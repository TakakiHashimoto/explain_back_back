import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import express, { type NextFunction, type Request, type Response } from "express";
import type { Server } from "node:http";

// No database, Clerk or OpenAI: every dependency with side effects is replaced.
// Run: bun test scripts/explanation.test.ts
let usageEvents: string[] = [];
let savedRows: unknown[] = [];
let openaiCalls = 0;
let limitReached = false;

mock.module("../src/middleware/require-user.js", () => ({
  requireUser: (req: Request, _res: Response, next: NextFunction) => {
    req.user = { id: "user-1" } as Request["user"];
    next();
  },
}));

mock.module("../src/features/usage/usage.service.js", () => ({
  reserveUsage: async () => {
    if (limitReached) {
      const { AppError } = await import("../src/lib/errors.js");
      throw new AppError("FREE_LIMIT_REACHED");
    }
    usageEvents.push("reserve");
    return "usage-1";
  },
  completeUsage: async (_id: string, succeeded: boolean) => {
    usageEvents.push(succeeded ? "succeeded" : "failed");
  },
}));

const fakeTx = {
  explanation: {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      savedRows.push(data);
      return { id: "explanation-1", createdAt: new Date(0), ...data };
    },
  },
};
mock.module("../src/lib/prisma.js", () => ({
  prisma: { $transaction: async (fn: (tx: typeof fakeTx) => unknown) => fn(fakeTx) },
}));

let openaiImpl: () => Promise<{ text: string }> = async () => ({ text: "real transcript" });
mock.module("../src/lib/ai/openai.js", () => ({
  openai: {
    audio: {
      transcriptions: {
        create: async () => {
          openaiCalls++;
          return openaiImpl();
        },
      },
    },
  },
}));

const { default: explanationRouter } = await import("../src/features/explanation/routes/explanation.routes.js");
const { AppError, sendError } = await import("../src/lib/errors.js");
const { readM4aDurationSec } = await import("../src/features/explanation/audio/m4aDuration.js");

/** Builds a minimal MP4 file: ftyp + moov/mvhd with the given duration. */
function makeM4a(durationSec: number, version: 0 | 1 = 0): Buffer {
  const timescale = 1000;
  const box = (type: string, payload: Buffer) => {
    const header = Buffer.alloc(8);
    header.writeUInt32BE(8 + payload.length, 0);
    header.write(type, 4, "latin1");
    return Buffer.concat([header, payload]);
  };
  let mvhd: Buffer;
  if (version === 0) {
    mvhd = Buffer.alloc(100);
    mvhd.writeUInt32BE(timescale, 12);
    mvhd.writeUInt32BE(Math.round(durationSec * timescale), 16);
  } else {
    mvhd = Buffer.alloc(112);
    mvhd.writeUInt8(1, 0);
    mvhd.writeUInt32BE(timescale, 20);
    mvhd.writeBigUInt64BE(BigInt(Math.round(durationSec * timescale)), 24);
  }
  return Buffer.concat([
    box("ftyp", Buffer.from("M4A \0\0\0\0M4A isom", "latin1")),
    box("mdat", Buffer.alloc(64)),
    box("moov", box("mvhd", mvhd)),
  ]);
}

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use("/api/v1/explanations", explanationRouter);
  // Same mapping as the error handler in src/app.ts
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) return sendError(res, err.code);
    sendError(res, "INTERNAL_ERROR");
  });
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  usageEvents = [];
  savedRows = [];
  openaiCalls = 0;
  limitReached = false;
  openaiImpl = async () => ({ text: "real transcript" });
  delete process.env.TRANSCRIPTION_DRY_RUN;
});

function post(audio: Buffer | null, fields: Record<string, string> = { topic: "React useEffect" }, type = "audio/m4a") {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  if (audio) form.append("audio", new Blob([new Uint8Array(audio)], { type }), "recording.m4a");
  return fetch(`${baseUrl}/api/v1/explanations`, { method: "POST", body: form });
}

describe("readM4aDurationSec", () => {
  test("reads version 0 and version 1 mvhd", () => {
    expect(readM4aDurationSec(makeM4a(42.5))).toBe(42.5);
    expect(readM4aDurationSec(makeM4a(90, 1))).toBe(90);
  });

  test("returns null for non-MP4 data", () => {
    expect(readM4aDurationSec(Buffer.from("not an audio file at all"))).toBeNull();
    expect(readM4aDurationSec(Buffer.alloc(0))).toBeNull();
  });
});

describe("POST /api/v1/explanations", () => {
  test("dry run (default) returns a fake transcript without calling OpenAI", async () => {
    const res = await post(makeM4a(30));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.transcript).toStartWith("[dry run]");
    expect(body.topic).toBe("React useEffect");
    expect(openaiCalls).toBe(0);
    expect(usageEvents).toEqual(["reserve", "succeeded"]);
    expect(savedRows).toHaveLength(1);
  });

  test("calls OpenAI only when TRANSCRIPTION_DRY_RUN is exactly false", async () => {
    process.env.TRANSCRIPTION_DRY_RUN = "FALSE";
    await post(makeM4a(30));
    expect(openaiCalls).toBe(0);

    process.env.TRANSCRIPTION_DRY_RUN = "false";
    const res = await post(makeM4a(30));
    expect(res.status).toBe(201);
    expect((await res.json()).transcript).toBe("real transcript");
    expect(openaiCalls).toBe(1);
  });

  test.each([
    ["too short", makeM4a(1)],
    ["too long", makeM4a(10 * 60)],
    ["not an MP4", Buffer.from("garbage")],
  ])("rejects %s audio before reserving usage", async (_name, audio) => {
    process.env.TRANSCRIPTION_DRY_RUN = "false";
    const res = await post(audio);

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("INVALID_AUDIO");
    expect(usageEvents).toEqual([]);
    expect(openaiCalls).toBe(0);
  });

  test("rejects a missing file, a wrong MIME type and a missing topic", async () => {
    expect((await post(null)).status).toBe(400);
    expect((await post(makeM4a(30), { topic: "x" }, "image/png")).status).toBe(400);
    expect((await post(makeM4a(30), {})).status).toBe(400);
    expect((await post(makeM4a(30), { topic: "   " })).status).toBe(400);
    expect(usageEvents).toEqual([]);
  });

  test("rejects a file over the size limit", async () => {
    const res = await post(Buffer.concat([makeM4a(30), Buffer.alloc(11 * 1024 * 1024)]));
    expect(res.status).toBe(400);
    expect(usageEvents).toEqual([]);
  });

  test("returns 429 at the usage limit without calling OpenAI", async () => {
    process.env.TRANSCRIPTION_DRY_RUN = "false";
    limitReached = true;
    const res = await post(makeM4a(30));

    expect(res.status).toBe(429);
    expect(openaiCalls).toBe(0);
  });

  test("gives the use back when OpenAI fails", async () => {
    process.env.TRANSCRIPTION_DRY_RUN = "false";
    openaiImpl = async () => {
      throw new Error("upstream down");
    };
    const res = await post(makeM4a(30));

    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe("TRANSCRIPTION_FAILED");
    expect(usageEvents).toEqual(["reserve", "failed"]);
    expect(savedRows).toHaveLength(0);
  });

  test("gives the use back when the transcript is empty (silence)", async () => {
    process.env.TRANSCRIPTION_DRY_RUN = "false";
    openaiImpl = async () => ({ text: "   " });
    const res = await post(makeM4a(30));

    expect(res.status).toBe(400);
    expect(usageEvents).toEqual(["reserve", "failed"]);
    expect(savedRows).toHaveLength(0);
  });
});

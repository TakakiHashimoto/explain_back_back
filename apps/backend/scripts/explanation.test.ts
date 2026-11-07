import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import type { Server } from "node:http";

// No database, Clerk or OpenAI: every dependency with side effects is replaced.
// Run: bun test scripts/explanation.test.ts
let usageEvents: string[] = [];
let savedRows: unknown[] = [];
let openaiCalls = 0;
let limitReached = false;
let analyzeFails = false;
let failedQuestionFor: string | null = null;
let committed = false;
let questionCalls: string[] = [];
let gapCount = 1;

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
      const relation = data.knowledgeGaps as {
        create: { concept: string; misconception: string; severity: number }[];
      };
      return {
        id: "explanation-1",
        createdAt: new Date(0),
        ...data,
        knowledgeGaps: relation.create.map((gap, i) => ({
          id: `gap-${i + 1}`,
          ...gap,
        })),
      };
    },
  },
};
mock.module("../src/lib/prisma.js", () => ({
  prisma: {
    $transaction: async (fn: (tx: typeof fakeTx) => unknown) => {
      const result = await fn(fakeTx);
      committed = true;
      return result;
    },
  },
}));

mock.module(
  "../src/features/explanation/analysis/analyzeExplanation.js",
  () => ({
    analyzeExplanation: async () => {
      if (analyzeFails) throw new Error("Analysis provider unavailable");
      return {
        strengths: [
          {
            concept: "effects",
            explanation: "Described the execution of effects",
          },
        ],
        gaps: Array.from({ length: gapCount }, (_, i) => ({
          concept: `missing concept ${i + 1}`,
          misconception: "Did not explain the mechanism",
          severity: 2,
        })),
        scores: { accuracy: 80, clarity: 75, completeness: 60, overall: 72 },
      };
    },
  }),
);

mock.module("../src/features/review/services/ensureReviewQuestion.js", () => ({
  ensureReviewQuestion: async (_userId: string, gapId: string) => {
    if (!committed)
      throw new Error("Question generation was invoked before commit");
    questionCalls.push(gapId);
    if (failedQuestionFor === gapId)
      throw new Error("Question provider unavailable");
    return { question: { id: `question-for-${gapId}` }, created: true };
  },
}));

let openaiImpl: () => Promise<{ text: string }> = async () => ({
  text: "real transcript",
});
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

const { default: explanationRouter } =
  await import("../src/features/explanation/routes/explanation.routes.js");
const { AppError, sendError } = await import("../src/lib/errors.js");
const { readM4aDurationSec } =
  await import("../src/features/explanation/audio/m4aDuration.js");

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
  analyzeFails = false;
  failedQuestionFor = null;
  committed = false;
  questionCalls = [];
  gapCount = 1;
  openaiImpl = async () => ({ text: "real transcript" });
  delete process.env.TRANSCRIPTION_DRY_RUN;
});

function post(
  audio: Buffer | null,
  fields: Record<string, string> = { topic: "React useEffect" },
  type = "audio/m4a",
) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  if (audio)
    form.append(
      "audio",
      new Blob([new Uint8Array(audio)], { type }),
      "recording.m4a",
    );
  return fetch(`${baseUrl}/api/v1/explanations`, {
    method: "POST",
    body: form,
  });
}

describe("readM4aDurationSec", () => {
  test("reads version 0 and version 1 mvhd", () => {
    expect(readM4aDurationSec(makeM4a(42.5))).toBe(42.5);
    expect(readM4aDurationSec(makeM4a(90, 1))).toBe(90);
  });

  test("returns null for non-MP4 data", () => {
    expect(
      readM4aDurationSec(Buffer.from("not an audio file at all")),
    ).toBeNull();
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
    expect(body.analysis.scores.overall).toBe(72);
    expect(body.knowledgeGaps[0].severity).toBe(2);
    expect(body.reviewGeneration).toEqual({
      generatedCount: 1,
      failedGapIds: [],
    });
    expect(questionCalls).toEqual(["gap-1"]);
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
    expect((await post(makeM4a(30), { topic: "x" }, "image/png")).status).toBe(
      400,
    );
    expect((await post(makeM4a(30), {})).status).toBe(400);
    expect((await post(makeM4a(30), { topic: "   " })).status).toBe(400);
    expect(usageEvents).toEqual([]);
  });

  test("rejects a file over the size limit", async () => {
    const res = await post(
      Buffer.concat([makeM4a(30), Buffer.alloc(11 * 1024 * 1024)]),
    );
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

  test("analysis failure persists nothing and releases reserved usage", async () => {
    analyzeFails = true;
    const response = await post(makeM4a(30));
    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe("ANALYSIS_FAILED");
    expect(usageEvents).toEqual(["reserve", "failed"]);
    expect(savedRows).toHaveLength(0);
    expect(questionCalls).toHaveLength(0);
  });

  test("review generation failure leaves committed explanation and retryable gap", async () => {
    failedQuestionFor = "gap-1";
    const response = await post(makeM4a(30));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.reviewGeneration).toEqual({
      generatedCount: 0,
      failedGapIds: ["gap-1"],
    });
    expect(committed).toBe(true);
    expect(savedRows).toHaveLength(1);
    expect(usageEvents).toEqual(["reserve", "succeeded"]);
  });

  test("one failing question does not block generation for subsequent gaps", async () => {
    gapCount = 3;
    failedQuestionFor = "gap-2";
    const response = await post(makeM4a(30));
    expect(response.status).toBe(201);
    expect((await response.json()).reviewGeneration).toEqual({
      generatedCount: 2,
      failedGapIds: ["gap-2"],
    });
    expect(questionCalls).toEqual(["gap-1", "gap-2", "gap-3"]);
    expect(usageEvents).toEqual(["reserve", "succeeded"]);
  });
});

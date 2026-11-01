import { afterAll, beforeAll, beforeEach, expect, mock, test } from "bun:test";
import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Request, Response, NextFunction } from "express";
import { AppError, type ErrorCode } from "../../src/lib/errors.js";

// Real Express HTTP + real requireUser/controller/evaluator/scheduling/service.
// Clerk identity, OpenAI transport, Prisma persistence and the usage service are mocked.
// No database is opened.
const now = new Date("2026-10-31T12:00:00.000Z");
const q = {
  id: "question-1",
  gapId: "gap-1",
  question: "When do Promise callbacks run?",
  createdAt: now,
  knowledgeGap: {
    id: "gap-1",
    concept: "Event loop",
    misconception: "private misconception",
    severity: 4,
  },
};
const evaluation = {
  score: 91,
  correct: true,
  feedback: "You explained the microtask queue.",
};
const parse = mock(async () => ({
  status: "completed",
  output_parsed: { ...evaluation },
}));
const userUpsert = mock(async () => ({
  id: "owner",
  authSubject: "clerk-owner",
}));
const findQuestion = mock(async (args: any) => {
  const ownerId =
    args.where.id === q.id
      ? "owner"
      : args.where.id === "other-users-question"
        ? "other-user"
        : null;
  if (!ownerId || args.where.knowledgeGap.explanation.userId !== ownerId)
    return null;
  if (args.select)
    return {
      id: q.id,
      question: q.question,
      knowledgeGap: { concept: q.knowledgeGap.concept },
    };
  return q;
});
let savedAttempts: any[] = [];
let savedSchedule: any = null;
const createAttempt = mock(async ({ data }: any) => {
  const attempt = {
    id: `attempt-${savedAttempts.length + 1}`,
    ...data,
    createdAt: now,
  };
  savedAttempts.push(attempt);
  return attempt;
});
const upsertSchedule = mock(async ({ create, update }: any) => {
  savedSchedule = savedSchedule
    ? { ...savedSchedule, ...update, updatedAt: now }
    : { id: "schedule-1", ...create, createdAt: now, updatedAt: now };
  return savedSchedule;
});
const transaction = mock(async (run: (tx: unknown) => unknown) => {
  const previousAttempts = [...savedAttempts];
  const previousSchedule = savedSchedule;
  try {
    return await run({
      reviewAttempt: { create: createAttempt },
      reviewSchedule: { upsert: upsertSchedule },
    });
  } catch (error) {
    savedAttempts = previousAttempts;
    savedSchedule = previousSchedule;
    throw error;
  }
});
const findDue = mock(async (args: any) =>
  savedSchedule && savedSchedule.nextReviewAt <= args.where.nextReviewAt.lte
    ? [
        {
          questionId: q.id,
          intervalDays: savedSchedule.intervalDays,
          nextReviewAt: savedSchedule.nextReviewAt,
          question: {
            id: q.id,
            question: q.question,
            knowledgeGap: { concept: q.knowledgeGap.concept },
          },
        },
      ]
    : [],
);
mock.module("../../src/lib/prisma.js", () => ({
  prisma: {
    user: { upsert: userUpsert },
    reviewQuestion: { findFirst: findQuestion },
    reviewSchedule: { findMany: findDue },
    $transaction: transaction,
  },
}));
mock.module("../../src/lib/ai/openai.js", () => ({
  openai: { responses: { parse } },
}));
mock.module("@clerk/express", () => ({
  clerkMiddleware: () => (_req: Request, _res: Response, next: NextFunction) =>
    next(),
  getAuth: (req: Request) => ({
    isAuthenticated: req.headers.authorization === "Bearer test-token",
    userId: "clerk-owner",
  }),
}));
const reserveUsage = mock(async () => "usage-1");
const completeUsage = mock(async () => {});
mock.module("../../src/features/usage/usage.service.js", () => ({
  getUsage: mock(async () => {
    throw new Error("not used in review tests");
  }),
  reserveUsage,
  completeUsage,
}));
const { app } = await import("../../src/app.js");
let server: Server;
let origin: string;
beforeAll(async () => {
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  if (server?.listening) {
    const closed = new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    server.closeAllConnections();
    await closed;
  }
});
beforeEach(() => {
  savedAttempts = [];
  savedSchedule = null;
  parse.mockClear();
  parse.mockResolvedValue({
    status: "completed",
    output_parsed: { ...evaluation },
  });
  userUpsert.mockClear();
  findQuestion.mockClear();
  transaction.mockClear();
  createAttempt.mockClear();
  upsertSchedule.mockClear();
  findDue.mockClear();
  reserveUsage.mockClear();
  reserveUsage.mockResolvedValue("usage-1");
  completeUsage.mockClear();
});
async function request(
  path: string,
  { token = "test-token", answer }: { token?: string; answer?: unknown } = {},
) {
  const response = await fetch(`${origin}/api/v1/${path}`, {
    method: answer === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(answer === undefined ? {} : { body: JSON.stringify({ answer }) }),
  });
  return { status: response.status, body: await response.json() };
}

test.each(["", "invalid-token"])(
  "missing/invalid simulated Clerk token %s rejects GET and POST before database/AI",
  async (token) => {
    expect((await request(`review-questions/${q.id}`, { token })).status).toBe(
      401,
    );
    expect(
      (
        await request(`review-questions/${q.id}/attempts`, {
          token,
          answer: "answer",
        })
      ).status,
    ).toBe(401);
    expect(userUpsert).not.toHaveBeenCalled();
    expect(findQuestion).not.toHaveBeenCalled();
    expect(parse).not.toHaveBeenCalled();
    expect(reserveUsage).not.toHaveBeenCalled();
  },
);

test("GET selects only safe fields and enforces internal-user ownership", async () => {
  const response = await request(`review-questions/${q.id}`);
  expect(response).toEqual({
    status: 200,
    body: {
      data: {
        id: q.id,
        question: q.question,
        knowledgeGap: { concept: "Event loop" },
      },
    },
  });
  expect(findQuestion).toHaveBeenCalledWith({
    where: { id: q.id, knowledgeGap: { explanation: { userId: "owner" } } },
    select: {
      id: true,
      question: true,
      knowledgeGap: { select: { concept: true } },
    },
  });
  expect(JSON.stringify(response.body)).not.toContain("misconception");
  expect(parse).not.toHaveBeenCalled();
});

test.each(["missing-question", "other-users-question"])(
  "GET and POST return 404 for %s without AI/persistence",
  async (id) => {
    expect((await request(`review-questions/${id}`)).status).toBe(404);
    expect(
      (await request(`review-questions/${id}/attempts`, { answer: "answer" }))
        .status,
    ).toBe(404);
    expect(
      findQuestion.mock.calls.every(
        ([args]) => args.where.knowledgeGap.explanation.userId === "owner",
      ),
    ).toBe(true);
    expect(parse).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
    expect(reserveUsage).not.toHaveBeenCalled();
  },
);

test.each(["", " \n", 42, null])(
  "invalid answer %# returns 400 before AI/persistence",
  async (answer) => {
    expect(
      (await request(`review-questions/${q.id}/attempts`, { answer })).status,
    ).toBe(400);
    expect(parse).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
    expect(reserveUsage).not.toHaveBeenCalled();
  },
);

test("POST uses real evaluator/scheduler/service and serializes the two persisted records; due refresh drops the question", async () => {
  savedSchedule = {
    id: "schedule-1",
    questionId: q.id,
    intervalDays: 1,
    nextReviewAt: new Date("2000-01-01T00:00:00.000Z"),
    createdAt: now,
    updatedAt: now,
  };
  expect((await request("reviews/due")).body.data).toHaveLength(1);
  const started = Date.now();
  const response = await request(`review-questions/${q.id}/attempts`, {
    answer: " After the stack clears. ",
  });
  expect(response.status).toBe(200);
  expect(response.body.data).toEqual(
    JSON.parse(
      JSON.stringify({
        attempt: savedAttempts[0],
        reviewSchedule: savedSchedule,
      }),
    ),
  );
  expect(savedAttempts[0]).toMatchObject({
    questionId: q.id,
    answer: "After the stack clears.",
    ...evaluation,
  });
  expect(savedSchedule.intervalDays).toBe(7);
  expect(savedSchedule.nextReviewAt.getTime()).toBeGreaterThanOrEqual(
    started + 7 * 86400000,
  );
  expect(savedSchedule.nextReviewAt.getTime()).toBeLessThanOrEqual(
    Date.now() + 7 * 86400000,
  );
  expect(parse).toHaveBeenCalledTimes(1);
  expect(transaction).toHaveBeenCalledTimes(1);
  expect(createAttempt).toHaveBeenCalledTimes(1);
  expect(upsertSchedule).toHaveBeenCalledTimes(1);
  expect(typeof response.body.data.reviewSchedule.nextReviewAt).toBe("string");
  expect((await request("reviews/due")).body.data).toEqual([]);
  expect(reserveUsage).toHaveBeenCalledWith("owner", "REVIEW");
  expect(completeUsage).toHaveBeenCalledWith(
    "usage-1",
    true,
    expect.anything(),
  );
});

test("invalid AI output is rejected before persistence", async () => {
  parse.mockResolvedValueOnce({
    status: "completed",
    output_parsed: { ...evaluation, score: 101 },
  });
  const originalError = console.error;
  console.error = () => {};
  try {
    const response = await request(`review-questions/${q.id}/attempts`, {
      answer: "answer",
    });
    expect(response.status).toBe(500);
    expect(transaction).not.toHaveBeenCalled();
    expect(savedAttempts).toEqual([]);
    expect(completeUsage).toHaveBeenCalledWith(
      "usage-1",
      false,
      expect.anything(),
    );
  } finally {
    console.error = originalError;
  }
});

test("transaction failure returns 500 instead of reporting saved feedback (simulated rollback)", async () => {
  upsertSchedule.mockRejectedValueOnce(new Error("simulated DB failure"));
  const originalError = console.error;
  console.error = () => {};
  try {
    const response = await request(`review-questions/${q.id}/attempts`, {
      answer: "answer",
    });
    expect(response.status).toBe(500);
    expect(savedAttempts).toEqual([]);
    expect(savedSchedule).toBeNull();
    expect(response.body).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Something went wrong." },
    });
    expect(completeUsage).toHaveBeenLastCalledWith(
      "usage-1",
      false,
      expect.anything(),
    );
  } finally {
    console.error = originalError;
  }
});

test.each<ErrorCode>(["FREE_LIMIT_REACHED", "USAGE_LIMIT_REACHED"])(
  "%s returns 429 before AI/persistence and leaves no usage to complete",
  async (code) => {
    reserveUsage.mockRejectedValueOnce(new AppError(code));
    const originalError = console.error;
    console.error = () => {};
    try {
      const response = await request(`review-questions/${q.id}/attempts`, {
        answer: "answer",
      });
      expect(response.status).toBe(429);
      expect(response.body.error.code).toBe(code);
      expect(reserveUsage).toHaveBeenCalledWith("owner", "REVIEW");
      expect(parse).not.toHaveBeenCalled();
      expect(transaction).not.toHaveBeenCalled();
      expect(completeUsage).not.toHaveBeenCalled();
      expect(savedAttempts).toEqual([]);
    } finally {
      console.error = originalError;
    }
  },
);

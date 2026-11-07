import { beforeEach, expect, mock, test } from "bun:test";
import type { Request, Response } from "express";
import { Prisma } from "../../src/generated/prisma/client.js";

// Isolated mock boundaries: no DB connection, network request or real AI call.
const now = new Date("2026-11-06T12:00:00Z");
const gap = { id: "gap", explanationId: "explanation", concept: "Event loop",
  misconception: "Promises run synchronously", severity: 4, createdAt: now };
const question = { id: "question", gapId: gap.id, question: "When do promises run?", createdAt: now };
let saved: typeof question | null = null;
let schedule: { questionId: string; intervalDays: number; nextReviewAt: Date } | null = null;
const findGap = mock(async ({ where }: any) => where.id === gap.id && where.explanation.userId === "owner"
  ? { ...gap, reviewQuestion: saved } : null);
const generate = mock(async () => question.question);
const uniqueError = () => new Prisma.PrismaClientKnownRequestError("Unique gapId", {
  code: "P2002", clientVersion: "test",
});
const create = mock(async ({ data }: any) => {
  if (saved) throw uniqueError();
  saved = { ...question, question: data.question };
  schedule = { questionId: saved.id, ...data.schedule.create };
  return saved;
});
const upsert = mock(async ({ create: initial }: any) => schedule ??= initial);

mock.module("../../src/lib/prisma.js", () => ({ prisma: {
  knowledgeGap: { findFirst: findGap }, reviewQuestion: { create },
  reviewSchedule: { upsert, findUnique: async () => schedule },
} }));
mock.module("../../src/features/review/generation/generateReviewQuestion.js", () => ({ generateQuestion: generate }));
const { ensureReviewQuestion } = await import("../../src/features/review/services/ensureReviewQuestion.js");
const { generateReviewQuestion } = await import("../../src/features/review/controllers/reviewQuestion.controller.js");

beforeEach(() => {
  saved = null;
  schedule = null;
  for (const fn of [findGap, generate, create, upsert]) fn.mockClear();
});

test("new generation writes a question and immediately due schedule in one nested write", async () => {
  const before = Date.now();
  const result = await ensureReviewQuestion("owner", "gap");
  expect(result).toEqual({ question, created: true });
  expect(generate).toHaveBeenCalledWith({ ...gap, reviewQuestion: null });
  expect(create.mock.calls[0]?.[0].data.schedule.create.intervalDays).toBe(1);
  expect(schedule!.nextReviewAt.getTime()).toBeGreaterThanOrEqual(before);
  expect(schedule!.nextReviewAt.getTime()).toBeLessThanOrEqual(Date.now());
  expect(upsert).not.toHaveBeenCalled();
});

test.each([["stranger", "gap"], ["owner", "missing"]])("rejects unowned or missing gap %s/%s before AI", async (userId, gapId) => {
  await expect(ensureReviewQuestion(userId, gapId)).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(generate).not.toHaveBeenCalled();
  expect(create).not.toHaveBeenCalled();
});

test("retries reuse the question and never reset a future answered schedule", async () => {
  await ensureReviewQuestion("owner", "gap");
  schedule = { questionId: question.id, intervalDays: 7, nextReviewAt: new Date("2030-01-01") };
  const existing = schedule;
  expect((await ensureReviewQuestion("owner", "gap")).created).toBe(false);
  expect(generate).toHaveBeenCalledTimes(1);
  expect(create).toHaveBeenCalledTimes(1);
  expect(upsert.mock.calls[0]?.[0].update).toEqual({});
  expect(schedule).toBe(existing);
});

test("repairs an existing question with no schedule without another AI call", async () => {
  saved = question;
  expect((await ensureReviewQuestion("owner", "gap")).created).toBe(false);
  expect(schedule!.questionId).toBe(question.id);
  expect(generate).not.toHaveBeenCalled();
});

test("schedule repair preserves a concurrently saved answer schedule after a unique conflict", async () => {
  saved = question;
  const answered = { questionId: question.id, intervalDays: 7, nextReviewAt: new Date("2030-01-01") };
  upsert.mockImplementationOnce(async () => { schedule = answered; throw uniqueError(); });
  expect((await ensureReviewQuestion("owner", "gap")).created).toBe(false);
  expect(schedule).toBe(answered);
});

test("AI failure leaves persistence untouched and a later retry works", async () => {
  generate.mockRejectedValueOnce(new Error("AI unavailable"));
  await expect(ensureReviewQuestion("owner", "gap")).rejects.toThrow("AI unavailable");
  expect(create).not.toHaveBeenCalled();
  expect(upsert).not.toHaveBeenCalled();
  expect(saved).toBeNull();
  expect((await ensureReviewQuestion("owner", "gap")).created).toBe(true);
});

test("nested-write failure propagates and does not perform a separate schedule write", async () => {
  create.mockRejectedValueOnce(new Error("Database unavailable"));
  await expect(ensureReviewQuestion("owner", "gap")).rejects.toThrow("Database unavailable");
  expect(upsert).not.toHaveBeenCalled();
  expect(saved).toBeNull();
});

test("concurrent generation recovers the unique-constraint winner", async () => {
  const results = await Promise.all([ensureReviewQuestion("owner", "gap"), ensureReviewQuestion("owner", "gap")]);
  expect(results.map((r) => r.created).sort()).toEqual([false, true]);
  expect(results[0]!.question.id).toBe(results[1]!.question.id);
  expect(schedule!.questionId).toBe(question.id);
  expect(findGap).toHaveBeenCalledTimes(3);
});

test("an unrecoverable unique failure is not reported as success", async () => {
  create.mockRejectedValueOnce(uniqueError());
  await expect(ensureReviewQuestion("owner", "gap")).rejects.toMatchObject({ code: "P2002" });
  expect(upsert).not.toHaveBeenCalled();
});

test("controller preserves created/reused status and its response envelope", async () => {
  const res = { status: mock((_code: number) => res), json: mock((_body: unknown) => res) };
  const next = mock(() => {});
  const req = { params: { gapId: "gap" }, user: { id: "owner" } };
  await generateReviewQuestion(req as unknown as Request, res as unknown as Response, next);
  expect(res.status).toHaveBeenLastCalledWith(201);
  expect(res.json).toHaveBeenLastCalledWith({ data: question });
  await generateReviewQuestion(req as unknown as Request, res as unknown as Response, next);
  expect(res.status).toHaveBeenLastCalledWith(200);
  expect(next).not.toHaveBeenCalled();
});

test("controller refuses unauthenticated requests without invoking generation", async () => {
  const res = { status: mock((_code: number) => res), json: mock((_body: unknown) => res) };
  await generateReviewQuestion({ params: { gapId: "gap" } } as unknown as Request, res as unknown as Response, mock(() => {}));
  expect(res.status).toHaveBeenCalledWith(401);
  expect(findGap).not.toHaveBeenCalled();
});

test("controller preserves the existing unowned-gap error response", async () => {
  const res = { status: mock((_code: number) => res), json: mock((_body: unknown) => res) };
  const next = mock(() => {});
  await generateReviewQuestion({ params: { gapId: "gap" }, user: { id: "stranger" } } as unknown as Request,
    res as unknown as Response, next);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(res.json).toHaveBeenCalledWith({ error: "Knowledge gap was not found" });
  expect(generate).not.toHaveBeenCalled();
  expect(next).not.toHaveBeenCalled();
});

import { expect, test } from "bun:test";
import { fakeEvaluateAnswer } from "../src/features/review/evaluation/fakeAnswerEvaluator.js";

test("defaults to a correct score of 90", async () => {
  expect(await fakeEvaluateAnswer("A closure keeps its scope")).toEqual({
    score: 90,
    correct: true,
    feedback: "[fake] score=90",
  });
});

test.each([
  [40, false],
  [84, false],
  [85, true],
])("score=%i marker sets the score and correct=%p", async (score, correct) => {
  const result = await fakeEvaluateAnswer(`my answer score=${score}`);
  expect(result).toMatchObject({ score, correct });
});

test("markers ignore case, as keyboards capitalize sentence starts", async () => {
  expect((await fakeEvaluateAnswer("It remembers. Score=60")).score).toBe(60);
  expect(fakeEvaluateAnswer("Fail")).rejects.toThrow();
});

test("clamps the score to 100", async () => {
  expect((await fakeEvaluateAnswer("score=150")).score).toBe(100);
});

test("fail marker throws like a failed evaluation", async () => {
  expect(fakeEvaluateAnswer("please fail now")).rejects.toThrow();
});

test("delay marker waits before answering", async () => {
  const started = Date.now();
  await fakeEvaluateAnswer("delay=200");
  expect(Date.now() - started).toBeGreaterThanOrEqual(190);
});

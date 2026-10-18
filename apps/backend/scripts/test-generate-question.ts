import assert from "node:assert/strict";
import type { KnowledgeGap } from "../src/features/review/types.js";

// Run from apps/backend: bun run scripts/test-generate-question.ts
// Calls the real OpenAI API using the existing generator and client settings.
const mockGap: KnowledgeGap = {
  id: "test-gap-001",
  concept: "JavaScript Event Loop",
  misconception:
    "Promise callbacks execute synchronously before the current call stack finishes.",
  severity: 4,
};

async function main() {
  // Import inside main so configuration/import failures reach the error handler.
  const { generateQuestion } =
    await import("../src/features/review/generation/generateReviewQuestion.js");

  console.log("Generating review question...");
  const question = await generateQuestion(mockGap);

  assert.equal(typeof question, "string", "Expected a question string");
  assert.ok(question.trim().length > 0, "Expected a nonempty question");
  assert.ok(question.length <= 1000, "Question exceeds 1000 characters");

  console.log("Generated question:", question);
  console.log("Type:", typeof question);
  console.log("PASS: OpenAI integration smoke test");
}

main().catch((error: unknown) => {
  // Avoid dumping SDK objects or credentials into terminal output.
  let message = error instanceof Error ? error.message : "Unknown error";
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) message = message.replaceAll(apiKey, "[REDACTED]");
  message = message.replace(/sk-[A-Za-z0-9_*-]+/g, "[REDACTED]");
  console.error("Generation failed:", message);
  process.exitCode = 1;
});

import "dotenv/config";
import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Request, Response, NextFunction } from "express";
import { mock } from "bun:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import type { KnowledgeGap } from "../src/features/review/types.js";
import { getTestDatabaseUrl } from "./test-database.js";

// Run from apps/backend: bun run scripts/test-review-question-route.ts
// Real HTTP + Prisma + PostgreSQL; simulated Clerk identity and AI generation.
// All database changes run inside a transaction that is always rolled back.
process.env.DATABASE_URL = getTestDatabaseUrl();
const question = "Why do Promise callbacks wait until the call stack is empty?";
const subject = `route-test-${crypto.randomUUID()}`;
const rollback = new Error("Rollback route-test fixtures");
const generatedGaps: KnowledgeGap[] = [];
let blockedOpenAIRequests = 0;

// Prevent accidental use of the real OpenAI client in this process.
process.env.OPENAI_API_KEY = "";
mock.module("../src/lib/ai/openai.js", () => ({
  openai: {
    responses: {
      parse: () => {
        blockedOpenAIRequests++;
        throw new Error("OpenAI requests are forbidden in this test");
      },
    },
  },
}));
mock.module("../src/features/review/generation/generateReviewQuestion.js", () => ({
  generateQuestion: async (gap: KnowledgeGap) => {
    generatedGaps.push(gap);
    return question;
  },
}));

// Keep the application's requireUser middleware, mocking only Clerk's boundary.
mock.module("@clerk/express", () => ({
  clerkMiddleware: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  getAuth: (req: Request) => ({
    isAuthenticated: req.headers.authorization === "Bearer route-test-token",
    userId: req.headers.authorization === "Bearer route-test-token" ? subject : null,
  }),
}));

async function main() {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL must be configured");
  const db = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000,
    }),
  });
  let server: Server | undefined;
  const originalFetch = globalThis.fetch;

  try {
    await db.$transaction(async (tx) => {
      // Route handlers and requireUser use the same real database transaction.
      mock.module("../src/lib/prisma.js", () => ({ prisma: tx }));
      const { app } = await import("../src/app.js");
      server = app.listen(0, "127.0.0.1");
      await once(server, "listening");
      const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

      // Only loopback HTTP requests are allowed; Prisma uses PostgreSQL directly.
      globalThis.fetch = ((input, init) => {
        const url = new URL(input instanceof globalThis.Request ? input.url : String(input));
        assert.equal(url.origin, baseUrl, "External HTTP requests are forbidden");
        return originalFetch(input, init);
      }) as typeof fetch;

      const owner = await tx.user.create({ data: { authSubject: subject } });
      const other = await tx.user.create({ data: { authSubject: `${subject}-other` } });
      async function createGap(userId: string) {
        const explanation = await tx.explanation.create({
          data: { userId, topic: "JavaScript Event Loop" },
        });
        return tx.knowledgeGap.create({
          data: {
            explanationId: explanation.id,
            concept: "JavaScript Event Loop",
            misconception: "Promise callbacks execute synchronously before the call stack finishes.",
            severity: 4,
          },
        });
      }
      const gap = await createGap(owner.id);
      const otherGap = await createGap(other.id);

      async function post(gapId: string, token?: string) {
        const response = await fetch(`${baseUrl}/api/v1/knowledge-gaps/${gapId}/review-questions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        return { status: response.status, body: await response.json() };
      }

      for (const token of [undefined, "invalid-test-token"]) {
        const result = await post(gap.id, token);
        assert.equal(result.status, 401);
        assert.equal(result.body.error.code, "UNAUTHENTICATED");
        console.log(`PASS: ${token ? "invalid" : "missing"} simulated authentication -> 401`);
      }
      for (const [label, id] of [["nonexistent", crypto.randomUUID()], ["not owned", otherGap.id]]) {
        const result = await post(id!, "route-test-token");
        assert.equal(result.status, 404);
        console.log(`PASS: ${label} knowledge gap -> 404`);
      }
      assert.equal(generatedGaps.length, 0);

      const created = await post(gap.id, "route-test-token");
      assert.equal(created.status, 201);
      assert.equal(created.body.data.gapId, gap.id);
      assert.equal(created.body.data.question, question);
      assert.equal(generatedGaps.length, 1);
      assert.equal(generatedGaps[0]?.id, gap.id);
      const saved = await tx.reviewQuestion.findUniqueOrThrow({ where: { gapId: gap.id } });
      assert.equal(saved.id, created.body.data.id);
      assert.equal(saved.question, question);
      console.log("PASS: fixed test question inserted into PostgreSQL -> 201");

      const existing = await post(gap.id, "route-test-token");
      assert.equal(existing.status, 200);
      assert.equal(existing.body.data.id, saved.id);
      assert.equal(generatedGaps.length, 1);
      assert.equal(await tx.reviewQuestion.count({ where: { gapId: gap.id } }), 1);
      assert.equal(blockedOpenAIRequests, 0);
      console.log("PASS: existing question returned without generation or duplicate insert -> 200");
      throw rollback;
    }, { timeout: 30000, maxWait: 5000 });
  } catch (error) {
    if (error !== rollback) throw error;
    assert.equal(await db.user.count({ where: { authSubject: { in: [subject, `${subject}-other`] } } }), 0);
    console.log("PASS: test transaction rolled back; no test data retained");
    console.log("PASS: OpenAI API requests = 0");
  } finally {
    globalThis.fetch = originalFetch;
    try {
      if (server?.listening) {
        await new Promise<void>((resolve, reject) => {
          server!.close((error) => {
            if (error && (error as NodeJS.ErrnoException).code !== "ERR_SERVER_NOT_RUNNING") reject(error);
            else resolve();
          });
          server!.closeAllConnections();
        });
      }
    } finally {
      await db.$disconnect();
    }
  }
}

main().catch((error: unknown) => {
  let message = error instanceof Error ? error.message : "Unknown error";
  for (const secret of [process.env.DATABASE_URL, process.env.CLERK_SECRET_KEY]) {
    if (secret) message = message.replaceAll(secret, "[REDACTED]");
  }
  console.error("FAIL:", message);
  process.exitCode = 1;
});

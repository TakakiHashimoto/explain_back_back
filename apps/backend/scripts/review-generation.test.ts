import { expect, test } from "bun:test";

// Keep Bun module mocks out of the PostgreSQL integration suites.
test("review generation: isolated service/controller tests", async () => {
  const child = Bun.spawn([process.execPath, "test",
    new URL("./test-support/review-generation.cases.test.ts", import.meta.url).pathname,
  ], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
  ]);
  if (stdout) console.log(stdout);
  if (stderr) console.log(stderr);
  expect(code).toBe(0);
}, 15_000);

import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

/** Runs one cases file in a child process and fails if any of its tests fail. */
async function runIsolated(casesFile: string) {
  const child = Bun.spawn(
    [
      process.execPath,
      "test",
      // fileURLToPath decodes %20 etc., so paths with spaces or non-ASCII characters work.
      fileURLToPath(new URL(`./test-support/${casesFile}`, import.meta.url)),
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (stdout) console.log(stdout);
  if (stderr) console.log(stderr);
  expect(code).toBe(0);
}

// Keep Bun module mocks (fake Prisma, Clerk) out of the other suites.
test("account deletion: isolated DELETE /me tests", async () => {
  await runIsolated("account-deletion.cases.test.ts");
}, 30_000);

// Real database (TEST_DATABASE_URL). Its own process so its Prisma client and fetch stub
// cannot leak into other DB suites (review-reminders relies on its own application_name).
test("account deletion: cascade on a real database", async () => {
  await runIsolated("account-deletion-cascade.cases.test.ts");
}, 30_000);

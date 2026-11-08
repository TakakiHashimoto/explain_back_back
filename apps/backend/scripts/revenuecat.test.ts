import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

// Keep Bun module mocks (fake Prisma) out of the other suites.
test("revenuecat: isolated sync / webhook tests", async () => {
  const child = Bun.spawn(
    [
      process.execPath,
      "test",
      // fileURLToPath decodes %20 etc., so paths with spaces or non-ASCII characters work.
      fileURLToPath(
        new URL("./test-support/revenuecat.cases.test.ts", import.meta.url),
      ),
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
}, 15_000);

import { expect, test } from 'bun:test';

// Bun module mocks persist across test files. Run the route fixtures in their
// own process so they cannot replace Prisma/Clerk in the existing DB suites.
test('review experience: isolated HTTP contract tests (mocked Clerk/OpenAI/Prisma)', async () => {
  const child = Bun.spawn([process.execPath, 'test',
    new URL('./test-support/review-experience.cases.test.ts', import.meta.url).pathname,
  ], { stdout: 'pipe', stderr: 'pipe' });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
  ]);
  if (stdout) console.log(stdout);
  if (stderr) console.log(stderr);
  expect(exitCode).toBe(0);
}, 15_000);

import { expect, test } from 'bun:test';

// Isolate hook/module mocks from the SDK and navigation tests.
test('identity bridge effects: isolated account lifecycle tests', async () => {
  const child = Bun.spawn([process.execPath, 'test',
    new URL('./test-support/identity.cases.ts', import.meta.url).pathname,
  ], { stdout: 'pipe', stderr: 'pipe' });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
  ]);
  if (stdout) console.log(stdout);
  if (stderr) console.log(stderr);
  expect(code).toBe(0);
}, 15_000);

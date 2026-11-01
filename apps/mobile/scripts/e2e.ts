/// <reference types="bun" />
// Runs the Maestro flows in apps/mobile/.maestro against the local backend.
// Usage (repo root): bun run e2e [scenario]   e.g. `bun run e2e one-due`
//
// Each `.maestro/<scenario>/` directory names the fixture it needs. Before every flow the
// fixtures are re-seeded, so flows never depend on each other's database changes.
// Flows named `*.offline.yaml` run with the backend port un-reversed (backend unreachable).
import { $ } from 'bun';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const MAESTRO_DIR = join(import.meta.dir, '../.maestro');
const BACKEND_DIR = join(import.meta.dir, '../../backend');
const BACKEND_URL = 'http://localhost:3000';
// Directory -> fixture scenario passed to `e2e:fixtures seed`.
const SEED_FOR: Record<string, string> = {
  empty: 'empty',
  'one-due': 'one-due',
  mixed: 'mixed',
  offline: 'one-due',
};

const installed = join(homedir(), '.maestro/bin/maestro');
const maestro = Bun.which('maestro') ?? (existsSync(installed) ? installed : null);
if (!maestro) throw new Error('Maestro CLI not found. Install it from https://maestro.dev');

// Refuse to run against the real evaluator: every submitted answer would call OpenAI.
const health = await fetch(`${BACKEND_URL}/health`)
  .then((res) => res.json())
  .catch(() => null);
if (!health?.fakeAiEvaluation) {
  throw new Error(
    'Start the backend with `bun run dev:e2e` (apps/backend) before running E2E flows',
  );
}

const only = process.argv[2];
const scenarios = Object.keys(SEED_FOR).filter((name) => !only || name === only);
if (scenarios.length === 0)
  throw new Error(`Unknown scenario "${only}". Use one of: ${Object.keys(SEED_FOR).join(', ')}`);

const results: { flow: string; passed: boolean }[] = [];

for (const scenario of scenarios) {
  const dir = join(MAESTRO_DIR, scenario);
  if (!existsSync(dir)) continue;
  const flows = readdirSync(dir)
    .filter((file) => file.endsWith('.yaml'))
    .sort();

  for (const flow of flows) {
    console.log(`\n=== ${scenario}/${flow}`);
    await $`bun run e2e:fixtures seed ${SEED_FOR[scenario]}`.cwd(BACKEND_DIR);

    const offline = flow.includes('.offline.');
    await (offline ? $`adb reverse --remove tcp:3000` : $`adb reverse tcp:3000 tcp:3000`).nothrow();

    const { exitCode } = await $`${maestro} test ${join(dir, flow)}`.nothrow();
    results.push({ flow: `${scenario}/${flow}`, passed: exitCode === 0 });

    if (offline) await $`adb reverse tcp:3000 tcp:3000`;
    // Show what the flow wrote, for the DB-side checks (attempt count, score, schedule).
    if (scenario === 'one-due') await $`bun run e2e:fixtures verify`.cwd(BACKEND_DIR);
  }
}

console.log('\n=== Summary');
for (const { flow, passed } of results) console.log(`${passed ? 'PASS' : 'FAIL'}  ${flow}`);
process.exit(results.every((result) => result.passed) ? 0 : 1);

# Evidence retained from the interrupted audit

These are **transcribed observations from tool results in this conversation**, not reconstructed raw logs. The interruption removed `/tmp/explain-back-qa-20261101`, including its test harnesses and logs. The source commit remained `9e3b345e64b767c94c9ef3962fcd06ad37c6bbda`; no implementation changes were made. Fresh retained logs are listed in `commands.jsonl`. Do not interpret the missing original files as still available artifacts.

All commands below ran through `/tmp/explain-back-qa-20261101/run.py`, which pinned TEST_DATABASE_URL to a new local QA cluster (port 55439, database explain_back_qa_20261101), substituted dummy OpenAI/OneSignal credentials, and redacted configured secrets. `http-*`, `additional-*`, `restart-*`, `prisma-*` labels set DATABASE_URL to that isolated database. Existing DB scripts selected TEST_DATABASE_URL through their own guard.

| Directory | Exact command | Exit | Observed result |
|---|---|---:|---|
| apps/backend | `bun run typecheck` | 0 | clean |
| apps/backend | `bunx --no-install tsc -p tsconfig.scripts.json` | 0 | clean |
| apps/backend | `bun run build` | 0 | compiled Node backend |
| apps/mobile | `bun run typecheck` | 2 initially; 0 after setup | missing react-native-purchases resolved by frozen install; stale profile/paywall route types resolved by offline Expo startup |
| root | `bun install --frozen-lockfile --ignore-scripts` | 1 sandbox; 0 outside sandbox | 14 locked packages installed; no manifest/lock changes |
| apps/mobile | `timeout --signal=INT 20s bunx --no-install expo start --offline --port 18081 --max-workers 2` | 124 | deliberate timeout after successful Metro startup; regenerated ignored route types |
| apps/mobile | `bunx --no-install expo export --platform android --output-dir /tmp/explain-back-qa-20261101/android-export --max-workers 2` | 0 | 2,129 modules; 7.7 MB Hermes bundle; 30 assets; 40.26 s |
| apps/mobile | `bun run lint` | 1 | Cannot find module eslint; missing declared lint dependencies |
| apps/backend | `bun run test` | 0 | 70 outer tests plus 14 nested HTTP tests; 0 failures. One outer case wraps the nested suite, so 83 substantive cases |
| apps/mobile | `bun run test` | 0 | 112 review + 6 notification tests; 0 failures |
| apps/backend | `bun run test:reminders` (two additional executions) | 0 each | 20 real PostgreSQL tests each, including overlapping workers and read-only CLI dry-run |
| apps/backend | `bun scripts/test-review-persistence.ts` | 0 | 5 PASS checkpoints: commits, same schedule upsert, invalid-date transaction rejection, unchanged state after rollback, cleanup |
| apps/backend | `bun scripts/test-review-question-route.ts` | 0 | 8 PASS checkpoints; real PostgreSQL/HTTP, simulated Clerk/generator, zero OpenAI requests |
| apps/mobile | `bun scripts/verify-due-reviews.ts` | 0 | 6 PASS checkpoints; real client/HTTP/PostgreSQL; simulated Clerk; rollback verified |
| apps/backend | `bunx --no-install prisma migrate deploy --config prisma7.config.ts` | 0 | all 4 migrations applied to empty isolated database |
| apps/backend | `bunx --no-install prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code --config prisma7.config.ts` | 0 | No difference detected |
| apps/backend | `bunx --no-install prisma generate --config prisma7.config.ts` | 0 | Prisma Client 7.10.0 generated |
| apps/backend | `bun /tmp/explain-back-qa-20261101/clerk-probe.ts` | 0 | actual Clerk middleware: missing/invalid/expired JWT 401; local RSA-signed valid JWT 200; no live Clerk session |
| apps/backend | `bun test /tmp/explain-back-qa-20261101/integration.test.ts` | 1 | 56 pass, 3 fail, 224 assertions; real HTTP, real Clerk verifier with ephemeral RSA keys, real PostgreSQL; mocked OpenAI |
| apps/backend | `bun test /tmp/explain-back-qa-20261101/restart.test.ts` | 0 | 8 pass, 20 assertions; compiled Node backend process restarts, real cancelled HTTP transport, DB outage/recovery, fake AI |
| apps/backend | `bun test /tmp/explain-back-qa-20261101/sdk-boundaries.test.ts` | 0 | 27 pass, 45 assertions; actual OpenAI SDK parsing mocked HTTP, OneSignal payload/error validation, real worker CLI connection failure |
| apps/backend | `bun test /tmp/explain-back-qa-20261101/database-constraints.test.ts` | 0 final | 5 pass, 8 assertions; uniqueness/FK/SQL rollback. Initial 1 pass/4 fail was a harness error: Bun expect.rejects requires a native Promise; wrapping Prisma thenables fixed the test only |
| apps/mobile | `bun test /tmp/explain-back-qa-20261101/mobile-harness/mobile-audit.test.ts` | 1 final | 3 pass, 5 fail, 14 assertions; mounted React 19.2.3 test renderer, mocked native controls/Clerk/fetch |

The initial mobile harness failed before running cases because its NativeWind mock covered only the CommonJS entry point. Adding the import mock fixed the harness. Those setup errors are not application defects or additional unique failed cases.

## Expanded HTTP observations

- Actual Clerk verifier rejected missing, malformed, expired, future-not-before, and tampered tokens. Valid signed subjects resolved to stable internal UUIDs.
- Due boundaries, ownership, chronological order, 20-item limit, DTO parsing by the actual mobile client, repeated-read stability, history filtering, and newest-first history passed.
- Empty/whitespace/null/numeric/array/object answers, nonexistent IDs, malformed JSON and 110,000-character JSON payloads were rejected before evaluation/persistence.
- Full API-client journey: initial attempt count 0 and interval 1; submission returned score 90, interval 7, nextReviewAt `2026-11-08T22:14:35.972Z`; attempt persisted, due item disappeared and history contained it.
- Invalid score range, fractional score, inconsistent correctness, blank feedback, incomplete response, simulated timeout and HTTP error left attempts/schedule unchanged and marked reserved usage FAILED.
- **Fail:** injected `Error('OpenAI HTTP failure QA_SYNTHETIC_SECRET_DO_NOT_LOG')` appeared unchanged in console.error. The HTTP client received only a generic safe response.
- **Fail:** generation returned one question but zero schedules and zero due reviews for the otherwise empty owner.
- **Fail:** authenticated development usage GET returned 33 records belonging to other fixture users.
- Two concurrent identical submissions with the same `Idempotency-Key` returned `[200,200]`, created 2 attempts, 1 schedule, and 2 quota charges. Sequential replay also created another attempt.
- Concurrent generation yielded 200/201 and one question per gap; malformed/empty/oversized/failed generation left no partial question.
- All score thresholds 0/49/50/69/70/84/85/100 and elapsed UTC-day scheduling across the Vancouver DST transition passed. Scheduling depends on score, not attempt ordinal.
- 22 concurrent FREE reservations yielded exactly 18 successes and 4 FREE_LIMIT_REACHED failures. Failed/stale reservations, window expiry, plan changes, and entitlement expiry passed.
- Each harness removed its owned fixture tree. External HTTP was blocked in the expanded HTTP harness; observed external calls = 0.

## Restart and database observations

- Compiled `node dist/server.js` accepted score=60 through its fake evaluator and persisted a 2-day schedule.
- Restarted process retrieved the same attempt ID `3bc6c309-fdc6-4203-a07f-eb7f90e5d67f`, schedule timestamp `2026-11-03T22:17:05.171Z`, and history entry.
- Stopped backend caused network failure; restarted backend recovered. A backend configured to unused database port 55438 returned generic 500; restoring the QA URL preserved all 3 prior attempts.
- Aborting the HTTP client 80 ms into `delay=200 score=85` still committed an attempt. Replaying committed a second attempt.
- Fake evaluation refused NODE_ENV=production startup. Dev routes were absent outside development. Generation remains available in production behind authentication (missing JWT returned 401).
- Real SQL FK failure after an attempt INSERT rolled the transaction back: attempts 0 -> 0, schedules 1 -> 1. Duplicate user subject, question gap, schedule question and same-day reminder constraints rejected writes.

## Mounted-component observations

- **Fail:** paywall made 6 entitlement requests after mount. Test capped the mock at the sixth request to stop the loop. Installed Clerk useAuth creates a new getToken function each render; paywall effect depends on that function and writes fresh state.
- **Pass:** profile focus load stayed at one request with changing getToken identity.
- **Pass:** notification bridge used internal-A rather than clerk-A and logged out on sign-out.
- **Pass:** delayed account-A bootstrap did not replace account-B notification identity.
- **Fail:** thrown native initialization error propagated from notifications.initialize().
- **Fail:** same-account parent rerender changed answer draft from `My draft answer` to `""`.
- **Fail:** definite FREE_LIMIT_REACHED 429 became `uncertain: true` with “Your answer may have been saved”.
- **Fail:** a stalled due-list fetch stayed in loading and installed no timeout; explicit abort was needed to finish the test. No claim of a measured 30-second device hang is made.

## Provider and CI observations

Actual OpenAI SDK parsing (transport mocked) rejected wrong field types, missing fields and malformed JSON. OneSignal tests verified internal-user targeting, persisted idempotency key, malformed-success rejection, argument rejection, and timeout propagation. The real worker CLI against a closed local DB port exited 1 with `Reminder job failed Notification processing failed`.

GitHub connector `fetch_commit_workflow_runs` returned no PR-triggered runs for this commit. Read-only `gh api repos/TakakiHashimoto/explain_back_back/actions/workflows/review-reminders.yml/runs` found historical run 40472154822 (main, workflow_dispatch, success, 2026-10-27T08:14:38Z). Its checkout/install/Prisma/worker steps succeeded. This is historical evidence, not a run of the audited development commit. No workflow was dispatched.

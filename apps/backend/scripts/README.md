# Notification verification

From `apps/backend`:

```sh
bun run typecheck
bunx tsc -p tsconfig.scripts.json
bun test scripts/notification-safety.test.ts
TEST_DATABASE_URL=postgresql://localhost/explain_reminders_test bun run test
TEST_DATABASE_URL=postgresql://localhost/explain_reminders_test bun run test:reminders
```

`TEST_DATABASE_URL` must point to an **isolated, migrated, disposable PostgreSQL
database**. Provision it separately and apply the existing migrations to that
database before running integration tests. The tests do not migrate or reset a
database. They never fall back to `DATABASE_URL`, reject a URL targeting the
configured application database, and clean up only their own random fixture IDs.
URL checks cannot establish isolation by themselves; do not supply production
credentials. The standalone persistence and route integration scripts use the
same guard. The default test command runs only `*.test.ts`, excluding the manual
OpenAI smoke script.

Notification HTTP calls are mocked. The CLI dry-run regression also uses a
read-only PostgreSQL connection and a preload that blocks every fetch request.

For a manual database connectivity check:

```sh
NOTIFICATION_DRY_RUN=true bun scripts/run-due-review-reminders.ts
```

This uses the configured `DATABASE_URL`, reads due reviews, and performs no
notification writes or sends. An explicit dry-run works at any UTC hour. Live
mode still skips before 11:00 UTC. GitHub Actions defaults to dry-run unless
`NOTIFICATION_DRY_RUN=false` is explicitly set; the manual and scheduled workflow at
`.github/workflows/review-reminders.yml` pins it to `true` and receives no
OneSignal credentials. That workflow requires the repository `DATABASE_URL`
secret to point to an already migrated database reachable by the runner. It
does not apply migrations. No workflow has been dispatched as part of this
local verification.

The workflow runs daily at **11:17 UTC / 20:17 JST** (`17 11 * * *`) for
the Japan-first MVP; the worker's live guard starts at 11:00 UTC. The workflow
is still pinned to dry-run, with no production OneSignal sends. See
[Engineer 2 handoff](../../../docs/engineer-2-handoff.md) for the full activation
procedure, retry limits, integration contract, and device verification checklist.

Focused tests that need no database or external service:

```sh
bun test scripts/review-generation.test.ts scripts/notification-safety.test.ts
bun test scripts/review-experience.test.ts
```

The second command binds a loopback HTTP server. The generation suite mocks
Prisma and AI; it exercises service/controller ownership, retries, schedule
repair and unique-constraint recovery. The manual
`bun scripts/test-review-question-route.ts` check additionally verifies the
initial due schedule with real PostgreSQL when an isolated `TEST_DATABASE_URL`
is supplied. It was not executed for this implementation task.

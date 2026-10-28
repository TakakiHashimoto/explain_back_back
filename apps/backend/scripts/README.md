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
mode still skips before 16:00 UTC. GitHub Actions defaults to dry-run unless
`NOTIFICATION_DRY_RUN=false` is explicitly set; the manual workflow at
`.github/workflows/review-reminders.yml` pins it to `true` and receives no
OneSignal credentials. That workflow requires the repository `DATABASE_URL`
secret to point to an already migrated database reachable by the runner. It
does not apply migrations. No workflow has been dispatched as part of this
local verification.

# Maestro E2E flows

Android emulator → local backend → database, with a fake AI evaluator (no OpenAI cost).

## One-time setup

1. Install the Maestro CLI: <https://maestro.dev> (installs to `~/.maestro/bin`).
2. In the Clerk dashboard (**development** instance), create two users with email only:
   - `e2e-user1+clerk_test@example.com`
   - `e2e-user2+clerk_test@example.com`

   `+clerk_test` addresses receive no email; the verification code is always `424242`
   (Clerk test mode, development instances only), so these values are safe to commit.

## Run

```sh
# terminal 1: backend with the fake evaluator (refuses to start with NODE_ENV=production)
bun run backend:e2e
# terminal 2: Metro + the Android dev build on a running emulator
bun run android
# terminal 3: all flows, or one scenario
bun run e2e
bun run e2e one-due
```

The runner (`apps/mobile/scripts/e2e.ts`) refuses to run unless `/health` reports
`fakeAiEvaluation: true`. Before each flow it re-seeds the fixtures of its directory.

## Layout

| Directory | Fixture (`bun run e2e:fixtures seed …`) | What it covers |
|---|---|---|
| `empty/` | user1 has nothing due | empty state |
| `one-due/` | user1 has 1 question due an hour ago | answer, feedback, loading, double tap, failure, account switch |
| `mixed/` | user1 has 1 due + 1 due in 3 days | due filtering |
| `offline/` | same as `one-due` | backend unreachable (`*.offline.yaml` run without `adb reverse tcp:3000`) |
| `common/` | — | sub-flows (sign in / out, open Review tab) |

user2 always has one due question of its own, so any flow can assert it never shows for user1.

## Fake evaluator markers

Type these in the answer text (`apps/backend/src/features/review/evaluation/fakeAnswerEvaluator.ts`):

| Marker | Result |
|---|---|
| none | score 90, correct |
| `score=NN` | score NN (`correct` when ≥ 85) → interval 1 / 2 / 4 / 7 days |
| `fail` | evaluation throws (HTTP 500) |
| `delay=NNNN` | waits NNNN ms first |

## Database checks

Maestro only sees the screen. For attempt counts, scores and schedules:

```sh
cd apps/backend
bun run e2e:fixtures verify            # user1's [e2e] questions, latest attempt, schedule
bun run e2e:fixtures make-due <id>     # move a question's nextReviewAt into the past
```

Fixtures only touch `+clerk_test` users and Explanations whose topic starts with `[e2e]`.

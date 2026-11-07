# Engineer 1 + Engineer 2 integration — MVP

## Goal

One user action (recording a spoken explanation) should produce a transcript,
AI understanding feedback, persisted knowledge gaps, and immediately available
spaced-repetition questions. The existing Engineer 2 review services remain the
sole owners of question creation, answer evaluation, schedules and reminders.

## Request and response

`POST /api/v1/explanations` requires the user's Clerk bearer token and
`multipart/form-data` fields `topic` (1–200 characters) and `audio` (m4a, 3–120
seconds, up to 10 MiB). The backend derives the **internal PostgreSQL UUID**
from `requireUser`; the client does not provide `userId`.

On success, HTTP 201 returns the existing explanation fields together with:

```json
{
  "id": "explanation-uuid",
  "topic": "React useEffect",
  "transcript": "...",
  "createdAt": "2026-11-07T00:00:00.000Z",
  "knowledgeGaps": [
    { "id": "gap-uuid", "concept": "cleanup", "misconception": "...", "severity": 2 }
  ],
  "analysis": {
    "strengths": [{ "concept": "...", "explanation": "..." }],
    "gaps": [{ "concept": "cleanup", "misconception": "...", "severity": 2 }],
    "scores": { "accuracy": 80, "clarity": 75, "completeness": 60, "overall": 72 }
  },
  "reviewGeneration": { "generatedCount": 1, "failedGapIds": [] }
}
```

The JSON above is an illustrative contract, not a real user's AI output.
`severity` is an **integer** (1 minor, 2 moderate, 3 major), matching Prisma.
The structured model response is checked with Zod before any database write.
Zero knowledge gaps is valid and yields zero initial questions.

## Under the hood

1. The Express route runs `requireUser` then Multer's memory-only parser.
2. The controller checks the MIME type and parses the MP4 `moov/mvhd` duration.
3. `reserveUsage` acquires a short transactional user-row lock and reserves one
   analysis use. This transaction completes before contacting OpenAI.
4. `transcribeAudio` sends the audio bytes to OpenAI; `analyzeExplanation`
   sends the resulting text and topic to the Responses API with a Zod output
   schema. Neither call runs in a database transaction.
5. One Prisma transaction writes the Explanation and nested KnowledgeGap rows,
   then marks the usage record successful. If this transaction fails, all those
   writes roll back together.
6. After Prisma returns successfully, the transaction has committed. Each
   persisted gap is passed to `ensureReviewQuestion(userId, gapId)`, which
   validates ownership, invokes question generation if needed, and atomically
   creates the ReviewQuestion plus initial ReviewSchedule.
7. The mobile result view shows the analysis and gaps. Newly due review
   questions appear in the existing Reviews tab after an authenticated refresh.

### Why question generation follows commit

`ensureReviewQuestion` reads the gap through a regular Prisma client. Calling
it while the gap is uncommitted in another transaction could return NOT_FOUND;
waiting for OpenAI inside the transaction would also unnecessarily hold a DB
connection and possibly locks. Post-commit generation makes each gap independently
retryable and avoids rolling back successful analysis because of a later AI
question-generation failure.

## Failure behavior and retries

| Failure | Persistent data | User-visible behavior |
| --- | --- | --- |
| Invalid upload | None | HTTP 400 |
| Usage limit | No explanation | HTTP 429 |
| Transcription failure/empty speech | No explanation; usage reservation marked failed | HTTP 502/400, recording retained on device for retry |
| Analysis failure | No explanation/gaps; usage reservation marked failed | HTTP 502, recording retained for retry |
| DB transaction failure | Explanation/gaps/usage success rolled back | HTTP 500 (usage reservation marked failed) |
| One question generation failure | Explanation and all gaps committed; successful questions preserved | HTTP 201 with `failedGapIds`; mobile offers retry |

The retry button invokes the existing authenticated
`POST /api/v1/knowledge-gaps/:gapId/review-questions`. `ensureReviewQuestion`
reuses existing questions and schedules without resetting a future due date.
Because no queue is introduced, a client that disappears before receiving the
201 response will not automatically retry failed gap IDs. An operational
backfill for old gaps can be added later without destructive migrations.

## Configuration and safety

- Backend uses `OPENAI_API_KEY` for transcription, analysis and questions.
- `TRANSCRIPTION_DRY_RUN=true` (the default) returns fake transcript text; set
  it to the literal `false` only when testing real speech-to-text intentionally.
  This flag does **not** suppress analysis or review-question OpenAI calls.
- `EXPLANATION_ANALYSIS_MODEL` optionally overrides the analysis model.
- **Notification sending remains disabled** via the workflow's literal
  `NOTIFICATION_DRY_RUN: "true"`.
- The worker's scheduled start is 11:17 UTC = 20:17 JST, with a live guard
  permitting execution from 11:00 UTC onward. GitHub may delay a scheduled run.
- The Profile screen advertises this common Japan-time schedule and no longer
  exposes a non-persistent personalized time picker.

## Validation completed locally

```sh
# In apps/backend
bunx prisma generate --config prisma7.config.ts
bun run typecheck
bun test scripts/explanation.test.ts
bun test scripts/notification-safety.test.ts scripts/review-generation.test.ts

# In apps/mobile
bun run typecheck
```

These checks mock OpenAI, Clerk, Prisma and OneSignal where needed. They do not
establish native recording, real OpenAI accuracy, actual DB write behavior,
Push delivery or cold-start navigation. A teammate must complete those tests.

## Known limitations for MVP review

1. Scores and strengths are returned to the current client session but are
   **not separately persisted** in the existing database schema. Knowledge gaps
   and the transcript are persisted. Showing past analysis reports requires an
   additive schema/API change.
2. Generation is synchronous and serial per gap: a slow OpenAI request may
   delay the 201 response. A persistent background queue is a later upgrade.
3. The existing unique gap-question constraint prevents duplicate question
   records, but simultaneous requests can still invoke the AI twice.
4. Repeated audio uploads are not request-idempotent; the client prevents
   duplicate taps, not multi-device or uncertain-result retries.
5. Per-user notification timezones are not supported; the time is fixed JST.

Do not turn on production sending, run migrations against production, or merge
into the team's default branch until the team reviews the implementation.

# MILESTONE 1 — REVIEW EXPERIENCE REPORT

## 1. Status

**COMPLETE — implementation and mocked automated verification.** Real-device, real-Clerk, live-AI, and real-PostgreSQL end-to-end verification remains outstanding; this report does not claim those checks passed.

Branch: `takaki/general-dev`. Before editing, `git status --short` and `git diff --stat` were empty. Phase 2.2 was already present in the checkout. Its authenticated due-review endpoint, Review tab, loading/error/empty/retry states, focus refresh, and cancellation were retained. No commits or pushes were made.

## 2. Features Implemented

- Due-question cards open `/review/[questionId]` with the selected server question ID.
- Direct links and reloads fetch the owned question independently of the due list.
- The answer screen displays the real question and concept, an editable multiline input, and a working submit action. The answer is held in React state through the screen hook.
- Empty answers show inline validation. A synchronous session guard prevents duplicate submissions even before React has rendered the disabled button.
- Submission sends a trimmed answer and Clerk Bearer token to the existing backend. The screen shows evaluation progress and safely handles authentication, missing questions, HTTP/network errors, and malformed responses.
- Feedback shows the persisted score, correctness, AI feedback, next review date/time in the device locale, and review interval.
- Back to Review returns to the existing tab, whose existing focus effect fetches the due list again.
- GET question requests have a 30-second deadline; submission has a 120-second deadline, including token acquisition and response parsing. No POST automatically retries.
- Ambiguous POST failures retain the answer, explain that it may have been saved, and disable another submission on that screen. Definite rejection permits an explicit user retry.
- Account/session/question changes discard previous state. Unmount and explicit return cancel local waiting and suppress obsolete results.

The existing card, typography, color, spacing, input, and button tokens remain in use. Dummy concept/question data, fake profile imagery, fake counters, static navigation controls, and the nonfunctional voice control were removed from the live question screen. Voice recording was not added.

## 3. Files Changed

Paths below are repository-relative. “New” files are untracked and must be included when reviewing this change.

| File | Responsibility |
| --- | --- |
| `apps/backend/src/features/review/routes/review.router.ts` | Registers authenticated GET question route alongside existing POST attempts route. |
| `apps/backend/src/features/review/controllers/getReviewQuestion.controller.ts` — new | Ownership-filtered question lookup with a minimal safe projection and 404 for missing/unowned questions. |
| `apps/backend/scripts/review-experience.test.ts` — new | Runs backend contract tests in a subprocess to isolate Bun module mocks from existing database suites. |
| `apps/backend/scripts/test-support/review-experience.cases.test.ts` — new | Real loopback Express requests with mocked Clerk identity, OpenAI transport, and Prisma; exercises real application handlers, evaluator, scheduler, and persistence service. |
| `apps/mobile/src/app/(protected)/review/[questionId]/index.tsx` | Fixes `qeustionId`; normalizes route parameters and supplies the selected ID. |
| `apps/mobile/src/features/review/api/api.review.ts` | Shares existing authenticated transport; adds GET question and POST answer APIs, runtime DTO validation, request deadlines, and ambiguous-submission errors. |
| `apps/mobile/src/features/review/types.ts` | Adds safe question-detail and persisted-result DTO types with serialized timestamp strings. |
| `apps/mobile/src/features/review/hooks/reviewSession.ts` — new | React-independent question lifecycle, answer state transitions, duplicate guard, failure handling, and cancellation. |
| `apps/mobile/src/features/review/hooks/useReviewQuestion.ts` — new | Holds React state and owns session creation/disposal. |
| `apps/mobile/src/features/review/screen/DueReviewsScreen.tsx` | Connects question selection to Expo Router. |
| `apps/mobile/src/features/review/screen/DueReviewsView.tsx` | Makes real due-question cards selectable without replacing existing list states. |
| `apps/mobile/src/features/review/screen/ReviewQuestionClient.tsx` | Replaces static preview with Clerk guard, question/session identity, screen hook, and return navigation. |
| `apps/mobile/src/features/review/screen/ReviewQuestionView.tsx` — new | Question, answer form, loading/error/progress states, persisted feedback, and return button. |
| `apps/mobile/src/features/review/api/reviewFixtures.test-support.ts` — new | Typed synthetic question/result fixtures and deferred promises for tests. |
| `apps/mobile/src/features/review/api/reviewQuestion.test.ts` — new | Tests authentication, paths/bodies, runtime validation, failures, deadlines, cancellation, and no automatic retries. |
| `apps/mobile/src/features/review/hooks/reviewSession.test.ts` — new | Tests state transitions, duplicate prevention, cancellation, stale responses, failure recovery, and refresh data flow. |
| `apps/mobile/src/features/review/screen/DueReviewsView.test.tsx` | Preserves existing tests and adds route/selection/answer/feedback/authentication/focus-refresh tests with mocked native/router boundaries. |
| `docs/milestone-1-review-experience-report.md` — new | This review report. |

No dependency, lockfile, migration, OneSignal implementation, notification worker/scheduling, or GitHub Actions file changed. The existing backend evaluation, scheduling, and transaction implementation were reused unchanged. Legacy unused mobile dummy/action files remain untouched and are not imported by the implemented flow.

## 4. Architecture

1. Review tab calls existing `GET /api/v1/reviews/due` with Clerk's session JWT.
2. Selecting a card passes its `questionId` into the dynamic Expo route.
3. The question screen waits for Clerk, redirects signed-out users, and keys the authenticated component by user, session, and question ID.
4. `useReviewQuestion` creates a session and fetches `GET /api/v1/review-questions/:questionId`.
5. Backend `requireUser` resolves the internal user. The query filters through `knowledgeGap.explanation.userId` and selects only question ID/text and concept.
6. The screen accepts an answer, validates it, and locks submission synchronously before awaiting `POST /api/v1/review-questions/:questionId/attempts`.
7. The existing backend rechecks ownership, passes the answer/question/knowledge gap to the existing OpenAI evaluator, validates its output, and calls the existing scheduler.
8. `saveReviewResult` creates the attempt and upserts the schedule inside the existing Prisma transaction. Only the resolved transaction result is returned.
9. Express serializes the persisted records. The mobile API checks field types, IDs, score bounds, positive integer interval, nonempty strings, and canonical ISO timestamps before constructing typed DTOs.
10. Feedback uses those records directly. The mobile app does not evaluate correctness or calculate the next review date.
11. Back to Review uses `router.dismissTo('/(tabs)/reviews')`. The retained `useDueReviews` focus effect makes a new GET, so a rescheduled item disappears according to the server's due query.

**Why add GET by ID:** the due endpoint is capped at 20 and only contains currently due questions. A selected question can disappear from that list after scheduling, and navigation memory does not survive reloads. Refetching the due list would therefore be an unreliable detail lookup. The new small endpoint is independent of due status and returns the same 404 for missing and unowned IDs. It never selects the misconception, severity, explanation/transcript, or hidden evaluation instructions.

Expo SDK 57 documentation was read as required by `apps/mobile/AGENTS.md`. `dismissTo` replaces the current screen when its target is absent from history, and `useFocusEffect` reruns when the route gains focus. These support direct-link return navigation and list refresh. [Expo SDK 57 Router reference](https://docs.expo.dev/versions/v57.0.0/sdk/router/).

## 5. API Contracts

Base URL: `EXPO_PUBLIC_API_URL`. All three endpoints require:

```http
Authorization: Bearer <Clerk session JWT>
Accept: application/json
```

The JSON below shows the actual field shapes verified through code inspection and mocked HTTP serialization. Values are illustrative test values, not live user records; database IDs are strings, normally UUIDs.

**Existing due list**

```http
GET /api/v1/reviews/due
```

```json
{
  "data": [{
    "questionId": "question-123",
    "intervalDays": 1,
    "nextReviewAt": "2026-10-31T12:00:00.000Z",
    "question": {
      "id": "question-123",
      "question": "When do Promise callbacks execute?",
      "knowledgeGap": { "concept": "Event loop" }
    }
  }]
}
```

**New question detail**

```http
GET /api/v1/review-questions/question-123
```

```json
{
  "data": {
    "id": "question-123",
    "question": "When do Promise callbacks execute?",
    "knowledgeGap": { "concept": "Event loop" }
  }
}
```

Success is 200. Missing/unowned question is 404:

```json
{ "error": { "code": "NOT_FOUND", "message": "Not found." } }
```

**Existing submission, unchanged backend contract**

```http
POST /api/v1/review-questions/question-123/attempts
Content-Type: application/json
```

```json
{ "answer": "After the stack clears." }
```

200 response:

```json
{
  "data": {
    "attempt": {
      "id": "attempt-1",
      "questionId": "question-123",
      "answer": "After the stack clears.",
      "score": 91,
      "correct": true,
      "feedback": "You identified the microtask queue.",
      "createdAt": "2026-10-31T12:00:00.000Z"
    },
    "reviewSchedule": {
      "id": "schedule-1",
      "questionId": "question-123",
      "intervalDays": 7,
      "nextReviewAt": "2026-11-07T12:00:00.000Z",
      "createdAt": "2026-10-01T12:00:00.000Z",
      "updatedAt": "2026-10-31T12:00:00.000Z"
    }
  }
}
```

Existing POST controller errors remain unchanged:

- 400 invalid answer: `{ "error": "Answer must be a non-empty string" }`.
- 404 missing/unowned question: `{ "error": "review question was not found" }`.
- Router authentication failure, 401: `{ "error": { "code": "UNAUTHENTICATED", "message": "Authentication required." } }`.
- App-level internal error, 500: `{ "error": { "code": "INTERNAL_ERROR", "message": "Something went wrong." } }`.

The client maps HTTP status to safe messages instead of displaying arbitrary error bodies. A malformed success response is not treated as success. Network failures, timeout, malformed POST responses, and unclassified HTTP failures are conservatively ambiguous. No POST retry occurs automatically.

## 6. Important Code

Actual ownership-filtered selection:

```ts
const question = await prisma.reviewQuestion.findFirst({
  where: { id: questionId, knowledgeGap: { explanation: { userId: req.user.id } } },
  select: { id: true, question: true, knowledgeGap: { select: { concept: true } } },
});
if (!question) return void sendError(res, "NOT_FOUND");
res.json({ data: question });
```

Actual session submission guard, evaluated synchronously before any await:

```ts
if (disposed || state.status !== 'ready' || state.submission.status === 'submitting'
  || state.submission.status === 'success'
  || (state.submission.status === 'error' && state.submission.uncertain)) return;
```

Actual one-request submission path:

```ts
return await withDeadline(signal, timeoutMs, async (requestSignal) => parseReviewResult(
  await requestReviewJSON(`/api/v1/review-questions/${encodeURIComponent(questionId)}/attempts`,
    getToken, requestSignal, answer.trim()), questionId,
));
```

Actual cancellation cleanup:

```ts
return () => { current.dispose(); session.current = null; };
```

The session's `dispose()` marks it inactive and aborts its request; publication also checks the disposed flag. Backend cancellation is not assumed: aborting a client request cannot roll back a server commit.

Actual return action:

```tsx
onReturn={() => { cancel(); router.dismissTo('/(tabs)/reviews'); }}
```

The existing `useDueReviews` focus subscription remains unchanged and is exercised by the new simulated-focus test.

## 7. Test Results

Commands were executed from the repository root unless noted.

| Exact command | Final result | Evidence and limits |
| --- | --- | --- |
| `bun run --cwd apps/mobile typecheck` | PASS, exit 0 | Mobile application and included test TypeScript compile. |
| `bun run --cwd apps/backend typecheck` | PASS, exit 0 | Backend source compiles; its tsconfig excludes scripts. |
| `bun run --cwd apps/mobile test` | PASS: 112 review tests + 4 existing notification tests; 0 failures | Includes existing Phase 2.2 API/load/view coverage and new question API/session/UI tests. All network/auth/native boundaries are mocked. |
| `bun test apps/backend/scripts/review-experience.test.ts` | PASS: 12 isolated HTTP cases, plus 1 subprocess wrapper assertion | Real Express loopback HTTP and application logic; simulated Clerk identity, OpenAI transport, and Prisma. Verifies safe GET projection, ownership filters, 401/404/400 behavior, actual JSON field shape, evaluator validation, transaction service calls, simulated rollback, and due-list refresh after schedule update. |
| `bun test apps/backend/scripts/notification-safety.test.ts` | PASS: 41 existing tests; 0 failures | Existing error-safety, scheduler policy, and test-database guard regression checks. No real notifications or database writes. |
| `git diff --check` | PASS, exit 0 | No whitespace errors in tracked diff. |

Focused new coverage includes:

1. Real due-card selection and correct dynamic route/ID; normalization of scalar/array/missing route parameters.
2. Safe authenticated question retrieval, real supplied question/concept rendering, and no dummy question substitution.
3. Controlled multiline input and callback wiring; empty-answer rejection before HTTP.
4. Clerk token header, configured base URL, encoded question ID, trimmed JSON answer, and persisted response parsing.
5. Score/correctness/feedback/date/interval rendering from the server result.
6. Synchronous duplicate-tap protection, post-success submission protection, and no automatic POST retry.
7. Authentication failures, 404, 400, 429, 5xx, network loss, invalid JSON/fields/timestamps/IDs, long evaluation, and timeout.
8. Cancellation during token acquisition, late success/failure after disposal, obsolete GET suppression, and account/session/question identity changes.
9. Return navigation to Review, a fresh GET on simulated focus, blur cancellation, and an updated mock due list after successful persistence flow.
10. Backend GET and POST ownership enforcement before AI or persistence, plus exclusion of sensitive fields from GET.

UI tests inspect actual JSX with mocked native primitives and use React DOM server rendering to register the real hook callbacks. Router focus is explicitly simulated. These do not mount a native device UI or prove physical keyboard/layout/navigation behavior.

Initial test runs found two whitespace-sensitive JSX assertions and a missing `react-dom/server` declaration in the test harness. The assertions now normalize tree text, and the test types its one existing React DOM API without adding dependencies. Final mobile checks pass.

The initial sandboxed backend HTTP test could not bind loopback (`EPERM`). The same mocked test was then run with permitted loopback access and passed. No external service or real database was involved.

`TEST_DATABASE_URL` was checked without printing credentials and is not configured. Existing real-database scripts (`test-review-persistence.ts`, `test-review-question-route.ts`, and the reminder database suite) were not run. The aggregate backend `test` command was not run because it includes that database suite. No production database records were modified, and no live OpenAI requests were made.

## 8. Bugs Found

- **Wrong route parameter:** `qeustionId` did not match `[questionId]`. Fixed the spelling and added safe missing/array handling.
- **Static answer preview:** ignored the route ID, used dummy data, disabled the input, and had no working submission. Replaced with authenticated loading, controlled answer state, real submission, and persisted feedback.
- **Unselectable due cards:** cards were plain Views. Changed them to Pressables connected to the selected question ID.
- **No reliable detail lookup:** the due list could not support reloads or questions outside its current result window. Added a small safe, owned GET endpoint.
- **Unprotected detail screen:** the `(protected)` directory name alone provided no authentication guard. The question screen now waits for Clerk and redirects signed-out users.

The existing backend evaluation, schedule calculation, and transaction service required no production changes.

## 9. Remaining Risks

- No real Clerk JWT, live OpenAI response, real PostgreSQL commit/rollback, or physical-device session was exercised. The HTTP tests prove handler/service behavior against mocks, not infrastructure operation.
- The backend has no idempotency key or attempt-status recovery endpoint. Same-screen duplicate taps and automatic retries are prevented, but manual resubmission after remount, another device, or a lost response can still create another attempt. Refreshing may race an evaluation still running on the server.
- Leaving the screen or reaching the client deadline does not cancel backend evaluation/persistence. The UI states this while processing and treats uncertain outcomes conservatively.
- Draft answers and feedback are in memory. Reloading can retrieve the question, but does not restore an unsent draft or a prior result; persisted-history recovery is outside this milestone.
- Native keyboard avoidance, accessibility announcements, real stack/deep-link behavior, and styling still need device checks. A signed-out deep link redirects to sign-in; preservation of the original destination after sign-in was not added.
- If using Expo web from a separate origin, the backend/proxy must permit that origin. The existing app has no explicit CORS middleware; browser cross-origin deployment was not verified or changed.
- The existing due query returns at most 20 items; this milestone does not introduce pagination.

## 10. Git Status

Working tree started clean on `takaki/general-dev`. All changes below remain unstaged and uncommitted. `git diff --stat` only includes tracked changes; the untracked inventory is also provided.

`git status --short`:

```text
 M apps/backend/src/features/review/routes/review.router.ts
 M apps/mobile/src/app/(protected)/review/[questionId]/index.tsx
 M apps/mobile/src/features/review/api/api.review.ts
 M apps/mobile/src/features/review/screen/DueReviewsScreen.tsx
 M apps/mobile/src/features/review/screen/DueReviewsView.test.tsx
 M apps/mobile/src/features/review/screen/DueReviewsView.tsx
 M apps/mobile/src/features/review/screen/ReviewQuestionClient.tsx
 M apps/mobile/src/features/review/types.ts
?? apps/backend/scripts/review-experience.test.ts
?? apps/backend/scripts/test-support/review-experience.cases.test.ts
?? apps/backend/src/features/review/controllers/getReviewQuestion.controller.ts
?? apps/mobile/src/features/review/api/reviewFixtures.test-support.ts
?? apps/mobile/src/features/review/api/reviewQuestion.test.ts
?? apps/mobile/src/features/review/hooks/reviewSession.test.ts
?? apps/mobile/src/features/review/hooks/reviewSession.ts
?? apps/mobile/src/features/review/hooks/useReviewQuestion.ts
?? apps/mobile/src/features/review/screen/ReviewQuestionView.tsx
?? docs/milestone-1-review-experience-report.md
```

`git diff --stat`:

```text
 .../src/features/review/routes/review.router.ts    |   2 +
 .../app/(protected)/review/[questionId]/index.tsx  |  16 +-
 apps/mobile/src/features/review/api/api.review.ts  | 133 ++++++++++-
 .../features/review/screen/DueReviewsScreen.tsx    |   6 +-
 .../features/review/screen/DueReviewsView.test.tsx | 165 +++++++++++++-
 .../src/features/review/screen/DueReviewsView.tsx  |   9 +-
 .../review/screen/ReviewQuestionClient.tsx         | 250 ++-------------------
 apps/mobile/src/features/review/types.ts           |  20 ++
 8 files changed, 340 insertions(+), 261 deletions(-)
```

Untracked implementation/test files (not counted by `git diff --stat`):

```text
  15 lines  apps/backend/scripts/review-experience.test.ts
 142 lines  apps/backend/scripts/test-support/review-experience.cases.test.ts
  21 lines  apps/backend/src/features/review/controllers/getReviewQuestion.controller.ts
  17 lines  apps/mobile/src/features/review/api/reviewFixtures.test-support.ts
 134 lines  apps/mobile/src/features/review/api/reviewQuestion.test.ts
 103 lines  apps/mobile/src/features/review/hooks/reviewSession.test.ts
  76 lines  apps/mobile/src/features/review/hooks/reviewSession.ts
  21 lines  apps/mobile/src/features/review/hooks/useReviewQuestion.ts
  85 lines  apps/mobile/src/features/review/screen/ReviewQuestionView.tsx
```

The report itself is also untracked. Total inventory: 8 modified tracked files and 10 new files, including this report.

## 11. Definition of Done

| Requirement | Status and evidence |
| --- | --- |
| Real question displayed | Implemented; GET DTO, supplied-data rendering, and route ID tests pass. Live user data not exercised. |
| User can enter an answer | Implemented; controlled multiline field and state/callback tests pass. Device typing check pending. |
| Answer reaches the backend | Authenticated client POST contract and actual Express HTTP route both tested. A single real-device-to-server session is unverified. |
| AI evaluation is returned | Existing real evaluator invoked in HTTP tests with mocked OpenAI structured output. No live AI call. |
| Attempt is persisted | Existing Prisma transaction service reused and its create call/result tested against mocked persistence. Actual PostgreSQL commit unverified here. |
| Next review schedule is updated | Existing scheduler and transaction upsert exercised; returned persisted schedule drives feedback. Actual PostgreSQL update unverified here. |
| Feedback is displayed | Score, correctness, AI text, next date, and interval rendering tests pass. |
| Due-review list refreshes | Existing focus refetch retained; simulated-focus and updated due-list flow tests pass. Native focus transition pending. |
| Authentication and ownership are enforced | Client guards and backend requireUser/filter tests pass with simulated Clerk identity. Real JWT verification pending. |
| Relevant automated tests pass | Both TypeScript checks and the executed mobile/backend suites pass. Real-database suites were not run. |

All implementation criteria are satisfied. Infrastructure and physical-device acceptance remain explicit verification tasks rather than claimed test results.

## 12. Next Step

Use a development build and a disposable migrated test database:

1. Sign in with a real Clerk session, open a due card, and confirm the displayed ID/question/concept match that user's record.
2. Open the same route directly and reload; verify owned access succeeds and a second account receives 404. Verify missing/expired authentication fails.
3. Enter an answer on-device, submit once, rapidly tap again, and verify one attempt and the updated schedule in the test database. Compare feedback/date/interval with the HTTP response and persisted records.
4. Return using Back to Review and the platform back gesture/button; confirm the due list refreshes and the completed item disappears.
5. Check slow evaluation, lost connection after POST, navigation away, and account switching. Confirm no automatic resubmission and no old result shown under a new question/account.
6. Verify iOS/Android keyboard, safe-area spacing, scrolling, and accessibility behavior. If targeting web, verify origin/CORS configuration and direct-route hosting behavior.
7. Run the existing persistence integration script with an explicitly isolated `TEST_DATABASE_URL`. Perform one deliberate live-AI development check only when intended; the automated suites require no live AI calls.

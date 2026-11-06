# Engineer 2 — Review & Retention handoff

Status: **COMPLETE EXCEPT FOR EXTERNAL INTEGRATION** for the requested Engineer 2
scope. Implementation and focused local checks are complete. End-to-end product
completion still requires Engineer 1's post-persistence call, a native Android
test, and approved deployment/notification activation. No live sends, database
operations, migrations, repository setting changes, commits or pushes were
performed during this task. Existing `docs/qa-evidence/` was preserved.

## Findings and decisions

| Component | Initial state | Result |
| --- | --- | --- |
| GitHub workflow | Manual only; dry-run pinned; shared concurrency already present | Added provisional daily `17 0 * * *`; kept manual trigger and all safety settings |
| Production question endpoint | Already mounted at `POST /api/v1/knowledge-gaps/:gapId/review-questions`, with `requireUser` | Reused; not restricted to development |
| Question generation | Ownership and unique-gap recovery embedded in controller | Extracted `ensureReviewQuestion(userId, gapId)` for production callers |
| First review discovery | New questions had no schedule; due API reads schedules only | Question and immediately due schedule now created atomically |
| Existing questions | Could exist without schedules | Calling the service repairs missing schedule; preserves existing schedule |
| Engineer 1 persistence | No production explanation-analysis/gap-persistence implementation found in `src` | Exact service boundary below; no speculative analysis endpoint |
| Answer/evaluation/history | Authenticated routes, usage reservation, validation, transaction, score-based schedule present | Preserved; existing HTTP regressions passed |
| Repeat reviews | Focus refresh and `nextReviewAt <= now` selection present | Preserved; first schedule now makes questions discoverable |
| Worker | Due selection, internal UUID targeting, UTC daily key, claims, leases, retries and sanitization present | Preserved |
| Notification click | No listener or payload discriminator | Added `data.type`, native click subscription and auth/router gate |
| Identity | Backend UUID used; old identity could survive a direct account switch/bootstrap failure | Clear old identity before bootstrap and during cleanup; abort stale requests; key lifetime by session |
| Permissions | Real profile switch calls `enable`/`disable` and requests OS permission on opt-in | Preserved |
| Native delivery/cold launch | Code exists, device behavior not verified in this task | Required external verification; unit tests do not establish native delivery |

## Engineer 1 integration contract

After the transaction that persists the Explanation and its integer-severity
KnowledgeGap rows **commits**, invoke the Engineer 2 service for each persisted
gap, using the authenticated internal PostgreSQL `User.id`:

```ts
import { ensureReviewQuestion } from "../review/services/ensureReviewQuestion.js";

// userId is derived from requireUser/authenticated server context.
// persistedGapIds come from your committed persistence result.
for (const gapId of persistedGapIds) {
  await ensureReviewQuestion(userId, gapId);
}
```

The import is relative to the caller; adjust its path, not the service contract.
This example specifies no explanation-analysis request/response JSON shape.
Engineer 1 must supply the committed gap IDs and authenticated internal user ID,
and decide how its existing flow surfaces generation failures and retries.
Do not call this inside a transaction holding uncommitted gaps: the service reads
through the normal Prisma client and makes an external AI request.

Return value: `{ question: ReviewQuestion, created: boolean }`. The existing HTTP
endpoint returns `{ data: question }`, with 201 on creation and 200 on reuse.
Missing/unowned gaps produce `AppError("NOT_FOUND")`; the HTTP controller
preserves its existing 404 `{ error: "Knowledge gap was not found" }` response.
Blank service arguments produce `BAD_REQUEST`.
Clerk authentication remains mandatory at the HTTP boundary.

Behavior:

1. `ensureReviewQuestion` reads the gap through `explanation.userId` ownership.
2. An existing question is reused; a missing schedule is upserted with an empty
   update, so an answered question's future date is preserved. Unique conflicts
   during repair accept the concurrently persisted schedule.
3. Otherwise `generateQuestion(gap)` calls the existing AI service and validates
   its output. Severity remains an integer; no schema/migration changes.
4. `prisma.reviewQuestion.create` uses a nested schedule create, committing both
   or neither. The initial `intervalDays` is 1 (compatible with existing DTOs),
   with `nextReviewAt` set to creation time: this is an immediately available
   first question, not a claimed one-day wait. No attempt or score is invented.
5. Unique `ReviewQuestion.gapId` arbitrates competing generators. A losing call
   rechecks ownership and returns the winner. Concurrent callers can make more
   than one AI request, but cannot persist duplicate questions for a gap.
6. AI errors leave the committed gap unchanged and cause no question/schedule
   write. A retry is safe. Successful earlier gaps in a batch remain usable;
   the caller must retain failed gap IDs for retry. No queue was introduced.

The service and endpoint are ready now. Automatic generation on explanation
completion is **not wired**, because the owning implementation/contract is
absent. Existing orphaned questions are repaired on service invocation; no
bulk production backfill was executed.

## Runtime call flows

### KnowledgeGap → question → first due review

`Engineer 1 post-commit caller` (pending integration) OR
`POST /api/v1/knowledge-gaps/:gapId/review-questions`
→ `requireUser` → `generateReviewQuestion` controller
→ `ensureReviewQuestion` → owned gap lookup → `generateQuestion`
→ Prisma nested question/schedule create.

`DueReviewsScreen` → `useDueReviews` focus effect → `loadDueReviews`
→ mobile `getDueReviews` → authenticated `GET /api/v1/reviews/due`
→ `requireUser` → `getDueReviewsController` → backend `getDueReviews`.
The API returns up to 20 due schedules ordered by date; more can appear as
earlier questions are answered and the list refreshes.

### Answer → attempt → later schedule

`ReviewQuestionClient` → `useReviewQuestion` → `createReviewSession.submit`
→ `submitReviewAnswer` → `POST /api/v1/review-questions/:questionId/attempts`
→ `requireUser` → `reviewAnswers` (owned question lookup)
→ `reserveUsage` → `evaluateAnswer` → `scheduleReview`
→ `saveReviewResult` transaction:
`reviewAttempt.create` + `reviewSchedule.upsert` + `completeUsage`.

Scores below 50/70/85, or at least 85, schedule 1/2/4/7 days respectively.
The returned persisted records drive feedback. Returning to Review triggers
another authenticated fetch. The question reappears when due again.

Existing transaction and unique schedule constraint preserve DB consistency
for concurrent submissions; separate accepted requests represent separate
attempts, with the last schedule write winning. The mobile session blocks
duplicate taps and uncertain-result retries. There is no server request-key
deduplication or exactly-once answer-submission guarantee; this was not added
without a request contract. The current scheduler depends on score/time, not
an increment of a previous interval, so there is no lost interval increment.
History remains available at `GET /api/v1/reviews/history` → `getHistory`.

### Scheduler → worker → OneSignal

GitHub `schedule` or `workflow_dispatch`
→ `bun scripts/run-due-review-reminders.ts` → `runReminderJob`
→ `sendDueReviewReminders` → `getUsersWithDueReviews(now)`.

Current dry-run stops here after logging eligible users/counts. It creates no
reminder records and makes no OneSignal HTTP request.

Approved live mode additionally runs:
`createReminder` → `claimReminder` → `sendReviewReminder`
→ `finishReminder`; errors → `markReminderFailed`.

Existing protection layers: shared workflow concurrency group (manual and
scheduled runs), unique `(userId, reminderDate)` per UTC date, conditional DB
claim, two-minute lease, claim-token-guarded completion, stable OneSignal
idempotency key, ten-second HTTP timeout. A failed reminder can be reclaimed
after 30 minutes; an expired processing lease can be reclaimed; maximum three
claims per reminder. These remain useful even for workers outside Actions.

A daily cron does **not** automatically retry 30 minutes later. Approved manual
reruns in the same UTC date/live window reuse the same reminder/key; the next
UTC day creates a new daily reminder. Daily eligibility is based on actual run
time, so delayed runs need no exact-minute logic.

### Android tap → authenticated current due list

`sendReviewReminder` attaches `data: { type: "due_review_reminder" }`
→ native OneSignal click event → `notifications.onClick`
→ `NotificationNavigationBridge` → `reviewReminderId`
→ `createReviewReminderNavigation.receive`.

After Clerk loads with a signed-in user/session and `useRootNavigationState`
reports a root key: `consume` → `router.replace('/(tabs)/reviews', reminder)`
→ `DueReviewsScreen` → fresh authenticated due fetch as above.
The reminder ID changes the screen's React key so even an already-focused tab
refetches. Repeated SDK delivery of a recently handled ID is ignored.

The listener is registered during root mount, including while Clerk loads.
This uses the installed OneSignal 5.5.15 click API for warm and native-delivered
cold-start clicks. Real terminated-app delivery remains unverified; there is
no invented polling or unsupported get-initial-notification API.

Signed-out launch waits on the normal protected sign-in UI and then opens the
current account's due list. Pending intent from an already authenticated
session is discarded on logout, user change or session change. Payload user
IDs, question IDs and URLs are never used. A newly tapped old notification can
only open the current authenticated user's generic list; it grants no access
to the old account. Unknown/untyped old payloads retain their prior behavior
(open the app without review routing). Old mobile builds can ignore the added
`data` field.

`NotificationIdentityBridge` → Clerk token → authenticated `GET /api/v1/me`
→ `notifications.login(internal UUID)`. Cleanup aborts old requests and logs
OneSignal out. Failed/expired bootstrap leaves the old identity detached.
Due-fetch 401/403 uses the existing actionable session error; Clerk sign-out
returns to the auth route. Permission is requested only through the existing
Profile reminder switch, not at launch.

## Automatic schedule and activation guide

Current: daily **00:17 UTC**, `17 0 * * *`, a provisional operational choice
from the task brief. No local timezone/DST adjustment is applied. Reminder
deduplication also uses UTC dates. The worker retains its existing live guard:
**before 16:00 UTC it skips live processing**. Therefore changing only the
dry-run flag on this cron would normally send nothing.

GitHub schedules run from the default branch and can be delayed or dropped;
they are not precise timers. Review source: [GitHub schedule documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

The following steps are for an authorized maintainer **after explicit approval**;
none were performed here:

1. Review and commit these changes, open a PR from `takaki/general-dev`, and
   merge through the team's process into the repository's actual default branch.
   Confirm Actions and this workflow are enabled. Merely keeping the workflow
   on a development branch does not activate the cron.
2. Confirm `DATABASE_URL` is set in GitHub Actions secrets, targets the intended
   already-migrated DB, and is reachable by runners. Confirm required tables
   and constraints exist. This workflow only generates Prisma Client; it never
   migrates the DB. Check an approved dry-run dispatch and its eligibility log.
3. Deploy the backend payload/generation changes and build a native Android
   app containing the click listener. Expo Go and web skip native OneSignal.
   Verify OneSignal/FCM setup and that the server's OneSignal app ID matches
   mobile `APP_ID` (`4ef89c9c-db70-4019-9b48-5cbd71f70e87`). The app ID is public;
   the REST API key must remain server-only.
4. With separate approval for a controlled test send to a test account/device,
   verify permission opt-in, internal UUID identity, receipt, warm/background/
   terminated taps, delayed Clerk hydration, signed-out sign-in, expired auth,
   account switching, and refresh while Reviews is already open. Verify an
   unrelated notification does not route. A force-stopped Android app is a
   separate OS condition from an ordinary terminated app; record it separately.
5. Choose/approve the live UTC schedule. To retain the current worker window,
   change cron to `17 16 * * *` (daily 16:17 UTC), or another approved time at or
   after 16:00 UTC. Keep existing concurrency and claim logic. Do not remove the
   guard merely to make the provisional 00:17 cron send.
6. Add/confirm Actions secrets `ONESIGNAL_APP_ID` and `ONESIGNAL_REST_API_KEY`.
   In the **Run notification worker** step, explicitly set:

   ```yaml
   env:
     DATABASE_URL: ${{ secrets.DATABASE_URL }}
     NOTIFICATION_DRY_RUN: "false"
     ONESIGNAL_APP_ID: ${{ secrets.ONESIGNAL_APP_ID }}
     ONESIGNAL_REST_API_KEY: ${{ secrets.ONESIGNAL_REST_API_KEY }}
   ```

   This activates sending for every eligible user selected by the existing
   worker; it is not a test-user allowlist. Do this only after device validation
   and approval of the intended production audience.
7. Perform an approved manual live run inside the UTC window; inspect summary,
   persisted status and OneSignal acceptance/delivery separately. Provider
   acceptance is not proof of device delivery. Monitor the first scheduled run.
8. For failures, an approved same-day rerun after 30 minutes can retry within
   the existing three-claim limit. To disable sending, restore literal
   `NOTIFICATION_DRY_RUN: "true"` (and remove the secret bindings if desired).
   Leave cron enabled for safe eligibility observation, or disable it through
   the approved operational process.

## Validation and remaining dependencies

Commands executed from `apps/backend`:

```sh
bun run typecheck
bunx tsc -p tsconfig.scripts.json
bun test scripts/review-generation.test.ts scripts/notification-safety.test.ts
bun test scripts/review-experience.test.ts
```

Commands executed from `apps/mobile`:

```sh
bun run test
bun test src/features/notifications
bun run typecheck
```

Results by substantive test suite (child-process wrapper checks excluded):

| Suite | Passed | Final failures |
| --- | ---: | ---: |
| Generation service/controller, including concurrent schedule repair | 13 | 0 |
| Notification payload, worker safety and configuration guards | 42 | 0 |
| Existing Express review contracts | 14 | 0 |
| Mobile reviews, including already-focused reminder refresh | 113 | 0 |
| Native SDK adapter (mocked) | 9 | 0 |
| Notification navigation state | 12 | 0 |
| Identity bridge effect callbacks | 4 | 0 |

Backend source/scripts and mobile TypeScript checks pass. Initial new test
fixtures had TypeScript cast errors, corrected before final checks. The first
HTTP suite invocation failed because the sandbox denied loopback `listen`
(`EPERM`); it passed when rerun with permitted loopback access. No application
test failure remains. Database-dependent suites were intentionally not run.

At repository root, `git diff --check` passed. The workflow was parsed using
`Bun.YAML.parse` with assertions for the cron, retained manual trigger, shared
concurrency, literal string `NOTIFICATION_DRY_RUN: "true"`, and absence of
OneSignal credential bindings. YAML syntax/configuration was validated locally;
no GitHub runner execution was claimed.

Focused checks use mocked OpenAI, Clerk, Prisma and OneSignal boundaries. They
exercise ownership, generation failure, initial scheduling, reuse/repair,
unique-conflict recovery, payload classification, delayed auth/router readiness,
session switching, native listener registration/cleanup and fresh due fetching.
Identity effect tests execute callbacks with mocked hooks; they do not mount
React Native. Existing HTTP review regressions use real Express on loopback.

The PostgreSQL route script now asserts initial scheduling and unchanged dates
on reuse, but was not run. No real PostgreSQL concurrency test, OpenAI generation,
Clerk exchange, OneSignal send, Android build/device test, or GitHub dispatch was
performed. No database was read, changed, reset or migrated during this task.

Additional product observations outside this contract: the Profile reminder-time
picker is local UI state and does not persist or control worker timing; there is
no agreed per-user timezone/time preference API. The history API exists, while
the requested mobile milestone is the due-question-answer-feedback flow. These
should not be advertised as completed personalized scheduling/history UI.

Primary integration references: [Expo 57 Router](https://docs.expo.dev/versions/v57.0.0/sdk/router/)
and [OneSignal mobile click events](https://documentation.onesignal.com/docs/en/mobile-sdk-reference#addclicklistener-push).
Installed SDK source/types were inspected for the actual listener API.

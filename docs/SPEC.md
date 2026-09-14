# Explain It Back — Team Product & Engineering Specification

> **Status:** Foundation complete; team architecture and vertical-slice development next  
> **Project:** RevenueCat Shipaton  
> **Team size:** 3 engineers  
> **Primary goal:** Ship a polished learning product while deliberately practicing serious full-stack engineering.

---

# 0. How to Use This Document

This document is the shared source of truth for **Explain It Back**.

Use it when the team needs to answer questions such as:

- What exactly are we building?
- What is the core user experience?
- What belongs on mobile vs backend?
- How does audio become text?
- How does AI analysis work?
- How should authentication and authorization work?
- How should reviews and notifications work?
- What should RevenueCat own?
- What should the database represent?
- What APIs do we expect?
- What does each engineer own?
- What must be decided by the whole team?
- What should we build first?
- What should we explicitly avoid?
- How should we handle failures?
- What does “done” mean for a feature?
- What should the final Shipaton demo show?

This is **not** intended to freeze every implementation detail forever.

It defines:

1. Product direction
2. Architectural boundaries
3. Shared terminology
4. Team responsibilities
5. Core contracts
6. Engineering principles
7. Delivery priorities

Implementation details may evolve, but changes to core concepts should be discussed by the team and reflected here.

---

# 1. Product Vision

## 1.1 Core Idea

**Explain It Back** is a mobile learning app where users explain a concept they just learned.

The app then:

1. Transcribes the explanation
2. Analyzes the user's understanding
3. Finds strengths
4. Finds missing concepts
5. Finds misconceptions
6. Scores the explanation
7. Generates follow-up questions
8. Evaluates later answers
9. Schedules future review
10. Reminds the user to revisit weak concepts

The product should feel like:

> “A tutor that listens to how I explain something, identifies what I *think* I understand but actually misunderstand, and makes me retrieve it again later.”

It should **not** feel like:

> “Another chat box where I type a prompt and receive generic AI feedback.”

---

# 2. Product Magic Moment

The most important moment in the product is the discovery of a subtle misunderstanding.

Example:

```text
User:
"I understand React useEffect."

User explanation:
"useEffect runs after render, and React watches the
variables in the dependency array."

App:

"You correctly understand that effects run after render.

However, your explanation suggests that you think React
'watches' variables.

React actually compares the dependency values from the
current render with the values from the previous render.

Let's test that."
```

This is the core product value.

Everything else exists to support this moment and turn it into long-term retention.

---

# 3. Core Product Loops

The entire application can be thought of as three connected loops.

## 3.1 Loop A — Learn

```text
Choose/create topic
        ↓
Record explanation
        ↓
Upload audio
        ↓
Speech-to-text
        ↓
Analyze understanding
        ↓
Show:
- strengths
- gaps
- misconceptions
- scores
        ↓
Generate follow-up questions
```

## 3.2 Loop B — Retain

```text
Knowledge gap
        ↓
Follow-up question
        ↓
User answers
        ↓
AI evaluates answer
        ↓
Show feedback
        ↓
Schedule next review
        ↓
Push notification later
        ↓
Deep link into review
        ↓
Recall again
```

## 3.3 Loop C — Monetize

```text
Install
        ↓
Sign up
        ↓
Use free product
        ↓
Reach free limit
        ↓
Paywall
        ↓
Purchase
        ↓
RevenueCat entitlement
        ↓
Pro access
```

---

# 4. Locked Technology Stack

## 4.1 Mobile

```text
React Native
Expo
TypeScript
Expo Router
TanStack Query
```

Potentially:

```text
Zustand
```

only when there is a genuine client-global-state problem.

Do not use Zustand for server state that belongs in TanStack Query.

---

## 4.2 Backend

```text
Node.js
TypeScript
Express
Prisma
PostgreSQL
```

---

## 4.3 External Services

Current direction:

```text
Clerk       → Authentication
OpenAI      → Speech-to-text + analysis + evaluation
RevenueCat  → Purchases / entitlements
OneSignal   → Push notifications
Supabase    → Managed PostgreSQL hosting
```

Supabase is being used as **PostgreSQL hosting**, not as the frontend data-access architecture.

The mobile app should not directly perform Supabase table queries.

---

# 5. Repository Structure

Current repository:

```text
explain-back/
├── apps/
│   ├── backend/
│   └── mobile/
├── packages/
├── package.json
├── package-lock.json
└── .gitignore
```

Important naming:

```text
apps/backend
package: @explain-it-back/backend

apps/mobile
package: @explain-it-back/mobile
```

Do not rename `backend` to `api` merely to match examples from tutorials.

Architecture examples are not folder-name commandments.

---

# 6. Current Foundation Status

The shared repository foundation is considered complete.

```text
Monorepo / npm workspaces                 ✓
Root development commands                ✓
Expo SDK / Expo Router                    ✓
React Native + TypeScript                 ✓
Backend Express + TypeScript              ✓
Development /health                       ✓
Production build /health                  ✓
.env ignored                              ✓
.env.example documented                   ✓
Supabase PostgreSQL project               ✓
DATABASE_URL available                    ✓
Prisma 7 installed                        ✓
Prisma config valid                       ✓
```

This is the correct point to hand the repository to the team.

Do **not** continue centrally installing every future integration “just in case.”

Feature-specific integrations should be introduced by the engineer who owns that slice.

---

# 7. High-Level System Architecture

```text
                         ┌─────────────────────┐
                         │       Clerk         │
                         │   authentication    │
                         └──────────┬──────────┘
                                    │ token
                                    │
┌───────────────────────────────────▼────────────────────────────┐
│                      Expo Mobile App                           │
│                                                                │
│  Topics → Record → Processing → Analysis → Review → Paywall    │
│                                                                │
│  Audio recording        TanStack Query       RevenueCat SDK    │
│                                                                │
└───────────────┬────────────────────────────────┬───────────────┘
                │ HTTPS                          │ purchase flow
                │                               ▼
                │                     ┌──────────────────────┐
                │                     │     RevenueCat       │
                │                     └──────────┬───────────┘
                │                                │ webhook
                ▼                                ▼
┌───────────────────────────────────────────────────────────────┐
│                    Express Backend                            │
│                                                               │
│ Authentication                                                │
│ Authorization                                                 │
│ Input validation                                              │
│ Business logic                                                │
│ AI orchestration                                              │
│ Entitlement enforcement                                       │
│ Persistence                                                   │
│                                                               │
│   ├── Topic                                                   │
│   ├── Explanation                                             │
│   ├── Review                                                  │
│   ├── Subscription                                            │
│   └── Notification                                            │
│                                                               │
│          │                    │                    │          │
│          ▼                    ▼                    ▼          │
│       Prisma               OpenAI              OneSignal      │
└──────────┬────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────┐
│ PostgreSQL/Supabase  │
└──────────────────────┘
```

---

# 8. Fundamental Boundary Model

The most important general engineering model for the project is:

```text
UNTRUSTED EXTERNAL INPUT
        ↓
BOUNDARY
        ↓
AUTHENTICATION / VALIDATION
        ↓
TRUSTED DOMAIN REPRESENTATION
        ↓
BUSINESS LOGIC
        ↓
PERSISTENCE
        ↓
API RESPONSE
        ↓
MOBILE UI
```

External input includes:

- User input
- Mobile requests
- Uploaded audio
- Clerk tokens
- OpenAI output
- RevenueCat webhooks
- OneSignal callbacks
- Any other external API

External data should never silently become trusted application data.

---

# 9. Authentication and Application Identity

## 9.1 Identity Model

Clerk proves external identity.

Our application owns application identity.

```text
Clerk identity
      ↓
auth subject
      ↓
our User record
      ↓
internal UUID
```

Conceptually:

```text
User
- id UUID
- authSubject UNIQUE
- createdAt
- updatedAt
```

All domain tables should generally reference:

```text
User.id
```

not Clerk IDs.

Example:

```text
Topic.userId
ExplanationSession.userId
ReviewAttempt.userId
ReviewSchedule.userId
```

depending on final schema decisions.

---

## 9.2 Authentication vs Authorization

Authentication answers:

> Who are you?

Authorization answers:

> Are you allowed to perform this operation on this resource?

Example:

```text
Clerk verifies token
        ↓
authenticated identity
        ↓
map to internal User
        ↓
load Topic
        ↓
does Topic belong to this User?
        ↓
ALLOW / DENY
```

Clerk does not know whether a topic belongs to a particular user.

That is our backend's job.

---

## 9.3 Never Trust Client Ownership Claims

Bad:

```json
{
  "userId": "some-user-id",
  "title": "React"
}
```

Better:

```http
Authorization: Bearer <token>
```

```json
{
  "title": "React"
}
```

Backend derives the authenticated user from the verified token.

---

# 10. Audio Recording — What Actually Happens

This section exists because audio is new territory for the team.

## 10.1 Recording on the Device

The phone microphone receives sound waves and converts them into a digital audio signal.

Conceptually:

```text
human voice
    ↓
air pressure changes
    ↓
microphone
    ↓
electrical signal
    ↓
analog-to-digital conversion
    ↓
digital samples
    ↓
encoded audio file
```

The React Native application does not receive spoken words directly.

It receives a local audio file.

Conceptually:

```text
file:///.../recording.m4a
```

The application therefore holds:

```text
recordingUri
```

not:

```text
transcript
```

at this stage.

---

# 11. Uploading Audio to the Backend

Normal API requests often use JSON:

```http
POST /topics

Content-Type: application/json
```

Audio is binary data.

For an MVP, use:

```text
multipart/form-data
```

Conceptually:

```http
POST /api/v1/topics/:topicId/explanations

Authorization: Bearer <token>
Content-Type: multipart/form-data
```

Payload:

```text
audio=<binary file>
duration=83
```

Flow:

```text
phone filesystem
        ↓
read audio bytes
        ↓
multipart request
        ↓
HTTPS
        ↓
Express
```

Express needs multipart/file-upload middleware.

`express.json()` alone is not enough because it only parses JSON bodies.

---

# 12. Audio Upload Validation

Do not immediately forward every uploaded file to OpenAI.

The server should first verify:

```text
Is a file present?
Is the file type allowed?
Is the file size acceptable?
Is the duration acceptable?
Is the user authenticated?
Does the topic exist?
Does the topic belong to the user?
Is the user allowed another analysis?
```

Desired order:

```text
request
   ↓
authenticate
   ↓
map to internal User
   ↓
authorize Topic ownership
   ↓
entitlement / usage check
   ↓
validate audio
   ↓
transcribe
```

---

# 13. Speech-to-Text Flow

Speech-to-text should be treated as a separate system step.

```text
Audio
  ↓
OpenAI transcription model
  ↓
Transcript
```

Example:

Audio contains:

```text
"useEffect lets you run side effects after rendering..."
```

Transcription result:

```text
"useEffect lets you run side effects after rendering..."
```

The backend does not need to implement speech-recognition algorithms.

It sends audio to the transcription service and receives text.

---

# 14. Keep Transcription and Analysis Separate

Do not conceptualize this as:

```text
Audio
 ↓
Magic AI
 ↓
Final answer
```

Use:

```text
Audio
    ↓
TRANSCRIPTION
    ↓
Transcript
    ↓
ANALYSIS
    ↓
Understanding assessment
```

Advantages:

- Easier debugging
- Easier retries
- Easier observability
- Transcript can be inspected
- Transcript can be shown to user
- Analysis can be retried without recording again
- Speech recognition and reasoning remain separate concerns

---

# 15. Audio Retention Strategy

For MVP:

```text
record locally
    ↓
upload
    ↓
transcribe
    ↓
receive transcript
    ↓
discard temporary audio
    ↓
persist transcript
```

Avoid permanent audio storage unless a real product requirement appears.

This avoids:

- Blob-storage setup
- Audio cleanup
- Long-term storage cost
- Privacy complexity
- Audio-retention policy
- Extra failure modes

---

# 16. AI Analysis

After transcription, send the transcript plus topic context to the analysis model.

Conceptually:

```text
TOPIC
React useEffect

USER EXPLANATION
"..."

TASK
Analyze:
- strengths
- missing concepts
- misconceptions
- severity
- scores
- follow-up questions
```

Do not ask for arbitrary prose.

The output should match a structured application contract.

Example conceptual contract:

```ts
type Analysis = {
  strengths: {
    concept: string;
    explanation: string;
  }[];

  gaps: {
    concept: string;
    type: "missing" | "misconception";
    severity: "minor" | "moderate" | "major";
    explanation: string;
  }[];

  scores: {
    accuracy: number;
    clarity: number;
    completeness: number;
    overall: number;
  };

  questions: {
    question: string;
    targetConcept: string;
  }[];
};
```

---

# 17. AI Output Is Untrusted External Data

Even structured AI output must be treated as untrusted.

Mental model:

```text
OpenAI output
     ↓
UNTRUSTED EXTERNAL DATA
     ↓
runtime validation
     ↓
domain object
     ↓
database / API
```

TypeScript alone does not protect runtime input.

A TypeScript type:

```ts
type Analysis = ...
```

does not prevent an external API from returning malformed data at runtime.

Use runtime validation, likely with a library such as Zod.

---

# 18. Domain Model — Concepts the Database Must Represent

The team will design the actual schema together.

This document intentionally defines **domain concepts**, not the final Prisma schema.

The database must be able to represent concepts like:

```text
User
 │
 ├── Topic
 │    │
 │    └── ExplanationSession
 │          │
 │          ├── Transcript
 │          ├── Scores
 │          ├── Strengths
 │          └── KnowledgeGap
 │                 │
 │                 ├── ReviewQuestion
 │                 │      │
 │                 │      └── ReviewAttempt
 │                 │
 │                 └── ReviewSchedule
 │
 └── Subscription / entitlement state
```

---

# 19. Explanation Is a Session

Do not store the explanation directly on `Topic`.

A topic may be practiced many times.

Example:

```text
Topic: React useEffect

Session Sep 3  → 52%
Session Sep 8  → 71%
Session Sep 15 → 89%
```

Therefore the domain needs:

```text
Topic
  ↓
many ExplanationSessions
```

An ExplanationSession captures one attempt to explain the topic.

---

# 20. Session Status

The team should explicitly decide how processing states are represented.

Potential statuses:

```text
UPLOADING
TRANSCRIBING
ANALYZING
COMPLETED
FAILED
```

or a smaller state model.

Why status matters:

```text
transcription succeeded
        ↓
analysis failed
```

The application should potentially retry analysis without forcing the user to record again.

---

# 21. Knowledge Gaps and Misconceptions

For the MVP, it is reasonable to treat both as variants of a general weakness.

Conceptually:

```text
KnowledgeGap
- concept
- type
- severity
- explanation
```

Possible types:

```text
MISSING
MISCONCEPTION
```

Difference:

```text
MISSING
→ user failed to mention something important

MISCONCEPTION
→ user actively expressed an incorrect mental model
```

This decision should be confirmed by the team during schema design.

---

# 22. Strengths

Do not automatically create a new database table for everything returned by AI.

If strengths are only displayed and do not have their own lifecycle, identity, or relationships, storing them as structured JSON on the session may be sufficient.

General rule:

> Give something its own table when it has meaningful independent identity, lifecycle, querying needs, relationships, or constraints.

---

# 23. Review Questions

A review question exists because a knowledge weakness needs testing.

Conceptually:

```text
KnowledgeGap
      ↓
ReviewQuestion
```

Example:

```text
Gap:
Dependency comparison

Question:
"How does React determine whether a dependency changed?"
```

The team should discuss whether questions belong:

- directly to a gap
- directly to a session
- or to both through relationships

Do not make this decision casually.

Ask:

> What concept owns the lifecycle of the question?

---

# 24. Review Attempts

Do not overwrite a single answer field.

A user may answer the same question multiple times.

Conceptually:

```text
ReviewQuestion
    ├── Attempt 1
    ├── Attempt 2
    └── Attempt 3
```

A ReviewAttempt may contain:

```text
answer
score
feedback
createdAt
```

depending on final schema.

This preserves learning history.

---

# 25. AI Review Evaluation

Review flow:

```text
ReviewQuestion
      ↓
user answer
      ↓
Express
      ↓
authorization
      ↓
OpenAI evaluation
      ↓
structured evaluation
      ↓
runtime validation
      ↓
persist ReviewAttempt
```

Example result:

```json
{
  "score": 91,
  "correct": true,
  "feedback": "You correctly explained..."
}
```

---

# 26. Spaced Review Scheduling

The scheduling algorithm should be deterministic application logic.

MVP example:

```text
score < 50
→ review tomorrow

50–70
→ 2 days

70–85
→ 4 days

85+
→ 7 days
```

Do not ask AI:

> “When should this user review again?”

There is no need.

Boundary:

```text
AI
→ evaluates understanding

Our application
→ applies scheduling rule
```

Do not build an Anki-level scheduling engine for the hackathon.

---

# 27. Push Notification Flow

A due review eventually needs to become a notification.

Conceptual flow:

```text
ReviewSchedule.nextReviewAt
        ↓
scheduler detects due item
        ↓
backend
        ↓
OneSignal
        ↓
APNs / FCM
        ↓
phone OS
        ↓
notification
```

Notification:

```text
"Ready to test your understanding of React dependencies?"
```

Notification payload should contain enough data to navigate to the correct review.

Example:

```json
{
  "type": "review",
  "gapId": "gap123"
}
```

---

# 28. Deep Linking

When the user taps a push notification, do not dump them on the home screen.

Use a deep link into the intended workflow.

Example:

```text
/reviews/gap123
```

Flow:

```text
push notification
       ↓
tap
       ↓
Expo Router deep link
       ↓
specific review screen
```

This is part of the retention loop, not optional polish.

---

# 29. Scheduling Infrastructure

Something must detect due reviews.

Possible options:

```text
hosting-platform scheduled job
cron
external scheduler
OneSignal scheduling
```

Choose the simplest reliable mechanism supported by the deployment environment.

Do not introduce:

```text
Kafka
Redis
BullMQ
distributed worker clusters
event sourcing
```

without a real need.

---

# 30. RevenueCat Architecture

RevenueCat should own purchase and entitlement abstraction.

Use entitlement concepts such as:

```text
pro
```

Do not scatter product identifiers through application logic.

Conceptually:

```text
monthly product ─┐
annual product  ─┼──→ entitlement "pro"
promotion       ─┘
```

Business code should ask:

```text
Does this user have "pro"?
```

not:

```text
Did this user purchase product xyz.monthly.2026?
```

---

# 31. RevenueCat Identity

Recommended mapping:

```text
Clerk identity
      ↓
internal User.id
      ↓
RevenueCat App User ID
```

Where possible, OneSignal should also map to the same internal application identity.

This creates a stable identity layer independent from email.

---

# 32. Server-Side Entitlement Enforcement

The mobile app may hide premium functionality.

But that is only UX.

A modified client can bypass UI restrictions.

Therefore:

```text
mobile
→ hides/disables premium feature

backend
→ actually enforces access
```

Example explanation request:

```text
POST explanation
       ↓
authenticate
       ↓
load internal User
       ↓
check entitlement
       ↓
PRO?
  │
 yes ───────→ allow
  │
 no
  ↓
check free usage
  │
under limit → allow
  │
over limit  → reject
```

---

# 33. RevenueCat Webhooks

Subscription state changes may happen while the mobile app is closed.

Examples:

- renewal
- expiration
- cancellation
- purchase
- refund

RevenueCat should notify the backend.

Conceptually:

```text
RevenueCat
    ↓
POST /webhooks/revenuecat
    ↓
verify webhook
    ↓
identify User
    ↓
update entitlement state
```

Webhooks must be authenticated/verified.

Never trust a random incoming HTTP request claiming the user is Pro.

---

# 34. TanStack Query — What It Owns

TanStack Query manages **server state** on the mobile app.

Examples:

```text
topics
analysis
review history
due reviews
entitlement state
```

Local React state handles things like:

```text
isRecording
isModalOpen
selectedTab
temporary form input
```

Mental model:

```text
SERVER STATE
→ came from backend
→ may become stale
→ may need refetching
→ may be cached
→ TanStack Query

LOCAL UI STATE
→ belongs to current UI interaction
→ React state / potentially Zustand
```

---

# 35. Full Explanation Flow

This is Engineer A's main vertical slice.

```text
USER
│
│ taps Record
▼
Expo audio recording
│
│ microphone → audio file
▼
local recording URI
│
│ multipart/form-data
▼
Express
│
├─ authenticate Clerk token
├─ map external identity → internal User
├─ authorize Topic ownership
├─ validate upload
├─ enforce free/pro usage
│
▼
OpenAI transcription
│
▼
Transcript
│
▼
OpenAI analysis
│
▼
Structured result
│
▼
Runtime validation
│
▼
Prisma transaction
│
▼
PostgreSQL
│
▼
Typed API response
│
▼
TanStack Query
│
▼
React Native result UI
```

---

# 36. Database Transaction for Analysis Persistence

A completed analysis may create several related records.

Example:

```text
create ExplanationSession
create KnowledgeGap A
create KnowledgeGap B
create ReviewQuestion A
create ReviewQuestion B
```

Without a transaction:

```text
Session created         ✓
Gap A created           ✓
Gap B created           ✓
Question A created      ✓
Question B fails        ✗
```

Now the database contains a partially persisted analysis.

Use a database transaction when the business rule is:

> Either the complete analysis is persisted, or none of it is.

Conceptually:

```text
BEGIN

create session
create gaps
create questions

COMMIT
```

On failure:

```text
ROLLBACK
```

---

# 37. Synchronous Processing Strategy for MVP

Start simple.

```text
POST explanation
      ↓
upload
      ↓
transcribe
      ↓
analyze
      ↓
persist
      ↓
return
```

Do not immediately introduce:

```text
job queue
Redis
workers
polling architecture
distributed processing
```

If processing latency becomes a demonstrated problem, revisit.

For the hackathon, simplicity wins.

---

# 38. Processing UI

The mobile app can show processing states.

Avoid fake numerical progress such as:

```text
Transcribing: 43%
```

unless actual progress information exists.

Prefer:

```text
Uploading explanation...
Understanding your explanation...
Finding weak spots...
Preparing follow-up questions...
```

These communicate state without pretending to know precise progress.

---

# 39. Major API Surface

Exact paths may change, but the team should agree on a contract close to this before building independently.

## User

```http
GET /api/v1/me
```

## Topics

```http
GET    /api/v1/topics
POST   /api/v1/topics
GET    /api/v1/topics/:topicId
PATCH  /api/v1/topics/:topicId
DELETE /api/v1/topics/:topicId
```

## Explanations

```http
POST /api/v1/topics/:topicId/explanations
GET  /api/v1/topics/:topicId/explanations
GET  /api/v1/explanations/:sessionId
```

## Reviews

```http
GET  /api/v1/reviews/due
POST /api/v1/review-questions/:questionId/attempts
GET  /api/v1/reviews/history
```

## Subscription

```http
GET  /api/v1/me/entitlement
POST /api/v1/webhooks/revenuecat
```

The exact route design is a team decision.

What matters is agreement before parallel implementation.

---

# 40. API Contract Principles

Frontend and backend should not wait for each other.

Agree on request and response shapes first.

Then mobile can build against mocks while backend develops the real endpoint.

Example:

```http
POST /api/v1/topics/:topicId/explanations
```

Possible response:

```ts
{
  id: string;
  topicId: string;
  transcript: string;

  strengths: {
    concept: string;
    explanation: string;
  }[];

  gaps: {
    id: string;
    concept: string;
    severity: "minor" | "moderate" | "major";
    explanation: string;
  }[];

  scores: {
    accuracy: number;
    clarity: number;
    completeness: number;
    overall: number;
  };

  questions: {
    id: string;
    question: string;
    targetConcept: string;
  }[];
}
```

---

# 41. Mobile Responsibilities

The mobile application owns:

```text
screens
navigation
recording UI
microphone permissions
local audio file
upload initiation
loading states
displaying transcript
displaying analysis
review answer UI
paywall UI
purchase initiation
push permission UX
deep-link navigation
TanStack Query cache
local interaction state
```

The mobile app does **not** own:

```text
database access
AI secret keys
authorization authority
entitlement authority
business invariants
webhook validation
```

---

# 42. Backend Responsibilities

The backend owns:

```text
token verification
internal User mapping
authorization
ownership checks
input validation
usage limits
AI orchestration
runtime validation of AI output
database access
business rules
review scheduling rules
subscription enforcement
RevenueCat webhook handling
notification orchestration
```

---

# 43. PostgreSQL Responsibilities

PostgreSQL should be the final authority for durable data invariants.

Potential responsibilities:

```text
primary keys
foreign keys
unique constraints
nullability
referential integrity
transactions
indexes
```

Do not rely solely on application validation for invariants that must survive:

- bugs
- duplicate requests
- concurrent requests
- multiple backend instances

---

# 44. External Provider Responsibilities

```text
Clerk
→ proves identity

OpenAI
→ speech-to-text
→ explanation analysis
→ answer evaluation

RevenueCat
→ purchase abstraction
→ entitlement state

OneSignal
→ push-notification delivery

Supabase
→ managed PostgreSQL infrastructure
```

Our backend remains the coordinator and owner of application business rules.

---

# 45. Secrets

Never put server secrets inside the Expo app.

Do not expose:

```text
OPENAI_API_KEY
CLERK_SECRET_KEY
DATABASE_URL
RevenueCat webhook secrets
OneSignal REST API secrets
```

Mobile applications are distributed to users and can be inspected.

Secret boundary:

```text
mobile bundle
      ✗ secrets

backend environment
      ✓ secrets
```

---

# 46. Failure Modes

Failures are part of the product design.

## 46.1 Microphone Permission Denied

Handle on mobile.

```text
user denies permission
      ↓
show explanation
      ↓
offer route to settings / retry
```

---

## 46.2 Recording Failure

User should be able to retry without losing unrelated state.

---

## 46.3 Upload Failure

Examples:

```text
offline
timeout
server unavailable
```

Mobile should show a retryable state.

---

## 46.4 Authentication Failure

Examples:

```text
expired session
invalid token
missing token
```

Backend rejects request.

Mobile should move through Clerk/session recovery appropriately.

---

## 46.5 Authorization Failure

Example:

```text
User A tries to access User B's Topic
```

Backend must reject even if the client manually constructs the URL.

---

## 46.6 Transcription Failure

Potential strategy:

```text
session exists
      ↓
transcription failed
      ↓
mark failure
      ↓
allow retry
```

Exact state model is a team decision.

---

## 46.7 Analysis Failure After Successful Transcription

Important case:

```text
audio ✓
transcription ✓
analysis ✗
```

The user should not necessarily need to record again.

Persist enough state to potentially retry analysis using the existing transcript.

---

## 46.8 Invalid AI Output

```text
OpenAI response
      ↓
runtime validation fails
      ↓
do not persist invalid domain result
      ↓
log
      ↓
return controlled error
```

---

## 46.9 Database Failure

Do not tell the user the analysis was safely saved unless persistence succeeded.

---

## 46.10 Partial Database Writes

Use transactions for operations that must succeed or fail as a unit.

---

## 46.11 Duplicate Requests

Ask for each important operation:

```text
What if the user taps twice?
What if the network retries?
What if the client resends after timeout?
```

Potential tools:

```text
unique constraints
idempotency keys
upsert
transactions
request deduplication
```

Do not add them everywhere blindly.

Use them where duplicate execution would cause real damage.

---

## 46.12 Notification Failure

A failed push notification should not corrupt review data.

Review scheduling and notification delivery are related but separate concerns.

---

# 47. Team Ownership

Work should be divided by vertical feature ownership, not frontend/backend/database layers.

Each engineer should own a user-visible slice:

```text
mobile
  ↓
API
  ↓
business logic
  ↓
Prisma
  ↓
database
  ↓
external integration if needed
```

---

# 48. Engineer A — Explain / Analysis

Owns:

```text
Create topic
      ↓
Record explanation
      ↓
Upload audio
      ↓
Transcribe
      ↓
Analyze
      ↓
Find strengths/gaps/misconceptions
      ↓
Persist
      ↓
Display result
```

Likely responsibilities:

```text
Topic UI
Topic detail
Recording UI
Microphone permissions
Audio upload
Processing UI
Analysis result UI

Topic API
Explanation API

OpenAI transcription
OpenAI analysis
Structured output
Runtime validation
Persistence transaction
Error handling
Authorization
```

Engineer A should own the product's **magic moment**.

---

# 49. Engineer B — Review / Retention

Owns:

```text
Knowledge gap
      ↓
Follow-up question
      ↓
User answer
      ↓
AI evaluation
      ↓
Feedback
      ↓
Schedule
      ↓
Push notification
      ↓
Deep link
      ↓
Review again
```

Likely responsibilities:

```text
ReviewQuestion
ReviewAttempt
ReviewSchedule

Due reviews UI
Answer UI
Feedback UI
Review history

AI answer evaluation
Simple spaced repetition
OneSignal
Push notification
Deep linking
Scheduler integration
```

---

# 50. Engineer C — Account / Product / Pro

Owns:

```text
install
      ↓
signup/signin
      ↓
authenticated app
      ↓
free usage
      ↓
limit
      ↓
paywall
      ↓
purchase
      ↓
pro
```

Likely responsibilities:

```text
Clerk Expo integration
Clerk Express integration
Session persistence
Authenticated routing
User bootstrap

RevenueCat SDK
Offerings
Products/packages
Purchases
Restore purchases
Entitlements
Webhook

Free/pro rules
Usage limits
Server-side enforcement helpers

Paywall
Subscription screen
Settings
Profile
Basic onboarding
```

---

# 51. Cross-Team Decisions

These must not be independently invented by individual engineers.

The team must agree on:

```text
1. Domain model
2. Database schema
3. API contracts
4. User identity model
5. Authentication middleware contract
6. Error response format
7. Shared terminology
8. Git / PR conventions
9. Core design language
```

Especially:

```text
Clerk subject
      ↓
internal User.id
```

and shared concepts:

```text
ExplanationSession
KnowledgeGap
ReviewQuestion
ReviewAttempt
ReviewSchedule
```

must mean the same thing to everyone.

---

# 52. Parallel Development Strategy

Do not serialize the team.

Bad:

```text
Engineer C finishes auth
      ↓
Engineer A starts
      ↓
Engineer A finishes analysis
      ↓
Engineer B starts
```

Better:

```text
agree on contracts
        ↓
┌──────────────┬──────────────┬──────────────┐
│ Engineer A   │ Engineer B   │ Engineer C   │
│ Explain      │ Review       │ Auth / Pro   │
└──────────────┴──────────────┴──────────────┘
        ↓
continuous integration
```

Use mocks.

Example:

Engineer B can work with:

```ts
const mockGap = {
  id: "gap-123",
  concept: "Dependency comparison",
  severity: "moderate",
};
```

while Engineer A builds the real source of that data.

---

# 53. Build Order

Build by user value, not by technology layer.

---

## Milestone 1 — Fake Product Flow

Build:

```text
Topic screen
      ↓
Record button
      ↓
fake processing
      ↓
hard-coded analysis result
```

Goal:

> Validate the user experience before expensive backend work.

---

## Milestone 2 — Real Recording + Transcription

Build:

```text
record
      ↓
upload
      ↓
OpenAI transcription
      ↓
display transcript
```

Goal:

> Solve the unfamiliar audio → text pipeline early.

---

## Milestone 3 — Real AI Analysis

Build:

```text
transcript
      ↓
structured AI analysis
      ↓
runtime validation
      ↓
analysis UI
```

Goal:

> Reach the magic moment.

This is the first point at which the product becomes genuinely interesting.

---

## Milestone 4 — Persistence

Persist:

```text
Topic
ExplanationSession
KnowledgeGap
ReviewQuestion
```

and whichever additional concepts the team agrees belong here.

Goal:

> History survives app/backend restarts.

---

## Milestone 5 — Review Loop

Build:

```text
question
      ↓
answer
      ↓
AI evaluation
      ↓
feedback
```

---

## Milestone 6 — Spaced Review + Push

Build:

```text
schedule
      ↓
due item
      ↓
push
      ↓
deep link
      ↓
review
```

---

## Milestone 7 — Monetization

Build:

```text
free usage
      ↓
limit
      ↓
paywall
      ↓
RevenueCat purchase
      ↓
pro entitlement
```

---

## Milestone 8 — Polish

Focus on:

```text
animations
loading states
error UX
onboarding
history
copywriting
performance
demo fixtures
visual consistency
```

---

# 54. First True End-to-End Product Goal

Target this as early as possible:

```text
1. Sign in
2. Create "React useEffect"
3. Press record
4. Speak for ~30 seconds
5. Stop recording
6. Upload
7. Receive transcript
8. Receive one real misconception
9. Show understanding score
10. Show one follow-up question
```

At that point the core product has been proven.

Everything after that expands retention and monetization.

---

# 55. Database Design Meeting Questions

The team should design the schema together.

For every candidate table/entity, ask:

```text
Does this have its own identity?

Does it have its own lifecycle?

Will we query it independently?

Can multiple of these exist?

Does history matter?

What owns it?

What is the cardinality?

What should happen on deletion?

What must be unique?

What fields can be null?

What invariants must PostgreSQL enforce?

Does this operation require a transaction?
```

Do not blindly translate UI objects into tables.

---

# 56. Where Rules Belong

Ask where each invariant should live.

## TypeScript

Good for:

```text
compile-time expectations
function contracts
internal application types
```

Not sufficient for external runtime validation.

---

## Runtime Validation

Good for:

```text
HTTP request payloads
AI output
webhooks
external API data
```

---

## Service / Business Logic

Good for:

```text
free/pro rule
review schedule algorithm
authorization flow
state transitions
orchestration
```

---

## Prisma Schema / PostgreSQL

Good for:

```text
primary keys
foreign keys
unique constraints
nullability
referential integrity
indexes
```

PostgreSQL is the final authority for persistent invariants.

---

# 57. Code Review Mindset

Do not review only:

> Does it work?

Review:

```text
What assumptions does this depend on?

Who is allowed to do this?

Can this happen twice?

What happens if the process crashes halfway through?

What happens under concurrent requests?

Is external input validated?

What does PostgreSQL guarantee?

What happens if OpenAI times out?

What happens if RevenueCat sends the webhook twice?

Could another user's resource be accessed?

Does stale mobile cache matter?

Are writes atomic where required?

Will logs tell us what failed?
```

---

# 58. Logging and Observability

Do not build a giant observability platform.

But production errors should be diagnosable.

For important backend operations, log context such as:

```text
request ID
internal user ID
route / operation
session ID
topic ID
external provider
failure category
duration
```

Never log:

```text
secret API keys
database passwords
auth tokens
sensitive credential material
```

Be thoughtful about logging full transcripts if they may contain private user speech.

---

# 59. Error Contract

The team should eventually agree on a consistent API error format.

Example:

```json
{
  "error": {
    "code": "FREE_LIMIT_REACHED",
    "message": "You have reached your free analysis limit."
  }
}
```

Potential codes:

```text
UNAUTHENTICATED
FORBIDDEN
NOT_FOUND
INVALID_AUDIO
TRANSCRIPTION_FAILED
ANALYSIS_FAILED
INVALID_AI_RESPONSE
FREE_LIMIT_REACHED
INTERNAL_ERROR
```

Do not leak raw internal exceptions directly to the mobile client.

---

# 60. Security Checklist

Every protected operation should consider:

```text
Authentication
Authorization
Ownership
Input validation
Secret handling
Webhook verification
Entitlement enforcement
Resource isolation
```

Never trust the mobile app because we wrote it.

The client is always an untrusted environment.

---

# 61. External Service Contract Model

Treat every external provider as a boundary.

```text
Clerk token
      ↓
verify
      ↓
auth representation

OpenAI result
      ↓
validate
      ↓
analysis domain object

RevenueCat webhook
      ↓
verify
      ↓
entitlement update

OneSignal result
      ↓
handle success/failure
```

Do not spread raw provider-specific data throughout the entire application.

---

# 62. Provider Abstraction Rule

Do not overengineer provider abstractions.

But prevent provider-specific values from leaking unnecessarily into business logic.

Examples:

Good:

```text
User has entitlement "pro"
```

Less desirable:

```text
User has PRODUCT_MONTHLY_US_2026_V3
```

Good:

```text
AnalysisResult
```

Less desirable:

```text
raw OpenAI SDK response object
```

---

# 63. Avoid Overengineering

Explicitly avoid unless a real requirement appears:

```text
microservices
Kafka
event sourcing
CQRS
Redis everywhere
complex worker infrastructure
giant repository pattern hierarchy
enterprise dependency injection frameworks
abstract factory layers with no need
Anki-level scheduling
premature multi-region architecture
```

Preferred:

```text
simple
correct
secure
observable
testable
easy to explain
fast to ship
```

---

# 64. Git / PR Working Style

Recommended team workflow:

```text
small branches
small PRs
frequent merges
contracts agreed early
mock external dependencies when useful
avoid multi-week isolated branches
```

Good PR:

```text
"Add audio recording + local playback"
```

Better than:

```text
"Implement entire Explain feature"
```

Small PRs reduce merge conflict and integration risk.

---

# 65. Integration Rule

Do not postpone integration until the end.

Bad:

```text
Week 1–3:
everyone builds independently

Week 4:
merge everything

💥
```

Preferred:

```text
contract
↓
thin implementation
↓
merge
↓
test
↓
deepen
```

---

# 66. Testing Strategy

The project should have a practical testing pyramid.

## Manual E2E

Critical hackathon path:

```text
sign in
create topic
record
upload
transcribe
analyze
view feedback
answer review
receive feedback
purchase/restore
```

---

## Backend Integration Tests

Good candidates:

```text
ownership checks
Topic CRUD
usage limits
review scheduling
entitlement enforcement
invalid input
duplicate requests where important
```

---

## Pure Unit Tests

Good candidates:

```text
review schedule algorithm
score mapping
domain transformations
validation helpers
```

Do not waste hackathon time unit-testing obvious framework plumbing.

---

# 67. Definition of Done for a Vertical Slice

A feature is not “done” merely because the happy-path UI works.

A vertical slice should ideally include:

```text
UI
API
authorization
validation
persistence
loading state
failure state
basic testing
clear ownership
```

External-integration features should also include:

```text
provider failure handling
secret configuration
webhook/auth verification if relevant
```

---

# 68. Product UX Priorities

Prioritize:

```text
fast understanding
clear feedback
confidence
low friction
visible progress
good failure recovery
```

The analysis screen is especially important.

The user should immediately understand:

```text
What did I understand?
What did I miss?
What did I misunderstand?
How strong is my explanation?
What should I answer next?
```

---

# 69. Demo Strategy

The final demo should showcase:

```text
user explains something
      ↓
AI finds subtle misconception
      ↓
follow-up challenge
      ↓
review loop
      ↓
RevenueCat monetization
```

Do not spend three weeks making infrastructure perfect while the demo looks unfinished.

---

# 70. Suggested 5-Minute Demo

Potential sequence:

### 0:00–0:30 — Problem

```text
"Reading something does not prove you understand it.
Explain It Back tests whether your mental model is actually correct."
```

### 0:30–1:30 — Record

Create/open:

```text
React useEffect
```

Record a short deliberately imperfect explanation.

### 1:30–2:20 — Magic Moment

Show:

```text
Strength
Gap
Misconception
Score
```

Emphasize the subtle misconception.

### 2:20–3:10 — Follow-Up

Answer the generated question.

Show AI evaluation.

### 3:10–3:50 — Retention

Show scheduled future review / due-review flow / notification.

### 3:50–4:30 — Monetization

Show free limit → RevenueCat paywall → Pro entitlement.

### 4:30–5:00 — Close

Show progress/history and summarize product value.

---

# 71. Demo Reliability

Do not depend on perfect live conditions.

Prepare:

```text
known demo topic
known explanation
tested network
tested OpenAI behavior
tested RevenueCat sandbox
tested push flow
fallback screenshots/video if needed
```

The demo should feel live, but the team should have a fallback.

---

# 72. Team Architecture Meeting Agenda

Before major development, spend roughly 60–90 minutes together.

Agenda:

## A. Domain

Define:

```text
User
Topic
ExplanationSession
KnowledgeGap
ReviewQuestion
ReviewAttempt
ReviewSchedule
Entitlement
```

Ask which require actual tables.

---

## B. Identity

Agree:

```text
Clerk subject
      ↓
internal User UUID
```

---

## C. API Contracts

Agree on:

```text
Topic endpoints
Explanation upload endpoint
Review endpoints
Entitlement endpoint
Webhook endpoint
```

---

## D. Error Contract

Agree on common error shape.

---

## E. Ownership

Assign:

```text
Engineer A → Explain
Engineer B → Review
Engineer C → Auth/Product
```

---

## F. Mock Contracts

Prepare example JSON for each cross-feature boundary.

---

## G. First Integration Deadline

Set an early date when all three slices merge into `main`.

Do not wait until the final week.

---

# 73. Questions the Team Still Needs to Decide

These are intentionally unresolved.

## Database

```text
Is a misconception a subtype of KnowledgeGap?
Should strengths be JSON or normalized?
Should scores be columns or another object/table?
Does ReviewQuestion belong to Gap, Session, or both?
What does "resolved" mean?
Can a question survive across sessions?
What exactly does ReviewSchedule own?
What gets cascade-deleted?
What history must survive?
```

---

## Processing

```text
What session statuses do we need?
Do we persist before transcription?
Do we persist transcript before analysis?
How does retry work?
What is our maximum recording duration?
What file types do we allow?
```

---

## Product

```text
How many free analyses?
Per day? week? month?
What exactly is Pro?
Can free users do reviews indefinitely?
What onboarding is required?
```

---

## Notifications

```text
What scheduler triggers due notifications?
At what local time?
What happens if notification permission is denied?
```

---

# 74. Architecture Decision Rule

When facing a design choice, ask:

```text
What problem are we solving?

Why here?

Why not somewhere else?

What assumption are we making?

What can fail?

What invariant must survive concurrency?

What is the simplest version that ships?

What would we regret if we got wrong?
```

---

# 75. Learning Rule for This Project

This project is both:

```text
a product we need to ship
```

and:

```text
a senior-engineering apprenticeship
```

When implementing new infrastructure or code, understand:

```text
what abstraction is doing
what happens underneath
where data crosses boundaries
what failures are possible
who owns each invariant
```

But do not turn every library choice into a multi-day research project.

Learning should support shipping.

---

# 76. Complete Product Mental Model

```text
VOICE
 ↓
AUDIO FILE
 ↓
HTTP UPLOAD
 ↓
AUTHENTICATION
 ↓
AUTHORIZATION
 ↓
VALIDATION
 ↓
TRANSCRIPTION
 ↓
TEXT
 ↓
AI ANALYSIS
 ↓
STRUCTURED DATA
 ↓
RUNTIME VALIDATION
 ↓
DATABASE TRANSACTION
 ↓
PERSISTED LEARNING STATE
 ↓
MOBILE RESULT UI
 ↓
FOLLOW-UP QUESTION
 ↓
USER ANSWER
 ↓
AI EVALUATION
 ↓
REVIEW SCHEDULE
 ↓
PUSH NOTIFICATION
 ↓
DEEP LINK
 ↓
RECALL
 ↓
BETTER UNDERSTANDING
```

Monetization wraps around this loop:

```text
USAGE
 ↓
FREE LIMIT
 ↓
PAYWALL
 ↓
PURCHASE
 ↓
REVENUECAT
 ↓
PRO ENTITLEMENT
 ↓
BACKEND ENFORCEMENT
```

---

# 77. Shared Engineering Mental Model

For every important request:

```text
client intent
      ↓
HTTP contract
      ↓
authentication
      ↓
authorization
      ↓
input validation
      ↓
business rule
      ↓
external service if needed
      ↓
runtime validation
      ↓
database invariant
      ↓
API response
      ↓
server-state cache
      ↓
UI
```

For every external input:

```text
raw external data
      ↓
boundary
      ↓
validation
      ↓
trusted representation
      ↓
domain logic
```

For persistence:

```text
JavaScript object
      ↓
Prisma
      ↓
SQL
      ↓
PostgreSQL execution
      ↓
rows
      ↓
Prisma mapping
      ↓
JavaScript object
```

---

# 78. Final Team Principle

Do not optimize for:

> “How sophisticated does our architecture look?”

Optimize for:

> “Can three engineers understand it, ship it, debug it, secure it, demo it, and explain why it works?”

The target architecture should be:

```text
simple
correct
secure
observable
testable
understandable
demo-ready
```

---

# 79. Immediate Next Steps

The shared technical foundation is complete.

Next:

```text
1. Share repository with team
2. Confirm fresh install works
3. Hold architecture meeting
4. Agree domain model
5. Agree API contracts
6. Agree identity contract
7. Allocate vertical slices
8. Build mocks
9. Start all three slices in parallel
10. Integrate early
```

The first product milestone should be:

```text
Sign in
↓
Create topic
↓
Record explanation
↓
Upload
↓
Transcribe
↓
Analyze
↓
Show one real misconception
↓
Show one follow-up question
```

Once that works, the product exists.

Everything else makes it stronger.

---

# 80. North Star

By the end of Shipaton, the team should have both:

```text
A polished, monetizable mobile learning product
```

and:

```text
A system every team member can explain from
microphone input to database row to AI output
to review notification to subscription entitlement.
```

That is the standard for **Explain It Back**.

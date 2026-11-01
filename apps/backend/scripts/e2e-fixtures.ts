import "dotenv/config";
import { createClerkClient } from "@clerk/express";
import { prisma } from "../src/lib/prisma.js";

// E2E fixtures for the Maestro flows in apps/mobile/.maestro.
// Run from apps/backend:
//   bun run e2e:fixtures seed <empty|one-due|mixed>
//   bun run e2e:fixtures make-due <questionId>
//   bun run e2e:fixtures verify
//
// Writes to DATABASE_URL (the current DB is test-only). It only ever touches
// Clerk test users (+clerk_test) and their Explanations whose topic starts with "[e2e]".
if (process.env.NODE_ENV === "production") {
  throw new Error("e2e-fixtures must not run with NODE_ENV=production");
}

const FIXTURE_PREFIX = "[e2e]";
const USER1_EMAIL = "e2e-user1+clerk_test@example.com";
const USER2_EMAIL = "e2e-user2+clerk_test@example.com";
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const scenarios = ["empty", "one-due", "mixed"] as const;
type Scenario = (typeof scenarios)[number];

type QuestionFixture = {
  concept: string;
  question: string;
  nextReviewAt: Date;
};

/** Maps a Clerk test email to the internal User, creating it like requireUser does. */
async function getTestUser(email: string) {
  if (!email.includes("+clerk_test")) {
    throw new Error(`Only Clerk test addresses (+clerk_test) are allowed: ${email}`);
  }
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const { data } = await clerk.users.getUserList({ emailAddress: [email] });
  const clerkUser = data[0];
  if (!clerkUser) {
    throw new Error(`Clerk user not found: ${email}. Create it in the Clerk dashboard (development).`);
  }
  return prisma.user.upsert({
    where: { authSubject: clerkUser.id },
    update: {},
    create: { authSubject: clerkUser.id },
  });
}

/** Deletes the user's [e2e] Explanations and everything under them, children first. */
async function resetFixtures(userId: string) {
  const byExplanation = {
    explanation: { userId, topic: { startsWith: FIXTURE_PREFIX } },
  };
  const byQuestion = { question: { knowledgeGap: byExplanation } };

  await prisma.$transaction([
    prisma.reviewAttempt.deleteMany({ where: byQuestion }),
    prisma.reviewSchedule.deleteMany({ where: byQuestion }),
    prisma.reviewQuestion.deleteMany({ where: { knowledgeGap: byExplanation } }),
    prisma.knowledgeGap.deleteMany({ where: byExplanation }),
    prisma.explanation.deleteMany({
      where: { userId, topic: { startsWith: FIXTURE_PREFIX } },
    }),
  ]);
}

/** Creates one Explanation with a gap, a question and a schedule per fixture. */
async function createQuestions(userId: string, fixtures: QuestionFixture[]) {
  for (const fixture of fixtures) {
    await prisma.explanation.create({
      data: {
        userId,
        topic: `${FIXTURE_PREFIX} ${fixture.concept}`,
        knowledgeGaps: {
          create: {
            concept: fixture.concept,
            misconception: `${FIXTURE_PREFIX} fixture misconception`,
            severity: 2,
            reviewQuestion: {
              create: {
                question: fixture.question,
                // A generated question has no schedule yet, so create one to make it due.
                schedule: {
                  create: { intervalDays: 1, nextReviewAt: fixture.nextReviewAt },
                },
              },
            },
          },
        },
      },
    });
  }
}

function user1Fixtures(scenario: Scenario, now: Date): QuestionFixture[] {
  const due = {
    concept: "E2E Closures",
    question: "E2E user1: What does a JavaScript closure capture?",
    nextReviewAt: new Date(now.getTime() - HOUR_MS),
  };
  const future = {
    concept: "E2E Hoisting",
    question: "E2E user1: Why is this future question hidden?",
    nextReviewAt: new Date(now.getTime() + 3 * DAY_MS),
  };
  if (scenario === "empty") return [];
  if (scenario === "one-due") return [due];
  return [due, future];
}

async function seed(scenario: Scenario) {
  const now = new Date();
  const [user1, user2] = [await getTestUser(USER1_EMAIL), await getTestUser(USER2_EMAIL)];

  await resetFixtures(user1.id);
  await resetFixtures(user2.id);
  await createQuestions(user1.id, user1Fixtures(scenario, now));
  // user2 always has its own due question, so flows can check it never shows for user1.
  await createQuestions(user2.id, [
    {
      concept: "E2E Promises",
      question: "E2E user2: What does Promise.all reject with?",
      nextReviewAt: new Date(now.getTime() - HOUR_MS),
    },
  ]);
  console.log(`Seeded "${scenario}" for ${USER1_EMAIL}; one due question for ${USER2_EMAIL}`);
}

async function makeDue(questionId: string) {
  const { count } = await prisma.reviewSchedule.updateMany({
    where: {
      questionId,
      question: {
        knowledgeGap: { explanation: { topic: { startsWith: FIXTURE_PREFIX } } },
      },
    },
    data: { nextReviewAt: new Date(Date.now() - 60 * 1000) },
  });
  if (count === 0) throw new Error(`No [e2e] schedule found for question ${questionId}`);
  console.log(`Question ${questionId} is due now`);
}

/** Prints user1's [e2e] questions with their latest attempt and schedule. */
async function verify() {
  const user1 = await getTestUser(USER1_EMAIL);
  const questions = await prisma.reviewQuestion.findMany({
    where: {
      knowledgeGap: {
        explanation: { userId: user1.id, topic: { startsWith: FIXTURE_PREFIX } },
      },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      question: true,
      schedule: { select: { intervalDays: true, nextReviewAt: true } },
      _count: { select: { attempts: true } },
      attempts: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { score: true, correct: true, feedback: true, createdAt: true },
      },
    },
  });
  console.log(JSON.stringify(questions, null, 2));
}

async function main() {
  const [command, arg] = process.argv.slice(2);

  if (command === "seed" && scenarios.includes(arg as Scenario)) {
    await seed(arg as Scenario);
  } else if (command === "make-due" && arg) {
    await makeDue(arg);
  } else if (command === "verify") {
    await verify();
  } else {
    throw new Error(
      `Usage: seed <${scenarios.join("|")}> | make-due <questionId> | verify`,
    );
  }
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}

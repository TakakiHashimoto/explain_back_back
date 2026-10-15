-- CreateTable
CREATE TABLE "Explanation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "transcript" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Explanation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeGap" (
    "id" TEXT NOT NULL,
    "explanationId" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "misconception" TEXT NOT NULL,
    "severity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeGap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewQuestion" (
    "id" TEXT NOT NULL,
    "gapId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewAttempt" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "feedback" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewSchedule" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "intervalDays" INTEGER NOT NULL,
    "nextReviewAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Explanation_userId_createdAt_idx" ON "Explanation"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "KnowledgeGap_explanationId_idx" ON "KnowledgeGap"("explanationId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewQuestion_gapId_key" ON "ReviewQuestion"("gapId");

-- CreateIndex
CREATE INDEX "ReviewAttempt_questionId_createdAt_idx" ON "ReviewAttempt"("questionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewSchedule_questionId_key" ON "ReviewSchedule"("questionId");

-- CreateIndex
CREATE INDEX "ReviewSchedule_nextReviewAt_idx" ON "ReviewSchedule"("nextReviewAt");

-- AddForeignKey
ALTER TABLE "Explanation" ADD CONSTRAINT "Explanation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeGap" ADD CONSTRAINT "KnowledgeGap_explanationId_fkey" FOREIGN KEY ("explanationId") REFERENCES "Explanation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewQuestion" ADD CONSTRAINT "ReviewQuestion_gapId_fkey" FOREIGN KEY ("gapId") REFERENCES "KnowledgeGap"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewAttempt" ADD CONSTRAINT "ReviewAttempt_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ReviewQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewSchedule" ADD CONSTRAINT "ReviewSchedule_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ReviewQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

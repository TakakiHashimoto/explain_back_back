-- DropForeignKey
ALTER TABLE "Explanation" DROP CONSTRAINT "Explanation_userId_fkey";

-- DropForeignKey
ALTER TABLE "KnowledgeGap" DROP CONSTRAINT "KnowledgeGap_explanationId_fkey";

-- DropForeignKey
ALTER TABLE "ReviewAttempt" DROP CONSTRAINT "ReviewAttempt_questionId_fkey";

-- DropForeignKey
ALTER TABLE "ReviewQuestion" DROP CONSTRAINT "ReviewQuestion_gapId_fkey";

-- DropForeignKey
ALTER TABLE "ReviewSchedule" DROP CONSTRAINT "ReviewSchedule_questionId_fkey";

-- AddForeignKey
ALTER TABLE "Explanation" ADD CONSTRAINT "Explanation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeGap" ADD CONSTRAINT "KnowledgeGap_explanationId_fkey" FOREIGN KEY ("explanationId") REFERENCES "Explanation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewQuestion" ADD CONSTRAINT "ReviewQuestion_gapId_fkey" FOREIGN KEY ("gapId") REFERENCES "KnowledgeGap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewAttempt" ADD CONSTRAINT "ReviewAttempt_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ReviewQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewSchedule" ADD CONSTRAINT "ReviewSchedule_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ReviewQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;


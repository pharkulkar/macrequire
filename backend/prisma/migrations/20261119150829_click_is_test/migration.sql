-- AlterTable
ALTER TABLE "AffiliateClickEvent" ADD COLUMN     "isTest" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "AffiliateClickEvent_isTest_idx" ON "AffiliateClickEvent"("isTest");

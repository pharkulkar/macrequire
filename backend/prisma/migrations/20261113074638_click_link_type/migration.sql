-- AlterTable
ALTER TABLE "AffiliateClickEvent" ADD COLUMN     "linkType" TEXT NOT NULL DEFAULT 'REGULAR';

-- CreateIndex
CREATE INDEX "AffiliateClickEvent_ipHash_offerId_createdAt_idx" ON "AffiliateClickEvent"("ipHash", "offerId", "createdAt");

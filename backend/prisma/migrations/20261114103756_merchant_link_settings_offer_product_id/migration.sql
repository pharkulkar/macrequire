-- AlterTable
ALTER TABLE "Merchant" ADD COLUMN     "affiliateId" TEXT,
ADD COLUMN     "affiliateIdParam" TEXT,
ADD COLUMN     "affiliateLinkTemplate" TEXT,
ADD COLUMN     "productUrlTemplate" TEXT;

-- AlterTable
ALTER TABLE "MerchantOffer" ADD COLUMN     "productId" TEXT;

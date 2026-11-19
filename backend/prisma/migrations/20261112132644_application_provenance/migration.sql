-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "aliases" TEXT[];

-- AlterTable
ALTER TABLE "ApplicationRequirement" ADD COLUMN     "basis" TEXT NOT NULL DEFAULT 'ESTIMATE',
ADD COLUMN     "basisNote" TEXT,
ADD COLUMN     "sourceUrl" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "UseCase" ADD COLUMN     "appCategories" TEXT[],
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

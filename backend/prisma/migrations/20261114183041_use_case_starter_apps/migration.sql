-- AlterTable
ALTER TABLE "UseCase" ADD COLUMN     "starterApps" TEXT[] DEFAULT ARRAY[]::TEXT[];

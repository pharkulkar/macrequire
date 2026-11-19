-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('OFFICIAL_APPLE', 'MERCHANT_FEED', 'ADMIN_VERIFIED', 'SAMPLE');

-- CreateEnum
CREATE TYPE "StockStatus" AS ENUM ('IN_STOCK', 'OUT_OF_STOCK', 'LIMITED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "WorkloadIntensity" AS ENUM ('BASIC', 'MODERATE', 'HEAVY', 'PROFESSIONAL');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'EDITOR');

-- CreateTable
CREATE TABLE "ChipSpecification" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "cpuCores" INTEGER NOT NULL,
    "performanceCores" INTEGER,
    "efficiencyCores" INTEGER,
    "gpuCores" INTEGER NOT NULL,
    "neuralEngineCores" INTEGER,
    "neuralEngineNote" TEXT,
    "memoryBandwidthGBs" INTEGER,
    "maxMemoryGB" INTEGER,
    "cpuPerfIndex" DOUBLE PRECISION NOT NULL,
    "gpuPerfIndex" DOUBLE PRECISION NOT NULL,
    "source" "DataSource" NOT NULL DEFAULT 'SAMPLE',
    "sourceUrl" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChipSpecification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductModel" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "productFamily" TEXT NOT NULL DEFAULT 'MacBook',
    "generation" TEXT NOT NULL,
    "releaseYear" INTEGER NOT NULL,
    "modelIdentifier" TEXT,
    "screenSizeInch" DOUBLE PRECISION NOT NULL,
    "imageUrl" TEXT,
    "officialSpecUrl" TEXT,
    "source" "DataSource" NOT NULL DEFAULT 'SAMPLE',
    "verifiedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductConfiguration" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "chipId" TEXT NOT NULL,
    "sku" TEXT,
    "ramGB" INTEGER NOT NULL,
    "storageGB" INTEGER NOT NULL,
    "cpuCores" INTEGER NOT NULL,
    "gpuCores" INTEGER NOT NULL,
    "colors" TEXT[],
    "verification" TEXT NOT NULL DEFAULT 'CTO_DERIVED',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "source" "DataSource" NOT NULL DEFAULT 'SAMPLE',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigurationSpecification" (
    "id" TEXT NOT NULL,
    "configurationId" TEXT NOT NULL,
    "displayTech" TEXT,
    "displayResolution" TEXT,
    "refreshRateHz" INTEGER,
    "brightnessNits" INTEGER,
    "batteryWh" DOUBLE PRECISION,
    "batteryLifeHours" DOUBLE PRECISION,
    "weightKg" DOUBLE PRECISION,
    "ports" TEXT[],
    "wireless" TEXT,
    "camera" TEXT,
    "audio" TEXT,
    "externalDisplays" TEXT,
    "extra" JSONB,
    "source" "DataSource" NOT NULL DEFAULT 'SAMPLE',
    "sourceUrl" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfigurationSpecification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "macSupported" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationRequirement" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "minRamGB" INTEGER NOT NULL,
    "preferredRamGB" INTEGER NOT NULL,
    "cpuDemand" INTEGER NOT NULL,
    "gpuDemand" INTEGER NOT NULL,
    "storageGB" INTEGER NOT NULL,
    "intensity" "WorkloadIntensity" NOT NULL DEFAULT 'MODERATE',
    "concurrencyFactor" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
    "needsAppleSilicon" BOOLEAN NOT NULL DEFAULT false,
    "extra" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UseCase" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UseCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UseCaseWeight" (
    "id" TEXT NOT NULL,
    "useCaseId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "UseCaseWeight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoringRuleSet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "weights" JSONB NOT NULL,
    "rules" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoringRuleSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationProfile" (
    "id" TEXT NOT NULL,
    "ruleSetId" TEXT,
    "country" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "minBudget" INTEGER,
    "maxBudget" INTEGER NOT NULL,
    "useCases" TEXT[],
    "applicationIds" TEXT[],
    "futureApplicationIds" TEXT[],
    "intensity" "WorkloadIntensity" NOT NULL,
    "futureNeeds" JSONB NOT NULL,
    "preferences" JSONB NOT NULL,
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationResult" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "configurationId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "finalScore" DOUBLE PRECISION NOT NULL,
    "section" TEXT,
    "priceAtTime" INTEGER,
    "currency" TEXT,
    "explanation" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationScoreBreakdown" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "configurationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "weighted" DOUBLE PRECISION NOT NULL,
    "detail" JSONB,

    CONSTRAINT "RecommendationScoreBreakdown_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateProgram" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "network" TEXT,
    "country" TEXT NOT NULL,
    "affiliateId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AffiliateProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantOffer" (
    "id" TEXT NOT NULL,
    "configurationId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "programId" TEXT,
    "country" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "price" INTEGER,
    "listPrice" INTEGER,
    "stock" "StockStatus" NOT NULL DEFAULT 'UNKNOWN',
    "regularUrl" TEXT NOT NULL,
    "affiliateUrl" TEXT,
    "source" "DataSource" NOT NULL DEFAULT 'SAMPLE',
    "priceVerifiedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "configurationId" TEXT NOT NULL,
    "price" INTEGER,
    "listPrice" INTEGER,
    "currency" TEXT NOT NULL,
    "stock" "StockStatus" NOT NULL DEFAULT 'UNKNOWN',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateClickEvent" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "configurationId" TEXT NOT NULL,
    "productModelId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "referralSource" TEXT,
    "resultId" TEXT,
    "userAgent" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateClickEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChipSpecification_name_key" ON "ChipSpecification"("name");

-- CreateIndex
CREATE INDEX "ChipSpecification_family_tier_idx" ON "ChipSpecification"("family", "tier");

-- CreateIndex
CREATE UNIQUE INDEX "ProductModel_slug_key" ON "ProductModel"("slug");

-- CreateIndex
CREATE INDEX "ProductModel_category_releaseYear_idx" ON "ProductModel"("category", "releaseYear");

-- CreateIndex
CREATE INDEX "ProductModel_isActive_idx" ON "ProductModel"("isActive");

-- CreateIndex
CREATE INDEX "ProductConfiguration_ramGB_storageGB_idx" ON "ProductConfiguration"("ramGB", "storageGB");

-- CreateIndex
CREATE UNIQUE INDEX "ProductConfiguration_modelId_chipId_cpuCores_gpuCores_ramGB_key" ON "ProductConfiguration"("modelId", "chipId", "cpuCores", "gpuCores", "ramGB", "storageGB");

-- CreateIndex
CREATE UNIQUE INDEX "ProductConfiguration_sku_key" ON "ProductConfiguration"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigurationSpecification_configurationId_key" ON "ConfigurationSpecification"("configurationId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_slug_key" ON "Application"("slug");

-- CreateIndex
CREATE INDEX "Application_category_idx" ON "Application"("category");

-- CreateIndex
CREATE INDEX "Application_name_idx" ON "Application"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationRequirement_applicationId_key" ON "ApplicationRequirement"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "UseCase_slug_key" ON "UseCase"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UseCaseWeight_useCaseId_category_key" ON "UseCaseWeight"("useCaseId", "category");

-- CreateIndex
CREATE INDEX "ScoringRuleSet_isActive_idx" ON "ScoringRuleSet"("isActive");

-- CreateIndex
CREATE INDEX "RecommendationProfile_createdAt_idx" ON "RecommendationProfile"("createdAt");

-- CreateIndex
CREATE INDEX "RecommendationProfile_country_idx" ON "RecommendationProfile"("country");

-- CreateIndex
CREATE INDEX "RecommendationResult_configurationId_idx" ON "RecommendationResult"("configurationId");

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationResult_profileId_configurationId_key" ON "RecommendationResult"("profileId", "configurationId");

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationScoreBreakdown_resultId_category_key" ON "RecommendationScoreBreakdown"("resultId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_slug_key" ON "Merchant"("slug");

-- CreateIndex
CREATE INDEX "Merchant_country_idx" ON "Merchant"("country");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateProgram_merchantId_country_name_key" ON "AffiliateProgram"("merchantId", "country", "name");

-- CreateIndex
CREATE INDEX "MerchantOffer_country_isActive_idx" ON "MerchantOffer"("country", "isActive");

-- CreateIndex
CREATE INDEX "MerchantOffer_priceVerifiedAt_idx" ON "MerchantOffer"("priceVerifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantOffer_configurationId_merchantId_country_key" ON "MerchantOffer"("configurationId", "merchantId", "country");

-- CreateIndex
CREATE INDEX "PriceHistory_offerId_recordedAt_idx" ON "PriceHistory"("offerId", "recordedAt");

-- CreateIndex
CREATE INDEX "PriceHistory_configurationId_recordedAt_idx" ON "PriceHistory"("configurationId", "recordedAt");

-- CreateIndex
CREATE INDEX "AffiliateClickEvent_createdAt_idx" ON "AffiliateClickEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AffiliateClickEvent_configurationId_idx" ON "AffiliateClickEvent"("configurationId");

-- CreateIndex
CREATE INDEX "AffiliateClickEvent_merchantId_createdAt_idx" ON "AffiliateClickEvent"("merchantId", "createdAt");

-- CreateIndex
CREATE INDEX "AffiliateClickEvent_country_createdAt_idx" ON "AffiliateClickEvent"("country", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- AddForeignKey
ALTER TABLE "ProductConfiguration" ADD CONSTRAINT "ProductConfiguration_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ProductModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductConfiguration" ADD CONSTRAINT "ProductConfiguration_chipId_fkey" FOREIGN KEY ("chipId") REFERENCES "ChipSpecification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigurationSpecification" ADD CONSTRAINT "ConfigurationSpecification_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "ProductConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationRequirement" ADD CONSTRAINT "ApplicationRequirement_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UseCaseWeight" ADD CONSTRAINT "UseCaseWeight_useCaseId_fkey" FOREIGN KEY ("useCaseId") REFERENCES "UseCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationProfile" ADD CONSTRAINT "RecommendationProfile_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "ScoringRuleSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationResult" ADD CONSTRAINT "RecommendationResult_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "RecommendationProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationResult" ADD CONSTRAINT "RecommendationResult_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "ProductConfiguration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationScoreBreakdown" ADD CONSTRAINT "RecommendationScoreBreakdown_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "RecommendationResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationScoreBreakdown" ADD CONSTRAINT "RecommendationScoreBreakdown_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "ProductConfiguration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateProgram" ADD CONSTRAINT "AffiliateProgram_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantOffer" ADD CONSTRAINT "MerchantOffer_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "ProductConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantOffer" ADD CONSTRAINT "MerchantOffer_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantOffer" ADD CONSTRAINT "MerchantOffer_programId_fkey" FOREIGN KEY ("programId") REFERENCES "AffiliateProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "MerchantOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "ProductConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateClickEvent" ADD CONSTRAINT "AffiliateClickEvent_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "MerchantOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateClickEvent" ADD CONSTRAINT "AffiliateClickEvent_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "RecommendationResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

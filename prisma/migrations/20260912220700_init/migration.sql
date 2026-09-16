-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'EDITOR');

-- CreateEnum
CREATE TYPE "IPOType" AS ENUM ('MAINBOARD', 'SME');

-- CreateEnum
CREATE TYPE "IPOStatus" AS ENUM ('UPCOMING', 'OPEN', 'CLOSING_TODAY', 'CLOSED', 'LISTED');

-- CreateEnum
CREATE TYPE "GMPTrend" AS ENUM ('UP', 'DOWN', 'FLAT');

-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ArticleCategory" AS ENUM ('NEWS', 'ANALYSIS', 'GMP_UPDATE', 'GUIDE', 'ALLOTMENT_GUIDE');

-- CreateEnum
CREATE TYPE "Sentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE');

-- CreateEnum
CREATE TYPE "DataSourceKind" AS ENUM ('GMP', 'IPO_LISTING', 'SUBSCRIPTION', 'ARTICLE', 'REVIEW', 'ALLOTMENT');

-- CreateEnum
CREATE TYPE "UpdateLogStatus" AS ENUM ('SUCCESS', 'PARTIAL', 'FAILURE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EDITOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IPO" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "logo" TEXT,
    "type" "IPOType" NOT NULL DEFAULT 'MAINBOARD',
    "priceBandMin" INTEGER NOT NULL,
    "priceBandMax" INTEGER NOT NULL,
    "lotSize" INTEGER NOT NULL,
    "issueSizeCr" DECIMAL(12,2) NOT NULL,
    "gmp" INTEGER NOT NULL DEFAULT 0,
    "gmpTrend" "GMPTrend" NOT NULL DEFAULT 'FLAT',
    "expectedSubscription" DECIMAL(8,2),
    "estimatedListing" INTEGER,
    "openDate" TIMESTAMP(3) NOT NULL,
    "closeDate" TIMESTAMP(3) NOT NULL,
    "allotmentDate" TIMESTAMP(3),
    "refundDate" TIMESTAMP(3),
    "demateDate" TIMESTAMP(3),
    "listingDate" TIMESTAMP(3),
    "status" "IPOStatus" NOT NULL DEFAULT 'UPCOMING',
    "registrar" TEXT,
    "registrarUrl" TEXT,
    "leadManagers" TEXT[],
    "about" TEXT,
    "strengths" TEXT[],
    "risks" TEXT[],
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isStale" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IPO_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GMPHistory" (
    "id" TEXT NOT NULL,
    "ipoId" TEXT NOT NULL,
    "gmp" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,

    CONSTRAINT "GMPHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "ipoId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "qib" DECIMAL(8,2) NOT NULL,
    "nii" DECIMAL(8,2) NOT NULL,
    "retail" DECIMAL(8,2) NOT NULL,
    "employee" DECIMAL(8,2),
    "total" DECIMAL(8,2) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "image" TEXT,
    "category" "ArticleCategory" NOT NULL DEFAULT 'NEWS',
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "ArticleStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "ipoId" TEXT NOT NULL,
    "sentiment" "Sentiment" NOT NULL,
    "positivePct" INTEGER NOT NULL,
    "neutralPct" INTEGER NOT NULL,
    "negativePct" INTEGER NOT NULL,
    "reviewCount" INTEGER NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isStale" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "DataSourceKind" NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "lastSuccess" TIMESTAMP(3),
    "lastFailure" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllotmentSource" (
    "id" TEXT NOT NULL,
    "registrar" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "ipoSlug" TEXT,
    "note" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AllotmentSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UpdateLog" (
    "id" TEXT NOT NULL,
    "job" TEXT NOT NULL,
    "status" "UpdateLogStatus" NOT NULL,
    "message" TEXT,
    "recordsTouched" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "UpdateLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ArticleToIPO" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "IPO_slug_key" ON "IPO"("slug");

-- CreateIndex
CREATE INDEX "IPO_status_idx" ON "IPO"("status");

-- CreateIndex
CREATE INDEX "IPO_openDate_idx" ON "IPO"("openDate");

-- CreateIndex
CREATE INDEX "IPO_closeDate_idx" ON "IPO"("closeDate");

-- CreateIndex
CREATE INDEX "GMPHistory_ipoId_timestamp_idx" ON "GMPHistory"("ipoId", "timestamp");

-- CreateIndex
CREATE INDEX "Subscription_ipoId_day_idx" ON "Subscription"("ipoId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "Article_slug_key" ON "Article"("slug");

-- CreateIndex
CREATE INDEX "Article_status_publishedAt_idx" ON "Article"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "Article_category_idx" ON "Article"("category");

-- CreateIndex
CREATE INDEX "Review_ipoId_idx" ON "Review"("ipoId");

-- CreateIndex
CREATE UNIQUE INDEX "_ArticleToIPO_AB_unique" ON "_ArticleToIPO"("A", "B");

-- CreateIndex
CREATE INDEX "_ArticleToIPO_B_index" ON "_ArticleToIPO"("B");

-- AddForeignKey
ALTER TABLE "GMPHistory" ADD CONSTRAINT "GMPHistory_ipoId_fkey" FOREIGN KEY ("ipoId") REFERENCES "IPO"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_ipoId_fkey" FOREIGN KEY ("ipoId") REFERENCES "IPO"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_ipoId_fkey" FOREIGN KEY ("ipoId") REFERENCES "IPO"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArticleToIPO" ADD CONSTRAINT "_ArticleToIPO_A_fkey" FOREIGN KEY ("A") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArticleToIPO" ADD CONSTRAINT "_ArticleToIPO_B_fkey" FOREIGN KEY ("B") REFERENCES "IPO"("id") ON DELETE CASCADE ON UPDATE CASCADE;

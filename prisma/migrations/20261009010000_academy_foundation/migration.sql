-- CreateEnum
CREATE TYPE "AcademyLessonStatus" AS ENUM ('PLANNED', 'VERIFIED', 'MEDIA_PENDING', 'READY', 'PUBLISHED', 'OUTDATED');

-- CreateEnum
CREATE TYPE "AcademyFeedbackCategory" AS ENUM ('UNCLEAR', 'WRONG_UI', 'BROKEN', 'ACCESS', 'OUTDATED');

-- CreateTable
CREATE TABLE "AcademyCategory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "AcademyCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademyLesson" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "AcademyLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademyLessonRevision" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "status" "AcademyLessonStatus" NOT NULL DEFAULT 'PLANNED',
    "content" JSONB NOT NULL,
    "sourceCommit" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "verifiedByUserId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcademyLessonRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademyFeedback" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "reporterUserId" TEXT NOT NULL,
    "stepId" TEXT,
    "category" "AcademyFeedbackCategory" NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "AcademyFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AcademyCategory_organizationId_id_key" ON "AcademyCategory"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AcademyCategory_organizationId_slug_key" ON "AcademyCategory"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "AcademyLesson_organizationId_categoryId_idx" ON "AcademyLesson"("organizationId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademyLesson_organizationId_id_key" ON "AcademyLesson"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AcademyLesson_organizationId_slug_key" ON "AcademyLesson"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "AcademyLessonRevision_organizationId_status_idx" ON "AcademyLessonRevision"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AcademyLessonRevision_organizationId_id_key" ON "AcademyLessonRevision"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AcademyLessonRevision_organizationId_lessonId_version_key" ON "AcademyLessonRevision"("organizationId", "lessonId", "version");

-- CreateIndex
CREATE INDEX "AcademyFeedback_organizationId_createdAt_idx" ON "AcademyFeedback"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AcademyFeedback_organizationId_revisionId_idx" ON "AcademyFeedback"("organizationId", "revisionId");

-- AddForeignKey
ALTER TABLE "AcademyCategory" ADD CONSTRAINT "AcademyCategory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademyLesson" ADD CONSTRAINT "AcademyLesson_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademyLesson" ADD CONSTRAINT "AcademyLesson_organizationId_categoryId_fkey" FOREIGN KEY ("organizationId", "categoryId") REFERENCES "AcademyCategory"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademyLessonRevision" ADD CONSTRAINT "AcademyLessonRevision_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademyLessonRevision" ADD CONSTRAINT "AcademyLessonRevision_organizationId_lessonId_fkey" FOREIGN KEY ("organizationId", "lessonId") REFERENCES "AcademyLesson"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademyFeedback" ADD CONSTRAINT "AcademyFeedback_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademyFeedback" ADD CONSTRAINT "AcademyFeedback_organizationId_revisionId_fkey" FOREIGN KEY ("organizationId", "revisionId") REFERENCES "AcademyLessonRevision"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "TaskFileVersionReview" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "comment" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskFileVersionReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskFileVersionReview_organizationId_versionId_createdAt_idx" ON "TaskFileVersionReview"("organizationId", "versionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaskFileVersionReview_organizationId_versionId_reviewerId_key" ON "TaskFileVersionReview"("organizationId", "versionId", "reviewerId");

-- AddForeignKey
ALTER TABLE "TaskFileVersionReview" ADD CONSTRAINT "TaskFileVersionReview_organizationId_versionId_fkey" FOREIGN KEY ("organizationId", "versionId") REFERENCES "TaskFileVersion"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskFileVersionReview" ADD CONSTRAINT "TaskFileVersionReview_organizationId_reviewerId_fkey" FOREIGN KEY ("organizationId", "reviewerId") REFERENCES "OrganizationMembership"("organizationId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaskFileVersionReview" ADD CONSTRAINT "FileReview_kind_check" CHECK ("kind" IN ('internal','customer'));
ALTER TABLE "TaskFileVersionReview" ADD CONSTRAINT "FileReview_decision_check" CHECK ("decision" IN ('approved','changes_requested'));

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "allowedModules" JSONB,
ADD COLUMN     "entitlementVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "planCode" TEXT NOT NULL DEFAULT 'manual';

-- AlterTable
ALTER TABLE "OrganizationInvitation" ADD COLUMN     "revokedAt" TIMESTAMP(3),
ALTER COLUMN "invitedUserId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "RateLimitCounter" (
    "id" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntitlementChange" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "planCode" TEXT NOT NULL,
    "activeMemberLimit" INTEGER NOT NULL,
    "storageByteLimit" BIGINT NOT NULL,
    "allowedModules" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntitlementChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateLimitCounter_expiresAt_idx" ON "RateLimitCounter"("expiresAt");

-- CreateIndex
CREATE INDEX "EntitlementChange_organizationId_createdAt_idx" ON "EntitlementChange"("organizationId", "createdAt");

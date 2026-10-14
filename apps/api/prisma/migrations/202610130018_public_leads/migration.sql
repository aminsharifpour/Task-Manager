-- CreateTable
CREATE TABLE "PublicLead" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "teamSize" INTEGER NOT NULL,
    "deploymentMode" TEXT NOT NULL,
    "message" TEXT,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "requestKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicLeadEvent" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicLeadEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PublicLead_requestKey_key" ON "PublicLead"("requestKey");

-- CreateIndex
CREATE INDEX "PublicLead_status_createdAt_idx" ON "PublicLead"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "PublicLeadEvent" ADD CONSTRAINT "PublicLeadEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "PublicLead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublicLead" ADD CONSTRAINT public_lead_status CHECK (status IN ('new','contacted','closed'));
ALTER TABLE "PublicLead" ADD CONSTRAINT public_lead_team_size CHECK ("teamSize" BETWEEN 1 AND 100000);
ALTER TABLE "PublicLead" ADD CONSTRAINT public_lead_deployment CHECK ("deploymentMode" IN ('hosted','self_hosted'));

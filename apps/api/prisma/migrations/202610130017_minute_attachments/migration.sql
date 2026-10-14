-- CreateTable
CREATE TABLE "MinuteAttachment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "minuteId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MinuteAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MinuteAttachment_storageKey_key" ON "MinuteAttachment"("storageKey");

-- CreateIndex
CREATE INDEX "MinuteAttachment_organizationId_minuteId_createdAt_idx" ON "MinuteAttachment"("organizationId", "minuteId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MinuteAttachment_organizationId_uploadKey_key" ON "MinuteAttachment"("organizationId", "uploadKey");

-- AddForeignKey
ALTER TABLE "MinuteAttachment" ADD CONSTRAINT "MinuteAttachment_organizationId_minuteId_fkey" FOREIGN KEY ("organizationId", "minuteId") REFERENCES "MeetingMinute"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinuteAttachment" ADD CONSTRAINT "MinuteAttachment_organizationId_createdById_fkey" FOREIGN KEY ("organizationId", "createdById") REFERENCES "OrganizationMembership"("organizationId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MinuteAttachment" ADD CONSTRAINT minute_attachment_size CHECK ("byteSize">0 AND "byteSize"<=20971520);

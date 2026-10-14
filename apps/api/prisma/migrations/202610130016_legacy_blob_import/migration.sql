-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "legacyAttachmentsMigratedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LegacyBlobImport" (
    "migrationKey" TEXT NOT NULL,
    "sourceChecksum" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "attachmentIndex" INTEGER NOT NULL,
    "attachmentId" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegacyBlobImport_pkey" PRIMARY KEY ("migrationKey")
);

-- CreateIndex
CREATE UNIQUE INDEX "LegacyBlobImport_sourceChecksum_messageId_attachmentIndex_key" ON "LegacyBlobImport"("sourceChecksum", "messageId", "attachmentIndex");

-- AddForeignKey
ALTER TABLE "LegacyBlobImport" ADD CONSTRAINT "LegacyBlobImport_organizationId_attachmentId_fkey" FOREIGN KEY ("organizationId", "attachmentId") REFERENCES "ChatAttachment"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

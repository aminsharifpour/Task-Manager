ALTER TABLE "ChatMessage" ADD COLUMN "clientRequestId" TEXT, ADD COLUMN "requestHash" TEXT;
CREATE UNIQUE INDEX "ChatMessage_organizationId_senderId_clientRequestId_key" ON "ChatMessage"("organizationId", "senderId", "clientRequestId");
CREATE TABLE "ChatAttachment" (
 "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "conversationId" TEXT NOT NULL, "createdById" TEXT NOT NULL,
 "originalName" TEXT NOT NULL, "mediaType" TEXT NOT NULL, "byteSize" INTEGER NOT NULL, "checksum" TEXT NOT NULL,
 "storageKey" TEXT NOT NULL, "uploadKey" TEXT NOT NULL, "requestHash" TEXT NOT NULL, "discardedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ChatAttachment_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ChatAttachment_byteSize_check" CHECK ("byteSize" > 0 AND "byteSize" <= 20971520),
 CONSTRAINT "ChatAttachment_checksum_check" CHECK ("checksum" ~ '^[0-9a-f]{64}$'),
 CONSTRAINT "ChatAttachment_organizationId_conversationId_fkey" FOREIGN KEY ("organizationId", "conversationId") REFERENCES "ChatConversation"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "ChatAttachment_organizationId_createdById_fkey" FOREIGN KEY ("organizationId", "createdById") REFERENCES "OrganizationMembership"("organizationId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ChatAttachment_storageKey_key" ON "ChatAttachment"("storageKey");
CREATE UNIQUE INDEX "ChatAttachment_organizationId_id_key" ON "ChatAttachment"("organizationId", "id");
CREATE UNIQUE INDEX "ChatAttachment_organizationId_uploadKey_key" ON "ChatAttachment"("organizationId", "uploadKey");
CREATE INDEX "ChatAttachment_organizationId_conversationId_createdById_cre_idx" ON "ChatAttachment"("organizationId", "conversationId", "createdById", "createdAt");
CREATE TABLE "ChatMessageAttachment" (
 "organizationId" TEXT NOT NULL, "messageId" TEXT NOT NULL, "attachmentId" TEXT NOT NULL,
 CONSTRAINT "ChatMessageAttachment_pkey" PRIMARY KEY ("organizationId", "messageId", "attachmentId"),
 CONSTRAINT "ChatMessageAttachment_organizationId_messageId_fkey" FOREIGN KEY ("organizationId", "messageId") REFERENCES "ChatMessage"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "ChatMessageAttachment_organizationId_attachmentId_fkey" FOREIGN KEY ("organizationId", "attachmentId") REFERENCES "ChatAttachment"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ChatMessageAttachment_organizationId_attachmentId_idx" ON "ChatMessageAttachment"("organizationId", "attachmentId");

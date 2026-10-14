ALTER TABLE "Organization" ADD COLUMN "storageByteLimit" BIGINT NOT NULL DEFAULT 1073741824;
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_storageByteLimit_check" CHECK ("storageByteLimit" >= 0 AND "storageByteLimit" <= 9007199254740991);
CREATE TABLE "TaskFile" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "taskId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL, "name" TEXT NOT NULL, "currentVersion" INTEGER NOT NULL DEFAULT 1,
  "archivedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaskFile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaskFile_currentVersion_check" CHECK ("currentVersion" > 0),
  CONSTRAINT "TaskFile_organizationId_taskId_fkey" FOREIGN KEY ("organizationId", "taskId") REFERENCES "Task"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TaskFile_organizationId_createdById_fkey" FOREIGN KEY ("organizationId", "createdById") REFERENCES "OrganizationMembership"("organizationId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TaskFile_organizationId_id_key" ON "TaskFile"("organizationId", "id");
CREATE INDEX "TaskFile_organizationId_taskId_archivedAt_createdAt_idx" ON "TaskFile"("organizationId", "taskId", "archivedAt", "createdAt");
CREATE TABLE "TaskFileVersion" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "fileId" TEXT NOT NULL, "version" INTEGER NOT NULL,
  "originalName" TEXT NOT NULL, "mediaType" TEXT NOT NULL, "byteSize" INTEGER NOT NULL,
  "checksum" TEXT NOT NULL, "storageKey" TEXT NOT NULL, "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskFileVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaskFileVersion_version_check" CHECK ("version" > 0),
  CONSTRAINT "TaskFileVersion_byteSize_check" CHECK ("byteSize" > 0 AND "byteSize" <= 20971520),
  CONSTRAINT "TaskFileVersion_checksum_check" CHECK ("checksum" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "TaskFileVersion_organizationId_fileId_fkey" FOREIGN KEY ("organizationId", "fileId") REFERENCES "TaskFile"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TaskFileVersion_organizationId_createdById_fkey" FOREIGN KEY ("organizationId", "createdById") REFERENCES "OrganizationMembership"("organizationId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TaskFileVersion_storageKey_key" ON "TaskFileVersion"("storageKey");
CREATE UNIQUE INDEX "TaskFileVersion_organizationId_id_key" ON "TaskFileVersion"("organizationId", "id");
CREATE UNIQUE INDEX "TaskFileVersion_organizationId_fileId_version_key" ON "TaskFileVersion"("organizationId", "fileId", "version");
CREATE INDEX "TaskFileVersion_organizationId_createdAt_idx" ON "TaskFileVersion"("organizationId", "createdAt");
CREATE TABLE "FileVersionFeedback" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "versionId" TEXT NOT NULL, "authorId" TEXT NOT NULL,
  "text" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FileVersionFeedback_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FileVersionFeedback_organizationId_versionId_fkey" FOREIGN KEY ("organizationId", "versionId") REFERENCES "TaskFileVersion"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FileVersionFeedback_organizationId_authorId_fkey" FOREIGN KEY ("organizationId", "authorId") REFERENCES "OrganizationMembership"("organizationId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "FileVersionFeedback_organizationId_versionId_createdAt_idx" ON "FileVersionFeedback"("organizationId", "versionId", "createdAt");
ALTER TABLE "TaskFileVersion" ADD COLUMN "uploadKey" TEXT NOT NULL;
ALTER TABLE "TaskFileVersion" ADD COLUMN "requestHash" TEXT NOT NULL;
CREATE UNIQUE INDEX "TaskFileVersion_organizationId_uploadKey_key" ON "TaskFileVersion"("organizationId", "uploadKey");

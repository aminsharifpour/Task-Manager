ALTER TABLE "MeetingMinute" ADD COLUMN "content" JSONB;
ALTER TABLE "MeetingMinute" ADD COLUMN "archivedAt" TIMESTAMP(3);
CREATE INDEX "MeetingMinute_organizationId_archivedAt_date_idx" ON "MeetingMinute"("organizationId", "archivedAt", "date");

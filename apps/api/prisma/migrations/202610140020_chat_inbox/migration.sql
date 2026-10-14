ALTER TABLE "ChatConversationMember"
 ADD COLUMN "isStarred" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "inboxFolder" TEXT NOT NULL DEFAULT 'inbox',
 ADD COLUMN "inboxLabel" TEXT,
 ADD COLUMN "draftText" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ChatConversationMember" ADD CONSTRAINT "chat_inbox_folder_valid" CHECK ("inboxFolder" IN ('inbox','archive','trash'));
ALTER TABLE "ChatConversationMember" ADD CONSTRAINT "chat_draft_length" CHECK (length("draftText") <= 10000);
CREATE INDEX "ChatConversationMember_inbox_idx" ON "ChatConversationMember" ("organizationId","userId","inboxFolder");

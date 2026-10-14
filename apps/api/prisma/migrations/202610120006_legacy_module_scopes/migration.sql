-- DropIndex
DROP INDEX "HrAttendanceRecord_userId_date_key";

-- DropIndex
DROP INDEX "AccountingBudget_monthKey_key";

-- DropIndex
DROP INDEX "NotificationPreference_userId_key";

-- AlterTable
ALTER TABLE "TeamMembership" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "ProjectMember" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "ProjectTeam" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "TaskWorkflowComment" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "MeetingMinute" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "HrProfile" DROP CONSTRAINT "HrProfile_pkey",
ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'legacy-default',
ADD CONSTRAINT "HrProfile_pkey" PRIMARY KEY ("organizationId", "userId");

-- AlterTable
ALTER TABLE "HrLeaveRequest" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "HrAttendanceRecord" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "AccountingAccount" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "AccountingTransaction" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "AccountingBudget" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "AccountingBudgetHistory" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "ChatConversation" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "ChatConversationMember" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "ChatMessageReaction" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "NotificationPreference" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'legacy-default';

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "PresenceEvent" ADD COLUMN     "organizationId" TEXT;

-- CreateTable
CREATE TABLE "TaskWorkflowEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "fromStep" INTEGER NOT NULL,
    "toStep" INTEGER NOT NULL,
    "resultSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskWorkflowEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationSetting" (
    "organizationId" TEXT NOT NULL,
    "modules" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationSetting_pkey" PRIMARY KEY ("organizationId")
);

-- CreateIndex
CREATE INDEX "TaskWorkflowEvent_organizationId_taskId_createdAt_idx" ON "TaskWorkflowEvent"("organizationId", "taskId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaskWorkflowEvent_organizationId_taskId_idempotencyKey_key" ON "TaskWorkflowEvent"("organizationId", "taskId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Team_organizationId_id_key" ON "Team"("organizationId", "id");

-- CreateIndex
CREATE INDEX "TeamMembership_organizationId_idx" ON "TeamMembership"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMembership_organizationId_id_key" ON "TeamMembership"("organizationId", "id");

-- CreateIndex
CREATE INDEX "ProjectMember_organizationId_idx" ON "ProjectMember"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_organizationId_id_key" ON "ProjectMember"("organizationId", "id");

-- CreateIndex
CREATE INDEX "ProjectTeam_organizationId_idx" ON "ProjectTeam"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTeam_organizationId_id_key" ON "ProjectTeam"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Task_organizationId_id_key" ON "Task"("organizationId", "id");

-- CreateIndex
CREATE INDEX "TaskWorkflowComment_organizationId_idx" ON "TaskWorkflowComment"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskWorkflowComment_organizationId_id_key" ON "TaskWorkflowComment"("organizationId", "id");

-- CreateIndex
CREATE INDEX "MeetingMinute_organizationId_idx" ON "MeetingMinute"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingMinute_organizationId_id_key" ON "MeetingMinute"("organizationId", "id");

-- CreateIndex
CREATE INDEX "HrProfile_organizationId_idx" ON "HrProfile"("organizationId");

-- CreateIndex
CREATE INDEX "HrLeaveRequest_organizationId_idx" ON "HrLeaveRequest"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "HrLeaveRequest_organizationId_id_key" ON "HrLeaveRequest"("organizationId", "id");

-- CreateIndex
CREATE INDEX "HrAttendanceRecord_organizationId_idx" ON "HrAttendanceRecord"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "HrAttendanceRecord_organizationId_userId_date_key" ON "HrAttendanceRecord"("organizationId", "userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "HrAttendanceRecord_organizationId_id_key" ON "HrAttendanceRecord"("organizationId", "id");

-- CreateIndex
CREATE INDEX "AccountingAccount_organizationId_idx" ON "AccountingAccount"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingAccount_organizationId_id_key" ON "AccountingAccount"("organizationId", "id");

-- CreateIndex
CREATE INDEX "AccountingTransaction_organizationId_idx" ON "AccountingTransaction"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingTransaction_organizationId_id_key" ON "AccountingTransaction"("organizationId", "id");

-- CreateIndex
CREATE INDEX "AccountingBudget_organizationId_idx" ON "AccountingBudget"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingBudget_organizationId_monthKey_key" ON "AccountingBudget"("organizationId", "monthKey");

-- CreateIndex
CREATE INDEX "AccountingBudgetHistory_organizationId_idx" ON "AccountingBudgetHistory"("organizationId");

-- CreateIndex
CREATE INDEX "ChatConversation_organizationId_idx" ON "ChatConversation"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatConversation_organizationId_id_key" ON "ChatConversation"("organizationId", "id");

-- CreateIndex
CREATE INDEX "ChatConversationMember_organizationId_idx" ON "ChatConversationMember"("organizationId");

-- CreateIndex
CREATE INDEX "ChatMessage_organizationId_idx" ON "ChatMessage"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_organizationId_id_key" ON "ChatMessage"("organizationId", "id");

-- CreateIndex
CREATE INDEX "ChatMessageReaction_organizationId_idx" ON "ChatMessageReaction"("organizationId");

-- CreateIndex
CREATE INDEX "Notification_organizationId_idx" ON "Notification"("organizationId");

-- CreateIndex
CREATE INDEX "NotificationPreference_organizationId_idx" ON "NotificationPreference"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_organizationId_userId_key" ON "NotificationPreference"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");

-- CreateIndex
CREATE INDEX "PresenceEvent_organizationId_idx" ON "PresenceEvent"("organizationId");

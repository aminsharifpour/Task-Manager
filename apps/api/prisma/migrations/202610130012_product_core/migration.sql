-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "customFieldDefinitions" JSONB,
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "templateId" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "customFields" JSONB,
ADD COLUMN     "estimateMinutes" INTEGER,
ADD COLUMN     "parentTaskId" TEXT,
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'normal',
ADD COLUMN     "startDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OrganizationMembership" ADD COLUMN     "weeklyCapacityMinutes" INTEGER NOT NULL DEFAULT 2400;

-- CreateTable
CREATE TABLE "TaskChecklistItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskDependency" (
    "organizationId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "dependsOnTaskId" TEXT NOT NULL,

    CONSTRAINT "TaskDependency_pkey" PRIMARY KEY ("organizationId","taskId","dependsOnTaskId")
);

-- CreateTable
CREATE TABLE "TaskTimeEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "spentMinutes" INTEGER NOT NULL,
    "note" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskTimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskChecklistItem_organizationId_taskId_createdAt_idx" ON "TaskChecklistItem"("organizationId", "taskId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskDependency_organizationId_dependsOnTaskId_idx" ON "TaskDependency"("organizationId", "dependsOnTaskId");

-- CreateIndex
CREATE INDEX "TaskTimeEntry_organizationId_taskId_workDate_idx" ON "TaskTimeEntry"("organizationId", "taskId", "workDate");

-- CreateIndex
CREATE INDEX "TaskTimeEntry_organizationId_userId_workDate_idx" ON "TaskTimeEntry"("organizationId", "userId", "workDate");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_organizationId_parentTaskId_fkey" FOREIGN KEY ("organizationId", "parentTaskId") REFERENCES "Task"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskChecklistItem" ADD CONSTRAINT "TaskChecklistItem_organizationId_taskId_fkey" FOREIGN KEY ("organizationId", "taskId") REFERENCES "Task"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_organizationId_taskId_fkey" FOREIGN KEY ("organizationId", "taskId") REFERENCES "Task"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_organizationId_dependsOnTaskId_fkey" FOREIGN KEY ("organizationId", "dependsOnTaskId") REFERENCES "Task"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTimeEntry" ADD CONSTRAINT "TaskTimeEntry_organizationId_taskId_fkey" FOREIGN KEY ("organizationId", "taskId") REFERENCES "Task"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTimeEntry" ADD CONSTRAINT "TaskTimeEntry_organizationId_userId_fkey" FOREIGN KEY ("organizationId", "userId") REFERENCES "OrganizationMembership"("organizationId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_priority_check" CHECK ("priority" IN ('low','normal','high','urgent'));
ALTER TABLE "Task" ADD CONSTRAINT "Task_estimateMinutes_check" CHECK ("estimateMinutes" IS NULL OR "estimateMinutes" BETWEEN 1 AND 1008000);
ALTER TABLE "TaskTimeEntry" ADD CONSTRAINT "TaskTimeEntry_spentMinutes_check" CHECK ("spentMinutes" BETWEEN 1 AND 10080);
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "Membership_capacity_check" CHECK ("weeklyCapacityMinutes" BETWEEN 1 AND 10080);
ALTER TABLE "Project" ADD CONSTRAINT "Project_status_check" CHECK ("status" IN ('active','paused','completed','archived'));
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_no_self" CHECK ("taskId" <> "dependsOnTaskId");
CREATE INDEX "Task_organizationId_assigneePrimaryId_executionDate_idx" ON "Task" ("organizationId","assigneePrimaryId","executionDate");
ALTER TABLE "Project" ADD CONSTRAINT "Project_date_range_check" CHECK ("startDate" IS NULL OR "endDate" IS NULL OR "startDate" <= "endDate");
ALTER TABLE "Task" ADD CONSTRAINT "Task_date_range_check" CHECK ("startDate" IS NULL OR "executionDate" IS NULL OR "startDate" <= "executionDate");

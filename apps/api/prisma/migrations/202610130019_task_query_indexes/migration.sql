-- CreateIndex
CREATE INDEX "Task_org_created_id_idx" ON "Task"("organizationId", "createdAt" DESC, "id");

-- CreateIndex
CREATE INDEX "Task_org_status_date_idx" ON "Task"("organizationId", "status", "executionDate");

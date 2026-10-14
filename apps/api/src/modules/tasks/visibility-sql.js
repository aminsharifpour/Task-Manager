import { Prisma } from "@prisma/client";
// Equivalent to visibleTasks; all joins and workflow history retain organization scope.
export function taskVisibilitySQL(c){
 const ownership=c.role==="guest"?Prisma.sql`false`:Prisma.sql`p."ownerId"=${c.userId}`;
 const project=Prisma.sql`t."projectId" IN(SELECT p.id FROM "Project" p WHERE p."organizationId"=${c.organizationId} AND (${ownership} OR p.id IN(SELECT pm."projectId" FROM "ProjectMember" pm WHERE pm."organizationId"=${c.organizationId} AND pm."userId"=${c.userId})))`;
 const access=["owner","admin"].includes(c.role)?Prisma.sql`true`:c.role==="guest"?project:Prisma.sql`(${project} OR t."assignerId"=${c.userId} OR t."assigneePrimaryId"=${c.userId} OR t."assigneeSecondaryId"=${c.userId} OR t."workflowPendingAssigneeIds" @> ${JSON.stringify([c.userId])}::jsonb OR t.id IN(SELECT e."taskId" FROM "TaskWorkflowEvent" e WHERE e."organizationId"=${c.organizationId} AND e."actorUserId"=${c.userId}))`;
 return Prisma.sql`t."organizationId"=${c.organizationId} AND ${access}`;
}

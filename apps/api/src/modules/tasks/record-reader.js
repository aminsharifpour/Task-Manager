import { getTask, assertEditable, visibleTasks } from "./service.js";
import { readScoped, pageRows } from "../shared/scoped.js";

/** Only names of people linked to the visible record, never the organization directory. */
async function peopleFor(tx, context, ids) {
  const unique = [...new Set(ids.filter(id => typeof id === "string" && id))];
  if (!unique.length) return [];
  const rows = await tx.organizationMembership.findMany({
    where: { organizationId: context.organizationId, userId: { in: unique } },
    select: { userId: true, user: { select: { fullName: true } } },
  });
  return rows.map(row => ({ id: row.userId, fullName: row.user.fullName }));
}

export async function recordDetails(context, id) {
  return readScoped(context, "tasks", async (tx, current) => {
    const task = await getTask(current, id, tx);
    let canEdit = false;
    if (current.role !== "guest") {
      try { assertEditable(current, task); canEdit = true; }
      catch (error) { if (error.code !== "PERMISSION_DENIED") throw error; }
    }
    const steps = Array.isArray(task.workflowSteps) ? task.workflowSteps : [];
    const people = await peopleFor(tx, current, [
      task.assignerId, task.assigneePrimaryId, task.assigneeSecondaryId,
      task.project?.ownerId, ...(Array.isArray(task.workflowPendingAssigneeIds) ? task.workflowPendingAssigneeIds : []),
      ...steps.flatMap(step => [step.assigneeMemberId, step.approvalAssigneeMemberId]),
    ]);
    const [checklist, dependencies, parent] = await Promise.all([
      tx.taskChecklistItem.findMany({
        where: { organizationId: current.organizationId, taskId: id },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 100,
      }),
      tx.taskDependency.findMany({
        where: { organizationId: current.organizationId, taskId: id,
          dependsOn: { is: visibleTasks(current) } },
        select: { dependsOn: { select: { id: true, title: true, status: true } } },
        take: 100,
      }),
      task.parentTaskId ? tx.task.findFirst({
        where: { ...visibleTasks(current), id: task.parentTaskId },
        select: { id: true, title: true, status: true },
      }) : null,
    ]);
    // Keep the existing detail contract. Related lists are read separately with pagination.
    return {
      canEdit, people, parent, checklist, dependencies,
      task: { ...task, project: task.project ? {
        id: task.project.id, name: task.project.name,
        customFieldDefinitions: task.project.customFieldDefinitions,
      } : null },
    };
  });
}

export async function recordComments(context, id, query) {
  return readScoped(context, "tasks", async (tx, current) => {
    await getTask(current, id, tx);
    const page = await pageRows("taskWorkflowComment",
      { organizationId: current.organizationId, taskId: id }, query, {}, tx);
    const people = await peopleFor(tx, current, page.items.map(row => row.authorId));
    const names = new Map(people.map(row => [row.id, row.fullName]));
    return { ...page, items: page.items.map(row => ({
      ...row, author: { fullName: names.get(row.authorId) || null },
    })) };
  });
}

export async function recordActivity(context, id, query) {
  return readScoped(context, "tasks", async (tx, current) => {
    await getTask(current, id, tx);
    // Never expose idempotency keys, payload hashes or full result snapshots.
    const page = await pageRows("taskWorkflowEvent",
      { organizationId: current.organizationId, taskId: id }, query, {
        select: { id: true, actorUserId: true, decision: true, fromStep: true,
          toStep: true, createdAt: true },
      }, tx);
    const people = await peopleFor(tx, current, page.items.map(row => row.actorUserId));
    const names = new Map(people.map(row => [row.id, row.fullName]));
    return { ...page, items: page.items.map(row => ({
      ...row, actorName: names.get(row.actorUserId) || null,
    })) };
  });
}

export async function recordChildren(context, id, query) {
  return readScoped(context, "tasks", async (tx, current) => {
    await getTask(current, id, tx);
    return pageRows("task", { ...visibleTasks(current), parentTaskId: id }, query, {
      select: { id: true, title: true, status: true, executionDate: true },
    }, tx);
  });
}

import { DomainError, text, date, activeMember } from "../shared/scoped.js";

const types = ["task_assigner", "task_assignee_primary", "task_assignee_secondary", "project_owner", "project_members", "role", "member", "all_participants"];
export function normalizeSteps(value) {
  if (!Array.isArray(value) || value.length > 12) throw new DomainError(400, "INVALID_WORKFLOW", "گردش‌کار حداکثر ۱۲ مرحله دارد.");
  const steps = value.map((raw, index) => {
    const s = typeof raw === "string" ? { title: raw } : raw;
    if (!s || typeof s !== "object") throw new DomainError(400, "INVALID_WORKFLOW", "مرحله معتبر نیست.");
    const step = { ...s, id: s.id ? text(s.id, "شناسه مرحله", 64) : `step-${index + 1}`, title: text(s.title, "نام مرحله", 120),
      assigneeType: s.assigneeType || "task_assignee_primary", assigneeRole: s.assigneeRole || "", assigneeMemberId: s.assigneeMemberId || "",
      requiresApproval: s.requiresApproval === true, approvalAssigneeType: s.approvalAssigneeType || "task_assigner",
      approvalAssigneeRole: s.approvalAssigneeRole || "", approvalAssigneeMemberId: s.approvalAssigneeMemberId || "",
      onApprove: s.onApprove || "next", onReject: s.onReject || "stay" };
    if (!types.includes(step.assigneeType) || !types.includes(step.approvalAssigneeType)) throw new DomainError(400, "INVALID_WORKFLOW", "نوع مسئول مرحله معتبر نیست.");
    if (step.assigneeType === "role" && !step.assigneeRole || step.requiresApproval && step.approvalAssigneeType === "role" && !step.approvalAssigneeRole) throw new DomainError(400, "INVALID_WORKFLOW", "نقش مسئول مرحله را مشخص کنید.");
    if (s.requiresApproval !== undefined && typeof s.requiresApproval !== "boolean") throw new DomainError(400, "INVALID_WORKFLOW", "نوع تأیید مرحله معتبر نیست.");
    for (const field of ["assigneeRole", "approvalAssigneeRole"]) if (step[field] && !["owner", "admin", "manager", "project_manager", "member"].includes(step[field])) throw new DomainError(400, "INVALID_WORKFLOW", "نقش مرحله معتبر نیست.");
    for (const field of ["dueDate", "approvalDeadline"]) if (step[field]) date(step[field]);
    return step;
  });
  if (new Set(steps.map((s) => s.id)).size !== steps.length) throw new DomainError(400, "INVALID_WORKFLOW", "شناسه مرحله تکراری است.");
  for (const step of steps) for (const field of ["onApprove", "onReject"]) if (!["next", "previous", "stay", "done"].includes(step[field]) && !steps.some((s) => s.id === step[field])) throw new DomainError(400, "INVALID_WORKFLOW_ROUTE", "مسیر گردش‌کار معتبر نیست.");
  return steps;
}
export async function validateStepMembers(tx, c, steps) {
  for (const step of steps) {
    if (step.assigneeType === "member") await activeMember(tx, c, text(step.assigneeMemberId, "مسئول مرحله"));
    if (step.requiresApproval && step.approvalAssigneeType === "member") await activeMember(tx, c, text(step.approvalAssigneeMemberId, "تأییدکننده"));
  }
}
export async function pendingMembers(tx, c, task, project, step) {
  if (!step) return [];
  const prefix = step.requiresApproval ? "approvalAssignee" : "assignee";
  const type = step[`${prefix}Type`] || (step.requiresApproval ? "task_assigner" : "task_assignee_primary");
  let ids;
  switch (type) {
    case "task_assigner": ids = [task.assignerId]; break;
    case "task_assignee_primary": ids = [task.assigneePrimaryId]; break;
    case "task_assignee_secondary": ids = [task.assigneeSecondaryId]; break;
    case "project_owner": ids = [project?.ownerId]; break;
    case "project_members": ids = [project?.ownerId, ...(project?.members || []).map((m) => m.userId)]; break;
    case "member": ids = [step[`${prefix}MemberId`]]; break;
    case "all_participants": ids = [task.assignerId, task.assigneePrimaryId, task.assigneeSecondaryId, project?.ownerId, ...(project?.members || []).map((m) => m.userId)]; break;
    case "role": {
      const role = step[`${prefix}Role`];
      const roles = role === "admin" ? ["owner", "admin"] : role === "manager" ? ["project_manager"] : [role];
      const rows = await tx.organizationMembership.findMany({ where: { organizationId: c.organizationId, status: "active", role: { in: roles }, user: { isActive: true } }, select: { userId: true } });
      ids = rows.map((r) => r.userId); break;
    }
    default: throw new DomainError(400, "INVALID_WORKFLOW", "مسئول مرحله مشخص نیست.");
  }
  const rows = await tx.organizationMembership.findMany({ where: { organizationId: c.organizationId, status: "active", userId: { in: [...new Set(ids.filter(Boolean))] }, role: { not: "guest" }, user: { isActive: true } }, select: { userId: true } });
  return rows.map((r) => r.userId);
}
export function routeTarget(steps, index, route) {
  if (route === "done") return steps.length;
  if (route === "next") return index + 1;
  if (route === "previous") return Math.max(0, index - 1);
  if (route === "stay") return index;
  return steps.findIndex((s) => s.id === route);
}

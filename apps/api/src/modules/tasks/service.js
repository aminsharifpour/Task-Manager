import {Prisma} from "@prisma/client";
import {taskVisibilitySQL} from "./visibility-sql.js";
import crypto from "node:crypto";
import { taskFields, parentChain, canComplete, canReopen } from "./rules.js";
import { getProject, projectVisibility } from "../organizations/service.js";
import { requireManager } from "../organizations/policy.js";
import { prisma, readScoped, pagination, DomainError, deny, text, optionalText, date, manager, requireInternal, mutate, audit, activeMember, uuid, pageRows } from "../shared/scoped.js";
import { normalizeSteps, validateStepMembers, pendingMembers, routeTarget } from "./workflow.js";

export function visibleTasks(c) {
  const where = { organizationId: c.organizationId };
  if (!["owner", "admin"].includes(c.role)) where.OR = [
    { project: { is: projectVisibility(c) } },
    ...(c.role === "guest" ? [] : [{ assignerId: c.userId }, { assigneePrimaryId: c.userId }, { assigneeSecondaryId: c.userId },
      { workflowPendingAssigneeIds: { array_contains: [c.userId] } }, { workflowEvents: { some: { organizationId: c.organizationId, actorUserId: c.userId } } }]),
  ];
  return where;
}
export function assertEditable(current,task){
  const managesProject = current.role === "project_manager" && (task.project?.ownerId === current.userId || task.project?.members.some(m => m.userId === current.userId));
  if (!["owner", "admin"].includes(current.role) && !managesProject && task.assignerId !== current.userId && task.assigneePrimaryId !== current.userId && task.assigneeSecondaryId !== current.userId) throw new DomainError(403, "PERMISSION_DENIED", "ویرایش تسک فقط برای مسئولان آن مجاز است.");
}
const version = (v) => {
  if (!Number.isInteger(v) || v < 0) throw new DomainError(400, "VERSION_REQUIRED", "نسخه فعلی تسک لازم است.");
  return v;
};
const statusValue = (value) => {
  if (!["todo", "doing", "blocked", "done"].includes(value)) throw new DomainError(400, "INVALID_STATUS", "وضعیت معتبر نیست.");
  return value;
};
export async function listTasks(c,q){const {skip,take,page,pageSize}=pagination(q),projectId=q.projectId?text(q.projectId,"پروژه"):null,status=q.status?statusValue(q.status):null,priority=q.priority||null;if(priority&&!["low","normal","high","urgent"].includes(priority))throw new DomainError(400,"INVALID_PRIORITY","اولویت معتبر نیست.");const sort=q.sort||"newest",sorts={newest:Prisma.sql`t."createdAt" DESC,t.id ASC`,due:Prisma.sql`t."executionDate" ASC NULLS LAST,t.id ASC`,title:Prisma.sql`t.title ASC,t.id ASC`};if(typeof sort!=="string"||!Object.hasOwn(sorts,sort))throw new DomainError(400,"INVALID_SORT","مرتب‌سازی معتبر نیست.");const search=q.search?text(q.search,"جست‌وجو").replace(/[\\%_]/g,"\\$&"):null,from=q.from?date(q.from):null,to=q.to?date(q.to):null,assignee=q.assigneeId?text(q.assigneeId,"مسئول"):null;return readScoped(c,"tasks",async(tx,current)=>{const where=Prisma.sql`${taskVisibilitySQL(current)} ${projectId?Prisma.sql`AND t."projectId"=${projectId}`:Prisma.empty} ${status?Prisma.sql`AND t.status=${status}::"TaskStatus"`:Prisma.empty} ${priority?Prisma.sql`AND t.priority=${priority}`:Prisma.empty} ${assignee?Prisma.sql`AND t."assigneePrimaryId"=${assignee}`:Prisma.empty} ${search?Prisma.sql`AND t.title ILIKE ${"%"+search+"%"}`:Prisma.empty} ${from?Prisma.sql`AND t."executionDate">=${from}`:Prisma.empty} ${to?Prisma.sql`AND t."executionDate"<=${to}`:Prisma.empty}`;const [items,count]=await Promise.all([tx.$queryRaw`SELECT t.*,CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object('id',p.id,'name',p.name) END AS project,CASE WHEN u.id IS NULL THEN NULL ELSE jsonb_build_object('fullName',u."fullName") END AS "assigneePrimary" FROM "Task" t LEFT JOIN "Project" p ON p."organizationId"=t."organizationId" AND p.id=t."projectId" LEFT JOIN "User" u ON u.id=t."assigneePrimaryId" WHERE ${where} ORDER BY ${sorts[sort]} LIMIT ${take} OFFSET ${skip}`,tx.$queryRaw`SELECT COUNT(*)::int AS total FROM "Task" t WHERE ${where}`]);const managed=current.role==="project_manager"?await tx.project.findMany({where:{organizationId:current.organizationId,id:{in:items.map(row=>row.projectId).filter(Boolean)},OR:[{ownerId:current.userId},{members:{some:{userId:current.userId}}}]},select:{id:true}}):[];const managedIds=new Set(managed.map(row=>row.id));return {items:items.map(row=>({...row,canEdit:current.role!=="guest"&&(["owner","admin"].includes(current.role)||[row.assignerId,row.assigneePrimaryId,row.assigneeSecondaryId].includes(current.userId)||managedIds.has(row.projectId))})),total:count[0].total,page,pageSize};});}
export async function getTask(c, id, tx = prisma) {
  const task = await tx.task.findFirst({ where: { ...visibleTasks(c), id }, include: { project: { include: { members: { select: { userId: true } } } }, workflowComments: { where: { organizationId: c.organizationId }, orderBy: { createdAt: "asc" }, take: 300 } } });
  if (!task) deny();
  return task;
}
export async function readTask(c, id) {
  const task = await getTask(c, id);
  return { ...task, project: task.project ? { id: task.project.id, name: task.project.name } : null };
}
export async function createTask(c, body) {
  requireInternal(c);
  const title = text(body.title, "عنوان تسک");
  const projectId = text(body.projectId, "پروژه");
  const assigneePrimaryId = text(body.assigneePrimaryId || c.userId, "مسئول");
  const description = optionalText(body.description, "توضیح");
  const executionDate = date(body.executionDate, true);
  const announceDate = date(body.announceDate, true);
  return mutate(c, "tasks", async (tx, current) => {
    requireInternal(current);
    const project = await getProject(current, projectId, tx);
    if(["archived","completed"].includes(project.status))throw new DomainError(409,"PROJECT_CLOSED","پروژه بسته یا بایگانی شده است.");
    const fields=taskFields(body,project);
    let parent=null;if(body.parentTaskId){parent=await getTask(current,text(body.parentTaskId,"تسک والد"),tx);if(parent.projectId!==projectId||parent.status==="done")throw new DomainError(409,"INVALID_PARENT","والد باید در همین پروژه و تکمیل‌نشده باشد.");}
    const parentTaskId=await parentChain(tx,current,null,parent);
    await activeMember(tx, current, assigneePrimaryId);
    if (body.assigneeSecondaryId) await activeMember(tx, current, text(body.assigneeSecondaryId, "مسئول دوم"));
    const steps = normalizeSteps(body.workflowSteps ?? project.workflowTemplateSteps ?? []);
    await validateStepMembers(tx, current, steps);
    const taskData = { id: uuid(), organizationId: current.organizationId, projectId, title, description, assignerId: current.userId,
      assigneePrimaryId, assigneeSecondaryId: body.assigneeSecondaryId || null, announceDate, executionDate,
      ...fields, parentTaskId, status: "todo", workflowSteps: steps, workflowCurrentStep: steps.length ? 0 : -1 };
    const pending = await pendingMembers(tx, current, taskData, project, steps[0]);
    if (steps.length && !pending.length) throw new DomainError(400, "NO_STAGE_ASSIGNEE", "مرحله مسئول فعال ندارد.");
    const task = await tx.task.create({ data: { ...taskData, workflowPendingAssigneeIds: pending } });
    await audit(tx, current, "task.created", task.id);
    await notify(tx, current, task, [...new Set([assigneePrimaryId, ...pending])]);
    return task;
  });
}
export async function updateTask(c, id, body) {
  requireInternal(c); const expectedVersion = version(body.expectedVersion);
  return mutate(c, "tasks", async (tx, current) => {
    requireInternal(current);
    const task = await getTask(current, id, tx);
    assertEditable(current,task);
    if (task.version !== expectedVersion) throw new DomainError(409, "VERSION_CONFLICT", "تسک تغییر کرده است؛ دوباره دریافت کنید.");
    if (body.workflowSteps !== undefined) throw new DomainError(409, "WORKFLOW_SNAPSHOT_LOCKED", "گردش‌کار فعال مستقل از قالب پروژه است و در این مسیر تغییر نمی‌کند.");
    const data = { version: { increment: 1 }, ...taskFields(body,task.project,task) };
    if(body.parentTaskId!==undefined){let parent=null;if(body.parentTaskId){parent=await getTask(current,text(body.parentTaskId,"والد"),tx);if(!task.projectId||parent.projectId!==task.projectId||parent.status==="done")throw new DomainError(409,"INVALID_PARENT","والد معتبر نیست.");}data.parentTaskId=await parentChain(tx,current,id,parent); }
    if (body.title !== undefined) data.title = text(body.title, "عنوان");
    if (body.description !== undefined) data.description = optionalText(body.description, "توضیح");
    if (body.executionDate !== undefined) data.executionDate = date(body.executionDate, true);
    if (body.assigneePrimaryId !== undefined) { await activeMember(tx, current, body.assigneePrimaryId); data.assigneePrimaryId = body.assigneePrimaryId; }
    if (body.status !== undefined) {
      data.status = statusValue(body.status);
      if(data.status==="done")await canComplete(tx,current,id);
      if(task.status==="done"&&data.status!=="done")await canReopen(tx,current,id);
      if (task.workflowSteps?.length && (data.status === "done" || task.status === "done" && data.status !== "done")) throw new DomainError(409, "WORKFLOW_DECISION_REQUIRED", "تکمیل تسک از مسیر گردش‌کار انجام می‌شود.");
      data.blockedReason = optionalText(body.blockedReason, "دلیل توقف");
      if (data.status === "blocked" && !data.blockedReason) throw new DomainError(400, "BLOCKED_REASON_REQUIRED", "دلیل توقف را وارد کنید.");
      data.isDone = data.status === "done"; data.lastStatusChangedAt = new Date();
    }
    if (data.assigneePrimaryId && task.workflowSteps?.length) data.workflowPendingAssigneeIds = await pendingMembers(tx, current, { ...task, assigneePrimaryId: data.assigneePrimaryId }, task.project, task.workflowSteps[task.workflowCurrentStep]);
    const updated = await tx.task.update({ where: { id }, data });
    await audit(tx, current, "task.updated", id); return updated;
  });
}
export async function deleteTask(c, id, expectedVersion) {
  requireManager(c); version(expectedVersion);
  return mutate(c, "tasks", async (tx, current) => {
    requireManager(current); const task = await getTask(current, id, tx);
    if (current.role === "project_manager") await getProject(current, task.projectId, tx);
    if (task.version !== expectedVersion) throw new DomainError(409, "VERSION_CONFLICT", "تسک تغییر کرده است.");
    if (await tx.taskFile.count({ where: { organizationId: current.organizationId, taskId: id } })) throw new DomainError(409, "TASK_HAS_FILES", "تسک دارای فایل و تاریخچه نسخه است؛ حذف آن در این مرحله مجاز نیست.");
    if(await tx.task.count({where:{organizationId:current.organizationId,parentTaskId:id}})||await tx.taskTimeEntry.count({where:{organizationId:current.organizationId,taskId:id}}))throw new DomainError(409,"TASK_HAS_HISTORY","تسک دارای زیرتسک یا ثبت زمان است؛ حذف مجاز نیست.");
    await tx.taskDependency.deleteMany({where:{organizationId:current.organizationId,OR:[{taskId:id},{dependsOnTaskId:id}]}});
    await tx.task.delete({ where: { id } }); await audit(tx, current, "task.deleted", id); return { ok: true };
  });
}
export async function addComment(c, id, body) {
  requireInternal(c); const content = text(body.text, "نظر", 1200); const stepId = text(body.stepId||"general", "مرحله", 64);
  return mutate(c, "tasks", async (tx, current) => {
    requireInternal(current); const task = await getTask(current, id, tx);
    if (stepId!=="general"&&!task.workflowSteps?.some((s) => s.id === stepId)) throw new DomainError(400, "INVALID_STEP", "مرحله معتبر نیست.");
    const comment = await tx.taskWorkflowComment.create({ data: { id: uuid(), organizationId: current.organizationId, taskId: id, stepId, authorId: current.userId, text: content } });
    await audit(tx, current, "task.comment_created", id); return comment;
  });
}
async function notify(tx, c, task, recipients) {
  for (const userId of recipients.filter((id) => id !== c.userId)) {
    await tx.notification.create({ data: { id: uuid(), organizationId: c.organizationId, userId, kind: "task", title: task.title,
      description: "تسک منتظر اقدام شماست.", taskId: task.id, projectId: task.projectId, entityId: task.id, entityType: "task", targetView: "tasks" } });
  }
}
export async function decide(c, id, body) {
  requireInternal(c); const expectedVersion = version(body.expectedVersion);
  const idempotencyKey = text(body.idempotencyKey, "شناسه درخواست", 100);
  const decision = body.decision;
  if (!["advance", "approve", "reject"].includes(decision)) throw new DomainError(400, "INVALID_DECISION", "تصمیم معتبر نیست.");
  const payloadHash = crypto.createHash("sha256").update(JSON.stringify({ actor: c.userId, expectedVersion, decision })).digest("hex");
  return mutate(c, "tasks", async (tx, current) => {
    requireInternal(current); const task = await getTask(current, id, tx);
    const receipt = await tx.taskWorkflowEvent.findUnique({ where: { organizationId_taskId_idempotencyKey: { organizationId: current.organizationId, taskId: id, idempotencyKey } } });
    if (receipt) {
      if (receipt.payloadHash !== payloadHash) throw new DomainError(409, "IDEMPOTENCY_CONFLICT", "شناسه درخواست قبلاً برای تصمیم دیگری استفاده شده است.");
      return receipt.resultSnapshot;
    }
    if (task.version !== expectedVersion) throw new DomainError(409, "VERSION_CONFLICT", "تسک تغییر کرده است؛ دوباره دریافت کنید.");
    const steps = normalizeSteps(task.workflowSteps || []), index = task.workflowCurrentStep, step = steps[index];
    if (!step || task.workflowCompletedAt) throw new DomainError(409, "WORKFLOW_NOT_ACTIVE", "گردش‌کار فعالی وجود ندارد.");
    if (step.requiresApproval === (decision === "advance")) throw new DomainError(400, "DECISION_TYPE_MISMATCH", "نوع اقدام با مرحله سازگار نیست.");
    const assigned = await pendingMembers(tx, current, task, task.project, step);
    if (!assigned.includes(current.userId)) throw new DomainError(403, "APPROVER_REQUIRED", "شما مسئول این مرحله نیستید.");
    const next = routeTarget(steps, index, decision === "advance" ? "next" : decision === "approve" ? step.onApprove : step.onReject);
    const done = next >= steps.length;
    if(done)await canComplete(tx,current,id);
    const pending = done ? [] : await pendingMembers(tx, current, task, task.project, steps[next]);
    if (!done && !pending.length) throw new DomainError(409, "NO_STAGE_ASSIGNEE", "مرحله بعد مسئول فعال ندارد.");
    const result = await tx.task.update({ where: { id }, data: { workflowCurrentStep: done ? steps.length - 1 : next,
      workflowPendingAssigneeIds: pending, workflowCompletedAt: done ? new Date() : null, status: done ? "done" : "doing", isDone: done, version: { increment: 1 }, lastStatusChangedAt: new Date() } });
    await tx.taskWorkflowEvent.create({ data: { organizationId: current.organizationId, taskId: id, actorUserId: current.userId, idempotencyKey, payloadHash,
      decision, fromStep: index, toStep: done ? steps.length : next, resultSnapshot: JSON.parse(JSON.stringify(result)) } });
    await audit(tx, current, `task.workflow.${decision}`, id); await notify(tx, current, result, pending); return result;
  });
}
export async function history(c, id) {
  await getTask(c, id);
  return prisma.taskWorkflowEvent.findMany({ where: { organizationId: c.organizationId, taskId: id }, orderBy: { createdAt: "asc" }, take: 300,
    select: { id: true, actorUserId: true, decision: true, fromStep: true, toStep: true, createdAt: true } });
}

import crypto from "node:crypto";
import { chosenTemplate, fieldDefinitions, projectDates, customValues } from "../projects/definitions.js";
import prisma from "../../prisma.js";
import { runtimeConfig } from "../../runtime-config.js";
import { DomainError, deny, requireAdmin, requireManager, text, pagination } from "./policy.js";

const hash = (token) => crypto.createHash("sha256").update(token).digest("hex");
const audit = (tx, context, action, entityId) => tx.organizationAudit.create({ data: {
  organizationId: context.organizationId, actorUserId: context.userId, action, entityId,
} });
const lockOrganization = (tx, id) => tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${id} FOR UPDATE`;

export async function contextFor(userId, organizationId, tx = prisma) {
  if (!userId || !organizationId) deny();
  const membership = await tx.organizationMembership.findUnique({ where: {
    organizationId_userId: { organizationId, userId },
  }, include: { user: { select: { isActive: true } } } });
  if (!membership || membership.status !== "active" || !membership.user.isActive) deny();
  return Object.freeze({ organizationId, userId, role: membership.role,
    canManageHr: membership.canManageHr, canManageAccounting: membership.canManageAccounting });
}

export async function listOrganizations(userId) {
  return prisma.organization.findMany({ where: { memberships: { some: { userId, status: "active" } } },
    select: { id: true, name: true, timezone: true, calendar: true, logoUrl: true,
      memberships: { where: { userId }, select: { role: true } } }, orderBy: { createdAt: "asc" } });
}

export async function createOrganization(userId, body) {
  if (runtimeConfig.deploymentMode !== "hosted") throw new DomainError(403, "LOCAL_SETUP_REQUIRED", "ایجاد سازمان در نصب محلی از مسیر راه‌اندازی انجام می‌شود.");
  const name = text(body.name, "نام سازمان");
  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({ data: { name, memberships: { create: { userId, role: "owner", canManageHr: true, canManageAccounting: true } } } });
    await audit(tx, { organizationId: org.id, userId }, "organization.created", org.id);
    return { id: org.id, name: org.name };
  });
}

export function projectVisibility(context){return {organizationId:context.organizationId,...(["owner","admin"].includes(context.role)?{}:context.role==="guest"?{members:{some:{userId:context.userId}}}:{OR:[{ownerId:context.userId},{members:{some:{userId:context.userId}}}]})};}

export async function listProjects(context, query) {
  const { skip, take, page, pageSize } = pagination(query);
  if (query.search !== undefined && (typeof query.search !== "string" || query.search.length > 200)) throw new DomainError(400, "INVALID_INPUT", "جست‌وجو معتبر نیست.");
  if(query.status && !["active","paused","completed","archived"].includes(query.status))throw new DomainError(400,"INVALID_STATUS","وضعیت پروژه معتبر نیست.");
  const where = { ...projectVisibility(context), ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}), ...(query.status ? {status:query.status} : {}) };
  const [items, total] = await prisma.$transaction([
    prisma.project.findMany({ where, skip, take, orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      select: { id: true, name: true, description: true, ownerId: true, owner:{select:{fullName:true}}, createdAt: true, updatedAt: true, version: true, status: true, startDate: true, endDate: true, templateId: true, customFieldDefinitions: true } }),
    prisma.project.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function createProject(context, body) {
  requireManager(context);
  const name = text(body.name, "نام پروژه");
  const template=chosenTemplate(body.templateId); const dates=projectDates(body); const definitions=fieldDefinitions(body.customFieldDefinitions ?? template?.fields ?? []); const starterFields=template&&body.createStarterTasks!==false?customValues(body.starterTaskCustomFields||{},definitions):{};
  const description = body.description == null || body.description === "" ? null : text(body.description, "توضیح", 5000);
  return prisma.$transaction(async (tx) => {
    await lockOrganization(tx, context.organizationId);
    const current = await contextFor(context.userId, context.organizationId, tx);
    requireManager(current);
    if(template&&body.createStarterTasks!==false&&(await tx.organization.findUnique({where:{id:current.organizationId},select:{allowedModules:true}}))?.allowedModules?.tasks===false)throw new DomainError(403,"PLAN_FEATURE_DISABLED","تسک در طرح سازمان فعال نیست؛ پروژه را بدون تسک آغازین بسازید.");
    if(template&&body.createStarterTasks!==false&&(await tx.organizationSetting.findUnique({where:{organizationId:current.organizationId}}))?.modules?.tasks===false)throw new DomainError(403,"MODULE_DISABLED","تسک برای این سازمان غیرفعال است؛ پروژه را بدون تسک آغازین بسازید.");
    const ownerId=text(body.ownerId||current.userId,"مسئول پروژه",100); const owner=await contextFor(ownerId,current.organizationId,tx); if(owner.role==="guest")deny();
    const project = await tx.project.create({ data: { id: crypto.randomUUID(), name, description, ...dates, templateId:template?.id||null, customFieldDefinitions:definitions, workflowTemplateSteps:template?.steps||[], organizationId: current.organizationId, ownerId } });
    if(current.role==="project_manager"&&ownerId!==current.userId)await tx.projectMember.create({data:{id:crypto.randomUUID(),organizationId:current.organizationId,projectId:project.id,userId:current.userId}});
    if(template&&body.createStarterTasks!==false)for(const title of template.tasks)await tx.task.create({data:{id:crypto.randomUUID(),organizationId:current.organizationId,projectId:project.id,title,assignerId:current.userId,assigneePrimaryId:ownerId,workflowSteps:template.steps,workflowCurrentStep:0,workflowPendingAssigneeIds:[ownerId],customFields:starterFields}});
    await audit(tx, current, "project.created", project.id);
    return project;
  });
}

export async function getProject(context, id, tx = prisma) {
  const project = await tx.project.findFirst({ where: { id, organizationId: context.organizationId },
    include: { owner:{select:{fullName:true}}, members: { select: { userId: true, user: { select: { fullName: true } } } } } });
  if (!project) deny();
  if (!["owner", "admin"].includes(context.role) && (context.role === "guest" || project.ownerId !== context.userId) && !project.members.some((m) => m.userId === context.userId)) deny();
  return project;
}

export async function grantProject(context, projectId, userId) {
  requireManager(context);
  return prisma.$transaction(async (tx) => {
    await lockOrganization(tx, context.organizationId);
    const current = await contextFor(context.userId, context.organizationId, tx);
    requireManager(current);
    await getProject(current, projectId, tx);
    await contextFor(userId, current.organizationId, tx);
    await tx.projectMember.upsert({ where: { projectId_userId: { projectId, userId } },
      create: { id: crypto.randomUUID(), organizationId: current.organizationId, projectId, userId }, update: { organizationId: current.organizationId } });
    await audit(tx, current, "project.access_granted", projectId);
    return { ok: true };
  });
}

export async function revokeProject(context, projectId, userId) {
  requireManager(context);
  const target = text(userId, "عضو پروژه", 100);
  return prisma.$transaction(async (tx) => {
    await lockOrganization(tx, context.organizationId);
    const current = await contextFor(context.userId, context.organizationId, tx);
    requireManager(current);
    await getProject(current, projectId, tx);
    const removed = await tx.projectMember.deleteMany({ where: {
      organizationId: current.organizationId, projectId, userId: target,
    } });
    if (removed.count) await audit(tx, current, "project.access_revoked", projectId);
    return { ok: true };
  });
}

export async function createInvitation(context, body) {
  requireAdmin(context);
  const email = text(body.email, "ایمیل", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new DomainError(400, "INVALID_INPUT", "ایمیل معتبر نیست.");
  let invitedUserId = body.userId ? text(body.userId, "شناسه کاربر",100) : null;
  const role = body.role || "member";
  if (!["admin", "project_manager", "member", "guest"].includes(role)) throw new DomainError(400, "INVALID_ROLE", "نقش معتبر نیست.");
  if (role === "admin" && context.role !== "owner") throw new DomainError(403, "PERMISSION_DENIED", "فقط مالک می‌تواند مدیر دعوت کند.");
  const token = crypto.randomBytes(32).toString("base64url");
  return prisma.$transaction(async (tx) => {
    await lockOrganization(tx, context.organizationId);
    const current = await contextFor(context.userId, context.organizationId, tx);
    requireAdmin(current);
    if (role === "admin" && current.role !== "owner") throw new DomainError(403, "PERMISSION_DENIED", "فقط مالک می‌تواند مدیر دعوت کند.");
    if(invitedUserId){const user=await tx.user.findUnique({where:{id:invitedUserId},select:{email:true,isActive:true}});if(!user?.isActive||user.email?.toLowerCase()!==email)deny();}
    else{const matches=await tx.user.findMany({where:{email:{equals:email,mode:"insensitive"}},select:{id:true,isActive:true},take:2});if(matches.length>1)throw new DomainError(409,"IDENTITY_AMBIGUOUS","چند هویت با این ایمیل وجود دارد؛ شناسه حساب را صریح وارد کنید.");if(matches.length){if(!matches[0].isActive)deny();invitedUserId=matches[0].id;}}
    const invitation = await tx.organizationInvitation.create({ data: { organizationId: context.organizationId,
      email, invitedUserId, createdById: current.userId, role, tokenHash: hash(token), expiresAt: new Date(Date.now() + 7 * 86400000) } });
    await audit(tx, current, "invitation.created", invitation.id);
    return { id: invitation.id, token, expiresAt: invitation.expiresAt };
  });
}

export async function acceptInvitation(userId, token, externalTx=null) {
  const tokenHash = hash(text(token, "دعوت‌نامه", 100));
  const accept=async (tx) => {
    const invite = await tx.organizationInvitation.findUnique({ where: { tokenHash } });
    if (!invite || invite.invitedUserId && invite.invitedUserId !== userId || invite?.acceptedAt || invite?.revokedAt || invite?.expiresAt <= new Date()) deny();
    await lockOrganization(tx, invite.organizationId);
    if (!invite.createdById) deny();
    const inviter = await contextFor(invite.createdById, invite.organizationId, tx);
    requireAdmin(inviter);
    if (invite.role === "admin" && inviter.role !== "owner") deny();
    const user = await tx.user.findUnique({ where: { id: userId }, select: { isActive: true,email:true } });
    if (!user?.isActive||user.email?.toLowerCase()!==invite.email.toLowerCase()) deny();
    const existing = await tx.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId: invite.organizationId, userId } } });
    // An invitation cannot silently upgrade an existing member or reactivate a revoked one.
    if (existing) throw new DomainError(409, "MEMBERSHIP_EXISTS", "عضویت از قبل وجود دارد؛ تغییر آن به مدیر نیاز دارد.");
    const org = await tx.organization.findUnique({ where: { id: invite.organizationId } });
    const count = await tx.organizationMembership.count({ where: { organizationId: org.id, status: "active" } });
    if (count >= org.activeMemberLimit) throw new DomainError(409, "MEMBER_LIMIT", "ظرفیت اعضای فعال سازمان تکمیل است.");
    const claimed = await tx.organizationInvitation.updateMany({ where: { id: invite.id, acceptedAt: null, revokedAt:null, expiresAt: { gt: new Date() } }, data: { acceptedAt: new Date(),invitedUserId:userId } });
    if (claimed.count !== 1) throw new DomainError(409, "INVITATION_USED", "دعوت‌نامه قبلاً استفاده شده است.");
    await tx.organizationMembership.create({ data: { organizationId: org.id, userId, role: invite.role } });
    await audit(tx, { organizationId: org.id, userId }, "invitation.accepted", invite.id);
    return { organizationId: org.id };
  };
  return externalTx?accept(externalTx):prisma.$transaction(accept);
}

export async function revokeMembership(context, userId) {
  requireAdmin(context);
  return prisma.$transaction(async (tx) => {
    await lockOrganization(tx, context.organizationId);
    const current = await contextFor(context.userId, context.organizationId, tx);
    requireAdmin(current);
    const target = await contextFor(userId, current.organizationId, tx);
    if (target.role === "owner" || (target.role === "admin" && current.role !== "owner")) throw new DomainError(403, "PROTECTED_MEMBERSHIP", "این عضویت قابل لغو نیست.");
    await tx.organizationMembership.update({ where: { organizationId_userId: { organizationId: current.organizationId, userId } }, data: { status: "revoked" } });
    await audit(tx, current, "membership.revoked", userId);
    return { ok: true };
  });
}

export async function listAudit(context, query) {
  requireAdmin(context);
  const { skip, take } = pagination(query);
  const privatePrefixes = ["hr.", "account.", "transaction.", "budget.", "chat."];
  const allowed = [{ NOT: { OR: privatePrefixes.map(prefix => ({ action: { startsWith: prefix } })) } }];
  if (context.canManageHr) allowed.push({ action: { startsWith: "hr." } });
  if (context.canManageAccounting) allowed.push({ actorUserId: context.userId, OR: ["account.", "transaction.", "budget."].map(prefix => ({ action: { startsWith: prefix } })) });
  allowed.push({ actorUserId: context.userId, action: { startsWith: "chat." } });
  return prisma.organizationAudit.findMany({ where: { organizationId: context.organizationId, OR: allowed }, skip, take,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }] });
}

export async function listInvitations(c,query){requireAdmin(c);const {skip,take,page,pageSize}=pagination(query);const where={organizationId:c.organizationId};const [items,total]=await Promise.all([prisma.organizationInvitation.findMany({where,skip,take,orderBy:{createdAt:"desc"},select:{id:true,email:true,role:true,expiresAt:true,acceptedAt:true,revokedAt:true,createdAt:true}}),prisma.organizationInvitation.count({where})]);return {items,total,page,pageSize};}
export async function revokeInvitation(c,id){requireAdmin(c);return prisma.$transaction(async tx=>{await lockOrganization(tx,c.organizationId);const current=await contextFor(c.userId,c.organizationId,tx);requireAdmin(current);const row=await tx.organizationInvitation.findFirst({where:{id,organizationId:current.organizationId}});if(!row)deny();if(row.role==="admin"&&current.role!=="owner")throw new DomainError(403,"PERMISSION_DENIED","لغو دعوت مدیر با مالک است.");await tx.organizationInvitation.update({where:{id},data:{revokedAt:new Date()}});await audit(tx,current,"invitation.revoked",id);return {ok:true};});}

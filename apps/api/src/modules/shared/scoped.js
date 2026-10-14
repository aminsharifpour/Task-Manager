import crypto from "node:crypto";
import prisma from "../../prisma.js";
import { contextFor } from "../organizations/service.js";
import { DomainError, deny, pagination, text } from "../organizations/policy.js";

export { prisma, DomainError, deny, pagination, text };
export const manager = (c) => ["owner", "admin", "project_manager"].includes(c.role);
export const defaultModules = Object.freeze({ teams: true, tasks: true, files: true, minutes: true, chat: true, notifications: true, hr: true, accounting: false });
export const optionalText = (v, label, max = 5000) => v == null || v === "" ? null : text(v, label, max);
export function date(v, nullable = false) {
  if (nullable && (v == null || v === "")) return null;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(v) || Number.isNaN(new Date(v).getTime())) throw new DomainError(400, "INVALID_DATE", "تاریخ معتبر نیست.");
  const d = new Date(v);
  if (d.toISOString().slice(0, 10) !== v.slice(0, 10)) throw new DomainError(400, "INVALID_DATE", "تاریخ معتبر نیست.");
  return d;
}
export function decimal(v, nullable = false) {
  if (nullable && (v == null || v === "")) return null;
  if ((typeof v !== "string" && typeof v !== "number") || typeof v === "number" && Math.abs(v) > Number.MAX_SAFE_INTEGER) throw new DomainError(400, "INVALID_AMOUNT", "مقدار عددی معتبر نیست.");
  const value = String(v).trim();
  if (!/^\d{1,16}(\.\d{1,2})?$/.test(value)) throw new DomainError(400, "INVALID_AMOUNT", "مقدار عددی معتبر نیست.");
  return value;
}
export function currency(value) {
  if (!["IRR", "IRT", "USD", "EUR"].includes(value)) throw new DomainError(400, "CURRENCY_REQUIRED", "واحد پول را مشخص کنید.");
  return value;
}
export const idArray = (value) => {
  if (!Array.isArray(value) || value.length > 100 || value.some((v) => typeof v !== "string" || !v || v.length > 100)) throw new DomainError(400, "INVALID_MEMBERS", "فهرست اعضا معتبر نیست.");
  return [...new Set(value)];
};
export async function ensureModule(context, module, tx = prisma) {
  if(module==="accounting")throw new DomainError(403,"MODULE_DISABLED","امور مالی در این محصول ارائه نمی‌شود.");
  const org=await tx.organization.findUnique({where:{id:context.organizationId},select:{allowedModules:true}});
  if(org?.allowedModules?.[module]===false)throw new DomainError(403,"PLAN_FEATURE_DISABLED","این قابلیت در طرح سازمان فعال نیست.");
  const config = await tx.organizationSetting.findUnique({ where: { organizationId: context.organizationId } });
  if (config?.modules?.[module] === false) throw new DomainError(403, "MODULE_DISABLED", "این بخش برای سازمان غیرفعال است.");
}
export async function mutate(context, module, fn) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${context.organizationId} FOR UPDATE`;
    const current = await contextFor(context.userId, context.organizationId, tx);
    if (module) await ensureModule(current, module, tx);
    return fn(tx, current);
  }, { timeout: 15000 });
}
export async function readScoped(context,module,fn){return prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${context.organizationId} FOR SHARE`;const current=await contextFor(context.userId,context.organizationId,tx);if(module)await ensureModule(current,module,tx);return fn(tx,current);},{timeout:15000});}
export const audit = (tx, c, action, entityId) => tx.organizationAudit.create({ data: { organizationId: c.organizationId, actorUserId: c.userId, action, entityId } });
export async function activeMember(tx, c, userId, allowGuest = false) {
  if (typeof userId !== "string" || !userId || userId.length > 100) throw new DomainError(400, "INVALID_MEMBER_ID", "شناسه عضو معتبر نیست.");
  const m = await tx.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId: c.organizationId, userId } }, include: { user: { select: { isActive: true } } } });
  if (!m || m.status !== "active" || !m.user.isActive || !allowGuest && m.role === "guest") deny();
  return m;
}
export function requireInternal(c) { if (c.role === "guest") throw new DomainError(403, "PERMISSION_DENIED", "برای این بخش مجوز ندارید."); }
export function requireSensitive(c, field) { requireInternal(c); if (!c[field]) throw new DomainError(403, "PERMISSION_DENIED", "مجوز مستقل این بخش را ندارید."); }
export async function pageRows(model, where, query, options = {}, tx = prisma) {
  const { skip, take, page, pageSize } = pagination(query);
  const [items, total] = await Promise.all([tx[model].findMany({ where, skip, take, orderBy: [{ createdAt: "desc" }, { id: "asc" }], ...options }), tx[model].count({ where })]);
  return { items, total, page, pageSize };
}
export const uuid = () => crypto.randomUUID();

import { getTask } from "../tasks/service.js";
import { prisma, DomainError, deny, text, requireInternal, ensureModule, mutate, audit, uuid, pageRows } from "../shared/scoped.js";
import { configuredStorage, storageKey } from "./storage.js";

import { hash, filename, validateUpload, storageUsage as usage, maxUploadBytes, acceptedExtensions } from "./common.js";
export { maxUploadBytes, acceptedExtensions };
const versionSelect = { id: true, version: true, originalName: true, mediaType: true, byteSize: true, checksum: true, createdById: true, createdAt: true };
const fileSelect = { id: true, taskId: true, name: true, currentVersion: true, archivedAt: true, createdById: true, createdAt: true, updatedAt: true };
function canWrite(c, task) {
  return c.role !== "guest" && (["owner", "admin"].includes(c.role) || [task.assignerId, task.assigneePrimaryId, task.assigneeSecondaryId].includes(c.userId) || Array.isArray(task.workflowPendingAssigneeIds) && task.workflowPendingAssigneeIds.includes(c.userId) || c.role === "project_manager" && (task.project?.ownerId === c.userId || task.project?.members.some((member) => member.userId === c.userId)));
}
function requireWrite(c, task) {
  requireInternal(c);
  if (!canWrite(c, task)) throw new DomainError(403, "FILE_WRITE_DENIED", "بارگذاری و تغییر فایل فقط برای مسئولان تسک مجاز است.");
}
async function access(c, taskId, tx) {
  await ensureModule(c, "files", tx);
  await ensureModule(c, "tasks", tx);
  return getTask(c, taskId, tx);
}
async function fileFor(c, id, tx, allowArchived = false) {
  const file = await tx.taskFile.findFirst({ where: { id, organizationId: c.organizationId, ...(!allowArchived ? { archivedAt: null } : {}) } });
  if (!file) deny();
  const task = await access(c, file.taskId, tx);
  return { file, task };
}
export async function list(c, taskId, query) {
  return mutate(c, "files", async (tx, current) => {
    const task = await access(current, taskId, tx);
    const includeArchived = query.archived === "true" && canWrite(current, task);
    const page = await pageRows("taskFile", { organizationId: current.organizationId, taskId, ...(!includeArchived ? { archivedAt: null } : {}) }, query, {
      select: { ...fileSelect, versions: { orderBy: { version: "desc" }, take: 1, select: versionSelect } },
    }, tx);
    // Guests see only task-scoped metadata, not organization-wide storage totals.
    return { ...page, canUpload: canWrite(current, task), maxUploadBytes, acceptedExtensions, ...(current.role !== "guest" ? { storage: await usage(current, tx) } : {}) };
  });
}
export async function versions(c, fileId, query) {
  return mutate(c, "files", async (tx, current) => {
    const {task}=await fileFor(current, fileId, tx);
    const reviewKind=current.role==="guest"?"customer":(["owner","admin"].includes(current.role)||task.assignerId===current.userId||current.role==="project_manager"&&canWrite(current,task)||task.workflowSteps?.[task.workflowCurrentStep]?.requiresApproval&&task.workflowPendingAssigneeIds?.includes(current.userId))?"internal":null;
    const result=await pageRows("taskFileVersion", { organizationId: current.organizationId, fileId }, query, { orderBy: { version: "desc" }, select: {...versionSelect,reviews:{take:5,orderBy:{updatedAt:"desc"},select:{reviewerId:true,kind:true,decision:true,comment:true,version:true}}} }, tx);
    const own=await tx.taskFileVersionReview.findMany({where:{organizationId:current.organizationId,reviewerId:current.userId,versionId:{in:result.items.map(row=>row.id)}},select:{versionId:true,version:true,decision:true,comment:true}});
    return {...result,items:result.items.map(row=>({...row,ownReview:own.find(review=>review.versionId===row.id)||null})),reviewKind,userId:current.userId};
  });
}
export async function upload(c, taskId, bytes, options) {
  requireInternal(c);
  const name = filename(options.name), mediaType = validateUpload(bytes, name), checksum = hash(bytes);
  const uploadKey = text(options.uploadKey, "شناسه بارگذاری", 100);
  const fileId = options.fileId ? text(options.fileId, "شناسه فایل", 100) : null;
  const expectedVersion = fileId ? Number(options.expectedVersion) : null;
  if (fileId && (!Number.isInteger(expectedVersion) || expectedVersion < 1)) throw new DomainError(400, "VERSION_REQUIRED", "نسخه فعلی فایل لازم است.");
  const requestHash = hash(JSON.stringify({ taskId, actor: c.userId, fileId, expectedVersion, name, checksum }));
  const storage = configuredStorage(); let writtenKey;
  try {
    return await mutate(c, "files", async (tx, current) => {
      const task = await access(current, taskId, tx); requireWrite(current, task);
      const receipt = await tx.taskFileVersion.findUnique({ where: { organizationId_uploadKey: { organizationId: current.organizationId, uploadKey } }, select: { ...versionSelect, requestHash: true, file: { select: fileSelect } } });
      if (receipt) {
        if (receipt.requestHash !== requestHash) throw new DomainError(409, "IDEMPOTENCY_CONFLICT", "شناسه بارگذاری قبلاً برای فایل دیگری استفاده شده است.");
        if (receipt.file.archivedAt) throw new DomainError(409, "FILE_ARCHIVED", "فایل بایگانی شده است.");
        const { requestHash: ignored, file, ...version } = receipt;
        return { file, version };
      }
      let file;
      if (fileId) {
        ({ file } = await fileFor(current, fileId, tx));
        if (file.taskId !== taskId) deny();
        if (file.currentVersion !== expectedVersion) throw new DomainError(409, "VERSION_CONFLICT", "نسخه فایل تغییر کرده است؛ فهرست را تازه کنید.");
      }
      const storageUsage = await usage(current, tx);
      if (BigInt(storageUsage.usedBytes) + BigInt(bytes.length) > BigInt(storageUsage.limitBytes)) throw new DomainError(409, "STORAGE_LIMIT_REACHED", "فضای فایل سازمان کافی نیست؛ محدودیت فضای سازمان باید افزایش یابد.");
      if (!file) file = await tx.taskFile.create({ data: { id: uuid(), organizationId: current.organizationId, taskId, createdById: current.userId, name } });
      const nextVersion = fileId ? file.currentVersion + 1 : 1;
      const versionId = uuid(), key = storageKey(current.organizationId, file.id, versionId);
      await storage.put(key, bytes); writtenKey = key;
      const version = await tx.taskFileVersion.create({ data: { id: versionId, organizationId: current.organizationId, fileId: file.id, version: nextVersion, originalName: name, mediaType, byteSize: bytes.length, checksum, storageKey: key, uploadKey, requestHash, createdById: current.userId }, select: versionSelect });
      const updated = await tx.taskFile.update({ where: { id: file.id }, data: { currentVersion: nextVersion }, select: fileSelect });
      await audit(tx, current, "file.version_created", file.id);
      return { file: updated, version };
    });
  } catch (error) {
    if (writtenKey) {
      // A lost commit acknowledgement must not delete an object referenced by a committed row.
      try { if (!await prisma.taskFileVersion.findUnique({ where: { storageKey: writtenKey }, select: { id: true } }) && !await prisma.chatAttachment.findUnique({ where: { storageKey: writtenKey }, select: { id: true } })) await storage.remove(writtenKey); }
      catch { console.error(JSON.stringify({ event: "file.cleanup_pending", code: "STORAGE_RECONCILIATION_REQUIRED" })); }
    }
    throw error;
  }
}
export async function download(c, fileId, versionId) {
  return mutate(c, "files", async (tx, current) => {
    await fileFor(current, fileId, tx);
    const version = await tx.taskFileVersion.findFirst({ where: { id: versionId, organizationId: current.organizationId, fileId } });
    if (!version) deny();
    let bytes;
    try { bytes = await configuredStorage().get(version.storageKey, version.byteSize); }
    catch { throw new DomainError(410, "FILE_UNAVAILABLE", "فایل در فضای ذخیره‌سازی در دسترس نیست؛ بازیابی نسخه پشتیبان لازم است."); }
    if (hash(bytes) !== version.checksum) throw new DomainError(410, "FILE_INTEGRITY_ERROR", "یکپارچگی فایل تأیید نشد؛ دانلود متوقف شد.");
    await audit(tx, current, "file.downloaded", fileId);
    return { bytes, name: version.originalName, checksum: version.checksum };
  });
}
export async function archive(c, fileId, body) {
  return mutate(c, "files", async (tx, current) => {
    const { file, task } = await fileFor(current, fileId, tx, true); requireWrite(current, task);
    if (!Number.isInteger(body.expectedVersion) || body.expectedVersion !== file.currentVersion) throw new DomainError(409, "VERSION_CONFLICT", "نسخه فایل تغییر کرده است.");
    if (typeof body.archived !== "boolean") throw new DomainError(400, "INVALID_INPUT", "وضعیت بایگانی معتبر نیست.");
    const updated = await tx.taskFile.update({ where: { id: fileId }, data: { archivedAt: body.archived ? new Date() : null }, select: fileSelect });
    await audit(tx, current, body.archived ? "file.archived" : "file.restored", fileId);
    return updated;
  });
}
async function feedbackVersion(c, fileId, versionId, tx) {
  await fileFor(c, fileId, tx);
  if (!await tx.taskFileVersion.findFirst({ where: { id: versionId, organizationId: c.organizationId, fileId }, select: { id: true } })) deny();
}
export async function feedback(c, fileId, versionId, query) {
  return mutate(c, "files", async (tx, current) => {
    await feedbackVersion(current, fileId, versionId, tx);
    return pageRows("fileVersionFeedback", { organizationId: current.organizationId, versionId }, query, { select: { id: true, text: true, createdAt: true, author: { select: { user: { select: { fullName: true } } } } } }, tx);
  });
}
export async function addFeedback(c, fileId, versionId, body) {
  const content = text(body.text, "بازخورد", 2000);
  return mutate(c, "files", async (tx, current) => {
    await feedbackVersion(current, fileId, versionId, tx);
    const row = await tx.fileVersionFeedback.create({ data: { organizationId: current.organizationId, versionId, authorId: current.userId, text: content }, select: { id: true, text: true, createdAt: true } });
    await audit(tx, current, "file.feedback_created", fileId);
    return row;
  });
}

export async function review(c,fileId,versionId,body){return mutate(c,"files",async(tx,current)=>{
 const {task}=await fileFor(current,fileId,tx);
 const kind=current.role==="guest"?"customer":(["owner","admin"].includes(current.role)||task.assignerId===current.userId||current.role==="project_manager"&&canWrite(current,task)||task.workflowSteps?.[task.workflowCurrentStep]?.requiresApproval&&task.workflowPendingAssigneeIds?.includes(current.userId))?"internal":null;
 if(!kind)throw new DomainError(403,"REVIEWER_REQUIRED","شما تأییدکننده این خروجی نیستید.");
 if(!await tx.taskFileVersion.findFirst({where:{organizationId:current.organizationId,id:versionId,fileId}}))deny();
 if(!["approved","changes_requested"].includes(body.decision))throw new DomainError(400,"INVALID_DECISION","تصمیم نسخه معتبر نیست.");
 const comment=body.comment?text(body.comment,"توضیح بازبینی",2000):null;if(body.decision==="changes_requested"&&!comment)throw new DomainError(400,"REVIEW_COMMENT_REQUIRED","برای درخواست اصلاح توضیح لازم است.");
 const where={organizationId_versionId_reviewerId:{organizationId:current.organizationId,versionId,reviewerId:current.userId}};
 const previous=await tx.taskFileVersionReview.findUnique({where});if(previous&&previous.kind===kind&&previous.decision===body.decision&&previous.comment===comment)return {id:previous.id,kind,decision:previous.decision,comment,version:previous.version};if(!Number.isInteger(body.expectedVersion)||body.expectedVersion!==(previous?.version||0))throw new DomainError(409,"VERSION_CONFLICT","بازبینی تغییر کرده است؛ نسخه را دوباره دریافت کنید.");
 const row=await tx.taskFileVersionReview.upsert({where,create:{organizationId:current.organizationId,versionId,reviewerId:current.userId,kind,decision:body.decision,comment},update:{kind,decision:body.decision,comment,version:{increment:1}}});await audit(tx,current,"file.version_reviewed",fileId);return {id:row.id,kind:row.kind,decision:row.decision,comment:row.comment,version:row.version};
});}

import { prisma, DomainError, deny, text, mutate, audit, uuid, ensureModule, pageRows } from "../shared/scoped.js";
import { hash, filename, validateUpload, maxUploadBytes, acceptedExtensions, storageUsage } from "../files/common.js";
import { configuredStorage, storageKey } from "../files/storage.js";
import { conversation } from "./service.js";
import { attachmentSelect } from "./attachment-policy.js";

async function roomAccess(c, id, tx) {
  await ensureModule(c, "files", tx); await ensureModule(c, "chat", tx);
  return conversation(c, id, tx);
}
export async function drafts(c, id, query) {
  return mutate(c, "chat", async (tx, current) => {
    await roomAccess(current, id, tx);
    return { ...await pageRows("chatAttachment", { organizationId: current.organizationId, conversationId: id, createdById: current.userId, discardedAt: null, messageLinks: { none: {} } }, query, { select: attachmentSelect }, tx), maxUploadBytes, acceptedExtensions };
  });
}
export async function upload(c, id, bytes, options) {
  const name = filename(options.name), mediaType = validateUpload(bytes, name), checksum = hash(bytes);
  const uploadKey = text(options.uploadKey, "شناسه بارگذاری", 100), requestHash = hash(JSON.stringify({ id, userId: c.userId, name, checksum }));
  const storage = configuredStorage(); let writtenKey;
  try {
    return await mutate(c, "chat", async (tx, current) => {
      await roomAccess(current, id, tx);
      const receipt = await tx.chatAttachment.findUnique({ where: { organizationId_uploadKey: { organizationId: current.organizationId, uploadKey } } });
      if (receipt) {
        if (receipt.requestHash !== requestHash) throw new DomainError(409, "IDEMPOTENCY_CONFLICT", "شناسه بارگذاری قبلاً برای فایل دیگری استفاده شده است.");
        if (receipt.discardedAt) throw new DomainError(409, "ATTACHMENT_DISCARDED", "پیوست از پیش‌نویس کنار گذاشته شده است.");
        return tx.chatAttachment.findUnique({ where: { id: receipt.id }, select: attachmentSelect });
      }
      const usage = await storageUsage(current, tx);
      if (BigInt(usage.usedBytes) + BigInt(bytes.length) > BigInt(usage.limitBytes)) throw new DomainError(409, "STORAGE_LIMIT_REACHED", "فضای فایل سازمان کافی نیست.");
      const attachmentId = uuid(), key = storageKey(current.organizationId, attachmentId, uuid());
      await storage.put(key, bytes); writtenKey = key;
      const row = await tx.chatAttachment.create({ data: { id: attachmentId, organizationId: current.organizationId, conversationId: id, createdById: current.userId, originalName: name, mediaType, byteSize: bytes.length, checksum, storageKey: key, uploadKey, requestHash }, select: attachmentSelect });
      await audit(tx, current, "chat.attachment_uploaded", attachmentId); return row;
    });
  } catch (error) {
    if (writtenKey) {
      try { if (!await prisma.chatAttachment.findUnique({ where: { storageKey: writtenKey }, select: { id: true } }) && !await prisma.taskFileVersion.findUnique({ where: { storageKey: writtenKey }, select: { id: true } })) await storage.remove(writtenKey); }
      catch { console.error(JSON.stringify({ event: "file.cleanup_pending", code: "STORAGE_RECONCILIATION_REQUIRED" })); }
    }
    throw error;
  }
}
export async function discard(c, id) {
  return mutate(c, "chat", async (tx, current) => {
    const row = await tx.chatAttachment.findFirst({ where: { id, organizationId: current.organizationId, createdById: current.userId, messageLinks: { none: {} } } });
    if (!row) deny(); await roomAccess(current, row.conversationId, tx);
    await tx.chatAttachment.update({ where: { id }, data: { discardedAt: row.discardedAt || new Date() } });
    await audit(tx, current, "chat.attachment_discarded", id); return { ok: true };
  });
}
export async function download(c, messageId, attachmentId) {
  return mutate(c, "chat", async (tx, current) => {
    const row = await tx.chatMessageAttachment.findUnique({ where: { organizationId_messageId_attachmentId: { organizationId: current.organizationId, messageId, attachmentId } }, include: { message: true, attachment: true } });
    if (!row || row.message.isDeleted) deny();
    await roomAccess(current, row.message.conversationId, tx);
    let bytes;
    try { bytes = await configuredStorage().get(row.attachment.storageKey, row.attachment.byteSize); }
    catch { throw new DomainError(410, "FILE_UNAVAILABLE", "فایل در فضای ذخیره‌سازی در دسترس نیست."); }
    if (hash(bytes) !== row.attachment.checksum) throw new DomainError(410, "FILE_INTEGRITY_ERROR", "یکپارچگی فایل تأیید نشد.");
    await audit(tx, current, "chat.attachment_downloaded", messageId);
    return { bytes, name: row.attachment.originalName, checksum: row.attachment.checksum };
  });
}

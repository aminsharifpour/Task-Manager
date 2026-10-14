export const attachmentSelect = { id: true, originalName: true, mediaType: true, byteSize: true, checksum: true, createdAt: true };
export const messageInclude = { sender:{select:{fullName:true}}, reactions: { select: { userId: true, emoji: true } }, attachmentLinks: { orderBy: { attachmentId: "asc" }, include: { attachment: { select: attachmentSelect } } } };
export function messageView(row) {
  const { attachmentLinks = [], attachments, legacyAttachmentsMigratedAt, requestHash, clientRequestId, ...rest } = row;
  return { ...rest, ...(row.isDeleted ? { text: null, mentions: [] } : {}), attachments: row.isDeleted ? [] : attachmentLinks.map(link => link.attachment), legacyAttachmentsPending: row.isDeleted || legacyAttachmentsMigratedAt ? 0 : Array.isArray(attachments) ? attachments.length : 0 };
}

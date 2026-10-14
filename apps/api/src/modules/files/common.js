export {maxUploadBytes,acceptedExtensions,hash,filename,validateUpload} from "./validation.js";
export async function storageUsage(c, tx) {
  const [sum] = await tx.$queryRaw`SELECT (COALESCE((SELECT SUM("byteSize") FROM "TaskFileVersion" WHERE "organizationId"=${c.organizationId}), 0) + COALESCE((SELECT SUM("byteSize") FROM "ChatAttachment" WHERE "organizationId"=${c.organizationId}), 0) + COALESCE((SELECT SUM("byteSize") FROM "MinuteAttachment" WHERE "organizationId"=${c.organizationId}),0))::text AS bytes`;
  const org = await tx.organization.findUnique({ where: { id: c.organizationId }, select: { storageByteLimit: true } });
  return { usedBytes: sum.bytes, limitBytes: org.storageByteLimit.toString() };
}

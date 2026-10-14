import {isDeepStrictEqual} from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import {planLegacyChatFiles} from "./legacy-file-plan.mjs";
import {filename,validateUpload,hash,storageUsage} from "../../src/modules/files/common.js";
import {storageKey} from "../../src/modules/files/storage.js";
const failure=code=>{throw new Error(code);};
const stableId=input=>{const hex=hash(input).slice(0,32).split("");hex[12]="5";hex[16]="8";return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].map(row=>row.join("")).join("-");};
const immutable=async(file,bytes)=>{try{await fs.writeFile(file,bytes,{flag:"wx",mode:0o600});}catch(error){if(error.code!=="EEXIST")throw error;if(hash(await fs.readFile(file))!==hash(bytes))failure("BACKUP_CONTENT_MISMATCH");}};
export async function readPlannedBlob(source,entry,uploadsRoot){const row=source.chatMessages.find(message=>message.id===entry.messageId),attachment=row?.attachments?.[entry.attachmentIndex];if(!attachment)failure("SOURCE_CHANGED");let bytes;if(entry.origin==="inline")bytes=Buffer.from(attachment.dataUrl.slice(attachment.dataUrl.indexOf(",")+1),"base64");else{const root=await fs.realpath(path.resolve(uploadsRoot)),target=await fs.realpath(path.resolve(uploadsRoot,entry.sourceRelativePath));const relative=path.relative(root,target);if(!relative||relative===".."||relative.startsWith(".."+path.sep)||path.isAbsolute(relative))failure("UNSAFE_PATH");bytes=await fs.readFile(target);}if(bytes.length!==entry.byteSize||hash(bytes)!==entry.checksum)failure("SOURCE_CHANGED");return bytes;}
export async function applyLegacyChatFiles({db,storage,sourceBytes,uploadsRoot,organizationId,manifest,backupDir}){
 const plan=await planLegacyChatFiles({sourceBytes,uploadsRoot,organizationId}),source=JSON.parse(sourceBytes.toString("utf8"));
 if(!organizationId||plan.issues.length)failure("FILE_PLAN_INVALID");
 if(!manifest||manifest.sourceChecksum!==plan.sourceChecksum||JSON.stringify(manifest.entries)!==JSON.stringify(plan.entries)||manifest.issues?.length)failure("MANIFEST_CHANGED");
 if(!(await fs.stat(backupDir)).isDirectory()||(await fs.lstat(backupDir)).isSymbolicLink())failure("EXISTING_BACKUP_DIRECTORY_REQUIRED");
 const archived=await db.migrationImport.findFirst({where:{sourceSnapshot:{equals:source}},select:{checksum:true}});if(!archived)failure("SOURCE_IMPORT_ARCHIVE_REQUIRED");
 const grouped=Map.groupBy(plan.entries,entry=>entry.messageId);
 const validate=async(tx,messageId,entries)=>{const row=await tx.chatMessage.findFirst({where:{id:messageId,organizationId}}),old=source.chatMessages.find(message=>message.id===messageId);if(!row||row.conversationId!==old.conversationId||row.senderId!==old.senderId||!isDeepStrictEqual(row.attachments,old.attachments))failure("TARGET_MESSAGE_MAPPING_MISMATCH");if(!await tx.organizationMembership.findUnique({where:{organizationId_userId:{organizationId,userId:old.senderId}}})||!await tx.chatConversation.findFirst({where:{id:old.conversationId,organizationId}}))failure("TARGET_SCOPE_MISMATCH");for(const entry of entries){const imported=await tx.legacyBlobImport.findUnique({where:{migrationKey:entry.migrationKey}});if(imported&&(imported.organizationId!==organizationId||imported.messageId!==messageId||imported.checksum!==entry.checksum))failure("IMPORT_TARGET_CONFLICT");}return row;};
 // Verify every destination before writing the first object. No project/name guessing, raw JSON is retained.
 for(const [id,entries]of grouped)await validate(db,id,entries);
 await immutable(path.join(backupDir,plan.sourceChecksum+".json"),sourceBytes);
 let imported=0,reused=0;
 for(const [messageId,entries]of grouped){const blobs=[];for(const entry of entries){const bytes=await readPlannedBlob(source,entry,uploadsRoot);const name=filename(entry.name),mediaType=validateUpload(bytes,name);await immutable(path.join(backupDir,entry.checksum+".blob"),bytes);blobs.push({entry,bytes,name,mediaType});}
  await db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${organizationId} FOR UPDATE`;const row=await validate(tx,messageId,entries);for(const {entry,bytes,name,mediaType}of blobs){const existing=await tx.legacyBlobImport.findUnique({where:{migrationKey:entry.migrationKey}});if(existing){const attachment=await tx.chatAttachment.findUnique({where:{id:existing.attachmentId}});if(!attachment||hash(await storage.get(attachment.storageKey,attachment.byteSize))!==entry.checksum)failure("IMPORTED_BLOB_INTEGRITY_ERROR");reused++;continue;}
   const usage=await storageUsage({organizationId},tx);if(BigInt(usage.usedBytes)+BigInt(bytes.length)>BigInt(usage.limitBytes))failure("STORAGE_LIMIT_REACHED");
   const attachmentId=stableId(entry.migrationKey),key=storageKey(organizationId,attachmentId,stableId("blob:"+entry.migrationKey));try{await storage.put(key,bytes);}catch(error){if(error.code!=="EEXIST")throw error;if(hash(await storage.get(key,bytes.length))!==entry.checksum)failure("STAGED_BLOB_INTEGRITY_ERROR");}
   await tx.chatAttachment.create({data:{id:attachmentId,organizationId,conversationId:row.conversationId,createdById:row.senderId,originalName:name,mediaType,byteSize:bytes.length,checksum:entry.checksum,storageKey:key,uploadKey:"legacy:"+entry.migrationKey,requestHash:hash(entry.migrationKey)}});
   await tx.chatMessageAttachment.create({data:{organizationId,messageId,attachmentId}});await tx.legacyBlobImport.create({data:{migrationKey:entry.migrationKey,sourceChecksum:plan.sourceChecksum,organizationId,messageId,attachmentIndex:entry.attachmentIndex,attachmentId,checksum:entry.checksum}});imported++;
  }await tx.chatMessage.update({where:{id:messageId},data:{legacyAttachmentsMigratedAt:row.legacyAttachmentsMigratedAt||new Date()}});await tx.organizationAudit.create({data:{organizationId,actorUserId:"system:legacy-file-import",action:"chat.legacy_files_imported",entityId:messageId}});},{timeout:60000});
 }
 return {sourceChecksum:plan.sourceChecksum,messages:grouped.size,imported,reused,sourceRetained:true};
}

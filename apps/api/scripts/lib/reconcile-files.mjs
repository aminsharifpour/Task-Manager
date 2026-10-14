import crypto from "node:crypto";
import {hash} from "../../src/modules/files/common.js";
const models=["taskFileVersion","chatAttachment","minuteAttachment"];
export async function referenced(db,key){for(const model of models)if(await db[model].findUnique({where:{storageKey:key},select:{id:true}}))return true;return false;}
export async function reconcileFiles({db,storage,applyOrphans=false,minimumAgeDays=7,now=new Date()}){
 if(!Number.isInteger(minimumAgeDays)||minimumAgeDays<7)throw Error("MINIMUM_ORPHAN_AGE_IS_SEVEN_DAYS");
 const report={dryRun:!applyOrphans,referenced:0,verified:0,missing:[],corrupt:[],orphans:[],unknownObjects:[],removed:0},keys=new Set();
 for(const model of models){let cursor;do{const rows=await db[model].findMany({take:500,...(cursor?{skip:1,cursor:{id:cursor}}:{}),orderBy:{id:"asc"},select:{id:true,organizationId:true,storageKey:true,byteSize:true,checksum:true}});for(const row of rows){keys.add(row.storageKey);report.referenced++;try{const bytes=await storage.get(row.storageKey,row.byteSize);if(hash(bytes)!==row.checksum)report.corrupt.push({model,id:row.id});else report.verified++;}catch{report.missing.push({model,id:row.id});}}cursor=rows.length===500?rows.at(-1).id:undefined;}while(cursor);}
 const organizations=await db.organization.findMany({select:{id:true}}),orgByHash=new Map(organizations.map(org=>[crypto.createHash("sha256").update(org.id).digest("hex"),org.id]));
 for await(const object of storage.list()){if(!object.valid){report.unknownObjects.push(object.key);continue;}if(keys.has(object.key))continue;const organizationId=orgByHash.get(object.key.split("/")[0]),oldEnough=object.lastModified&&object.lastModified<=new Date(now.getTime()-minimumAgeDays*86400000);report.orphans.push({key:object.key,byteSize:object.byteSize,eligible:Boolean(organizationId&&oldEnough)});
  if(applyOrphans&&organizationId&&oldEnough)await db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${organizationId} FOR UPDATE`;if(!await referenced(tx,object.key)){await storage.remove(object.key);report.removed++;await tx.organizationAudit.create({data:{organizationId,actorUserId:"system:file-reconciliation",action:"file.orphan_removed",entityId:hash(object.key)}});}});
 }
 return report;
}

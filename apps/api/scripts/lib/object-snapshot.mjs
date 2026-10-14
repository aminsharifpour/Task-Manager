import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
const keyPattern=/^[0-9a-f]{64}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hash=bytes=>crypto.createHash("sha256").update(bytes).digest("hex");
export async function snapshotObjects({storage,directory,writersStopped,databaseChecksum}){
 if(writersStopped!==true||! /^[0-9a-f]{64}$/.test(databaseChecksum||""))throw Error("Stopped writers and matching database dump checksum are required");
 const root=path.resolve(directory);await fs.mkdir(root,{recursive:false,mode:0o700});const files=[];
 for await(const object of storage.list()){
  if(!object.valid||!keyPattern.test(object.key)||!Number.isInteger(object.byteSize)||object.byteSize<1||object.byteSize>20971520)throw Error("Unknown or unsupported object prevents a complete backup");
  const bytes=await storage.get(object.key,object.byteSize),target=path.join(root,...object.key.split("/"));await fs.mkdir(path.dirname(target),{recursive:true,mode:0o700});await fs.writeFile(target,bytes,{flag:"wx",mode:0o600});files.push({key:object.key,byteSize:bytes.length,sha256:hash(bytes)});
 }
 const manifest={format:"shekof-object-snapshot-v1",driver:storage.driver,completedAt:new Date().toISOString(),databaseChecksum,files};await fs.writeFile(path.join(root,"manifest.json"),JSON.stringify(manifest,null,2),{flag:"wx",mode:0o600});return {files:files.length};
}
export async function restoreObjects({storage,directory,writersStopped,databaseChecksum}){
 if(writersStopped!==true)throw Error("Stop all destination writers before restoring");
 const root=path.resolve(directory);if((await fs.lstat(root)).isSymbolicLink())throw Error("Unsafe snapshot directory");
 const manifest=JSON.parse(await fs.readFile(path.join(root,"manifest.json"),"utf8"));if(manifest.format!=="shekof-object-snapshot-v1"||manifest.databaseChecksum!==databaseChecksum||!Array.isArray(manifest.files))throw Error("Snapshot/database mismatch");
 const keys=new Set();
 const read=async row=>{if(!keyPattern.test(row.key)||!Number.isInteger(row.byteSize)||row.byteSize<1||row.byteSize>20971520)throw Error("Invalid snapshot object");let current=root;for(const part of row.key.split("/")){current=path.join(current,part);if((await fs.lstat(current)).isSymbolicLink())throw Error("Unsafe snapshot path");}const bytes=await fs.readFile(current);if(bytes.length!==row.byteSize||hash(bytes)!==row.sha256)throw Error("Snapshot checksum mismatch");return bytes;};
 // Verify all inputs before the first write. The destination must be a fresh bucket/prefix.
 for(const row of manifest.files){if(keys.has(row.key))throw Error("Duplicate snapshot object");keys.add(row.key);await read(row);}
 for await(const object of storage.list())throw Error("Object restore requires an empty destination");
 for(const row of manifest.files){const bytes=await read(row);await storage.put(row.key,bytes);if(hash(await storage.get(row.key,row.byteSize))!==row.sha256)throw Error("Restored object checksum mismatch");}
 return {files:keys.size};
}

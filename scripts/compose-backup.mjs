import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";

const args=process.argv.slice(2), option=key=>{const i=args.indexOf(key);return i<0?null:args[i+1];};
const project=option("--project"),envFile=option("--env-file"),output=option("--output");
if(!project||!/^[a-z][a-z0-9_-]{2,60}$/.test(project)||!envFile||!output)throw Error("Use --project, --env-file and a new --output directory");
const base=["compose","--project-name",project,"--env-file",path.resolve(envFile),"-f",path.resolve("docker-compose.yml")];
const run=(extra,{file=null}={})=>new Promise((resolve,reject)=>{
 const child=spawn("docker",[...base,...extra],{stdio:["ignore","pipe","pipe"]});let stderr="",stdout="";
 child.stderr.on("data",bytes=>{stderr=(stderr+bytes).slice(-4000);});
 const written=file?pipeline(child.stdout,createWriteStream(file,{flags:"wx",mode:0o600})):null;
 if(!file)child.stdout.on("data",bytes=>{stdout+=bytes;});
 child.on("error",reject);child.on("close",async code=>{try{if(written)await written;if(code)throw Error("Docker operation failed: "+stderr);resolve(stdout);}catch(error){reject(error);}});
});
const root=path.resolve(output);await fs.mkdir(root,{recursive:false,mode:0o700});
const digest=async file=>{if((await fs.lstat(file)).isSymbolicLink())throw Error("Unsafe backup file");const hash=crypto.createHash("sha256");for await(const bytes of createReadStream(file))hash.update(bytes);return hash.digest("hex");};
const files=[];
async function inventory(dir,relative="") {for(const item of await fs.readdir(dir,{withFileTypes:true})){const key=relative?relative+"/"+item.name:item.name,target=path.join(dir,item.name);if(item.isSymbolicLink())throw Error("Backup refuses symbolic links");if(item.isDirectory())await inventory(target,key);else if(item.isFile())files.push({key,bytes:(await fs.stat(target)).size,sha256:await digest(target)});}}
let stopped=false;
try {
 const running=(await run(["ps","--status","running","--services"])).trim().split(/\s+/);
 if(!running.includes("api")||!running.includes("postgres"))throw Error("Backup requires this project API and PostgreSQL to be running");
 const driver=(await run(["exec","-T","api","node","-e","process.stdout.write(process.env.FILE_STORAGE_DRIVER||'local')"])).trim();if(driver!=="local")throw Error("Compose volume backup supports local storage only; use the coordinated S3 dump/object-snapshot procedure");
 // Stop every API replica in the project. Immutable file writes and database writes are now quiescent.
 stopped=true;await run(["stop","api"]);
 await run(["exec","-T","postgres","pg_dump","-U","shekof","-d","shekof","-Fc","--no-owner"],{file:path.join(root,"database.dump")});
 await run(["cp","api:/app/apps/api/data/private-files",path.join(root,"private-files")]);
 await inventory(path.join(root,"private-files"));
 const configuration=await fs.readFile(path.resolve(envFile));await fs.writeFile(path.join(root,"configuration.env"),configuration,{flag:"wx",mode:0o600});
 const manifest={format:"shekof-local-backup-v1",completedAt:new Date().toISOString(),project,storageDriver:"local",configuration:{file:"configuration.env",sha256:await digest(path.join(root,"configuration.env")),containsSecrets:true},database:{file:"database.dump",sha256:await digest(path.join(root,"database.dump"))},files,consistency:"All API replicas stopped throughout database and file copy",encryption:"none; protect this directory as confidential customer data"};
 await fs.writeFile(path.join(root,"manifest.json"),JSON.stringify(manifest,null,2),{flag:"wx",mode:0o600});
 console.log(JSON.stringify({completed:true,directory:root,files:files.length}));
} finally {if(stopped)await run(["start","api"]);}

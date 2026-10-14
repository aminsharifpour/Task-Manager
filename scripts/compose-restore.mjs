import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import {spawn} from "node:child_process";
import {createReadStream} from "node:fs";
import {pipeline} from "node:stream/promises";
const args=process.argv.slice(2),opt=key=>{const i=args.indexOf(key);return i<0?null:args[i+1];},project=opt("--project"),envFile=opt("--env-file"),input=opt("--input");
if(!project||!/^[a-z][a-z0-9_-]{2,60}$/.test(project)||!envFile||!input)throw Error("Use --project (new empty installation), --env-file and --input");
const root=path.resolve(input),manifest=JSON.parse(await fs.readFile(path.join(root,"manifest.json"),"utf8"));
if(manifest.format!=="shekof-local-backup-v1"||manifest.storageDriver!=="local")throw Error("Unsupported backup format");
const digest=async file=>{if((await fs.lstat(file)).isSymbolicLink())throw Error("Unsafe backup file");const hash=crypto.createHash("sha256");for await(const bytes of createReadStream(file))hash.update(bytes);return hash.digest("hex");};
if(manifest.database.file!=="database.dump"||await digest(path.join(root,"database.dump"))!==manifest.database.sha256)throw Error("Database checksum mismatch");
if(manifest.configuration?.file!=="configuration.env"||await digest(path.join(root,"configuration.env"))!==manifest.configuration.sha256)throw Error("Configuration checksum mismatch");
const found=[];
async function verify(dir,relative="") {if((await fs.lstat(dir)).isSymbolicLink())throw Error("Unsafe backup path");for(const row of await fs.readdir(dir,{withFileTypes:true})){const key=relative?relative+"/"+row.name:row.name,target=path.join(dir,row.name);if(row.isSymbolicLink())throw Error("Unsafe backup path");if(row.isDirectory())await verify(target,key);else if(row.isFile()){const expected=manifest.files.find(file=>file.key===key);if(!expected||expected.bytes!==(await fs.stat(target)).size||expected.sha256!==await digest(target))throw Error("Private file checksum mismatch");found.push(key);}}}
await verify(path.join(root,"private-files"));if(found.length!==manifest.files.length||new Set(found).size!==found.length)throw Error("Incomplete file manifest");
const base=["compose","--project-name",project,"--env-file",path.resolve(envFile),"-f",path.resolve("docker-compose.yml")];
const run=(extra,file=null)=>new Promise((resolve,reject)=>{const child=spawn("docker",[...base,...extra],{stdio:[file?"pipe":"ignore","pipe","pipe"]});let out="",err="";child.stdout.on("data",b=>out+=b);child.stderr.on("data",b=>err=(err+b).slice(-4000));const copied=file?pipeline(createReadStream(file),child.stdin):null;child.on("error",reject);child.on("close",async code=>{try{if(copied)await copied;if(code)throw Error("Docker operation failed: "+err);resolve(out);}catch(e){reject(e);}});});
if((await run(["ps","-a","-q"])).trim())throw Error("Restore requires a new project with no containers");
// Also refuse orphaned volumes from an older installation using the same project name.
const volumes=await new Promise((resolve,reject)=>{const child=spawn("docker",["volume","ls","-q","--filter","label=com.docker.compose.project="+project],{stdio:["ignore","pipe","pipe"]});let out="";child.stdout.on("data",b=>out+=b);child.on("error",reject);child.on("close",code=>code?reject(Error("Cannot inspect volumes")):resolve(out));});
if(volumes.trim())throw Error("Restore project already has volumes; choose a fresh project name");
await run(["up","-d","--wait","postgres"]);
await run(["exec","-T","postgres","pg_restore","-U","shekof","-d","shekof","--no-owner","--exit-on-error"],path.join(root,"database.dump"));
await run(["create","api"]);
await run(["cp",path.join(root,"private-files")+path.sep+".","api:/app/apps/api/data/private-files"]);
// docker cp may preserve the host's UID; initialize ownership using only this fresh API container.
await run(["run","--rm","--no-deps","--user","0","--cap-add","CHOWN","--cap-add","DAC_OVERRIDE","api","node","-e","const fs=require('fs');function own(p){fs.chownSync(p,1000,1000);if(fs.statSync(p).isDirectory())for(const n of fs.readdirSync(p))own(p+'/'+n);}own('/app/apps/api/data/private-files');"]);
await run(["up","-d","--wait"]);
console.log(JSON.stringify({completed:true,project,restoredFiles:found.length}));

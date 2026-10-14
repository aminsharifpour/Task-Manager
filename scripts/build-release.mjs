import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import {createReadStream} from "node:fs";
import {spawn} from "node:child_process";
const args=process.argv.slice(2),opt=key=>{const i=args.indexOf(key);return i<0?null:args[i+1];},version=opt("--version"),destination=opt("--output");
if(!version||!/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/.test(version)||!destination)throw Error("Use --version x.y.z and a new --output directory");
const out=path.resolve(destination);await fs.mkdir(out,{recursive:false,mode:0o700});
const run=args=>new Promise((resolve,reject)=>{const child=spawn("docker",args,{stdio:["ignore","pipe","pipe"]});let stdout="",stderr="";child.stdout.on("data",b=>stdout+=b);child.stderr.on("data",b=>{stderr=(stderr+b).slice(-6000);});child.on("error",reject);child.on("close",code=>code?reject(Error("Docker release build failed: "+stderr)):resolve(stdout));});
const tag="shekof-app:"+version;console.log("Building application image "+tag);await run(["build","-t",tag,"."]);
const inspect=async name=>JSON.parse(await run(["image","inspect",name]))[0];
for(const image of ["postgres:16-alpine","caddy:2-alpine"])try{await inspect(image);}catch{await run(["pull",image]);}
const images=await Promise.all([tag,"postgres:16-alpine","caddy:2-alpine"].map(inspect));
console.log("Exporting application, database and gateway images");await run(["save","--output",path.join(out,"images.tar"),tag,"postgres:16-alpine","caddy:2-alpine"]);
await fs.mkdir(path.join(out,"deploy"));await fs.mkdir(path.join(out,"scripts"));await fs.mkdir(path.join(out,"docs"));
let compose=await fs.readFile("docker-compose.yml","utf8");compose=compose.replace("postgres:16-alpine",images[1].Id).replace("caddy:2-alpine",images[2].Id).replaceAll("${APP_IMAGE:-shekof-app:0.1.0}","${APP_IMAGE:-"+images[0].Id+"}");
// The installed package loads its built image; source builds are deliberately excluded.
compose=compose.replace(/    build:\r?\n      context: \.\r?\n      dockerfile: Dockerfile\r?\n/,"");
await fs.writeFile(path.join(out,"docker-compose.yml"),compose);
for(const file of ["README.md","deploy/shekof-backup.service","deploy/shekof-backup.timer","deploy/Caddyfile","deploy/Caddyfile.public","deploy/release.env.example","scripts/compose-install.mjs","scripts/verify-release.mjs","scripts/compose-backup.mjs","scripts/compose-restore.mjs","scripts/compose-upgrade.mjs","scripts/backup-scheduled.mjs","docs/IMPLEMENTATION_STATUS.md","docs/PRODUCT_SCOPE.md","docs/ARCHITECTURE.md","docs/VALIDATION_REPORT.md","docs/SELF_HOSTED.md","docs/HOSTED.md","docs/BACKUP_RESTORE.md","docs/UPGRADE.md"])await fs.copyFile(file,path.join(out,file));
let template=await fs.readFile(path.join(out,"deploy/release.env.example"),"utf8");await fs.writeFile(path.join(out,"deploy/release.env.example"),template.replace(/^APP_IMAGE=.*$/m,"APP_IMAGE="+images[0].Id));
const checksum=async file=>{const hash=crypto.createHash("sha256");for await(const bytes of createReadStream(file))hash.update(bytes);return hash.digest("hex");};
const files=[];async function scan(dir,relative=""){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const name=relative?relative+"/"+entry.name:entry.name,target=path.join(dir,entry.name);if(entry.isDirectory())await scan(target,name);else files.push({file:name,bytes:(await fs.stat(target)).size,sha256:await checksum(target)});}}
console.log("Writing offline release inventory and SHA-256 hashes");await scan(out);await fs.writeFile(path.join(out,"release-manifest.json"),JSON.stringify({version,builtAt:new Date().toISOString(),architecture:images[0].Architecture,os:images[0].Os,images:images.map(row=>({id:row.Id,tags:row.RepoTags})),files},null,2));
console.log(JSON.stringify({built:true,version,directory:out,image:images[0].Id}));

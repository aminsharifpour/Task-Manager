import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import https from "node:https";
import {spawn} from "node:child_process";
const suffix=crypto.randomBytes(5).toString("hex"),first="shekof-install-"+suffix,restored="shekof-restore-"+suffix;
const temp=await fs.mkdtemp(path.join(os.tmpdir(),"shekof-release-")),envFile=path.join(temp,"release.env"),backup=path.join(temp,"backup");
await fs.writeFile(envFile,["POSTGRES_PASSWORD="+crypto.randomBytes(32).toString("hex"),"JWT_SECRET="+crypto.randomBytes(32).toString("hex"),"APP_IMAGE=shekof-schema18:"+suffix+"","HTTPS_PORT=19443","HTTP_PORT=19080","PUBLIC_SITE_URL=https://localhost:19443"].join("\n"),{mode:0o600});
const run=(command,args)=>new Promise((resolve,reject)=>{const child=spawn(command,args,{stdio:["ignore","pipe","pipe"]});let out="",err="";child.stdout.on("data",b=>out+=b);child.stderr.on("data",b=>err=(err+b).slice(-6000));child.on("error",reject);child.on("close",code=>code?reject(Error(command+" failed: "+err)):resolve(out));});
const compose=(project,args)=>run("docker",["compose","--project-name",project,"--env-file",envFile,"-f","docker-compose.yml",...args]);
// Local laboratory uses Caddy's internal CA; production clients must trust the configured CA.
const request=(route,{token="",method="GET",body,raw=false,headers={}}={})=>new Promise((resolve,reject)=>{const req=https.request("https://localhost:19443"+route,{rejectUnauthorized:false,method,headers:{...(token?{Authorization:"Bearer "+token}:{}),...(body?{"Content-Type":raw?"application/octet-stream":"application/json"}:{}),...headers}},res=>{const chunks=[];res.on("data",b=>chunks.push(b));res.on("end",()=>resolve({status:res.statusCode,headers:res.headers,bytes:Buffer.concat(chunks)}));});req.on("error",reject);if(body)req.write(raw?body:JSON.stringify(body));req.end();});
const call=async(route,options={},status=200)=>{const result=await request(route,options);assert.equal(result.status,status,result.bytes.toString());return JSON.parse(result.bytes);};
const verify=async(token,org,task,file,bytes)=>{assert.equal((await call("/api/organizations/"+org+"/tasks/"+task,{token})).title,"Synthetic release task");const fetched=await request("/api/organizations/"+org+"/files/"+file.file.id+"/versions/"+file.version.id+"/download",{token});assert.equal(fetched.status,200);assert.deepEqual(fetched.bytes,bytes);};
try {
 const previousDockerfile=path.join(temp,"Dockerfile.schema18");await fs.writeFile(previousDockerfile,"FROM shekof-app:0.1.0\nUSER root\nRUN node -e \"require('fs').rmSync('/app/apps/api/prisma/migrations/202610130019_task_query_indexes',{recursive:true,force:false})\"\nUSER node\n");await run("docker",["build","-f",previousDockerfile,"-t","shekof-schema18:"+suffix,"."]);
 await compose(first,["up","-d","--wait"]);
 assert.equal((await compose(first,["exec","-T","postgres","psql","-U","shekof","-d","shekof","-Atc",'SELECT COUNT(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL'])).trim(),"18");
 const privateHtml=await request("/app/organizations");assert.equal(privateHtml.headers["x-robots-tag"],"noindex, nofollow");assert.equal((await call("/api/product-config")).needsSetup,true);
 const registration={fullName:"Synthetic release owner",phone:"09000011000",email:"release@example.test",password:"Synthetic-Release-Password",organizationName:"Synthetic release organization"};
 const setup=await call("/api/auth/setup",{method:"POST",body:registration}),token=setup.token,org=(await call("/api/organizations",{token}))[0].id;
 const project=await call("/api/organizations/"+org+"/projects",{token,method:"POST",body:{name:"Synthetic release project"}},201);
 const task=await call("/api/organizations/"+org+"/tasks",{token,method:"POST",body:{title:"Synthetic release task",projectId:project.id}},201),bytes=Buffer.from("Synthetic immutable file for backup and restore\n");
 const file=await call("/api/organizations/"+org+"/tasks/"+task.id+"/files?name=restore.txt",{token,method:"POST",body:bytes,raw:true,headers:{"Idempotency-Key":crypto.randomUUID()}},201);
 await verify(token,org,task.id,file,bytes);
 await compose(first,["restart","postgres","api","gateway"]);await compose(first,["up","-d","--wait"]);await verify(token,org,task.id,file,bytes);
 await run(process.execPath,["scripts/compose-backup.mjs","--project",first,"--env-file",envFile,"--output",backup]);
 const manifest=JSON.parse(await fs.readFile(path.join(backup,"manifest.json"),"utf8"));assert.equal(manifest.files.length,1);
 await run(process.execPath,["scripts/compose-upgrade.mjs","--project",first,"--env-file",envFile,"--image","shekof-app:0.1.0","--backup",path.join(temp,"upgrade-backup")]);await verify(token,org,task.id,file,bytes);assert.equal((await compose(first,["exec","-T","postgres","psql","-U","shekof","-d","shekof","-Atc",'SELECT COUNT(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL'])).trim(),"19");
 await compose(first,["down"]);
 await run(process.execPath,["scripts/compose-restore.mjs","--project",restored,"--env-file",envFile,"--input",backup]);
 const login=await call("/api/auth/login",{method:"POST",body:{phone:registration.phone,password:registration.password}});await verify(login.token,org,task.id,file,bytes);assert.equal((await call("/api/product-config")).needsSetup,false);
 const containers=JSON.parse(await run("docker",["inspect",...(await compose(restored,["ps","-q","api"])).trim().split(/\s+/)]));assert.equal(containers[0].Config.User,"node");assert.equal(Object.keys(containers[0].NetworkSettings.Ports).filter(port=>containers[0].NetworkSettings.Ports[port]).length,0,"API port must remain private");
 const report={completedAt:new Date().toISOString(),syntheticOnly:true,image:"shekof-app:0.1.0",cleanInstall:true,httpsInternalCa:true,containerRestart:true,backupRestore:true,restoredFiles:1,nonRootApi:true,privateApiPort:true,physicalHostReboot:false,upgradeSchema18To19:true,previousReleasedBinaryTested:false};await fs.writeFile("docs/validation/release-compose.json",JSON.stringify(report,null,2));console.log("Release Compose passed: clean production installation, internal-CA TLS, private API, non-root runtime, persistent restart, checksummed database/file backup and new-installation restore.");
} finally {
 for(const project of [first,restored])await compose(project,["down","--volumes","--remove-orphans"]).catch(()=>{});
 await run("docker",["image","rm","shekof-schema18:"+suffix]).catch(()=>{});
 assert.ok(path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep+"shekof-release-"));await fs.rm(temp,{recursive:true,force:true});
}

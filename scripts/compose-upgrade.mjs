import fs from "node:fs/promises";
import path from "node:path";
import {spawn} from "node:child_process";
const args=process.argv.slice(2),opt=key=>{const i=args.indexOf(key);return i<0?null:args[i+1];},project=opt("--project"),envFile=opt("--env-file"),image=opt("--image"),backup=opt("--backup");
if(!project||!/^[a-z][a-z0-9_-]{2,60}$/.test(project)||!envFile||!backup||!image||!(/^[a-z0-9][a-z0-9/_.:-]*$/.test(image)))throw Error("Use --project --env-file --image (already loaded locally) --backup (new directory)");
const run=(command,argv)=>new Promise((resolve,reject)=>{const child=spawn(command,argv,{stdio:["ignore","pipe","pipe"]});let out="",err="";child.stdout.on("data",b=>out+=b);child.stderr.on("data",b=>err=(err+b).slice(-5000));child.on("error",reject);child.on("close",code=>code?reject(Error("Upgrade operation failed: "+err)):resolve(out));});
await run("docker",["image","inspect",image,"--format","{{.Id}}"]);
const file=path.resolve(envFile),config=await fs.readFile(file,"utf8"),base=["compose","--project-name",project,"--env-file",file,"-f",path.resolve("docker-compose.yml")];
await run("docker",[...base,"stop","gateway"]);
try {
 await run(process.execPath,["scripts/compose-backup.mjs","--project",project,"--env-file",file,"--output",path.resolve(backup)]);
 await run("docker",[...base,"stop","api"]);
 const next=/^APP_IMAGE=.*$/m.test(config)?config.replace(/^APP_IMAGE=.*$/m,"APP_IMAGE="+image):config+"\nAPP_IMAGE="+image+"\n";
 const temporary=file+".upgrade-"+Date.now();await fs.writeFile(temporary,next,{flag:"wx",mode:0o600});await fs.rename(temporary,file);
 await run("docker",[...base,"up","-d","--wait","--force-recreate","migrate","api","gateway"]);
 console.log(JSON.stringify({upgraded:true,project,image,backup:path.resolve(backup)}));
} catch(error){
 // A failed health wait may happen after the gateway has already started.
 // Re-enter maintenance instead of merely describing the gateway as stopped.
 let maintenance=true;try{await run("docker",[...base,"stop","gateway"]);}catch{maintenance=false;}
 throw Error("Upgrade incomplete. "+(maintenance?"Gateway stopped for maintenance. ":"Could not stop the gateway; stop it locally before allowing traffic. ")+"Check migration state; restore the checked backup in a fresh project if needed. "+error.message);
}

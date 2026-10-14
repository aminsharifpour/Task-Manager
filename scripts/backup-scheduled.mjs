import path from "node:path";
import crypto from "node:crypto";
import {spawn} from "node:child_process";
const args=process.argv.slice(2),i=args.indexOf("--backup-root");if(i<0||!args[i+1])throw Error("Use --backup-root and compose backup's --project --env-file options");
const destination=path.join(path.resolve(args[i+1]),new Date().toISOString().replace(/[:.]/g,"-")+"-"+crypto.randomBytes(4).toString("hex"));args.splice(i,2);
const child=spawn(process.execPath,["scripts/compose-backup.mjs",...args,"--output",destination],{stdio:"inherit"});child.on("error",()=>{process.exitCode=1;});child.on("exit",code=>{process.exitCode=code??1;});

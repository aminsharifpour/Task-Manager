import fs from "node:fs/promises";
import path from "node:path";
import prisma from "../src/prisma.js";
import {runtimeConfig} from "../src/runtime-config.js";
import {configuredStorage} from "../src/modules/files/storage.js";
import {reconcileFiles} from "./lib/reconcile-files.mjs";
const args=process.argv.slice(2),option=key=>{const i=args.indexOf(key);return i<0?undefined:args[i+1];};
try{if(!runtimeConfig.tenantFoundation)throw Error("POSTGRES_REQUIRED");const report=option("--report");if(!report)throw Error("EXCLUSIVE_REPORT_PATH_REQUIRED");const resolved=path.resolve(report);await fs.mkdir(path.dirname(resolved),{recursive:true});const handle=await fs.open(resolved,"wx",0o600);try{const result=await reconcileFiles({db:prisma,storage:configuredStorage(),applyOrphans:args.includes("--apply-orphan-cleanup"),minimumAgeDays:Number(option("--minimum-age-days")||7)});await handle.writeFile(JSON.stringify(result,null,2));await handle.sync();console.log(JSON.stringify({dryRun:result.dryRun,referenced:result.referenced,verified:result.verified,missing:result.missing.length,corrupt:result.corrupt.length,orphans:result.orphans.length,removed:result.removed}));if(result.missing.length||result.corrupt.length)process.exitCode=2;}finally{await handle.close();}}catch(error){console.error(JSON.stringify({code:/^[A-Z_]+$/.test(error.message)?error.message:"FILE_RECONCILIATION_FAILED"}));process.exitCode=1;}finally{await prisma.$disconnect();configuredStorage().close?.();}

import fs from "node:fs/promises";
import prisma from "../src/prisma.js";
import {runtimeConfig} from "../src/runtime-config.js";
import {configuredStorage} from "../src/modules/files/storage.js";
import {applyLegacyChatFiles} from "./lib/apply-legacy-files.mjs";
const args=process.argv.slice(2),option=key=>{const i=args.indexOf(key);return i<0?undefined:args[i+1];};
try{if(!runtimeConfig.tenantFoundation||!args.includes("--apply"))throw Error("EXPLICIT_POSTGRES_APPLY_REQUIRED");const source=option("--source"),uploadsRoot=option("--uploads"),organizationId=option("--organization-id"),backupDir=option("--backup-dir"),manifestPath=option("--manifest");if(!source||!uploadsRoot||!organizationId||!backupDir||!manifestPath)throw Error("EXPLICIT_PATHS_AND_ORGANIZATION_REQUIRED");const result=await applyLegacyChatFiles({db:prisma,storage:configuredStorage(),sourceBytes:await fs.readFile(source),uploadsRoot,organizationId,backupDir,manifest:JSON.parse(await fs.readFile(manifestPath,"utf8"))});console.log(JSON.stringify(result));}catch(error){console.error(JSON.stringify({code:/^[A-Z_]+$/.test(error.message)?error.message:"FILE_IMPORT_FAILED"}));process.exitCode=1;}finally{await prisma.$disconnect();}

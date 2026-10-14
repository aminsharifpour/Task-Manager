import {configuredStorage} from "../src/modules/files/storage.js";
import "../src/load-env.js";
import {snapshotObjects,restoreObjects} from "./lib/object-snapshot.mjs";
const args=process.argv.slice(2),opt=key=>{const i=args.indexOf(key);return i<0?null:args[i+1];},mode=opt("--mode"),directory=opt("--directory"),databaseChecksum=opt("--database-sha256");
if(!["backup","restore"].includes(mode)||!directory||!args.includes("--writers-stopped"))throw Error("Use --mode backup|restore --directory --database-sha256 and --writers-stopped only after stopping every writer/cleanup process");
const storage=configuredStorage();try{const result=await (mode==="backup"?snapshotObjects:restoreObjects)({storage,directory,writersStopped:true,databaseChecksum});console.log(JSON.stringify({completed:true,mode,...result}));}finally{storage.close?.();}

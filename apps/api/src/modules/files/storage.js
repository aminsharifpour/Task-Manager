import {s3Storage} from "./s3-storage.js";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const defaultRoot = fileURLToPath(new URL("../../../data/private-files/", import.meta.url));
export const privateFilesRoot = path.resolve(process.env.PRIVATE_FILES_DIR || defaultRoot);
const uuidPattern = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const keyPattern = new RegExp("^[0-9a-f]{64}/" + uuidPattern + "/" + uuidPattern + "$", "i");
export function storageKey(organizationId, fileId, versionId) {
  return crypto.createHash("sha256").update(organizationId).digest("hex") + "/" + fileId + "/" + versionId;
}
// Local adapter: immutable object writes, no client-provided paths and no public URLs.
export function localStorage(root = privateFilesRoot) {
  const base = path.resolve(root);
  const locate = (key) => {
    if (!keyPattern.test(key)) throw new Error("INVALID_STORAGE_KEY");
    const result = path.resolve(base, ...key.split("/"));
    if (!result.startsWith(base + path.sep)) throw new Error("INVALID_STORAGE_KEY");
    return result;
  };
  const safePath = async (key, create = false) => {
    const target = locate(key);
    if (create) await fs.mkdir(base, { recursive: true, mode: 0o700 });
    if((await fs.lstat(base)).isSymbolicLink())throw new Error("UNSAFE_STORAGE_PATH");
    const parts = key.split("/");
    let current = base;
    for (const part of parts.slice(0, -1)) {
      current = path.join(current, part);
      if (create) await fs.mkdir(current, { recursive: true, mode: 0o700 });
      if ((await fs.lstat(current)).isSymbolicLink()) throw new Error("UNSAFE_STORAGE_PATH");
    }
    return target;
  };
  return {
    driver:"local",
    async health(){await fs.mkdir(base,{recursive:true,mode:0o700});if((await fs.lstat(base)).isSymbolicLink())throw Error("UNSAFE_STORAGE_PATH");await fs.access(base);},
    async *list(){const walk=async function*(dir,relative=""){for(const row of await fs.readdir(dir,{withFileTypes:true})){if(row.isSymbolicLink())throw Error("UNSAFE_STORAGE_PATH");const key=relative?relative+"/"+row.name:row.name,target=path.join(dir,row.name);if(row.isDirectory())yield*walk(target,key);else if(row.isFile()){const stat=await fs.stat(target);yield {key,byteSize:stat.size,lastModified:stat.mtime,valid:keyPattern.test(key)};}}};try{if((await fs.lstat(base)).isSymbolicLink())throw Error("UNSAFE_STORAGE_PATH");yield*walk(base);}catch(error){if(error.code!=="ENOENT")throw error;}},
    async put(key, bytes) {
      const target = await safePath(key, true);
      // An exclusive final name never overwrites an existing version.
      const handle = await fs.open(target, "wx", 0o600);
      try { await handle.writeFile(bytes); await handle.sync(); }
      catch (error) { await handle.close(); await fs.unlink(target).catch(() => {}); throw error; }
      await handle.close();
    },
    async get(key, expectedSize) {
      const target = await safePath(key);
      const stat = await fs.lstat(target);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== expectedSize) throw new Error("FILE_INTEGRITY_ERROR");
      return fs.readFile(target);
    },
    async remove(key) {
      const target = await safePath(key);
      await fs.unlink(target);
    },
  };
}
let configured;
export function configuredStorage() {
 if(configured)return configured;
 const driver=process.env.FILE_STORAGE_DRIVER||"local";
 if(driver==="local")return configured=localStorage();
 if(driver==="s3")return configured=s3Storage();
 throw new Error("Unsupported FILE_STORAGE_DRIVER; use local or s3.");
}

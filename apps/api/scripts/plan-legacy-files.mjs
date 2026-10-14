import fs from "node:fs/promises";
import path from "node:path";
import { planLegacyChatFiles } from "./lib/legacy-file-plan.mjs";
const args = process.argv.slice(2), option = key => { const index = args.indexOf(key); return index < 0 ? undefined : args[index + 1]; };
try {
  if (args.includes("--apply")) throw new Error("DRY_RUN_ONLY");
  const source = option("--source"), uploadsRoot = option("--uploads"), report = option("--report");
  if (!source || !uploadsRoot || !report) throw new Error("EXPLICIT_SOURCE_UPLOADS_REPORT_REQUIRED");
  if (path.resolve(source) === path.resolve(report)) throw new Error("REPORT_MUST_NOT_OVERWRITE_SOURCE");
  const result = await planLegacyChatFiles({ sourceBytes: await fs.readFile(source), uploadsRoot, organizationId: option("--organization-id") });
  await fs.mkdir(path.dirname(path.resolve(report)), { recursive: true });
  // Exclusive create: a prior manifest or source file is never overwritten.
  await fs.writeFile(report, JSON.stringify(result, null, 2), { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ dryRun: true, databaseVerified: false, ...result.summary }));
  if (result.issues.length) process.exitCode = 2;
} catch (error) { console.error(JSON.stringify({ code: /^[A-Z_]+$/.test(error.message) ? error.message : "FILE_PLAN_FAILED" })); process.exitCode = 1; }

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const run = (label, cmd, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: projectRoot,
      stdio: "inherit",
      env: { ...process.env, ...options.env },
      shell: false,
    });
    child.on("exit", (code) => {
      if (code === 0) return resolve(undefined);
      reject(new Error(`${label} failed with exit code ${code}`));
    });
    child.on("error", (error) => reject(new Error(`${label} failed: ${error.message}`)));
  });

const assertFile = (filePath, message) => {
  if (!fs.existsSync(path.resolve(projectRoot, filePath))) {
    throw new Error(message);
  }
};

async function main() {
  assertFile("package.json", "package.json not found.");
  assertFile("apps/api/src/index.js", "API entrypoint not found.");
  assertFile("apps/web/src/App.tsx", "Web app entrypoint not found.");

  console.log("\n[launch] checking API syntax");
  await run("api syntax", "node", ["--check", "apps/api/src/index.js"]);

  console.log("\n[launch] checking web types");
  await run("web typecheck", "npx", ["tsc", "-p", "apps/web/tsconfig.json", "--noEmit"]);

  console.log("\n[launch] building production web bundle");
  await run("web build", "npm", ["run", "build", "--silent"]);

  console.log("\n[launch] running end-to-end smoke test");
  await run("e2e", "npm", ["run", "test:e2e"]);

  console.log("\n[launch] readiness checks passed");
}

main().catch((error) => {
  console.error(`\n[launch] ${error.message}`);
  process.exitCode = 1;
});

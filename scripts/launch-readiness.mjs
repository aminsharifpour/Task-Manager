import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const run = (label, cmd, args, options = {}) =>
  new Promise((resolve, reject) => {
    const command = cmd === "npm" ? process.execPath : cmd;
    const commandArgs = cmd === "npm" ? [process.env.npm_execpath, ...args] : args;
    const child = spawn(command, commandArgs, {
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
  await run("web typecheck", process.execPath, ["node_modules/typescript/bin/tsc", "-p", "apps/web/tsconfig.json", "--noEmit"]);

  console.log("\n[launch] building production web bundle");
  await run("web build", "npm", ["run", "build", "--silent"]);

  console.log("\n[launch] running end-to-end smoke test");
  await run("e2e", "npm", ["run", "test:e2e"]);

  console.log("\n[launch] checking foundation policies and migration planning");
  await run("foundation", "npm", ["run", "test:foundation"]);

  if (process.env.TEST_DATABASE_URL) {
    await run("postgres", "npm", ["run", "test:postgres"]);
    await run("modules", "npm", ["run", "test:modules"]);
    await run("operations", "npm", ["run", "test:operations"]);
    await run("marketing", "npm", ["run", "test:marketing"]);
    await run("accounts", "npm", ["run", "test:accounts"]);
    await run("realtime", "npm", ["run", "test:realtime"]);
    await run("core", "npm", ["run", "test:core"]);
    await run("files", "npm", ["run", "test:files"]);
    await run("legacy blobs", "npm", ["run", "test:legacy-blobs"]);
    await run("upgrade", "npm", ["run", "test:upgrade"]);
    await run("browser", "npm", ["run", "test:browser"]);
    await run("browser onboarding", "npm", ["run", "test:browser-onboarding"]);
    await run("browser marketing", "npm", ["run", "test:browser-marketing"]);
  } else {
    console.log("[launch] PostgreSQL and browser gates NOT RUN: set TEST_DATABASE_URL for a separate _test database.");
  }

  console.log("\n[launch] readiness checks passed");
}

main().catch((error) => {
  console.error(`\n[launch] ${error.message}`);
  process.exitCode = 1;
});

import { spawnSync } from "node:child_process";

const run = (command, args) => {
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run("npm", ["run", "prisma:generate"]);
run("npm", ["run", "prisma:deploy"]);
console.log("Schema deployed. Import is a separate step: db:migrate-json -- --source <file> (dry-run by default).");

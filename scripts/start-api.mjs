import { spawn } from "node:child_process";
import "../apps/api/src/load-env.js";

const child = spawn(process.execPath, ["apps/api/src/index.js"], { stdio: "inherit", env: process.env });
child.on("error", () => { console.error("Unable to launch API."); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));

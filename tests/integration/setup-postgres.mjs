import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const url = new URL(process.env.TEST_DATABASE_URL);
if (!url.pathname.endsWith("_test")) throw new Error("Separate _test database required.");
const schema = "setup_" + crypto.randomBytes(6).toString("hex"); url.searchParams.set("schema", schema);
const env = { ...process.env, NODE_ENV: "test", DB_MODE: "postgres", DATABASE_URL: url.toString(), TENANT_FOUNDATION_ENABLED: "true", DEPLOYMENT_MODE: "self_hosted",
  JWT_SECRET: "synthetic-self-hosted-test-private-key", PORT: "8899", SERVE_CLIENT: "false", SERVER_LOG_TO_FILE: "false", HTTP_ACCESS_LOG: "off", SERVER_LOG_LEVEL: "error" };
const run = (args, extra = {}) => spawnSync(process.execPath, args, { env: { ...env, ...extra }, encoding: "utf8" });
const deploy = run(["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", "apps/api/prisma/schema.prisma"]);
assert.equal(deploy.status, 0, deploy.stdout + deploy.stderr);
const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
let server;
try {
  const incomplete = run(["apps/api/scripts/setup-organization.mjs"], { SETUP_ADMIN_PASSWORD: "", SETUP_ADMIN_NAME: "", SETUP_ADMIN_PHONE: "" });
  assert.equal(incomplete.status, 1); assert.equal(await db.user.count(), 0);
  const credentials = { SETUP_ADMIN_NAME: "Synthetic local owner", SETUP_ADMIN_PHONE: "09000000900", SETUP_ADMIN_PASSWORD: "private-synthetic-selected-password", SETUP_ORGANIZATION_NAME: "Synthetic local organization" };
  assert.equal(run(["apps/api/scripts/setup-organization.mjs"], credentials).status, 0);
  assert.equal(run(["apps/api/scripts/setup-organization.mjs"], credentials).status, 1);
  assert.equal(await db.organization.count(), 1); assert.equal(await db.user.count(), 1);
  server = spawn(process.execPath, ["apps/api/src/index.js"], { env, stdio: "ignore" });
  const base = "http://127.0.0.1:8899";
  for (let attempt = 0; attempt < 80; attempt++) {
    try { if ((await fetch(base + "/api/ready")).ok) break; } catch {}
    if (server.exitCode !== null) throw new Error("Local API failed to start");
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const config = await (await fetch(base + "/api/product-config")).json(); assert.equal(config.deploymentMode, "self_hosted");
  const login = await fetch(base + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: credentials.SETUP_ADMIN_PHONE, password: credentials.SETUP_ADMIN_PASSWORD }) });
  assert.equal(login.status, 200);
  const { token } = await login.json(); const headers = { Authorization: "Bearer " + token, "Content-Type": "application/json" };
  assert.equal((await fetch(base + "/api/organizations", { method: "POST", headers, body: JSON.stringify({ name: "blocked" }) })).status, 403);
  const organizations = await (await fetch(base + "/api/organizations", { headers })).json(); assert.equal(organizations.length, 1);
  assert.equal((await fetch(base + "/api/organizations/" + organizations[0].id + "/projects", { method: "POST", headers, body: JSON.stringify({ name: "Local project" }) })).status, 201);
  assert.equal((await fetch(base + "/api/auth/logout", { method: "POST", headers })).status, 200);
  console.log("Self-hosted integration passed: empty install, selected password, one-time setup closure, local login/project, public organization creation denied, logout.");
} finally {
  if (server) { server.kill(); await new Promise((resolve) => server.once("exit", resolve)); }
  await db.$executeRawUnsafe('DROP SCHEMA "' + schema + '" CASCADE'); await db.$disconnect();
}

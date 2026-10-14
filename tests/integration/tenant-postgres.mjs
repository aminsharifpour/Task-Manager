import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import { io } from "socket.io-client";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("TEST_DATABASE_URL is required. No application database is used.");
const parsed = new URL(databaseUrl);
if (!parsed.pathname.endsWith("_test")) throw new Error("Test database name must end with _test.");
const schema = "foundation_" + crypto.randomBytes(6).toString("hex");
parsed.searchParams.set("schema", schema);
const env = { ...process.env, NODE_ENV: "test", DB_MODE: "postgres", DATABASE_URL: parsed.toString(),
  DEPLOYMENT_MODE: "hosted", TENANT_FOUNDATION_ENABLED: "true", JWT_SECRET: "synthetic-foundation-test-private-key-2026", PORT: "8898",
  SERVE_CLIENT: "false", SERVER_LOG_TO_FILE: "false", HTTP_ACCESS_LOG: "off", SERVER_LOG_LEVEL: "error" };
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "shekof-pg-"));
env.TASK_APP_DATA_FILE = path.join(temporary, "must-not-exist.json");
const command = (args, expected = 0) => {
  const result = spawnSync(process.execPath, args, { env, encoding: "utf8" });
  assert.equal(result.status, expected, "Command failed: " + args[0] + "\n" + result.stdout + "\n" + result.stderr);
  return result.stdout;
};
command(["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", "apps/api/prisma/schema.prisma"]);
const db = new PrismaClient({ datasources: { db: { url: parsed.toString() } } });
const base = "http://127.0.0.1:8898";
let server;
const check = async (method, route, token, body, expected = 200) => {
  const res = await fetch(base + route, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await res.json();
  assert.equal(res.status, expected, method + " " + route + ": " + JSON.stringify(data));
  return data;
};

try {
  // An ambiguous legacy import must not write or normalize the source.
  const fixture = {
    teamMembers: [{ id: "u1", fullName: "Synthetic Owner", phone: "09000000001", email: "owner@example.test", appRole: "admin", passwordHash: "placeholder" }],
    projects: [{ id: "p1", name: "same", ownerId: "u1" }, { id: "p2", name: "same", ownerId: "u1" }],
    tasks: [{ id: "t1", title: "Synthetic task", projectName: "same", assignerId: "u1", assigneePrimaryId: "u1", status: "todo", workflowCurrentStep: -1,
      workflowStepComments: [{ id: "comment1", stepId: "step1", authorId: "u1", text: "synthetic feedback", createdAt: "2026-01-01T00:00:00Z" }] }],
    settings: { general: { organizationName: "Synthetic organization" } },
    chatConversations: [{ id: "chat1", type: "group", participantIds: ["u1"] }],
    chatMessages: [{ id: "message1", senderId: "u1", conversationId: "chat1", text: "Synthetic message", attachments: [{ url: "/uploads/chat/synthetic.txt" }] }],
    auditLogs: [{ id: "audit1", actor: { userId: "u1", fullName: "Synthetic Owner", role: "admin" }, action: "task.created", entityType: "task", entityId: "t1", summary: "Synthetic audit" }],
    notifications: [{ id: "notice1", userId: "u1", title: "Synthetic notice", kind: "task" }],
    accountingTransactions: [{ id: "transaction1", ownerId: "u1", type: "expense", title: "Synthetic expense", amount: "1234567890123456.78", date: "2026-01-01T00:00:00Z", time: "10:30" }],
  };
  const { default: bcrypt } = await import("bcryptjs");
  fixture.teamMembers[0].passwordHash = "bcrypt$" + bcrypt.hashSync("synthetic-password", 10);
  const source = path.join(temporary, "fixture.json");
  fs.writeFileSync(source, JSON.stringify(fixture));
  const before = fs.readFileSync(source, "utf8");
  const ambiguous = command(["apps/api/scripts/migrate-json-to-postgres.mjs", "--source", source], 1);
  assert.match(ambiguous, /AMBIGUOUS_PROJECT/);
  assert.equal(await db.user.count(), 0);
  assert.equal(fs.readFileSync(source, "utf8"), before);
  const mapping = path.join(temporary, "mapping.json"); fs.writeFileSync(mapping, JSON.stringify({ t1: "p2" }));
  const importArgs = ["apps/api/scripts/migrate-json-to-postgres.mjs", "--source", source, "--mapping", mapping, "--apply", "--backup-dir", temporary];
  command(importArgs);
  assert.equal((await db.task.findUnique({ where: { id: "t1" } })).projectId, "p2");
  assert.equal(await db.taskWorkflowComment.count(), 1);
  assert.equal((await db.accountingTransaction.findUnique({ where: { id: "transaction1" } })).amount.toString(), "1234567890123456.78");
  assert.equal((await db.chatMessage.findUnique({ where: { id: "message1" } })).attachments[0].url, "/uploads/chat/synthetic.txt");
  assert.match(command(importArgs), /alreadyImported/);
  assert.equal(await db.user.count(), 1);
  assert.equal(await db.organization.count(), 1);
  assert.deepEqual((await db.migrationImport.findFirst()).sourceSnapshot, fixture);
  assert.equal(fs.readFileSync(source, "utf8"), before);
  // The importer refuses to replace a database that already has data.
  const changed = { ...fixture, settings: { general: { organizationName: "changed" } } };
  fs.writeFileSync(source, JSON.stringify(changed));
  command(importArgs, 1);
  assert.equal(await db.task.count(), 1);

  await db.user.createMany({ data: [
    { id: "u2", fullName: "Synthetic B Owner", phone: "09000000002", email: "b@example.test", passwordHash: fixture.teamMembers[0].passwordHash, appRole: "admin" },
    { id: "u3", fullName: "Synthetic Guest", phone: "09000000003", email: "guest@example.test", passwordHash: fixture.teamMembers[0].passwordHash },
    { id: "u4", fullName: "Synthetic Member", phone: "09000000004", email: "member@example.test", passwordHash: fixture.teamMembers[0].passwordHash },
  ] });
  await db.organization.create({ data: { id: "org-b", name: "Synthetic B", memberships: { create: { userId: "u2", role: "owner" } } } });
  server = spawn(process.execPath, ["apps/api/src/index.js"], { env, stdio: ["ignore", "pipe", "pipe"] });
  let serverErrors = ""; server.stderr.on("data", (chunk) => { serverErrors += chunk.toString(); });
  server.stdout.on("data", () => {});
  for (let attempt = 0; attempt < 80; attempt++) {
    try { if ((await fetch(base + "/api/health")).ok) break; } catch {}
    if (server.exitCode !== null) throw new Error("API startup failed: " + serverErrors);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const login = (phone) => check("POST", "/api/auth/login", null, { phone, password: "synthetic-password" });
  const a = (await login("09000000001")).token;
  const b = (await login("09000000002")).token;
  const guest = (await login("09000000003")).token;
  const member = (await login("09000000004")).token;
  const organizations = await check("GET", "/api/organizations", a);
  assert.equal(organizations.length, 1);
  const prefix = "/api/organizations/legacy-default";
  const other = "/api/organizations/org-b";
  const newProject = await check("POST", prefix + "/projects", a, { name: "Visible A project", organizationId: "org-b" }, 201);
  assert.equal((await db.project.findUnique({ where: { id: newProject.id } })).organizationId, "legacy-default");
  for (const route of [prefix + "/projects", prefix + "/projects/" + newProject.id, prefix + "/audit"]) await check("GET", route, b, null, 404);
  await check("POST", prefix + "/projects", b, { name: "attack" }, 404);
  assert.equal((await check("GET", other + "/projects?search=Visible", b)).total, 0);
  await check("GET", prefix + "/projects?pageSize=100000", a, null, 400);
  const invitation = await check("POST", prefix + "/invitations", a, { userId: "u3", email: "guest@example.test", role: "guest" }, 201);
  await check("POST", "/api/organizations/accept-invitation", member, { token: invitation.token }, 404);
  await check("POST", "/api/organizations/accept-invitation", guest, { token: invitation.token });
  await check("POST", "/api/organizations/accept-invitation", guest, { token: invitation.token }, 404);
  assert.equal((await check("GET", prefix + "/projects", guest)).total, 0);
  await check("GET", prefix + "/projects/" + newProject.id, guest, null, 404);
  await check("POST", prefix + "/projects", guest, { name: "forbidden" }, 403);
  await check("GET", prefix + "/audit", guest, null, 403);
  await check("POST", prefix + "/projects/" + newProject.id + "/members", a, { userId: "u2" }, 404);
  await check("POST", prefix + "/projects/" + newProject.id + "/members", a, { userId: "u3" });
  assert.equal((await check("GET", prefix + "/projects", guest)).total, 1);
  // Same identity can join a second organization without changing the first one's role.
  const secondInvite = await check("POST", other + "/invitations", b, { userId: "u1", email: "owner@example.test", role: "member" }, 201);
  await check("POST", "/api/organizations/accept-invitation", a, { token: secondInvite.token });
  await check("POST", other + "/projects", a, { name: "escalation" }, 403);
  const orgBProject = await check("POST", other + "/projects", b, { name: "B private" }, 201);
  await assert.rejects(db.task.create({ data: { id: "cross-org-task", title: "attack", organizationId: "legacy-default", projectId: orgBProject.id, assignerId: "u1", assigneePrimaryId: "u1" } }), { code: "P2003" });
  // Membership caps are enforced at acceptance, under a database row lock.
  await db.organization.update({ where: { id: "legacy-default" }, data: { activeMemberLimit: 2 } });
  const cappedInvite = await check("POST", prefix + "/invitations", a, { userId: "u4", email: "member@example.test" }, 201);
  await check("POST", "/api/organizations/accept-invitation", member, { token: cappedInvite.token }, 409);
  await check("DELETE", prefix + "/members/u3", a);
  await check("GET", prefix + "/projects", guest, null, 404);
  // Retrying concurrently cannot create two memberships or consume two slots.
  const responses = await Promise.all([1, 2].map(() => fetch(base + "/api/organizations/accept-invitation", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + member }, body: JSON.stringify({ token: cappedInvite.token }) })));
  assert.equal(responses.filter((r) => r.status === 200).length, 1);
  assert.equal(await db.organizationMembership.count({ where: { organizationId: "legacy-default", status: "active" } }), 2);
  for (const route of ["/api/tasks", "/api/chat/conversations", "/api/notifications", "/api/settings", "/api/admin/backup"]) await check("GET", route, a, null, 503);
  await check("GET", "/uploads/chat/synthetic.txt", null, null, 404);
  await new Promise((resolve, reject) => {
    const socket = io(base, { auth: { token: a }, transports: ["websocket"], reconnection: false, timeout: 3000 });
    socket.once("connect", () => { socket.disconnect(); reject(new Error("Legacy socket unexpectedly connected")); });
    socket.once("connect_error", (error) => { socket.disconnect(); assert.match(error.message, /migration pending/); resolve(); });
  });
  const forged = jwt.sign({ sub: "u1", role: "admin" }, "dev-insecure-secret-change-me");
  await check("GET", "/api/organizations", forged, null, 401);
  await check("POST", "/api/auth/logout", a);
  await check("GET", "/api/organizations", a, null, 401);
  assert.equal(fs.existsSync(env.TASK_APP_DATA_FILE), false, "PostgreSQL must not initialize or access JSON");
  console.log("PostgreSQL integration passed: migrations, migration safety/idempotency, scope, guest grants, roles, limits/concurrency, revocation, session logout, file/socket gates.");
} finally {
  if (server) { server.kill(); await new Promise((resolve) => server.once("exit", resolve)); }
  await db.$executeRawUnsafe('DROP SCHEMA "' + schema + '" CASCADE');
  await db.$disconnect();
  // Synthetic local fixtures only; leave source backups available for inspection.
}

await import("./setup-postgres.mjs");

import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL is required.");
const url = new URL(process.env.TEST_DATABASE_URL);
if (!url.pathname.endsWith("_test")) throw new Error("Separate _test database required.");
const schema = "modules_" + crypto.randomBytes(6).toString("hex"); url.searchParams.set("schema", schema);
const env = { ...process.env, NODE_ENV: "test", DB_MODE: "postgres", DATABASE_URL: url.toString(), TENANT_FOUNDATION_ENABLED: "true", DEPLOYMENT_MODE: "hosted",
  JWT_SECRET: "synthetic-module-integration-private-key", PORT: "8900", SERVE_CLIENT: "false", SERVER_LOG_TO_FILE: "false", HTTP_ACCESS_LOG: "off", SERVER_LOG_LEVEL: "error" };
const deployment = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", "apps/api/prisma/schema.prisma"], { env, encoding: "utf8" });
assert.equal(deployment.status, 0, deployment.stdout + deployment.stderr);
const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
const base = "http://127.0.0.1:8900";
let server;
const call = async (route, token, method = "GET", body, expected = 200) => {
  const res = await fetch(base + route, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await res.json(); assert.equal(res.status, expected, method + " " + route + ": " + JSON.stringify(data)); return data;
};
try {
  const passwordHash = "bcrypt$" + bcrypt.hashSync("Synthetic-module-password", 10);
  await db.user.createMany({ data: ["owner-a", "owner-b", "member", "admin", "guest"].map((id, i) => ({ id, fullName: "Synthetic " + id, phone: "0900000100" + i, email: id + "@example.test", passwordHash })) });
  await db.organization.createMany({ data: [{ id: "a", name: "Synthetic A", activeMemberLimit: 10 }, { id: "b", name: "Synthetic B", activeMemberLimit: 10 }] });
  await db.organizationMembership.createMany({ data: [
    { organizationId: "a", userId: "owner-a", role: "owner", canManageHr: true, canManageAccounting: true },
    { organizationId: "b", userId: "owner-b", role: "owner", canManageHr: true, canManageAccounting: true },
    { organizationId: "a", userId: "member", role: "member" }, { organizationId: "a", userId: "admin", role: "admin" }, { organizationId: "a", userId: "guest", role: "guest" },
    { organizationId: "b", userId: "owner-a", role: "member" },
  ] });
  server = spawn(process.execPath, ["apps/api/src/index.js"], { env, stdio: ["ignore", "pipe", "pipe"] });
  let errors = ""; server.stderr.on("data", chunk => { errors += chunk;process.stderr.write(chunk); }); server.stdout.on("data", () => {});
  for (let attempt = 0; attempt < 80; attempt++) { try { if ((await fetch(base + "/api/ready")).ok) break; } catch {} if (server.exitCode !== null) throw new Error(errors); await new Promise(r => setTimeout(r, 250)); }
  const tokens = {};
  for (const [i, id] of ["owner-a", "owner-b", "member", "admin", "guest"].entries()) tokens[id] = (await call("/api/auth/login", null, "POST", { phone: "0900000100" + i, password: "Synthetic-module-password" })).token;
  const a = tokens["owner-a"], b = tokens["owner-b"], member = tokens.member, admin = tokens.admin, guest = tokens.guest;
  const prefix = "/api/organizations/a", other = "/api/organizations/b";
  const team = await call(prefix + "/teams", a, "POST", { name: "Synthetic team" }, 201);
  await call(prefix + "/teams/" + team.id + "/members", a, "POST", { userId: "member" });
  await call(prefix + "/teams/" + team.id + "/members", a, "POST", { userId: "owner-b" }, 404);
  await call(other + "/teams/" + team.id, b, "PATCH", { name: "attack" }, 404);
  const createdMember = await call(prefix + "/members", a, "POST", { fullName: "Synthetic created", phone: "09000001200", password: "Synthetic-create-password", role: "member" }, 201);
  assert.equal("passwordHash" in createdMember.user, false);
  await call(prefix + "/members", guest, "GET", null, 403);
  const project = await call(prefix + "/projects", a, "POST", { name: "Synthetic project" }, 201);
  await call(prefix + "/projects/" + project.id + "/members", a, "POST", { userId: "member" });
  await call(prefix + "/members/" + createdMember.userId, a, "PATCH", { role: "project_manager" });
  const projectManager = (await call("/api/auth/login", null, "POST", { phone: "09000001200", password: "Synthetic-create-password" })).token;
  assert.equal((await call(prefix + "/projects", projectManager)).total, 0);
  await call(prefix + "/projects/" + project.id, projectManager, "PATCH", { name: "attack" }, 404);
  const steps = [{ id: "execute", title: "Execute" }, { id: "approve", title: "Approve", requiresApproval: true, approvalAssigneeType: "task_assigner", onReject: "previous" }];
  const task = await call(prefix + "/tasks", a, "POST", { title: "Synthetic task", projectId: project.id, assigneePrimaryId: "member", workflowSteps: steps }, 201);
  await call(prefix + "/tasks", a, "POST", { title: "cross-org assignee", projectId: project.id, assigneePrimaryId: "owner-b" }, 404);
  assert.equal((await call(other + "/tasks?search=Synthetic", b)).total, 0);
  await call(other + "/tasks/" + task.id, b, "GET", null, 404);
  await call(prefix + "/tasks/" + task.id + "/workflow/decision", a, "POST", { expectedVersion: 0, decision: "advance", idempotencyKey: "wrong-actor" }, 403);
  const firstBody = { expectedVersion: 0, decision: "advance", idempotencyKey: "first" };
  const advanced = await call(prefix + "/tasks/" + task.id + "/workflow/decision", member, "POST", firstBody);
  assert.equal(advanced.version, 1); assert.equal(advanced.workflowCurrentStep, 1);
  assert.deepEqual(await call(prefix + "/tasks/" + task.id + "/workflow/decision", member, "POST", firstBody), advanced);
  await call(prefix + "/tasks/" + task.id + "/workflow/comments", member, "POST", { stepId: "approve", text: "Synthetic comment" }, 201);
  await call(prefix + "/tasks/" + task.id, member, "PATCH", { expectedVersion: 0, title: "stale" }, 409);
  await call(prefix + "/projects/" + project.id, a, "PATCH", { expectedVersion: project.version, workflowTemplateSteps: [{ id: "new", title: "New template" }] });
  assert.deepEqual((await call(prefix + "/tasks/" + task.id, a)).workflowSteps, task.workflowSteps);
  const requests = ["concurrent-a", "concurrent-b"].map(idempotencyKey => fetch(base + prefix + "/tasks/" + task.id + "/workflow/decision", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + a }, body: JSON.stringify({ expectedVersion: 1, decision: "approve", idempotencyKey }) }));
  const responses = await Promise.all(requests); assert.equal(responses.filter(r => r.status === 200).length, 1); assert.equal(responses.filter(r => r.status === 409).length, 1);
  assert.equal((await call(prefix + "/tasks/" + task.id, a)).status, "done"); assert.equal((await call(prefix + "/tasks/" + task.id + "/workflow/history", a)).length, 2);
  const rejectTask = await call(prefix + "/tasks", a, "POST", { title: "Reject test", projectId: project.id, assigneePrimaryId: "member", workflowSteps: steps }, 201);
  await call(prefix + "/tasks/" + rejectTask.id + "/workflow/decision", member, "POST", { expectedVersion: 0, decision: "advance", idempotencyKey: "advance" });
  assert.equal((await call(prefix + "/tasks/" + rejectTask.id + "/workflow/decision", a, "POST", { expectedVersion: 1, decision: "reject", idempotencyKey: "reject" })).workflowCurrentStep, 0);
  assert.equal((await call(prefix + "/tasks", guest)).total, 0);
  await call(prefix + "/projects/" + project.id + "/members", a, "POST", { userId: "guest" });
  assert.equal((await call(prefix + "/tasks", guest)).total, 2);
  await call(prefix + "/tasks", guest, "POST", { title: "guest attack", projectId: project.id }, 403);
  const roleTask = await call(prefix + "/tasks", a, "POST", { title: "Role stage task", projectId: project.id, assigneePrimaryId: "member", workflowSteps: [{ id: "role-execute", title: "Role execute", assigneeType: "role", assigneeRole: "project_manager" }, { id: "owner-approve", title: "Owner approve", requiresApproval: true }] }, 201);
  const roleView = await call(prefix + "/tasks/" + roleTask.id, projectManager);
  assert.equal("members" in roleView.project, false);
  assert.ok((await call(prefix + "/notifications", projectManager)).items.some(row => row.taskId === roleTask.id));
  const roleBody = { expectedVersion: 0, decision: "advance", idempotencyKey: "role-advance" };
  const roleResult = await call(prefix + "/tasks/" + roleTask.id + "/workflow/decision", projectManager, "POST", roleBody);
  assert.deepEqual(await call(prefix + "/tasks/" + roleTask.id + "/workflow/decision", projectManager, "POST", roleBody), roleResult);
  await call(prefix + "/tasks/" + roleTask.id, projectManager, "PATCH", { expectedVersion: 1, title: "history does not grant edit" }, 403);
  assert.equal((await call(prefix + "/projects", projectManager)).total, 0);
  const minute = await call(prefix + "/minutes", a, "POST", { title: "Meeting", date: "2026-10-13", summary: "Synthetic summary" }, 201);
  await call(other + "/minutes/" + minute.id, b, "DELETE", null, 404);
  await call(prefix + "/hr/profiles", admin, "GET", null, 403);
  await call(prefix + "/hr/profiles/member", a, "PUT", { department: "Synthetic HR", salaryBase: "120000.50", salaryCurrency: "IRR" });
  await call(other + "/hr/profiles/owner-a", b, "PUT", { department: "Synthetic B HR" });
  await call(prefix + "/hr/profiles/owner-a", a, "PUT", { department: "Synthetic A HR" });
  assert.equal(await db.hrProfile.count({ where: { userId: "owner-a" } }), 2);
  const leave = await call(prefix + "/hr/leaves", member, "POST", { fromDate: "2026-10-14", toDate: "2026-10-15", reason: "Synthetic leave" }, 201);
  await call(prefix + "/hr/leaves/" + leave.id + "/status", a, "PATCH", { status: "approved" });
  await call(other + "/hr/leaves/" + leave.id + "/status", b, "PATCH", { status: "rejected" }, 404);
  await call(prefix + "/hr/attendance/member/2026-10-13", a, "PUT", { checkIn: "09:00", checkOut: "17:00" });
  assert.equal((await call(prefix + "/hr/attendance", member)).items[0].workHours, "8");
  await call(prefix + "/accounting/accounts", admin, "GET", null, 403);
  const account = await call(prefix + "/accounting/accounts", a, "POST", { name: "Synthetic account" }, 201);
  const accountB = await call(other + "/accounting/accounts", b, "POST", { name: "Synthetic account B" }, 201);
  const transaction = await call(prefix + "/accounting/transactions", a, "POST", { title: "Synthetic expense", amount: "1234567890123456.78", currency: "IRR", type: "expense", date: "2026-10-13", accountId: account.id }, 201);
  assert.equal(transaction.amount, "1234567890123456.78");
  await call(prefix + "/accounting/transactions", a, "POST", { title: "attack", amount: "1", currency: "IRR", type: "expense", date: "2026-10-13", accountId: accountB.id }, 404);
  await call(other + "/accounting/transactions/" + transaction.id, b, "DELETE", null, 404);
  await call(prefix + "/accounting/budgets/2026-10", a, "PUT", { amount: "500.25", currency: "IRR" });
  assert.equal((await call(prefix + "/accounting/budget-history", a)).total, 1);
  const room = await call(prefix + "/chat/conversations", a, "POST", { title: "Synthetic room", participantIds: ["member"] }, 201);
  const message = await call(prefix + "/chat/conversations/" + room.id + "/messages", a, "POST", { text: "Synthetic message", mentionMemberIds: ["member"] }, 201);
  await call(prefix + "/chat/conversations/" + room.id + "/messages", admin, "GET", null, 404);
  await call(other + "/chat/conversations/" + room.id + "/messages", b, "GET", null, 404);
  await call(prefix + "/chat/messages/" + message.id + "/reactions", member, "POST", { emoji: "👍" });
  await call(prefix + "/chat/messages/" + message.id, member, "PATCH", { text: "attack" }, 403);
  const notices = await call(prefix + "/notifications", member); assert.ok(notices.total >= 2);
  const noticeId = notices.items[0].id;
  await call(other + "/notifications/" + noticeId + "/read", b, "POST", {}, 404);
  await call(prefix + "/notifications/" + noticeId + "/read", member, "POST", {});
  await call(prefix + "/notifications/bulk/read", member, "POST", {});
  await call(prefix + "/notification-preferences", member, "PUT", { delivery: { task: { center: true, toast: false, sound: false } }, mutedKinds: [], mutedCategories: [] });
  const adminAudit = await call(prefix + "/audit", admin);
  assert.equal(adminAudit.some(row => ["hr.", "account.", "transaction.", "budget.", "chat."].some(prefix => row.action.startsWith(prefix))), false);
  await call(prefix + "/module-settings", a, "PUT", { modules: { teams: false, tasks: false } });
  await call(prefix + "/tasks", a, "GET", null, 403);
  await call(prefix + "/module-settings", a, "PUT", { modules: { teams: true, tasks: true } });
  await call(prefix + "/members/member", a, "PATCH", { canManageHr: true });
  await call(prefix + "/hr/profiles", member);
  await call(prefix + "/members/member", admin, "PATCH", { canManageAccounting: true }, 403);
  await call(prefix + "/members/member", a, "DELETE");
  await call(prefix + "/chat/conversations", member, "GET", null, 404);
  await call(prefix+"/hr/leaves",a,"POST",{fromDate:"2026-10-14",toDate:"2026-10-15",leaveType:"annual",hours:"",userId:"owner-a",reason:"Synthetic browser-shaped leave"},201);
  await call(prefix+"/hr/leaves?page=1",a);await call(prefix+"/hr/attendance?page=1",a);await call(prefix+"/hr/profiles/owner-a",a);await call(prefix+"/hr/report?from=&to=",a);await call(prefix+"/accounting/report?from=&to=",a);
  console.log("Module integration passed: scoped CRUD, independent HR/finance grants, multi-org identity, workflow retry/concurrency/rejection, notifications, module toggles and revocation.");
} finally {
  if (server) { server.kill(); await new Promise(r => server.once("exit", r)); }
  await db.$executeRawUnsafe('DROP SCHEMA "' + schema + '" CASCADE'); await db.$disconnect();
}


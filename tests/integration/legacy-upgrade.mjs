import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
const url = new URL(process.env.TEST_DATABASE_URL);
if (!url.pathname.endsWith("_test")) throw new Error("Separate _test database required.");
const schema = "upgrade_" + crypto.randomBytes(6).toString("hex");
url.searchParams.set("schema", schema);
const env = { ...process.env, DATABASE_URL: url.toString() };
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "shekof-upgrade-"));
const legacySchema = path.join(temp, "schema.prisma");
fs.copyFileSync("tests/fixtures/legacy-v5.prisma", legacySchema);
fs.mkdirSync(path.join(temp, "migrations"));
for (const name of fs.readdirSync("apps/api/prisma/migrations")) {
  if (name === "migration_lock.toml") fs.copyFileSync(path.join("apps/api/prisma/migrations", name), path.join(temp, "migrations", name));
  else if (name < "202610120006") fs.cpSync(path.join("apps/api/prisma/migrations", name), path.join(temp, "migrations", name), { recursive: true });
}
const deploy = (source) => {
  const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", source], { env, encoding: "utf8" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
};
deploy(legacySchema);
const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
// Table/column names below come only from this fixed synthetic fixture; all values are parameters.
const seed = (table, data) => {
  const columns = Object.keys(data);
  const casts = { "User.appRole": '::"AppRole"', "ChatConversation.type": '::"ConversationType"', "AccountingTransaction.type": '::"AccountingType"' };
  const query = 'INSERT INTO "' + table + '" (' + columns.map(c => '"' + c + '"').join(",") + ") VALUES (" + columns.map((c,i) => "$" + (i + 1) + (casts[table + "." + c] || "")).join(",") + ")";
  return db.$executeRawUnsafe(query, ...Object.values(data));
};
try {
  const now = new Date();
  await seed("User", { id: "legacy-owner", fullName: "Synthetic owner", phone: "09000009901", passwordHash: "synthetic-hash", appRole: "admin", updatedAt: now });
  await seed("User", { id: "legacy-member", fullName: "Synthetic member", phone: "09000009902", passwordHash: "synthetic-hash", appRole: "member", updatedAt: now });
  await seed("Team", { id: "legacy-team", name: "Synthetic team", updatedAt: now });
  await seed("TeamMembership", { id: "legacy-team-member", teamId: "legacy-team", userId: "legacy-member" });
  await seed("Project", { id: "legacy-project", name: "Synthetic project", ownerId: "legacy-owner", updatedAt: now });
  await seed("ProjectMember", { id: "legacy-project-member", projectId: "legacy-project", userId: "legacy-member" });
  await seed("Task", { id: "legacy-task", title: "Synthetic task", assignerId: "legacy-owner", assigneePrimaryId: "legacy-member", projectId: "legacy-project", updatedAt: now });
  await seed("TaskWorkflowComment", { id: "legacy-comment", taskId: "legacy-task", stepId: "s1", authorId: "legacy-member", text: "Synthetic preserved comment" });
  await seed("HrProfile", { userId: "legacy-member", department: "Synthetic HR", salaryBase: 100.25, updatedAt: now });
  await seed("ChatConversation", { id: "legacy-room", type: "group", title: "Synthetic room", updatedAt: now });
  await seed("ChatConversationMember", { id: "legacy-room-member", conversationId: "legacy-room", userId: "legacy-member" });
  await seed("ChatMessage", { id: "legacy-message", conversationId: "legacy-room", senderId: "legacy-member", text: "Synthetic preserved message", updatedAt: now });
  await seed("AccountingTransaction", { id: "legacy-transaction", userId: "legacy-member", type: "expense", title: "Synthetic expense", amount: 1234.50, date: now, updatedAt: now });
  deploy("apps/api/prisma/schema.prisma");
  assert.equal((await db.task.findUnique({ where: { id: "legacy-task" } })).organizationId, "legacy-default");
  assert.equal((await db.teamMembership.findUnique({ where: { id: "legacy-team-member" } })).organizationId, "legacy-default");
  assert.equal((await db.chatMessage.findUnique({ where: { id: "legacy-message" } })).text, "Synthetic preserved message");
  assert.equal((await db.taskWorkflowComment.findUnique({ where: { id: "legacy-comment" } })).text, "Synthetic preserved comment");
  const profile = await db.hrProfile.findUnique({ where: { organizationId_userId: { organizationId: "legacy-default", userId: "legacy-member" } } });
  assert.equal(profile.salaryBase.toString(), "100.25"); assert.equal(profile.salaryCurrency, null);
  assert.equal((await db.accountingTransaction.findUnique({ where: { id: "legacy-transaction" } })).currency, null);
  assert.equal(await db.organizationMembership.count(), 2);
  assert.equal((await db.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId: "legacy-default", userId: "legacy-owner" } } })).role, "owner");
  const before = await db.task.count(); deploy("apps/api/prisma/schema.prisma"); assert.equal(await db.task.count(), before);
  await assert.rejects(seed("Team", { id: "unscoped-attack", name: "No scope", updatedAt: now }));
  console.log("Legacy upgrade passed: nonempty PostgreSQL, relational backfill, preserved IDs/comments/messages/Decimal, unknown units retained, required scopes and rerun.");
} finally {
  await db.$executeRawUnsafe('DROP SCHEMA "' + schema + '" CASCADE'); await db.$disconnect();
}


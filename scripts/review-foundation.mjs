import { spawn, spawnSync } from "node:child_process";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

if (process.env.NODE_ENV === "production") throw new Error("Review fixtures are development-only.");
const url = new URL(process.env.REVIEW_DATABASE_URL || "postgresql://shekof_test:synthetic-test-only@127.0.0.1:56432/shekof_test");
if (!url.pathname.endsWith("_test")) throw new Error("Review requires a separate database ending with _test.");
url.searchParams.set("schema", "review_foundation");
const env = { ...process.env, NODE_ENV: "development", DB_MODE: "postgres", DATABASE_URL: url.toString(), DEPLOYMENT_MODE: "hosted",
  TENANT_FOUNDATION_ENABLED: "true", TELEMETRY_ENABLED: "false", PORT: process.env.REVIEW_PORT || "8896", BIND_HOST: "127.0.0.1",
  SERVE_CLIENT: "true", PLATFORM_OPERATOR_USER_IDS:"synthetic-review-owner", JWT_SECRET: crypto.randomBytes(32).toString("hex"), SERVER_LOG_TO_FILE: "false", SERVER_LOG_LEVEL: "error", HTTP_ACCESS_LOG: "off" };
const migration = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", "apps/api/prisma/schema.prisma"], { env, stdio: "inherit" });
if (migration.status !== 0) process.exit(migration.status || 1);
const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
try {
  const id = "synthetic-review-owner";
  const password = process.env.REVIEW_PASSWORD || "Synthetic-Review-2026";
  const passwordHash = "bcrypt$" + await bcrypt.hash(password, 10);
  await db.user.upsert({ where: { id }, create: { id, fullName: "کاربر آزمایشی", phone: "09000000200", email: "review@example.test", passwordHash }, update: { passwordHash } });
  await db.organization.upsert({ where: { id: "synthetic-review-org" }, create: { id: "synthetic-review-org", name: "سازمان آزمایشی شکف", memberships: { create: { userId: id, role: "owner" } } }, update: {} });
  await db.organizationMembership.update({ where: { organizationId_userId: { organizationId: "synthetic-review-org", userId: id } }, data: { canManageHr: true, canManageAccounting: true } });
  await db.project.upsert({ where: { id: "synthetic-review-project" }, create: { id: "synthetic-review-project", organizationId: "synthetic-review-org", ownerId: id, name: "اولین پروژه آزمایشی", description: "این داده صرفاً برای بررسی محلی ساخته شده است." }, update: {} });
  console.log(`Local review: http://127.0.0.1:${env.PORT}/login`);
  console.log("Synthetic review account: 09000000200; password: " + (process.env.REVIEW_PASSWORD ? "your REVIEW_PASSWORD" : "Synthetic-Review-2026"));
} finally { await db.$disconnect(); }
const child = spawn(process.execPath, ["apps/api/src/index.js"], { env, stdio: "inherit" });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));


import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import prisma from "../src/prisma.js";
import { runtimeConfig } from "../src/runtime-config.js";

try {
  if (!runtimeConfig.tenantFoundation) throw new Error("SETUP_REQUIRES_TENANT_FOUNDATION");
  const fullName = process.env.SETUP_ADMIN_NAME;
  const phone = process.env.SETUP_ADMIN_PHONE;
  const password = process.env.SETUP_ADMIN_PASSWORD;
  const email = process.env.SETUP_ADMIN_EMAIL;
  const name = process.env.SETUP_ORGANIZATION_NAME || "مدیریت پروژه شکف";
  if (!fullName || !/^09\d{9}$/.test(phone || "") || !password || password.length < 12) throw new Error("SETUP_NAME_PHONE_AND_PRIVATE_PASSWORD_MIN_12_REQUIRED");
  const passwordHash = "bcrypt$" + await bcrypt.hash(password, 12);
  delete process.env.SETUP_ADMIN_PASSWORD;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(72411012)`;
    if (await tx.organization.count() || await tx.user.count()) throw new Error("SETUP_ALREADY_CLOSED");
    const user = await tx.user.create({ data: { id: crypto.randomUUID(), fullName, phone, email, passwordHash, appRole: "member" } });
    await tx.organization.create({ data: { name, memberships: { create: { userId: user.id, role: "owner", canManageHr: true, canManageAccounting: true } } } });
  });
  console.log("Setup completed. Initial setup is now closed; sign in using your chosen credentials.");
} catch (error) {
  console.error(JSON.stringify({ ok: false, code: /^[A-Z_0-9]+$/.test(error.message) ? error.message : (error.code || "SETUP_FAILED") }));
  process.exitCode = 1;
} finally { await prisma.$disconnect(); }

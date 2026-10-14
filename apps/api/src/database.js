import prisma from "./prisma.js";
import { isPostgresMode, DB_MODE } from "./db-mode.js";

let dbConnected = false;
let lastDbError = "";

export async function connectDatabase() {
  if (!isPostgresMode) {
    dbConnected = false;
    lastDbError = "";
    return { mode: DB_MODE, connected: false, provider: "json" };
  }
  try {
    await prisma.$connect();
    await prisma.user.count();
    if (process.env.TENANT_FOUNDATION_ENABLED === "true") await prisma.organization.count();
    dbConnected = true;
    lastDbError = "";
    return { mode: DB_MODE, connected: true, provider: "postgresql" };
  } catch (error) {
    dbConnected = false;
    lastDbError = "DATABASE_NOT_READY";
    throw new Error("PostgreSQL connection failed. Check database configuration without logging credentials.");
  }
}

export function getDatabaseHealth() {
  return {
    mode: DB_MODE,
    provider: isPostgresMode ? "postgresql" : "json",
    connected: isPostgresMode ? dbConnected : false,
    error: lastDbError || undefined,
  };
}

export async function disconnectDatabase() {
  if (!isPostgresMode) return;
  try {
    await prisma.$disconnect();
  } catch {
    // ignore shutdown disconnect errors
  }
}

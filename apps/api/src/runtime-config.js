import "./load-env.js";

export function parseRuntimeConfig(env = process.env) {
  const production = env.NODE_ENV === "production";
  const dbMode = String(env.DB_MODE || (production ? "postgres" : "json")).trim().toLowerCase();
  const deploymentMode = String(env.DEPLOYMENT_MODE || "self_hosted").trim().toLowerCase();
  const tenantFoundation = env.TENANT_FOUNDATION_ENABLED === "true";
  if (!["postgres", "json"].includes(dbMode)) throw new Error("DB_MODE must be postgres or json.");
  if (!["hosted", "self_hosted"].includes(deploymentMode)) throw new Error("DEPLOYMENT_MODE must be hosted or self_hosted.");
  if (production && dbMode !== "postgres") throw new Error("Production requires PostgreSQL; JSON is development-only.");
  if (tenantFoundation && dbMode !== "postgres") throw new Error("Tenant foundation requires PostgreSQL.");
  if (dbMode === "postgres" && !tenantFoundation) throw new Error("PostgreSQL requires TENANT_FOUNDATION_ENABLED=true; the legacy API is JSON-development-only.");
  if (production && !tenantFoundation) throw new Error("Production is gated until the tenant-safe foundation is enabled. Legacy modules are development-only.");
  if (production && (String(env.JWT_SECRET || "").length < 32 || /^(dev-|e2e-|change-me|REPLACE_|YOUR_|placeholder)/i.test(env.JWT_SECRET))) {
    throw new Error("Production requires a private JWT_SECRET of at least 32 characters.");
  }
  if (dbMode === "postgres" && !env.DATABASE_URL) throw new Error("DATABASE_URL is required for PostgreSQL.");
  return Object.freeze({ production, dbMode, deploymentMode, tenantFoundation, telemetryEnabled: env.TELEMETRY_ENABLED === "true" });
}

export const runtimeConfig = parseRuntimeConfig();

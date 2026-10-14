import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DB_MODE = "json";
process.env.NODE_ENV = "test";
process.env.TENANT_FOUNDATION_ENABLED = "false";
const { parseRuntimeConfig } = await import("../../apps/api/src/runtime-config.js");
const production = { NODE_ENV: "production", TENANT_FOUNDATION_ENABLED: "true", DATABASE_URL: "postgresql://synthetic", JWT_SECRET: "private-synthetic-value-with-more-than-32-characters" };
test("production defaults to postgres with offline self-hosting and no telemetry", () => {
  const result = parseRuntimeConfig(production);
  assert.equal(result.dbMode, "postgres"); assert.equal(result.deploymentMode, "self_hosted"); assert.equal(result.telemetryEnabled, false);
});
test("production rejects JSON, default credentials and incomplete tenant migration", () => {
  for (const extra of [{ DB_MODE: "json" }, { JWT_SECRET: "dev-insecure-secret-change-me" }, { TENANT_FOUNDATION_ENABLED: "false" }, { DATABASE_URL: "" }]) assert.throws(() => parseRuntimeConfig({ ...production, ...extra }));
});
test("unknown modes fail instead of falling back to JSON", () => {
  assert.throws(() => parseRuntimeConfig({ DB_MODE: "postgress" }));
  assert.throws(() => parseRuntimeConfig({ DEPLOYMENT_MODE: "other" }));
});

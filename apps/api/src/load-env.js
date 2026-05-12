import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const API_ROOT = path.resolve(CURRENT_DIR, "..");
const PROJECT_ROOT = path.resolve(API_ROOT, "..", "..");
const ENV_PATHS = [
  path.resolve(PROJECT_ROOT, ".env"),
  path.resolve(PROJECT_ROOT, ".env.local"),
];
const RUNTIME_SKIP_KEYS = new Set([
  "DB_MODE",
  "DATABASE_URL",
  "POSTGRES_DB",
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
  "POSTGRES_PORT",
]);

const parseEnvLine = (line) => {
  const trimmed = String(line ?? "").trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex <= 0) return null;
  const key = trimmed.slice(0, separatorIndex).trim();
  if (!key) return null;
  let value = trimmed.slice(separatorIndex + 1).trim();
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  value = value.replace(/\\n/g, "\n");
  return [key, value];
};

for (const envPath of ENV_PATHS) {
  if (!fs.existsSync(envPath)) continue;
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    const [key, value] = parsed;
    if (RUNTIME_SKIP_KEYS.has(key)) continue;
    if (process.env[key] == null || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

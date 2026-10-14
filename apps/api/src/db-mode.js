import { runtimeConfig } from "./runtime-config.js";

export const DB_MODE = runtimeConfig.dbMode;

export const isPostgresMode = DB_MODE === "postgres";
export const isJsonMode = !isPostgresMode;

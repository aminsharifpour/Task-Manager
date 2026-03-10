export const DB_MODE = String(process.env.DB_MODE || "json").trim().toLowerCase();

export const isPostgresMode = DB_MODE === "postgres";
export const isJsonMode = !isPostgresMode;

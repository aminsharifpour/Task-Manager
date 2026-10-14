import "./load-env.js";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__taskAppPrisma ??
  new PrismaClient({
    // ORM validation errors can contain customer fields or password hashes.
    // Controllers log only safe error codes and request IDs.
    log: [],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__taskAppPrisma = prisma;
}

export default prisma;

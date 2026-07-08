import { PrismaClient } from "@prisma/client";

/**
 * Shared Prisma client singleton for the TypeScript side (API, and web if needed).
 * The Python worker talks to Postgres directly (psycopg / supabase-py), not Prisma.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export * from "@prisma/client";

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function resolveDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.NEON_POSTGRES_PRISMA_URL ||
    process.env.NEON_POSTGRES_URL ||
    process.env.NEON_DATABASE_URL
  );
}

function resolveDirectUrl() {
  return (
    process.env.DIRECT_URL ||
    process.env.NEON_DATABASE_URL_UNPOOLED ||
    process.env.NEON_POSTGRES_URL_NON_POOLING ||
    process.env.NEON_POSTGRES_URL
  );
}

process.env.DATABASE_URL = resolveDatabaseUrl();
process.env.DIRECT_URL = resolveDirectUrl();

function assertPostgresUrl(name: "DATABASE_URL" | "DIRECT_URL") {
  const value = process.env[name];
  if (!value) return;

  if (!value.startsWith("postgresql://") && !value.startsWith("postgres://")) {
    throw new Error(
      `${name} must use a PostgreSQL connection string (postgresql:// or postgres://). ` +
      `Update the ${name} environment variable in Vercel project settings.`
    );
  }
}

assertPostgresUrl("DATABASE_URL");
assertPostgresUrl("DIRECT_URL");

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

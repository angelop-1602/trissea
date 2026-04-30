import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { ensureProductionRuntimeEnv } from '@/lib/env-config';

const globalForPrisma = globalThis as unknown as {
  __trisseaPrismaPool: Pool | undefined;
  __trisseaPrisma: PrismaClient | undefined;
};

function hasExpectedDelegates(client: PrismaClient) {
  const candidate = client as unknown as Record<string, unknown>;

  return (
    typeof (candidate.user as { findUnique?: unknown } | undefined)?.findUnique === 'function' &&
    typeof (candidate.ride as { findMany?: unknown } | undefined)?.findMany === 'function' &&
    typeof (candidate.reservation as { findMany?: unknown } | undefined)?.findMany === 'function' &&
    typeof (candidate.tODATerminal as { findMany?: unknown } | undefined)?.findMany === 'function' &&
    typeof (candidate.tenant as { findUnique?: unknown } | undefined)?.findUnique === 'function'
  );
}

export function getPrisma() {
  ensureProductionRuntimeEnv();

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Missing environment variable: DATABASE_URL');
  }

  if (!globalForPrisma.__trisseaPrismaPool) {
    globalForPrisma.__trisseaPrismaPool = new Pool({ connectionString });
  }

  if (!globalForPrisma.__trisseaPrisma || !hasExpectedDelegates(globalForPrisma.__trisseaPrisma)) {
    const adapter = new PrismaPg(globalForPrisma.__trisseaPrismaPool);
    globalForPrisma.__trisseaPrisma = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }

  return globalForPrisma.__trisseaPrisma;
}


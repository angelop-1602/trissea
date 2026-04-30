import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { ensureProductionRuntimeEnv } from '@/lib/env-config';

const globalForPrisma = globalThis as unknown as {
  __mobilityPrismaPool: Pool | undefined;
  __mobilityPrisma: PrismaClient | undefined;
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

  if (!globalForPrisma.__mobilityPrismaPool) {
    globalForPrisma.__mobilityPrismaPool = new Pool({ connectionString });
  }

  if (!globalForPrisma.__mobilityPrisma || !hasExpectedDelegates(globalForPrisma.__mobilityPrisma)) {
    const adapter = new PrismaPg(globalForPrisma.__mobilityPrismaPool);
    globalForPrisma.__mobilityPrisma = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }

  return globalForPrisma.__mobilityPrisma;
}


import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

type PrismaTx = Prisma.TransactionClient | PrismaClient;

type AuditDelegateClient = PrismaTx & {
  platformAuditLog: {
    create: (args: unknown) => Promise<unknown>;
  };
  tenantAuditLog: {
    create: (args: unknown) => Promise<unknown>;
  };
  supportAccessLog: {
    create: (args: unknown) => Promise<unknown>;
  };
};

export const AUDIT_MODULES = {
  settings: 'settings',
  tenantTeam: 'tenant_team',
  drivers: 'drivers',
  todas: 'todas',
  support: 'support',
  tenants: 'tenants',
  passengers: 'passengers',
  platform: 'platform',
} as const;

function toJsonValue(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function createTenantAuditLog(params: {
  prisma: PrismaTx;
  tenantId: string;
  actorUserId?: string | null;
  module: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  before?: unknown;
  after?: unknown;
}) {
  const prisma = params.prisma as unknown as AuditDelegateClient;
  return prisma.tenantAuditLog.create({
    data: {
      id: randomUUID(),
      tenantId: params.tenantId,
      actorUserId: params.actorUserId ?? null,
      module: params.module,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId ?? null,
      beforeJson: toJsonValue(params.before),
      afterJson: toJsonValue(params.after),
    },
  });
}

export async function createPlatformAuditLog(params: {
  prisma: PrismaTx;
  actorUserId: string;
  module: string;
  action: string;
  targetType: string;
  reason: string;
  tenantId?: string | null;
  targetId?: string | null;
  before?: unknown;
  after?: unknown;
}) {
  const prisma = params.prisma as unknown as AuditDelegateClient;
  return prisma.platformAuditLog.create({
    data: {
      id: randomUUID(),
      actorUserId: params.actorUserId,
      tenantId: params.tenantId ?? null,
      module: params.module,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId ?? null,
      reason: params.reason,
      beforeJson: toJsonValue(params.before),
      afterJson: toJsonValue(params.after),
    },
  });
}

export async function createSupportAccessLog(params: {
  prisma: PrismaTx;
  tenantId: string;
  superAdminUserId: string;
  accessType: string;
  reason: string;
}) {
  const prisma = params.prisma as unknown as AuditDelegateClient;
  return prisma.supportAccessLog.create({
    data: {
      id: randomUUID(),
      tenantId: params.tenantId,
      superAdminUserId: params.superAdminUserId,
      accessType: params.accessType,
      reason: params.reason,
    },
  });
}

export async function createSuperadminTenantActionLogs(params: {
  prisma: PrismaTx;
  tenantId: string;
  superAdminUserId: string;
  module: string;
  action: string;
  targetType: string;
  reason: string;
  accessType?: string;
  targetId?: string | null;
  before?: unknown;
  after?: unknown;
}) {
  await Promise.all([
    createPlatformAuditLog({
      prisma: params.prisma,
      actorUserId: params.superAdminUserId,
      tenantId: params.tenantId,
      module: params.module,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      reason: params.reason,
      before: params.before,
      after: params.after,
    }),
    createSupportAccessLog({
      prisma: params.prisma,
      tenantId: params.tenantId,
      superAdminUserId: params.superAdminUserId,
      accessType: params.accessType ?? params.action,
      reason: params.reason,
    }),
    createTenantAuditLog({
      prisma: params.prisma,
      tenantId: params.tenantId,
      actorUserId: params.superAdminUserId,
      module: params.module,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      before: params.before,
      after: params.after,
    }),
  ]);
}

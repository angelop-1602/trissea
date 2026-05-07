import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { PrismaClient, Tenant } from '@prisma/client';
import {
  DEFAULT_TENANT_TRANSPORT_MODULES,
  TRANSPORT_MODULE_KEYS,
  moduleSortOrder,
  type TransportModuleKeyValue,
  toModuleSummary,
} from '@/lib/transport-modules';

let supportedTransportModuleKeysPromise: Promise<Set<TransportModuleKeyValue>> | null = null;

async function loadSupportedTransportModuleKeys(prisma: PrismaClient) {
  const rows = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
    SELECT e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'TransportModuleKey'
  `;

  return new Set(
    rows
      .map((row) => row.enumlabel)
      .filter((value): value is TransportModuleKeyValue =>
        TRANSPORT_MODULE_KEYS.includes(value as TransportModuleKeyValue)
      )
  );
}

async function getSupportedTransportModuleKeys(prisma: PrismaClient) {
  if (!supportedTransportModuleKeysPromise) {
    supportedTransportModuleKeysPromise = loadSupportedTransportModuleKeys(prisma).catch((error) => {
      supportedTransportModuleKeysPromise = null;
      throw error;
    });
  }

  return supportedTransportModuleKeysPromise;
}

async function loadTenantTransportModules(prisma: PrismaClient, tenantId: string) {
  return prisma.tenantTransportModule.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
}

async function normalizeTenantTransportModules(prisma: PrismaClient, tenantId: string) {
  let modules = await loadTenantTransportModules(prisma, tenantId);
  const existingKeys = new Set(modules.map((module) => module.moduleKey));
  const supportedModuleKeys = await getSupportedTransportModuleKeys(prisma);
  const missingDefaults = DEFAULT_TENANT_TRANSPORT_MODULES.filter(
    (module) => supportedModuleKeys.has(module.moduleKey) && !existingKeys.has(module.moduleKey)
  );

  if (missingDefaults.length > 0) {
    const now = new Date();
    try {
      await prisma.tenantTransportModule.createMany({
        data: missingDefaults.map((module) => ({
          id: randomUUID(),
          tenantId,
          moduleKey: module.moduleKey,
          isEnabled: module.isEnabled,
          isDefault: module.isDefault,
          sortOrder: module.sortOrder,
          createdAt: now,
          updatedAt: now,
        })),
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2007') {
        throw error;
      }

      supportedTransportModuleKeysPromise = null;
      const refreshedSupportedKeys = await getSupportedTransportModuleKeys(prisma);
      const retryDefaults = missingDefaults.filter((module) => refreshedSupportedKeys.has(module.moduleKey));

      if (retryDefaults.length === 0) {
        modules = await loadTenantTransportModules(prisma, tenantId);
      } else {
        await prisma.tenantTransportModule.createMany({
          data: retryDefaults.map((module) => ({
            id: randomUUID(),
            tenantId,
            moduleKey: module.moduleKey,
            isEnabled: module.isEnabled,
            isDefault: module.isDefault,
            sortOrder: module.sortOrder,
            createdAt: now,
            updatedAt: now,
          })),
        });
      }
    }

    modules = await loadTenantTransportModules(prisma, tenantId);
  }

  const enabledModules = modules.filter((module) => module.isEnabled);
  if (enabledModules.length === 0) {
    await prisma.$transaction([
      prisma.tenantTransportModule.updateMany({
        where: { tenantId },
        data: { isDefault: false },
      }),
      prisma.tenantTransportModule.updateMany({
        where: {
          tenantId,
          moduleKey: 'tricycle',
        },
        data: {
          isEnabled: true,
          isDefault: true,
        },
      }),
    ]);

    modules = await loadTenantTransportModules(prisma, tenantId);
  } else {
    const enabledDefaults = enabledModules.filter((module) => module.isDefault);
    const fallbackDefault =
      enabledModules.find((module) => module.moduleKey === 'tricycle') ??
      [...enabledModules].sort(moduleSortOrder)[0] ??
      null;

    const preferredDefault =
      enabledDefaults.length === 1 &&
      enabledDefaults[0] &&
      enabledDefaults[0].isEnabled
        ? enabledDefaults[0]
        : fallbackDefault;

    if (
      preferredDefault &&
      (enabledDefaults.length !== 1 ||
        enabledDefaults[0]?.moduleKey !== preferredDefault.moduleKey ||
        modules.some((module) => module.isDefault && module.moduleKey !== preferredDefault.moduleKey))
    ) {
      await prisma.$transaction([
        prisma.tenantTransportModule.updateMany({
          where: { tenantId },
          data: { isDefault: false },
        }),
        prisma.tenantTransportModule.updateMany({
          where: {
            tenantId,
            moduleKey: preferredDefault.moduleKey,
          },
          data: { isDefault: true },
        }),
      ]);

      modules = await loadTenantTransportModules(prisma, tenantId);
    }
  }

  return [...modules].sort(moduleSortOrder);
}

export async function ensureTenantTransportModules(
  prisma: PrismaClient,
  tenant: Pick<Tenant, 'id'>
) {
  return normalizeTenantTransportModules(prisma, tenant.id);
}

export async function getTransportModulesForTenant(prisma: PrismaClient, tenantId: string) {
  const modules = await normalizeTenantTransportModules(prisma, tenantId);
  return modules.map((module) => toModuleSummary(module));
}

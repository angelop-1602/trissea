import type { UserRole } from '@prisma/client';

export const TRANSPORT_MODULE_KEYS = ['tricycle', 'jeepney', 'bus', 'van', 'p2p'] as const;
export type TransportModuleKeyValue = (typeof TRANSPORT_MODULE_KEYS)[number];
export type TransportModuleRole = Exclude<UserRole, 'superadmin'>;

export interface TransportModuleDefinition {
  key: TransportModuleKeyValue;
  label: string;
  summary: string;
  stage: 'live' | 'planned';
  roleRoutes: Record<TransportModuleRole, string>;
}

export interface TenantTransportModuleSummary {
  moduleKey: TransportModuleKeyValue;
  label: string;
  summary: string;
  stage: 'live' | 'planned';
  isEnabled: boolean;
  isDefault: boolean;
  sortOrder: number;
}

export interface TenantTransportModuleRecord {
  moduleKey: TransportModuleKeyValue;
  isEnabled: boolean;
  isDefault: boolean;
  sortOrder: number;
}

const TRANSPORT_MODULE_REGISTRY: Record<TransportModuleKeyValue, TransportModuleDefinition> = {
  tricycle: {
    key: 'tricycle',
    label: 'Tricycle',
    summary: 'Live on-demand rides and TODA reservations for the current platform.',
    stage: 'live',
    roleRoutes: {
      passenger: '/passenger/tricycle',
      driver: '/driver/tricycle',
      admin: '/admin/tricycle',
    },
  },
  jeepney: {
    key: 'jeepney',
    label: 'Jeepney',
    summary: 'Scheduled route and departure booking is being prepared as the next transport module.',
    stage: 'planned',
    roleRoutes: {
      passenger: '/passenger/jeepney',
      driver: '/driver/jeepney',
      admin: '/admin/jeepney',
    },
  },
  bus: {
    key: 'bus',
    label: 'Bus',
    summary: 'City and inter-terminal bus workflows are planned for a future transport module.',
    stage: 'planned',
    roleRoutes: {
      passenger: '/passenger/modules',
      driver: '/driver/modules',
      admin: '/admin/modules',
    },
  },
  van: {
    key: 'van',
    label: 'Van',
    summary: 'Van route and group-trip workflows are planned for a future transport module.',
    stage: 'planned',
    roleRoutes: {
      passenger: '/passenger/modules',
      driver: '/driver/modules',
      admin: '/admin/modules',
    },
  },
  p2p: {
    key: 'p2p',
    label: 'P2P',
    summary: 'Point-to-point shuttle booking, dispatch, and departure workflows are prepared as a separate module.',
    stage: 'planned',
    roleRoutes: {
      passenger: '/passenger/p2p',
      driver: '/driver/p2p',
      admin: '/admin/p2p',
    },
  },
};

export const DEFAULT_TENANT_TRANSPORT_MODULES: Array<{
  moduleKey: TransportModuleKeyValue;
  isEnabled: boolean;
  isDefault: boolean;
  sortOrder: number;
}> = [
  {
    moduleKey: 'tricycle',
    isEnabled: true,
    isDefault: true,
    sortOrder: 0,
  },
  {
    moduleKey: 'jeepney',
    isEnabled: false,
    isDefault: false,
    sortOrder: 1,
  },
  {
    moduleKey: 'bus',
    isEnabled: false,
    isDefault: false,
    sortOrder: 2,
  },
  {
    moduleKey: 'van',
    isEnabled: false,
    isDefault: false,
    sortOrder: 3,
  },
  {
    moduleKey: 'p2p',
    isEnabled: false,
    isDefault: false,
    sortOrder: 4,
  },
];

export function moduleSortOrder(left: TenantTransportModuleRecord, right: TenantTransportModuleRecord) {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }

  return TRANSPORT_MODULE_KEYS.indexOf(left.moduleKey) - TRANSPORT_MODULE_KEYS.indexOf(right.moduleKey);
}

export function toModuleSummary(record: TenantTransportModuleRecord): TenantTransportModuleSummary {
  const definition = TRANSPORT_MODULE_REGISTRY[record.moduleKey];

  return {
    moduleKey: record.moduleKey,
    label: definition.label,
    summary: definition.summary,
    stage: definition.stage,
    isEnabled: record.isEnabled,
    isDefault: record.isDefault,
    sortOrder: record.sortOrder,
  };
}

function buildFallbackTransportModules(): TenantTransportModuleSummary[] {
  return DEFAULT_TENANT_TRANSPORT_MODULES.map((record) => toModuleSummary(record));
}

export function getFallbackTransportModules() {
  return buildFallbackTransportModules();
}

export function getTransportModuleDefinition(moduleKey: TransportModuleKeyValue) {
  return TRANSPORT_MODULE_REGISTRY[moduleKey];
}

export function getEnabledTransportModules(modules: TenantTransportModuleSummary[] | null | undefined) {
  return (modules ?? []).filter((module) => module.isEnabled);
}

export function getDefaultTransportModule(modules: TenantTransportModuleSummary[] | null | undefined) {
  const enabledModules = getEnabledTransportModules(modules);
  return (
    enabledModules.find((module) => module.isDefault) ??
    enabledModules.find((module) => module.moduleKey === 'tricycle') ??
    enabledModules[0] ??
    null
  );
}

export function hasModuleHub(modules: TenantTransportModuleSummary[] | null | undefined) {
  return getEnabledTransportModules(modules).length > 1;
}

export function getModuleLandingRouteForRole(role: TransportModuleRole, moduleKey: TransportModuleKeyValue) {
  return TRANSPORT_MODULE_REGISTRY[moduleKey].roleRoutes[role];
}

export function getModuleHubRouteForRole(role: TransportModuleRole) {
  return `/${role}/modules`;
}

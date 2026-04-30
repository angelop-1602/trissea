import type { Prisma, PrismaClient, Tenant } from '@prisma/client';
import {
  DEFAULT_BRAND_ICON_PATH,
  DEFAULT_BRAND_LOGO_PATH,
  normalizeBrandAssetPath,
  normalizeBrandLogoPath,
} from '@/lib/brand';
import { BOOKING_FARE } from '@/lib/booking/constants';
import {
  DEFAULT_ACCENT_HEX,
  DEFAULT_BACKGROUND_HEX,
  DEFAULT_FOREGROUND_HEX,
  DEFAULT_PRIMARY_HEX,
} from '@/lib/theme/constants';
import { normalizeHexColor, resolveTenantTheme } from '@/lib/theme/tenant-theme';

export type DriversDefaultTab = 'verified' | 'unverified' | 'restricted';
export type WorkflowDefaultTab = 'active' | 'completed' | 'cancelled';
export interface TerminalFareAdjustment {
  terminalId: string;
  amount: number;
}

export interface OnDemandFareSettings {
  baseFare: number;
  perKmFare: number;
  perMinuteFare: number;
  terminalAdjustments: TerminalFareAdjustment[];
}

export interface TenantSettingsShape {
  branding: {
    displayName: string;
    logoUrl: string;
    faviconUrl: string;
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
    foregroundColor: string;
    driverPrimaryColor: string;
    driverAccentColor: string;
    driverBackgroundColor: string;
    driverForegroundColor: string;
  };
  moduleVisibility: {
    reportsVisible: boolean;
    tenantTeamVisible: boolean;
    dashboardWidgets: {
      liveTripQueue: boolean;
      queueWatch: boolean;
      onlineDrivers: boolean;
      operationalSummary: boolean;
    };
    settingsSections: {
      branding: boolean;
      operations: boolean;
      reporting: boolean;
      ui: boolean;
    };
  };
  operationsPreferences: {
    driversDefaultTab: DriversDefaultTab;
    reservationsDefaultTab: WorkflowDefaultTab;
    tripsDefaultTab: WorkflowDefaultTab;
    onDemandFare: OnDemandFareSettings;
  };
  reportingPreferences: {
    showCompletionRate: boolean;
    showDriverActivity: boolean;
    showTerminalOccupancy: boolean;
  };
  uiPreferences: {
    denseTables: boolean;
    showKpiStrip: boolean;
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function asString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function asCurrency(
  value: unknown,
  fallback: number,
  constraints: {
    min: number;
    max: number;
  }
) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return roundCurrency(Math.min(constraints.max, Math.max(constraints.min, value)));
}

function asDriversDefaultTab(value: unknown): DriversDefaultTab {
  return value === 'unverified' || value === 'restricted' ? value : 'verified';
}

function asWorkflowDefaultTab(value: unknown): WorkflowDefaultTab {
  return value === 'completed' || value === 'cancelled' ? value : 'active';
}

function asTerminalFareAdjustments(value: unknown, fallback: TerminalFareAdjustment[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const seen = new Set<string>();
  const normalized: TerminalFareAdjustment[] = [];

  for (const item of value) {
    const record = asRecord(item);
    const terminalId = typeof record.terminalId === 'string' ? record.terminalId.trim() : '';
    if (!terminalId || seen.has(terminalId)) {
      continue;
    }

    seen.add(terminalId);

    const amount = asCurrency(record.amount, 0, { min: -100, max: 150 });
    if (amount === 0) {
      continue;
    }

    normalized.push({
      terminalId,
      amount,
    });
  }

  return normalized;
}

type TenantBrandingFields = Pick<
  Tenant,
  | 'id'
  | 'name'
  | 'logoUrl'
  | 'logo'
  | 'faviconUrl'
  | 'primaryColor'
  | 'accentColor'
  | 'backgroundColor'
  | 'foregroundColor'
  | 'driverPrimaryColor'
  | 'driverAccentColor'
  | 'driverBackgroundColor'
  | 'driverForegroundColor'
>;

export function buildDefaultTenantSettings(tenant?: TenantBrandingFields | null): TenantSettingsShape {
  const resolvedTheme = resolveTenantTheme(tenant);

  return {
    branding: {
      displayName: tenant?.name ?? 'Tenant Workspace',
      logoUrl: normalizeBrandLogoPath(tenant?.logoUrl ?? tenant?.logo ?? DEFAULT_BRAND_LOGO_PATH),
      faviconUrl: normalizeBrandAssetPath(tenant?.faviconUrl, DEFAULT_BRAND_ICON_PATH),
      primaryColor: resolvedTheme.tenant.primary,
      accentColor: resolvedTheme.tenant.accent,
      backgroundColor: resolvedTheme.tenant.background,
      foregroundColor: resolvedTheme.tenant.foreground,
      driverPrimaryColor: resolvedTheme.driver.primary,
      driverAccentColor: resolvedTheme.driver.accent,
      driverBackgroundColor: resolvedTheme.driver.background,
      driverForegroundColor: resolvedTheme.driver.foreground,
    },
    moduleVisibility: {
      reportsVisible: true,
      tenantTeamVisible: true,
      dashboardWidgets: {
        liveTripQueue: true,
        queueWatch: true,
        onlineDrivers: true,
        operationalSummary: true,
      },
      settingsSections: {
        branding: true,
        operations: true,
        reporting: true,
        ui: true,
      },
    },
    operationsPreferences: {
      driversDefaultTab: 'verified',
      reservationsDefaultTab: 'active',
      tripsDefaultTab: 'active',
      onDemandFare: {
        baseFare: BOOKING_FARE.BASE_FARE,
        perKmFare: BOOKING_FARE.PER_KM,
        perMinuteFare: BOOKING_FARE.PER_MINUTE,
        terminalAdjustments: [],
      },
    },
    reportingPreferences: {
      showCompletionRate: true,
      showDriverActivity: true,
      showTerminalOccupancy: true,
    },
    uiPreferences: {
      denseTables: false,
      showKpiStrip: true,
    },
  };
}

export function normalizeTenantSettings(
  input: {
    branding?: unknown;
    moduleVisibility?: unknown;
    operationsPreferences?: unknown;
    reportingPreferences?: unknown;
    uiPreferences?: unknown;
  } | null | undefined,
  tenant?: TenantBrandingFields | null
): TenantSettingsShape {
  const defaults = buildDefaultTenantSettings(tenant);
  const branding = asRecord(input?.branding);
  const moduleVisibility = asRecord(input?.moduleVisibility);
  const dashboardWidgets = asRecord(moduleVisibility.dashboardWidgets);
  const settingsSections = asRecord(moduleVisibility.settingsSections);
  const operationsPreferences = asRecord(input?.operationsPreferences);
  const onDemandFare = asRecord(operationsPreferences.onDemandFare);
  const reportingPreferences = asRecord(input?.reportingPreferences);
  const uiPreferences = asRecord(input?.uiPreferences);

  return {
    branding: {
      displayName: asString(branding.displayName, defaults.branding.displayName),
      logoUrl: normalizeBrandLogoPath(asString(branding.logoUrl, defaults.branding.logoUrl)),
      faviconUrl: normalizeBrandAssetPath(
        asString(branding.faviconUrl, defaults.branding.faviconUrl),
        DEFAULT_BRAND_ICON_PATH
      ),
      primaryColor: normalizeHexColor(asString(branding.primaryColor, defaults.branding.primaryColor), DEFAULT_PRIMARY_HEX) ?? DEFAULT_PRIMARY_HEX,
      accentColor: normalizeHexColor(asString(branding.accentColor, defaults.branding.accentColor), DEFAULT_ACCENT_HEX) ?? DEFAULT_ACCENT_HEX,
      backgroundColor:
        normalizeHexColor(asString(branding.backgroundColor, defaults.branding.backgroundColor), DEFAULT_BACKGROUND_HEX) ??
        DEFAULT_BACKGROUND_HEX,
      foregroundColor:
        normalizeHexColor(asString(branding.foregroundColor, defaults.branding.foregroundColor), DEFAULT_FOREGROUND_HEX) ??
        DEFAULT_FOREGROUND_HEX,
      driverPrimaryColor:
        normalizeHexColor(asString(branding.driverPrimaryColor, defaults.branding.driverPrimaryColor), defaults.branding.driverPrimaryColor) ??
        defaults.branding.driverPrimaryColor,
      driverAccentColor:
        normalizeHexColor(asString(branding.driverAccentColor, defaults.branding.driverAccentColor), defaults.branding.driverAccentColor) ??
        defaults.branding.driverAccentColor,
      driverBackgroundColor:
        normalizeHexColor(
          asString(branding.driverBackgroundColor, defaults.branding.driverBackgroundColor),
          defaults.branding.driverBackgroundColor
        ) ?? defaults.branding.driverBackgroundColor,
      driverForegroundColor:
        normalizeHexColor(
          asString(branding.driverForegroundColor, defaults.branding.driverForegroundColor),
          defaults.branding.driverForegroundColor
        ) ?? defaults.branding.driverForegroundColor,
    },
    moduleVisibility: {
      reportsVisible: asBoolean(moduleVisibility.reportsVisible, defaults.moduleVisibility.reportsVisible),
      tenantTeamVisible: asBoolean(moduleVisibility.tenantTeamVisible, defaults.moduleVisibility.tenantTeamVisible),
      dashboardWidgets: {
        liveTripQueue: asBoolean(dashboardWidgets.liveTripQueue, defaults.moduleVisibility.dashboardWidgets.liveTripQueue),
        queueWatch: asBoolean(dashboardWidgets.queueWatch, defaults.moduleVisibility.dashboardWidgets.queueWatch),
        onlineDrivers: asBoolean(dashboardWidgets.onlineDrivers, defaults.moduleVisibility.dashboardWidgets.onlineDrivers),
        operationalSummary: asBoolean(
          dashboardWidgets.operationalSummary,
          defaults.moduleVisibility.dashboardWidgets.operationalSummary
        ),
      },
      settingsSections: {
        branding: asBoolean(settingsSections.branding, defaults.moduleVisibility.settingsSections.branding),
        operations: asBoolean(settingsSections.operations, defaults.moduleVisibility.settingsSections.operations),
        reporting: asBoolean(settingsSections.reporting, defaults.moduleVisibility.settingsSections.reporting),
        ui: asBoolean(settingsSections.ui, defaults.moduleVisibility.settingsSections.ui),
      },
    },
    operationsPreferences: {
      driversDefaultTab: asDriversDefaultTab(operationsPreferences.driversDefaultTab),
      reservationsDefaultTab: asWorkflowDefaultTab(operationsPreferences.reservationsDefaultTab),
      tripsDefaultTab: asWorkflowDefaultTab(operationsPreferences.tripsDefaultTab),
      onDemandFare: {
        baseFare: asCurrency(onDemandFare.baseFare, defaults.operationsPreferences.onDemandFare.baseFare, {
          min: 20,
          max: 200,
        }),
        perKmFare: asCurrency(onDemandFare.perKmFare, defaults.operationsPreferences.onDemandFare.perKmFare, {
          min: 0,
          max: 50,
        }),
        perMinuteFare: asCurrency(
          onDemandFare.perMinuteFare,
          defaults.operationsPreferences.onDemandFare.perMinuteFare,
          {
            min: 0,
            max: 20,
          }
        ),
        terminalAdjustments: asTerminalFareAdjustments(
          onDemandFare.terminalAdjustments,
          defaults.operationsPreferences.onDemandFare.terminalAdjustments
        ),
      },
    },
    reportingPreferences: {
      showCompletionRate: asBoolean(reportingPreferences.showCompletionRate, defaults.reportingPreferences.showCompletionRate),
      showDriverActivity: asBoolean(reportingPreferences.showDriverActivity, defaults.reportingPreferences.showDriverActivity),
      showTerminalOccupancy: asBoolean(
        reportingPreferences.showTerminalOccupancy,
        defaults.reportingPreferences.showTerminalOccupancy
      ),
    },
    uiPreferences: {
      denseTables: asBoolean(uiPreferences.denseTables, defaults.uiPreferences.denseTables),
      showKpiStrip: asBoolean(uiPreferences.showKpiStrip, defaults.uiPreferences.showKpiStrip),
    },
  };
}

export async function ensureTenantSettings(prisma: PrismaClient, tenant: Tenant) {
  const existing = await prisma.tenantSettings.findUnique({
    where: { tenantId: tenant.id },
  });

  if (existing) {
    return existing;
  }

  const normalized = normalizeTenantSettings(undefined, tenant);

  return prisma.tenantSettings.create({
    data: {
      id: `tenant-settings-${tenant.id}`,
      tenantId: tenant.id,
      branding: normalized.branding as Prisma.InputJsonValue,
      moduleVisibility: normalized.moduleVisibility as Prisma.InputJsonValue,
      operationsPreferences: normalized.operationsPreferences as unknown as Prisma.InputJsonValue,
      reportingPreferences: normalized.reportingPreferences as Prisma.InputJsonValue,
      uiPreferences: normalized.uiPreferences as Prisma.InputJsonValue,
    },
  });
}

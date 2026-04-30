'use client';

import React, { createContext, useContext, useMemo, useState, ReactNode } from 'react';
import type { Ride, RideStatus, Tenant, User } from '@prisma/client';
import { normalizeBrandLogoPath } from '@/lib/brand';
import { DEFAULT_ACCENT_HEX, DEFAULT_PRIMARY_HEX } from '@/lib/theme/constants';
import type { TenantThemeInput } from '@/lib/theme/tenant-theme';
import type { TenantSettingsShape } from '@/lib/dashboard/client';
import type { TenantTransportModuleSummary } from '@/lib/transport-modules';

interface StoreContextType {
  currentUser: User | null;
  currentTenant: Tenant | null;
  currentTenantSettings: TenantSettingsShape | null;
  currentTenantPermissions: string[];
  currentTenantModules: TenantTransportModuleSummary[];
  setCurrentUser: (user: User | null) => void;
  setCurrentTenant: (tenant: Tenant | null) => void;
  setCurrentTenantSettings: (settings: TenantSettingsShape | null) => void;
  setCurrentTenantPermissions: (permissions: string[]) => void;
  setCurrentTenantModules: (modules: TenantTransportModuleSummary[]) => void;
  resetSessionState: () => void;
  rides: Ride[];
  updateRideStatus: (rideId: string, status: RideStatus) => void;
  getTenantBranding: () => (TenantThemeInput & {
    logo?: string;
    faviconUrl?: string;
    displayName?: string;
  });
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [currentTenantSettings, setCurrentTenantSettings] = useState<TenantSettingsShape | null>(null);
  const [currentTenantPermissions, setCurrentTenantPermissions] = useState<string[]>([]);
  const [currentTenantModules, setCurrentTenantModules] = useState<TenantTransportModuleSummary[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);

  const updateRideStatus = (rideId: string, status: RideStatus) => {
    setRides((prevRides) => prevRides.map((ride) => (ride.id === rideId ? { ...ride, status } : ride)));
  };

  const getTenantBranding = () => {
    if (currentTenantSettings?.branding) {
      return {
        displayName: currentTenantSettings.branding.displayName,
        logo: normalizeBrandLogoPath(currentTenantSettings.branding.logoUrl),
        faviconUrl: currentTenantSettings.branding.faviconUrl,
        primaryColor: currentTenantSettings.branding.primaryColor,
        accentColor: currentTenantSettings.branding.accentColor,
        backgroundColor: currentTenantSettings.branding.backgroundColor,
        foregroundColor: currentTenantSettings.branding.foregroundColor,
        driverPrimaryColor: currentTenantSettings.branding.driverPrimaryColor,
        driverAccentColor: currentTenantSettings.branding.driverAccentColor,
        driverBackgroundColor: currentTenantSettings.branding.driverBackgroundColor,
        driverForegroundColor: currentTenantSettings.branding.driverForegroundColor,
      };
    }

    if (currentTenant?.logo || currentTenant?.primaryColor || currentTenant?.accentColor || currentTenant?.name) {
      return {
        displayName: currentTenant.name,
        logo: normalizeBrandLogoPath(currentTenant.logo ?? currentTenant.logoUrl ?? undefined),
        faviconUrl: currentTenant.faviconUrl ?? undefined,
        primaryColor: currentTenant.primaryColor ?? undefined,
        accentColor: currentTenant.accentColor ?? undefined,
        backgroundColor: currentTenant.backgroundColor ?? undefined,
        foregroundColor: currentTenant.foregroundColor ?? undefined,
        driverPrimaryColor: currentTenant.driverPrimaryColor ?? undefined,
        driverAccentColor: currentTenant.driverAccentColor ?? undefined,
        driverBackgroundColor: currentTenant.driverBackgroundColor ?? undefined,
        driverForegroundColor: currentTenant.driverForegroundColor ?? undefined,
      };
    }

    return {
      displayName: currentTenant?.name ?? undefined,
      logo: undefined,
      primaryColor: DEFAULT_PRIMARY_HEX,
      accentColor: DEFAULT_ACCENT_HEX,
    };
  };

  const resetSessionState = () => {
    setCurrentUser(null);
    setCurrentTenant(null);
    setCurrentTenantSettings(null);
    setCurrentTenantPermissions([]);
    setCurrentTenantModules([]);
  };

  const value = useMemo(
    () => ({
      currentUser,
      currentTenant,
      currentTenantSettings,
      currentTenantPermissions,
      currentTenantModules,
      setCurrentUser,
      setCurrentTenant,
      setCurrentTenantSettings,
      setCurrentTenantPermissions,
      setCurrentTenantModules,
      resetSessionState,
      rides,
      updateRideStatus,
      getTenantBranding,
    }),
    [currentTenant, currentTenantModules, currentTenantPermissions, currentTenantSettings, currentUser, rides]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within StoreProvider');
  }
  return context;
}

import type { Reservation, Ride, RideFeedback, TODATerminal, Tenant } from '@prisma/client';
import type { TenantSettingsShape as SharedTenantSettingsShape } from '@/lib/tenant-settings';

function createRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `req-${Date.now().toString(36)}`;
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const requestId = createRequestId();
  const response = await fetch(input, {
    cache: 'no-store',
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-request-id': requestId,
      ...(init?.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorPayload = payload as {
      error?: string;
      code?: string;
      requestId?: string;
    };
    const responseRequestId = response.headers.get('x-request-id')?.trim();
    const supportRequestId = errorPayload.requestId ?? responseRequestId ?? requestId;

    const detailParts = [
      errorPayload.code ? `code=${errorPayload.code}` : null,
      supportRequestId ? `requestId=${supportRequestId}` : null,
    ].filter(Boolean);

    const detail = detailParts.length > 0 ? ` (${detailParts.join(', ')})` : '';
    throw new Error(`${errorPayload.error ?? 'Request failed.'}${detail}`);
  }

  if (payload && typeof payload === 'object' && 'data' in (payload as Record<string, unknown>)) {
    return (payload as { data: T }).data;
  }

  return payload as T;
}

export type ReservationWithTerminal = Reservation & { TODATerminal: TODATerminal };

export type RideFeedbackSummary = Pick<
  RideFeedback,
  'id' | 'reviewerUserId' | 'subjectUserId' | 'rating' | 'note' | 'createdAt' | 'updatedAt'
>;

export type PassengerHistoryRide = Ride & {
  driver: {
    id: string;
    name: string;
    rating: number | null;
  } | null;
  viewerFeedback: RideFeedbackSummary | null;
};

export type DriverHistoryRide = Ride & {
  passenger: {
    id: string;
    name: string;
    rating: number | null;
  };
  viewerFeedback: RideFeedbackSummary | null;
};

export interface PassengerHomeData {
  profile: {
    id: string;
    name: string;
    balance: number;
    rating: number;
    completedRides: number;
  };
  activeRide: Ride | null;
  recentRides: Ride[];
  activeReservations: ReservationWithTerminal[];
}

export interface PassengerHistoryData {
  rides: PassengerHistoryRide[];
  stats: {
    totalRides: number;
    totalSpent: number;
    averageRating: number;
  };
}

export interface DriverSummaryData {
  profile: {
    id: string;
    name: string;
    rating: number;
  };
  presence: {
    isOnline: boolean;
    lastHeartbeatAt: string | Date | null;
  };
  terminalContext: {
    id: string;
    name: string;
    location: string;
    capacity: number;
    currentQueued: number;
  } | null;
  activeRide: Ride | null;
  stats: {
    assignedCount: number;
    ridesCompletedToday: number;
    ridesCompletedTotal: number;
    totalEarnings: number;
    totalEarningsToday: number;
    acceptanceRate: number;
  };
}

export interface DriverHistoryData {
  rides: DriverHistoryRide[];
  stats: {
    totalRides: number;
    completedRides: number;
    cancelledRides: number;
    totalEarnings: number;
  };
}


export interface DriverEarningsData {
  completedRides: Ride[];
  stats: {
    totalEarnings: number;
    averageRideEarnings: number;
    completedRides: number;
  };
}

export interface AdminOverviewData {
  terminals: TODATerminal[];
  rides: Ride[];
  activeRides: Ride[];
  drivers: Array<{
    id: string;
    name: string;
    rating: number | null;
    completedRides: number;
    isOnline: boolean;
  }>;
  stats: {
    totalTerminals: number;
    activeDrivers: number;
    todayRides: number;
    totalRevenue: number;
  };
}

export interface AdminDriversData {
  drivers: Array<{
    id: string;
    driverProfileId: string;
    name: string;
    email: string | null;
    phone: string | null;
    todaName: string | null;
    verificationStatus: 'pending' | 'verified';
    restrictionStatus: 'unrestricted' | 'restricted';
    operationalState: 'pending_review' | 'offline' | 'online' | 'restricted';
    isDriverVerified: boolean;
    isDriverRestricted: boolean;
    rating: number | null;
    completedRides: number | null;
    createdAt: string | Date;
    DriverPresence: {
      isOnline: boolean;
      onlineSinceAt: string | Date | null;
      lastHeartbeatAt: string | Date | null;
    } | null;
  }>;
  stats: {
    totalDrivers: number;
    activeToday: number;
    averageRating: number;
    verifiedDrivers: number;
    pendingVerification: number;
    restrictedDrivers: number;
  };
}

export interface AdminDriverProfileData {
  driver: {
    id: string;
    driverProfileId: string;
    name: string;
    email: string | null;
    phone: string | null;
    avatar: string | null;
    createdAt: string | Date;
    rating: number | null;
    completedRides: number | null;
    toda: {
      id: string;
      name: string;
      location: string;
    } | null;
    verificationStatus: 'pending' | 'verified';
    restrictionStatus: 'unrestricted' | 'restricted';
    legalFullName: string | null;
    dateOfBirth: string | Date | null;
    homeAddress: string | null;
    todaMembershipId: string | null;
    licenseNumber: string | null;
    licenseExpiry: string | Date | null;
    vehicleType: string | null;
    plateNumber: string | null;
    vehicleModel: string | null;
    vehicleColor: string | null;
    isDriverVerified: boolean;
    isDriverRestricted: boolean;
    driverRestrictionReason: string | null;
    driverRestrictedAt: string | Date | null;
  };
  presence: {
    isOnline: boolean;
    onlineSinceAt: string | Date | null;
    lastHeartbeatAt: string | Date | null;
  };
  activeRide: (Ride & {
    passenger: {
      id: string;
      name: string;
      phone: string | null;
    };
    terminal: {
      id: string;
      name: string;
      location: string;
    } | null;
  }) | null;
  recentRides: Array<
    Ride & {
      passenger: {
        id: string;
        name: string;
        phone: string | null;
      };
      terminal: {
        id: string;
        name: string;
        location: string;
      } | null;
    }
  >;
  stats: {
    totalTrips: number;
    completedTrips: number;
    cancelledTrips: number;
    activeTrips: number;
    totalEarnings: number;
    averageCompletedFare: number;
    completionRate: number;
  };
  documents: Array<{
    id: string;
    documentType: string;
    fileUrl: string | null;
    storageRef: string | null;
    reviewStatus: string;
    metadata: unknown;
    submittedAt: string | Date;
    reviewedAt: string | Date | null;
    reviewedBy: {
      id: string;
      name: string;
    } | null;
    remarks: string | null;
  }>;
}

export interface AdminRidesData {
  rides: Ride[];
  stats: {
    totalRides: number;
    completedRides: number;
    totalFares: number;
  };
}

export interface AdminTenantAuditData {
  logs: Array<{
    id: string;
    module: string;
    action: string;
    targetType: string;
    targetId: string | null;
    beforeJson: unknown;
    afterJson: unknown;
    createdAt: string | Date;
    actor: {
      id: string;
      name: string;
      email: string | null;
    } | null;
  }>;
}

export interface AdminTerminalsData {
  terminals: TODATerminal[];
  stats: {
    totalTerminals: number;
    totalCapacity: number;
    currentlyQueued: number;
  };
}

export interface AdminTerminalDetailsData {
  terminal: TODATerminal;
  stats: {
    currentQueued: number;
    capacity: number;
    occupancyPercent: number;
    activeOnDemandQueued: number;
    activeOnDemandInProgress: number;
    activeOnDemandTotal: number;
    activeReservationsTotal: number;
    today: {
      requests: number;
      completed: number;
      cancelled: number;
      reservations: number;
      revenue: number;
    };
    totals30d: {
      requests: number;
      completed: number;
      cancelled: number;
      reservations: number;
      revenue: number;
      completionRate: number;
      cancellationRate: number;
      averageFare: number;
    };
  };
  activeRides: Array<
    Ride & {
      passenger: {
        id: string;
        name: string;
        phone: string | null;
      };
      driver: {
        id: string;
        name: string;
        phone: string | null;
      } | null;
    }
  >;
  activeReservations: Array<
    Reservation & {
      passenger: {
        id: string;
        name: string;
        phone: string | null;
      };
    }
  >;
  analytics: Array<{
    date: string;
    requests: number;
    completed: number;
    cancelled: number;
    reservations: number;
    revenue: number;
  }>;
}

export interface AdminReportsData {
  stats: {
    totalRides: number;
    completedRides: number;
    totalFares: number;
    commission: number;
    completionRate: number;
    driverActivity: number;
    terminalOccupancy: number;
    todayRides: number;
  };
}

export interface AdminReservationsData {
  reservations: Array<{
    id: string;
    status: string;
    queuePosition: number;
    boardingTime: string | Date;
    createdAt: string | Date;
    User: {
      id: string;
      name: string;
      phone: string;
    };
    TODATerminal: {
      id: string;
      name: string;
      location: string;
    };
  }>;
  stats: {
    totalReservations: number;
    activeReservations: number;
  };
}

export interface AdminUsersData {
  users: Array<{
    id: string;
    name: string;
    phone: string;
    role: 'passenger' | 'driver' | 'admin' | 'superadmin';
    createdAt: string | Date;
  }>;
  stats: {
    totalUsers: number;
    roleCounts: {
      passenger: number;
      driver: number;
      admin: number;
      superadmin: number;
    };
  };
}

export interface AdminTenantRoleOption {
  id: string;
  key: string;
  name: string;
  description: string | null;
}

export interface AdminTenantTeamData {
  members: Array<{
    id: string;
    userId: string;
    name: string;
    email: string | null;
    tenantRoleKey: string;
    tenantRoleName: string;
    isActive: boolean;
    invitedByName: string | null;
    createdAt: string | Date;
    deactivatedAt: string | Date | null;
  }>;
  roles: AdminTenantRoleOption[];
  currentUserPermissions: string[];
}

export type TenantSettingsShape = SharedTenantSettingsShape;

type TenantBrandingPick = Pick<
  Tenant,
  | 'id'
  | 'name'
  | 'logo'
  | 'logoUrl'
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

export interface AdminTenantSettingsData {
  settings: TenantSettingsShape;
  currentUserPermissions: string[];
  tenant: TenantBrandingPick;
}

export interface SuperadminOverviewData {
  stats: {
    totalCoverageProvinces: number;
    totalTenants: number;
    totalUsers: number;
    totalRides: number;
  };
  platformMapPoints: Array<{
    id: string;
    label: string;
    description: string;
    latitude: number;
    longitude: number;
    tone: 'terminal' | 'driver' | 'ride';
  }>;
}

export interface SuperadminTenantRow {
  id: string;
  name: string;
  lguCode: string;
  lguName: string;
  lguType: 'province' | 'city' | 'municipality';
  psgcCode: string;
  provinceCode: string | null;
  provinceName: string | null;
  regionCode: string | null;
  regionName: string | null;
  users: number;
  passengers: number;
  drivers: number;
  admins: number;
  rides: number;
  reservations: number;
  terminals: number;
  revenue: number;
  status: 'active' | 'suspended';
  suspendedAt: string | Date | null;
  suspensionReason: string | null;
}

export interface SuperadminTenantsData {
  tenants: SuperadminTenantRow[];
  regions: Array<{
    code: string;
    name: string;
  }>;
}

export interface SuperadminTenantDetailData {
  tenant: Pick<
    Tenant,
    | 'id'
    | 'name'
    | 'lguCode'
    | 'lguName'
    | 'lguType'
    | 'provinceName'
    | 'regionName'
    | 'status'
    | 'suspendedAt'
    | 'suspensionReason'
    | 'logo'
    | 'logoUrl'
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
  stats: {
    passengers: number;
    drivers: number;
    admins: number;
    activeTeamMembers: number;
    terminals: number;
    totalRides: number;
    activeRides: number;
    totalReservations: number;
    activeReservations: number;
    completedRevenue: number;
    supportAccessCount: number;
  };
  recentRides: Array<
    Ride & {
      passenger: {
        id: string;
        name: string;
        phone: string | null;
      };
      driver: {
        id: string;
        name: string;
        phone: string | null;
      } | null;
      terminal: {
        id: string;
        name: string;
        location: string;
      } | null;
    }
  >;
  recentReservations: Array<
    Reservation & {
      passenger: {
        id: string;
        name: string;
        phone: string | null;
      };
      terminal: {
        id: string;
        name: string;
        location: string;
      };
    }
  >;
  roleCounts: {
    passenger: number;
    driver: number;
    admin: number;
    superadmin: number;
  };
}

export interface SuperadminReportsData {
  stats: {
    totalRides: number;
    totalRevenue: number;
    totalCommission: number;
    averagePerRide: number;
  };
  tenantPerformance: Array<{
    id: string;
    name: string;
    rides: number;
    revenue: number;
  }>;
}

export interface SuperadminSupportAccessData {
  logs: Array<{
    id: string;
    accessType: string;
    reason: string;
    createdAt: string | Date;
    tenant: {
      id: string;
      name: string;
      lguName: string;
    };
    superAdmin: {
      id: string;
      name: string;
      email: string | null;
    };
  }>;
  tenants: Array<{
    id: string;
    name: string;
    lguName: string;
  }>;
}

export interface SuperadminTenantSettingsData {
  settings: TenantSettingsShape;
  tenant: TenantBrandingPick;
}

export interface SuperadminTenantRidesData {
  rides: Array<
    Ride & {
      passenger: {
        id: string;
        name: string;
        phone: string | null;
      };
      driver: {
        id: string;
        name: string;
        phone: string | null;
      } | null;
      terminal: {
        id: string;
        name: string;
        location: string;
      } | null;
    }
  >;
  stats: {
    totalRides: number;
    completedRides: number;
    totalFares: number;
  };
}

export interface SuperadminTenantReservationsData {
  reservations: Array<
    Reservation & {
      passenger: {
        id: string;
        name: string;
        phone: string | null;
      };
      terminal: {
        id: string;
        name: string;
        location: string;
      };
    }
  >;
  stats: {
    totalReservations: number;
    activeReservations: number;
  };
}

export interface SuperadminPassengerDirectoryData {
  passengers: Array<{
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    createdAt: string | Date;
    rating: number | null;
    completedRides: number;
    activeRideCount: number;
    activeReservationCount: number;
    lastRideAt: string | Date | null;
    tenant: {
      id: string;
      name: string;
      status: 'active' | 'suspended';
    } | null;
  }>;
  stats: {
    totalPassengers: number;
    activePassengers: number;
    filteredPassengers: number;
  };
  tenants: Array<{
    id: string;
    name: string;
    status: 'active' | 'suspended';
  }>;
}

export interface SuperadminPassengerProfileData {
  passenger: {
    id: string;
    name: string;
    phone: string | null;
    phoneE164: string | null;
    email: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    termsAcceptedAt: string | Date | null;
    createdAt: string | Date;
    rating: number | null;
    completedRides: number;
    balance: number;
    tenant: {
      id: string;
      name: string;
      status: 'active' | 'suspended';
      lguName: string;
    } | null;
  };
  activeRide: (Ride & {
    driver: {
      id: string;
      name: string;
      phone: string | null;
    } | null;
    terminal: {
      id: string;
      name: string;
      location: string;
    } | null;
  }) | null;
  activeReservations: Array<
    Reservation & {
      terminal: {
        id: string;
        name: string;
        location: string;
      };
    }
  >;
  rides: Array<
    Ride & {
      driver: {
        id: string;
        name: string;
        phone: string | null;
      } | null;
      terminal: {
        id: string;
        name: string;
        location: string;
      } | null;
    }
  >;
  reservations: Array<
    Reservation & {
      terminal: {
        id: string;
        name: string;
        location: string;
      };
    }
  >;
  stats: {
    totalRides: number;
    completedRides: number;
    cancelledRides: number;
    totalReservations: number;
    totalSpent: number;
  };
}

export interface SuperadminPlatformAuditData {
  logs: Array<{
    id: string;
    module: string;
    action: string;
    targetType: string;
    targetId: string | null;
    reason: string;
    beforeJson: unknown;
    afterJson: unknown;
    createdAt: string | Date;
    actor: {
      id: string;
      name: string;
      email: string | null;
    };
    tenant: {
      id: string;
      name: string;
      lguName: string;
    } | null;
  }>;
  tenants: Array<{
    id: string;
    name: string;
    lguName: string;
  }>;
}

export function getPassengerHomeData() {
  return requestJson<PassengerHomeData>('/api/dashboard/passenger/home');
}

export function getPassengerHistoryData() {
  return requestJson<PassengerHistoryData>('/api/dashboard/passenger/history');
}

export function getDriverSummaryData() {
  return requestJson<DriverSummaryData>('/api/dashboard/driver/summary');
}

export function getDriverHistoryData() {
  return requestJson<DriverHistoryData>('/api/dashboard/driver/history');
}

export function getDriverEarningsData() {
  return requestJson<DriverEarningsData>('/api/dashboard/driver/earnings');
}

export function getAdminOverviewData() {
  return requestJson<AdminOverviewData>('/api/dashboard/admin/overview');
}

export function getAdminDriversData() {
  return requestJson<AdminDriversData>('/api/dashboard/admin/drivers');
}

export function getAdminDriverProfile(driverId: string) {
  return requestJson<AdminDriverProfileData>(`/api/dashboard/admin/drivers/${encodeURIComponent(driverId)}`);
}

export function updateAdminDriverVerification(driverId: string, input: { isDriverVerified: boolean }) {
  return requestJson<{
    driver: {
      id: string;
      isDriverVerified: boolean;
    };
  }>(`/api/dashboard/admin/drivers/${encodeURIComponent(driverId)}/verification`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function updateAdminDriverRestriction(
  driverId: string,
  input: { isDriverRestricted: boolean; reason?: string }
) {
  return requestJson<{
    driver: {
      id: string;
      isDriverRestricted: boolean;
      driverRestrictionReason: string | null;
      driverRestrictedAt: string | Date | null;
    };
  }>(`/api/dashboard/admin/drivers/${encodeURIComponent(driverId)}/restriction`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function getAdminRidesData() {
  return requestJson<AdminRidesData>('/api/dashboard/admin/rides');
}

export function getAdminTerminalsData() {
  return requestJson<AdminTerminalsData>('/api/dashboard/admin/terminals');
}

export function getAdminTerminalDetails(terminalId: string) {
  return requestJson<AdminTerminalDetailsData>(`/api/dashboard/admin/terminals/${encodeURIComponent(terminalId)}`);
}

export function createAdminTerminal(input: {
  name: string;
  location: string;
  latitude: number;
  longitude: number;
}) {
  return requestJson<{ terminal: TODATerminal }>('/api/dashboard/admin/terminals', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateAdminTerminal(
  terminalId: string,
  input: {
    name?: string;
    location?: string;
    capacity?: number;
    latitude?: number;
    longitude?: number;
  }
) {
  return requestJson<{ terminal: TODATerminal }>(`/api/dashboard/admin/terminals/${encodeURIComponent(terminalId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function getAdminReportsData() {
  return requestJson<AdminReportsData>('/api/dashboard/admin/reports');
}

export function getAdminReservationsData() {
  return requestJson<AdminReservationsData>('/api/dashboard/admin/reservations');
}

export function getAdminUsersData() {
  return requestJson<AdminUsersData>('/api/dashboard/admin/users');
}

export function getAdminTenantTeamData() {
  return requestJson<AdminTenantTeamData>('/api/dashboard/admin/team');
}

export function inviteAdminTenantTeamMember(input: { name: string; email: string; tenantRoleKey: string }) {
  return requestJson<{
    member: AdminTenantTeamData['members'][number];
    temporaryPassword: string;
  }>('/api/dashboard/admin/team', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateAdminTenantTeamMember(
  membershipId: string,
  input: { tenantRoleKey?: string; isActive?: boolean }
) {
  return requestJson<{
    member: AdminTenantTeamData['members'][number];
  }>(`/api/dashboard/admin/team/${encodeURIComponent(membershipId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function getAdminTenantSettingsData() {
  return requestJson<AdminTenantSettingsData>('/api/dashboard/admin/settings');
}

export function getAdminTenantAuditLogs(params?: {
  module?: string;
  action?: string;
  from?: string;
  to?: string;
}) {
  const search = new URLSearchParams();
  if (params?.module) search.set('module', params.module);
  if (params?.action) search.set('action', params.action);
  if (params?.from) search.set('from', params.from);
  if (params?.to) search.set('to', params.to);

  const query = search.toString();
  return requestJson<AdminTenantAuditData>(`/api/dashboard/admin/audit${query ? `?${query}` : ''}`);
}

export function updateAdminTenantSettings(input: TenantSettingsShape) {
  return requestJson<AdminTenantSettingsData>('/api/dashboard/admin/settings', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function getSuperadminOverviewData() {
  return requestJson<SuperadminOverviewData>('/api/dashboard/superadmin/overview');
}

export function getSuperadminTenantsData(params?: {
  query?: string;
  regionCode?: string;
  status?: 'all' | 'active' | 'suspended';
}) {
  const search = new URLSearchParams();
  if (params?.query) search.set('query', params.query);
  if (params?.regionCode) search.set('regionCode', params.regionCode);
  if (params?.status) search.set('status', params.status);

  const query = search.toString();
  return requestJson<SuperadminTenantsData>(`/api/dashboard/superadmin/tenants${query ? `?${query}` : ''}`);
}

export function createSuperadminTenant(input: { lguCode: string; reason: string }) {
  return requestJson<{
    tenant: Tenant;
    tenantAdmin: {
      id: string;
      name: string;
      email: string | null;
    };
    credentials: {
      email: string;
      temporaryPassword: string;
    };
  }>('/api/dashboard/superadmin/tenants', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getSuperadminTenantDetail(tenantId: string) {
  return requestJson<SuperadminTenantDetailData>(
    `/api/dashboard/superadmin/tenants/${encodeURIComponent(tenantId)}`
  );
}

export function updateSuperadminTenant(
  tenantId: string,
  input: {
    reason: string;
    status?: 'active' | 'suspended';
    suspensionReason?: string | null;
    logoUrl?: string | null;
    faviconUrl?: string | null;
    primaryColor?: string | null;
    accentColor?: string | null;
    backgroundColor?: string | null;
    foregroundColor?: string | null;
    driverPrimaryColor?: string | null;
    driverAccentColor?: string | null;
    driverBackgroundColor?: string | null;
    driverForegroundColor?: string | null;
  }
) {
  return requestJson<{ tenant: Tenant }>(
    `/api/dashboard/superadmin/tenants/${encodeURIComponent(tenantId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    }
  );
}

export function getSuperadminTenantTeamData(tenantId: string) {
  return requestJson<Pick<AdminTenantTeamData, 'members' | 'roles'>>(
    `/api/dashboard/superadmin/tenants/${encodeURIComponent(tenantId)}/team`
  );
}

export function inviteSuperadminTenantTeamMember(
  tenantId: string,
  input: { name: string; email: string; tenantRoleKey: string; reason: string }
) {
  return requestJson<{
    member: AdminTenantTeamData['members'][number];
    temporaryPassword: string;
  }>(`/api/dashboard/superadmin/tenants/${encodeURIComponent(tenantId)}/team`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateSuperadminTenantTeamMember(
  tenantId: string,
  membershipId: string,
  input: { tenantRoleKey?: string; isActive?: boolean; reason: string }
) {
  return requestJson<{
    member: AdminTenantTeamData['members'][number];
  }>(`/api/dashboard/superadmin/tenants/${encodeURIComponent(tenantId)}/team/${encodeURIComponent(membershipId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function getSuperadminTenantSettingsData(tenantId: string) {
  return requestJson<SuperadminTenantSettingsData>(
    `/api/dashboard/superadmin/tenants/${encodeURIComponent(tenantId)}/settings`
  );
}

export function updateSuperadminTenantSettings(tenantId: string, input: { settings: TenantSettingsShape; reason: string }) {
  return requestJson<SuperadminTenantSettingsData>(
    `/api/dashboard/superadmin/tenants/${encodeURIComponent(tenantId)}/settings`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    }
  );
}

export function getSuperadminTenantAuditData(
  tenantId: string,
  params?: {
    module?: string;
    action?: string;
    from?: string;
    to?: string;
  }
) {
  const search = new URLSearchParams();
  if (params?.module) search.set('module', params.module);
  if (params?.action) search.set('action', params.action);
  if (params?.from) search.set('from', params.from);
  if (params?.to) search.set('to', params.to);

  const query = search.toString();
  return requestJson<AdminTenantAuditData>(
    `/api/dashboard/superadmin/tenants/${encodeURIComponent(tenantId)}/audit${query ? `?${query}` : ''}`
  );
}

export function getSuperadminTenantDriversData(tenantId: string) {
  return requestJson<AdminDriversData>(
    `/api/dashboard/superadmin/tenants/${encodeURIComponent(tenantId)}/drivers`
  );
}

export function updateSuperadminTenantDriverVerification(
  tenantId: string,
  driverId: string,
  input: { isDriverVerified: boolean; reason: string }
) {
  return requestJson<{
    driver: {
      id: string;
      isDriverVerified: boolean;
    };
  }>(
    `/api/dashboard/superadmin/tenants/${encodeURIComponent(tenantId)}/drivers/${encodeURIComponent(driverId)}/verification`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    }
  );
}

export function updateSuperadminTenantDriverRestriction(
  tenantId: string,
  driverId: string,
  input: { isDriverRestricted: boolean; reason: string }
) {
  return requestJson<{
    driver: {
      id: string;
      isDriverRestricted: boolean;
      driverRestrictionReason: string | null;
      driverRestrictedAt: string | Date | null;
    };
  }>(
    `/api/dashboard/superadmin/tenants/${encodeURIComponent(tenantId)}/drivers/${encodeURIComponent(driverId)}/restriction`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    }
  );
}

export function getSuperadminTenantTerminalsData(tenantId: string) {
  return requestJson<AdminTerminalsData>(
    `/api/dashboard/superadmin/tenants/${encodeURIComponent(tenantId)}/terminals`
  );
}

export function createSuperadminTenantTerminal(
  tenantId: string,
  input: {
    name: string;
    location: string;
    latitude: number;
    longitude: number;
    reason: string;
  }
) {
  return requestJson<{ terminal: TODATerminal }>(
    `/api/dashboard/superadmin/tenants/${encodeURIComponent(tenantId)}/terminals`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  );
}

export function updateSuperadminTenantTerminal(
  tenantId: string,
  terminalId: string,
  input: {
    name?: string;
    location?: string;
    capacity?: number;
    latitude?: number;
    longitude?: number;
    reason: string;
  }
) {
  return requestJson<{ terminal: TODATerminal }>(
    `/api/dashboard/superadmin/tenants/${encodeURIComponent(tenantId)}/terminals/${encodeURIComponent(terminalId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    }
  );
}

export function getSuperadminTenantRidesData(tenantId: string) {
  return requestJson<SuperadminTenantRidesData>(
    `/api/dashboard/superadmin/tenants/${encodeURIComponent(tenantId)}/rides`
  );
}

export function getSuperadminTenantReservationsData(tenantId: string) {
  return requestJson<SuperadminTenantReservationsData>(
    `/api/dashboard/superadmin/tenants/${encodeURIComponent(tenantId)}/reservations`
  );
}

export function getSuperadminReportsData() {
  return requestJson<SuperadminReportsData>('/api/dashboard/superadmin/reports');
}

export function getSuperadminPassengersData(params?: {
  query?: string;
  tenantId?: string;
  activity?: 'all' | 'active' | 'inactive';
}) {
  const search = new URLSearchParams();
  if (params?.query) search.set('query', params.query);
  if (params?.tenantId) search.set('tenantId', params.tenantId);
  if (params?.activity) search.set('activity', params.activity);

  const query = search.toString();
  return requestJson<SuperadminPassengerDirectoryData>(
    `/api/dashboard/superadmin/passengers${query ? `?${query}` : ''}`
  );
}

export function getSuperadminPassengerProfile(passengerId: string) {
  return requestJson<SuperadminPassengerProfileData>(
    `/api/dashboard/superadmin/passengers/${encodeURIComponent(passengerId)}`
  );
}

export function updateSuperadminPassengerProfile(
  passengerId: string,
  input: {
    name?: string;
    email?: string | null;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
    reason: string;
  }
) {
  return requestJson<{
    passenger: {
      id: string;
      name: string;
      email: string | null;
      emergencyContactName: string | null;
      emergencyContactPhone: string | null;
    };
  }>(`/api/dashboard/superadmin/passengers/${encodeURIComponent(passengerId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function getSuperadminSupportAccessData(params?: {
  tenantId?: string;
  accessType?: string;
}) {
  const search = new URLSearchParams();
  if (params?.tenantId) search.set('tenantId', params.tenantId);
  if (params?.accessType) search.set('accessType', params.accessType);

  const query = search.toString();
  return requestJson<SuperadminSupportAccessData>(
    `/api/dashboard/superadmin/support-access${query ? `?${query}` : ''}`
  );
}

export function createSuperadminSupportAccessLog(input: {
  tenantId: string;
  accessType: string;
  reason: string;
}) {
  return requestJson<{ ok: true }>('/api/dashboard/superadmin/support-access', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getSuperadminPlatformAuditData(params?: {
  tenantId?: string;
  module?: string;
  action?: string;
}) {
  const search = new URLSearchParams();
  if (params?.tenantId) search.set('tenantId', params.tenantId);
  if (params?.module) search.set('module', params.module);
  if (params?.action) search.set('action', params.action);

  const query = search.toString();
  return requestJson<SuperadminPlatformAuditData>(
    `/api/dashboard/superadmin/audit${query ? `?${query}` : ''}`
  );
}


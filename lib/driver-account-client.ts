export interface DriverAccountData {
  user: {
    id: string;
    role: string;
    name: string;
    email: string | null;
    phone: string | null;
    phoneE164: string | null;
    createdAt: string | Date;
    isDriverVerified: boolean;
    isDriverRestricted: boolean;
    driverRestrictionReason: string | null;
    driverRestrictedAt: string | Date | null;
  };
  accessState: 'pending' | 'restricted' | 'active';
  profile: {
    legalFullName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    dateOfBirth: string | Date | null;
    homeAddress: string | null;
    todaMembershipId: string | null;
    licenseNumber: string | null;
    licenseExpiry: string | Date | null;
    vehicleType: string | null;
    plateNumber: string | null;
    vehicleModel: string | null;
    vehicleColor: string | null;
    operationalState: 'pending_review' | 'offline' | 'online' | 'restricted';
    verificationStatus: 'pending' | 'verified';
    restrictionStatus: 'unrestricted' | 'restricted';
    verificationApprovedAt: string | Date | null;
    lastVerificationReviewAt: string | Date | null;
    restrictedAt: string | Date | null;
    toda: {
      id: string;
      name: string;
      location: string;
      capacity: number;
      currentQueued: number;
    } | null;
    visibilityScope: 'assigned_terminal_first' | 'tenant_wide';
  };
  presence: {
    isOnline: boolean;
    onlineSinceAt: string | Date | null;
    lastHeartbeatAt: string | Date | null;
  };
  documents: Array<{
    id: string;
    documentType: string;
    reviewStatus: string;
    submittedAt: string | Date;
    reviewedAt: string | Date | null;
    remarks: string | null;
    reviewedBy: {
      id: string;
      name: string;
    } | null;
  }>;
  documentSummary: {
    total: number;
    submitted: number;
    approved: number;
    rejected: number;
  };
  latestVerificationReview: {
    decision: string;
    remarks: string | null;
    createdAt: string | Date;
    reviewedBy: {
      id: string;
      name: string;
    } | null;
  } | null;
  latestRestrictionLog: {
    action: string;
    reason: string | null;
    createdAt: string | Date;
    actedBy: {
      id: string;
      name: string;
    } | null;
  } | null;
}

export interface DriverAccountProfilePayload {
  contactEmail?: string | null;
  homeAddress?: string | null;
}

async function requestDriverAccount<T>(init?: RequestInit): Promise<T> {
  const response = await fetch('/api/driver/account', {
    cache: 'no-store',
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    account?: T;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? 'Driver account request failed.');
  }

  return payload.account as T;
}

export function getDriverAccount() {
  return requestDriverAccount<DriverAccountData>();
}

export function updateDriverAccountProfile(input: DriverAccountProfilePayload) {
  return requestDriverAccount<DriverAccountData>({
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

import type { DriverAccountData } from '@/lib/driver-account-client';

export function getDriverAccountInitials(value?: string | null) {
  if (!value?.trim()) {
    return 'D';
  }

  const parts = value.trim().split(/\s+/).filter(Boolean).slice(0, 2);

  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'D';
}

export function formatDriverAccountLabel(value: string) {
  return value
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatDriverAccountDate(
  value: string | Date | null | undefined,
  fallback = 'Not provided',
) {
  if (!value) return fallback;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
  }).format(date);
}

export function formatDriverAccountDateTime(
  value: string | Date | null | undefined,
  fallback = 'Not available',
) {
  if (!value) return fallback;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function getDriverAccessLabel(
  accessState: DriverAccountData['accessState'],
) {
  if (accessState === 'restricted') {
    return 'Restricted';
  }

  if (accessState === 'pending') {
    return 'Pending review';
  }

  return 'Active';
}

export function getDriverAccessBadgeClassName(
  accessState: DriverAccountData['accessState'],
) {
  if (accessState === 'restricted') {
    return 'border-amber-200 bg-amber-100 text-amber-900';
  }

  if (accessState === 'pending') {
    return 'border-orange-200 bg-orange-100 text-orange-800';
  }

  return 'border-emerald-200 bg-emerald-100 text-emerald-800';
}

export function getDriverOperationalStateLabel(
  value: DriverAccountData['profile']['operationalState'],
) {
  switch (value) {
    case 'pending_review':
      return 'Pending review';
    case 'offline':
      return 'Offline';
    case 'online':
      return 'Online';
    case 'restricted':
      return 'Restricted';
    default:
      return formatDriverAccountLabel(value);
  }
}

export function getDriverOperationalBadgeClassName(
  value: DriverAccountData['profile']['operationalState'],
) {
  switch (value) {
    case 'online':
      return 'border-emerald-200 bg-emerald-100 text-emerald-800';
    case 'offline':
      return 'border-slate-200 bg-slate-100 text-slate-700';
    case 'restricted':
      return 'border-amber-200 bg-amber-100 text-amber-900';
    case 'pending_review':
    default:
      return 'border-orange-200 bg-orange-100 text-orange-800';
  }
}

export function getDriverVisibilityScopeLabel(
  value: DriverAccountData['profile']['visibilityScope'],
) {
  return value === 'assigned_terminal_first'
    ? 'Assigned terminal first'
    : 'Tenant-wide terminal board';
}

export function getDriverDocumentStatusBadgeClassName(status: string) {
  switch (status) {
    case 'approved':
      return 'border-emerald-200 bg-emerald-100 text-emerald-800';
    case 'rejected':
      return 'border-rose-200 bg-rose-100 text-rose-800';
    case 'submitted':
    default:
      return 'border-orange-200 bg-orange-100 text-orange-800';
  }
}

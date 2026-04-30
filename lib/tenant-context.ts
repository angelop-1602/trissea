import { getPrisma } from '@/lib/prisma';
import { getPSGCLGUByCode, resolveProvinceCodeByName } from '@/lib/psgc';
import { BookingError } from '@/lib/booking/errors';

interface NominatimReverseResponse {
  address?: Record<string, string | undefined>;
}

export interface CoordinatePoint {
  latitude: number;
  longitude: number;
}

export class TenantResolutionError extends BookingError {
  constructor(
    message: string,
    public readonly status: number = 400,
    public readonly code: string = 'TENANT_RESOLUTION_FAILED'
  ) {
    super(message, status, code);
  }
}

export async function resolveTenantByProvinceCode(provinceCode: string) {
  const prisma = getPrisma();
  return prisma.tenant.findFirst({
    where: { provinceCode },
  });
}

export async function resolveTenantByDriverLguCode(lguCode: string) {
  const selectedLgu = await getPSGCLGUByCode(lguCode);
  if (!selectedLgu) {
    return null;
  }

  const prisma = getPrisma();

  const exactTenant = await prisma.tenant.findUnique({
    where: { lguCode: selectedLgu.code },
  });

  if (exactTenant) {
    return exactTenant;
  }

  if (
    (selectedLgu.lguType === 'city' || selectedLgu.lguType === 'municipality') &&
    selectedLgu.provinceCode
  ) {
    return prisma.tenant.findFirst({
      where: {
        lguType: 'province',
        lguCode: selectedLgu.provinceCode,
      },
    });
  }

  return null;
}

export async function resolveTenantByProvinceName(provinceName: string) {
  const provinceCode = await resolveProvinceCodeByName(provinceName);
  if (!provinceCode) {
    return null;
  }

  return resolveTenantByProvinceCode(provinceCode);
}

async function reverseGeocodeProvince(point: CoordinatePoint): Promise<string | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${point.latitude}&lon=${point.longitude}&addressdetails=1&zoom=10`;

  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en',
      'User-Agent': 'MobilityTenantResolver/1.0',
    },
  });

  if (!response.ok) {
    throw new TenantResolutionError('Location service is currently unavailable. Please try again.', 502, 'GEOCODE_UNAVAILABLE');
  }

  const payload = (await response.json()) as NominatimReverseResponse;
  const address = payload.address ?? {};

  return (
    address.state ??
    address.province ??
    address.region ??
    address.county ??
    address.city ??
    address.town ??
    null
  );
}

export async function resolveTenantByCoordinates(point: CoordinatePoint) {
  const provinceName = await reverseGeocodeProvince(point);
  if (!provinceName) {
    throw new TenantResolutionError('Unable to resolve your province from location.', 400, 'PROVINCE_NOT_RESOLVED');
  }

  const tenant = await resolveTenantByProvinceName(provinceName);
  if (!tenant) {
    throw new TenantResolutionError('No tenant is configured for your province yet.', 404, 'TENANT_NOT_FOUND_FOR_PROVINCE');
  }

  return tenant;
}


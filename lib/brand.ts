export const BRAND_NAME = 'Mobility';
export const PLATFORM_NAME = 'Mobility Platform';
export const PASSENGER_APP_NAME = 'Mobility Passenger';
export const DRIVER_APP_NAME = 'Mobility Driver';
export const BRAND_DESCRIPTION =
  'Multi-tenant mobility platform for tricycle booking, TODA queues, and future transport modules.';

export const DEFAULT_BRAND_LOGO_PATH = '/mobility-logo.png';
export const PREVIOUS_BRAND_LOGO_PATHS = new Set(['/mobility-logo.svg']);

export function normalizeBrandLogoPath(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (!trimmed || PREVIOUS_BRAND_LOGO_PATHS.has(trimmed)) {
    return DEFAULT_BRAND_LOGO_PATH;
  }

  return trimmed;
}

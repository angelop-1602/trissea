export const BRAND_NAME = 'TRISSEA';
export const PLATFORM_NAME = 'TRISSEA Platform';
export const PASSENGER_APP_NAME = 'TRISSEA Passenger';
export const DRIVER_APP_NAME = 'TRISSEA Driver';
export const BRAND_FULL_NAME =
  'Tuguegarao City Tricycle Riders Information, Security and Satisfaction Enhancement App';
export const BRAND_DESCRIPTION =
  'A mobile-first tricycle booking and TODA operations app for Tuguegarao City riders, drivers, and local transport teams.';

export const DEFAULT_BRAND_LOGO_PATH = '/trissea-logo.png';
export const DEFAULT_BRAND_ICON_PATH = '/trissea-icon-32.png';
export const DEFAULT_BRAND_APPLE_ICON_PATH = '/trissea-apple-icon.png';

export function normalizeBrandLogoPath(value: string | null | undefined) {
  return normalizeBrandAssetPath(value, DEFAULT_BRAND_LOGO_PATH);
}

export function normalizeBrandAssetPath(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return fallback;
  }

  return trimmed;
}

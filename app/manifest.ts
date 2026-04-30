import type { MetadataRoute } from 'next';
import {
  BRAND_DESCRIPTION,
  BRAND_NAME,
  DEFAULT_BRAND_APPLE_ICON_PATH,
  DEFAULT_BRAND_ICON_PATH,
  PLATFORM_NAME,
} from '@/lib/brand';
import { DEFAULT_PRIMARY_HEX, PWA_BACKGROUND_HEX } from '@/lib/theme/constants';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PLATFORM_NAME,
    short_name: BRAND_NAME,
    description: BRAND_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: PWA_BACKGROUND_HEX,
    theme_color: DEFAULT_PRIMARY_HEX,
    orientation: 'portrait',
    lang: 'en',
    shortcuts: [
      {
        name: 'Passenger',
        short_name: 'Passenger',
        description: 'Open passenger onboarding, sign in, and booking access.',
        url: '/passenger',
        icons: [
          {
            src: DEFAULT_BRAND_ICON_PATH,
            sizes: '32x32',
            type: 'image/png',
          },
        ],
      },
      {
        name: 'Driver',
        short_name: 'Driver',
        description: 'Open driver onboarding, sign in, and operational access.',
        url: '/driver',
        icons: [
          {
            src: DEFAULT_BRAND_ICON_PATH,
            sizes: '32x32',
            type: 'image/png',
          },
        ],
      },
    ],
    icons: [
      {
        src: DEFAULT_BRAND_ICON_PATH,
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: DEFAULT_BRAND_APPLE_ICON_PATH,
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}

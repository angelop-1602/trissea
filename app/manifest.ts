import type { MetadataRoute } from 'next';
import { BRAND_DESCRIPTION, BRAND_NAME, PLATFORM_NAME } from '@/lib/brand';
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
            src: '/icon-light-32x32.png',
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
            src: '/icon-light-32x32.png',
            sizes: '32x32',
            type: 'image/png',
          },
        ],
      },
    ],
    icons: [
      {
        src: '/icon-light-32x32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}

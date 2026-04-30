import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { StoreProvider } from '@/lib/store-context'
import { PwaClient } from '@/components/pwa/pwa-client'
import { ThemeProvider } from '@/components/theme-provider'
import {
  BRAND_DESCRIPTION,
  DEFAULT_BRAND_APPLE_ICON_PATH,
  DEFAULT_BRAND_ICON_PATH,
  PLATFORM_NAME,
} from '@/lib/brand'
import { DEFAULT_PRIMARY_HEX } from '@/lib/theme/constants'
import { DEFAULT_THEME_MODE_STORAGE_KEY, THEME_MODE_STORAGE_KEY } from '@/lib/theme/palette-storage'
import './globals.css'

const geist = Geist({ subsets: ["latin"] });

const themeStorageBootstrap = `
(() => {
  try {
    const nextKey = '${THEME_MODE_STORAGE_KEY}';
    const fallbackKey = '${DEFAULT_THEME_MODE_STORAGE_KEY}';
    const validModes = new Set(['light', 'dark', 'system']);
    let mode = localStorage.getItem(nextKey);
    const fallbackMode = localStorage.getItem(fallbackKey);

    if (!validModes.has(mode) && validModes.has(fallbackMode)) {
      localStorage.setItem(nextKey, fallbackMode);
      localStorage.removeItem(fallbackKey);
      mode = fallbackMode;
    }

    const effectiveMode = validModes.has(mode) ? mode : 'system';

    if (effectiveMode === 'dark' || (effectiveMode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
      return;
    }

    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = 'light';
  } catch {}
})();
`;

export const metadata: Metadata = {
  title: PLATFORM_NAME,
  description: BRAND_DESCRIPTION,
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      {
        url: DEFAULT_BRAND_ICON_PATH,
        media: '(prefers-color-scheme: light)',
      },
      {
        url: DEFAULT_BRAND_ICON_PATH,
        media: '(prefers-color-scheme: dark)',
      },
    ],
    apple: DEFAULT_BRAND_APPLE_ICON_PATH,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  userScalable: true,
  themeColor: DEFAULT_PRIMARY_HEX,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          id="trissea-theme-bootstrap"
          dangerouslySetInnerHTML={{ __html: themeStorageBootstrap }}
        />
      </head>
      <body className={`${geist.className} bg-background text-foreground font-sans antialiased`}>
        <ThemeProvider>
          <StoreProvider>
            <PwaClient />
            {children}
          </StoreProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}

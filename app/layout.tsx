import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { StoreProvider } from '@/lib/store-context'
import { PwaClient } from '@/components/pwa/pwa-client'
import { PaletteStyleInjector } from '@/components/theme/palette-style-injector'
import { ThemeProvider } from '@/components/theme-provider'
import { BRAND_DESCRIPTION, PLATFORM_NAME } from '@/lib/brand'
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
  generator: 'v0.app',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
    ],
    apple: '/apple-icon.png',
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
          id="mobility-theme-bootstrap"
          dangerouslySetInnerHTML={{ __html: themeStorageBootstrap }}
        />
      </head>
      <body className={`${geist.className} bg-background text-foreground font-sans antialiased`}>
        <ThemeProvider>
          <PaletteStyleInjector />
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

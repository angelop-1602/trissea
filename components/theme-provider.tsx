'use client'

import * as React from 'react'
import {
  ThemeProvider as NextThemesProvider,
  useTheme,
  type ThemeProviderProps,
} from 'next-themes'
import { THEME_MODE_STORAGE_KEY, migrateThemeModeStorage } from '@/lib/theme/palette-storage'

function ThemeModeStorageMigration() {
  const { resolvedTheme, setTheme } = useTheme()

  React.useEffect(() => {
    const migratedTheme = migrateThemeModeStorage()

    if (migratedTheme && resolvedTheme !== migratedTheme) {
      setTheme(migratedTheme)
    }
  }, [resolvedTheme, setTheme])

  return null
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey={THEME_MODE_STORAGE_KEY}
      {...props}
    >
      <ThemeModeStorageMigration />
      {children}
    </NextThemesProvider>
  )
}

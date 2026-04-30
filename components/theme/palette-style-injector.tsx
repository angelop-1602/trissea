'use client';

import { useEffect } from 'react';
import { buildPaletteStyleTagCss } from '@/lib/theme/palette';
import {
  PALETTE_STORAGE_EVENT,
  readPaletteFromStorage,
} from '@/lib/theme/palette-storage';

const PALETTE_STYLE_TAG_ID = 'theme-palette-vars';

function applyThemePaletteStyleTag() {
  if (typeof document === 'undefined') return;

  const lightPalette = readPaletteFromStorage('light');
  const darkPalette = readPaletteFromStorage('dark');
  const cssText = buildPaletteStyleTagCss(lightPalette, darkPalette);

  let styleTag = document.getElementById(PALETTE_STYLE_TAG_ID) as HTMLStyleElement | null;
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = PALETTE_STYLE_TAG_ID;
    document.head.appendChild(styleTag);
  }

  if (styleTag.textContent !== cssText) {
    styleTag.textContent = cssText;
  }
}

export function PaletteStyleInjector() {
  useEffect(() => {
    applyThemePaletteStyleTag();

    const handlePaletteUpdated = () => applyThemePaletteStyleTag();
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key.startsWith('trissea.theme.palette.')) {
        applyThemePaletteStyleTag();
      }
    };

    window.addEventListener(PALETTE_STORAGE_EVENT, handlePaletteUpdated);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(PALETTE_STORAGE_EVENT, handlePaletteUpdated);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return null;
}

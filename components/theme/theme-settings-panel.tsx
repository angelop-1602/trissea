'use client';

import { useEffect, useMemo, useState } from 'react';
import { Laptop, Moon, RotateCcw, Save, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import {
  DEFAULT_DARK_PALETTE,
  DEFAULT_LIGHT_PALETTE,
  EDITABLE_PALETTE_TOKEN_NAMES,
  type EditablePaletteTokenName,
  type ThemeMode,
  type ThemePalette,
} from '@/lib/theme/palette';
import { readPaletteFromStorage, sanitizePalette, writePaletteToStorage } from '@/lib/theme/palette-storage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type PaletteFormState = Record<EditablePaletteTokenName, string>;

type PaletteGroup = {
  label: string;
  tokens: EditablePaletteTokenName[];
};

const PALETTE_GROUPS: PaletteGroup[] = [
  {
    label: 'Core Tokens',
    tokens: [
      'background',
      'foreground',
      'card',
      'card-foreground',
      'popover',
      'popover-foreground',
      'primary',
      'primary-foreground',
      'secondary',
      'secondary-foreground',
      'muted',
      'muted-foreground',
      'accent',
      'accent-foreground',
      'destructive',
      'destructive-foreground',
      'border',
      'input',
      'ring',
    ],
  },
  {
    label: 'Chart Tokens',
    tokens: ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'],
  },
  {
    label: 'Sidebar Tokens',
    tokens: [
      'sidebar',
      'sidebar-foreground',
      'sidebar-primary',
      'sidebar-primary-foreground',
      'sidebar-accent',
      'sidebar-accent-foreground',
      'sidebar-border',
      'sidebar-ring',
    ],
  },
];

function toEditableState(palette: ThemePalette): PaletteFormState {
  const editable = {} as PaletteFormState;
  for (const token of EDITABLE_PALETTE_TOKEN_NAMES) {
    editable[token] = palette[token];
  }
  return editable;
}

function getTokenLabel(token: string) {
  return token
    .split('-')
    .map((part) => (part.length <= 2 ? part.toUpperCase() : `${part[0].toUpperCase()}${part.slice(1)}`))
    .join(' ');
}

function PaletteFields({
  palette,
  onChange,
  errors,
}: {
  palette: PaletteFormState;
  onChange: (token: EditablePaletteTokenName, value: string) => void;
  errors: Partial<Record<EditablePaletteTokenName, string>>;
}) {
  return (
    <div className="space-y-6">
      {PALETTE_GROUPS.map((group) => (
        <div key={group.label} className="space-y-3">
          <h4 className="text-sm font-semibold">{group.label}</h4>
          <div className="grid gap-3 md:grid-cols-2">
            {group.tokens.map((token) => (
              <div key={token} className="space-y-1.5">
                <Label htmlFor={`token-${token}`} className="text-xs text-muted-foreground">
                  {getTokenLabel(token)}
                </Label>
                <Input
                  id={`token-${token}`}
                  value={palette[token]}
                  onChange={(event) => onChange(token, event.target.value)}
                  className={errors[token] ? 'border-destructive' : undefined}
                />
                {errors[token] ? <p className="text-xs text-destructive">{errors[token]}</p> : null}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ThemeSettingsPanel() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lightPalette, setLightPalette] = useState<PaletteFormState>(() => toEditableState(DEFAULT_LIGHT_PALETTE));
  const [darkPalette, setDarkPalette] = useState<PaletteFormState>(() => toEditableState(DEFAULT_DARK_PALETTE));
  const [errors, setErrors] = useState<
    Partial<Record<EditablePaletteTokenName, string>> & { light?: string; dark?: string }
  >({});
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    setLightPalette(toEditableState(readPaletteFromStorage('light')));
    setDarkPalette(toEditableState(readPaletteFromStorage('dark')));
  }, []);

  const mode = useMemo<ThemeMode>(() => {
    if (theme === 'light' || theme === 'dark') return theme;
    return 'system';
  }, [theme]);

  const handlePaletteChange = (
    target: 'light' | 'dark',
    token: EditablePaletteTokenName,
    value: string
  ) => {
    setNotice(null);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[token];
      return next;
    });

    if (target === 'light') {
      setLightPalette((prev) => ({ ...prev, [token]: value }));
      return;
    }

    setDarkPalette((prev) => ({ ...prev, [token]: value }));
  };

  const handleSavePalettes = () => {
    setSaving(true);
    setNotice(null);

    const lightResult = sanitizePalette('light', lightPalette);
    const darkResult = sanitizePalette('dark', darkPalette);
    const invalidErrors: Partial<Record<EditablePaletteTokenName, string>> = {};

    for (const token of lightResult.invalidTokens) {
      invalidErrors[token] = 'Invalid color format for light palette.';
    }
    for (const token of darkResult.invalidTokens) {
      invalidErrors[token] = 'Invalid color format for dark palette.';
    }

    if (Object.keys(invalidErrors).length > 0) {
      setErrors(invalidErrors);
      setSaving(false);
      return;
    }

    writePaletteToStorage('light', lightResult.palette);
    writePaletteToStorage('dark', darkResult.palette);
    setLightPalette(toEditableState(lightResult.palette));
    setDarkPalette(toEditableState(darkResult.palette));
    setErrors({});
    setNotice('Theme palettes saved.');
    setSaving(false);
  };

  const handleResetPalettes = () => {
    setSaving(true);
    writePaletteToStorage('light', DEFAULT_LIGHT_PALETTE);
    writePaletteToStorage('dark', DEFAULT_DARK_PALETTE);
    setLightPalette(toEditableState(DEFAULT_LIGHT_PALETTE));
    setDarkPalette(toEditableState(DEFAULT_DARK_PALETTE));
    setErrors({});
    setNotice('Theme palettes reset to defaults.');
    setSaving(false);
  };

  if (!mounted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Loading local appearance preferences...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full max-w-sm" />
          <Skeleton className="h-52 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>These appearance preferences are saved in this browser only.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="theme-mode">Theme mode</Label>
          <Select
            value={mode}
            onValueChange={(value) => {
              setTheme(value as ThemeMode);
              setNotice('Theme mode updated.');
            }}
          >
            <SelectTrigger id="theme-mode" className="w-full max-w-sm">
              <SelectValue placeholder="Select mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">
                <span className="inline-flex items-center gap-2">
                  <Laptop className="h-4 w-4" />
                  System
                </span>
              </SelectItem>
              <SelectItem value="light">
                <span className="inline-flex items-center gap-2">
                  <Sun className="h-4 w-4" />
                  Light
                </span>
              </SelectItem>
              <SelectItem value="dark">
                <span className="inline-flex items-center gap-2">
                  <Moon className="h-4 w-4" />
                  Dark
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Brand Token Locked</Badge>
            <p className="text-sm">
              `--brand`: <span className="font-medium">oklch(0.865 0.143 50.814)</span>
            </p>
            <p className="text-sm">
              `--brand-foreground`: <span className="font-medium">oklch(0.145 0.001 0)</span>
            </p>
          </div>
        </div>

        <Tabs defaultValue="light" className="w-full">
          <TabsList>
            <TabsTrigger value="light">Light Palette</TabsTrigger>
            <TabsTrigger value="dark">Dark Palette</TabsTrigger>
          </TabsList>

          <TabsContent value="light" className="mt-4">
            <PaletteFields
              palette={lightPalette}
              onChange={(token, value) => handlePaletteChange('light', token, value)}
              errors={errors}
            />
          </TabsContent>

          <TabsContent value="dark" className="mt-4">
            <PaletteFields
              palette={darkPalette}
              onChange={(token, value) => handlePaletteChange('dark', token, value)}
              errors={errors}
            />
          </TabsContent>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleSavePalettes} disabled={saving} className="min-w-[140px]">
            <Save className="h-4 w-4" />
            Save Palettes
          </Button>
          <Button variant="outline" onClick={handleResetPalettes} disabled={saving}>
            <RotateCcw className="h-4 w-4" />
            Reset Defaults
          </Button>
          {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

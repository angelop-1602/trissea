'use client';

import { useMemo } from 'react';
import { Laptop, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { DriverAppShell } from '@/components/driver/driver-app-shell';
import {
  AccountSection,
  AccountValueRow,
} from '@/components/passenger/account-section';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ThemeMode = 'system' | 'light' | 'dark';

export default function DriverSettingsPage() {
  const { theme, setTheme } = useTheme();

  const mode = useMemo<ThemeMode>(() => {
    if (theme === 'light' || theme === 'dark') return theme;
    return 'system';
  }, [theme]);

  return (
    <DriverAppShell
      title="Settings"
      subtitle="Keep driver settings minimal and honest. Only real preferences appear here."
      backHref="/driver/account"
      topContext="Account"
      headerVariant="compact"
      headerSurface="minimal"
    >
      <AccountSection
        title="Appearance"
        description="Theme mode is stored on this device and applies across the driver workspace."
      >
        <div className="space-y-3 px-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="driver-theme-mode">Theme mode</Label>
            <Select value={mode} onValueChange={(value) => setTheme(value)}>
              <SelectTrigger
                id="driver-theme-mode"
                className="h-11 w-full rounded-[1.2rem]"
              >
                <SelectValue placeholder="Select theme mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">
                  <span className="inline-flex items-center gap-2">
                    <Laptop className="h-4 w-4" />
                    Device settings
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
        </div>
      </AccountSection>

      <AccountSection
        title="This phase"
        description="The current driver settings area stays intentionally small."
      >
        <AccountValueRow
          label="Available now"
          value="Theme mode is the only real driver preference supported here today."
        />
      </AccountSection>
    </DriverAppShell>
  );
}

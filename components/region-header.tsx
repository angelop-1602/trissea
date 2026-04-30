'use client';

import { useState } from 'react';
import { Region } from '@/lib/mock-db';
import { Button } from '@/components/ui/button';
import { ChevronDown, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RegionHeaderProps {
  region: Region;
  onProvinceSelect?: (province: string) => void;
}

export function RegionHeader({ region, onProvinceSelect }: RegionHeaderProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-primary/5 border-b border-primary/20">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-primary/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <div className="text-left">
            <div className="font-semibold text-sm">{region.name}</div>
            <div className="text-xs text-muted-foreground">{region.country}</div>
          </div>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-primary transition-transform',
            isExpanded && 'rotate-180'
          )}
        />
      </button>

      {isExpanded && (
        <div className="border-t border-primary/20 bg-primary/2">
          <div className="grid grid-cols-2 gap-2 p-3">
            {region.provinces.map((province) => (
              <Button
                key={province}
                variant="outline"
                size="sm"
                className="text-xs h-8"
                onClick={() => {
                  onProvinceSelect?.(province);
                  setIsExpanded(false);
                }}
              >
                {province}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

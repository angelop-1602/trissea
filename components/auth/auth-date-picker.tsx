'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { format, setMonth, setYear } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AuthDatePickerProps {
  id: string;
  label?: string;
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  disabled?: boolean;
  startYear?: number;
  endYear?: number;
}

function parseDateValue(value: string): Date | undefined {
  if (!value) return undefined;

  const [year, month, day] = value.split('-').map((part) => Number(part));
  if (!year || !month || !day) return undefined;

  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return undefined;

  return parsed;
}

export function AuthDatePicker({
  id,
  label,
  value,
  onChange,
  placeholder = 'Select date',
  disabled,
  startYear,
  endYear,
}: AuthDatePickerProps) {
  const [open, setOpen] = useState(false);
  const selectedDate = parseDateValue(value);
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const minimumYear = startYear ?? 1940;
  const maximumYear = endYear ?? currentYear + 20;
  const [viewMonth, setViewMonth] = useState<Date>(selectedDate ?? new Date());

  useEffect(() => {
    if (!open) {
      return;
    }

    setViewMonth(selectedDate ?? new Date());
  }, [open, selectedDate]);

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        value: String(index),
        label: new Date(2020, index, 1).toLocaleString('default', { month: 'short' }),
      })),
    []
  );

  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let year = maximumYear; year >= minimumYear; year -= 1) {
      years.push(year);
    }
    return years;
  }, [maximumYear, minimumYear]);

  return (
    <div className="space-y-1.5">
      {label ? (
        <Label htmlFor={id} className="pl-1 text-xs text-muted-foreground">
          {label}
        </Label>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              'h-12 w-full justify-start rounded-2xl border-border/50 bg-background/60 text-left text-sm font-normal hover:bg-background/70',
              !selectedDate && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            {selectedDate ? format(selectedDate, 'PPP') : placeholder}
          </Button>
        </DialogTrigger>
        <DialogContent showCloseButton={false} className="w-[calc(100vw-1rem)] max-w-[20rem] overflow-hidden p-3">
          <DialogHeader className="sr-only">
            <DialogTitle>{label ?? 'Select date'}</DialogTitle>
          </DialogHeader>
          <div className="mb-2 grid grid-cols-2 gap-2">
            <Select
              value={String(viewMonth.getMonth())}
              onValueChange={(monthValue) => {
                const nextMonth = Number.parseInt(monthValue, 10);
                if (!Number.isNaN(nextMonth)) {
                  setViewMonth((current) => setMonth(current, nextMonth));
                }
              }}
            >
              <SelectTrigger className="h-9 w-full rounded-md bg-background text-foreground">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                {monthOptions.map((monthOption) => (
                  <SelectItem key={monthOption.value} value={monthOption.value}>
                    {monthOption.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(viewMonth.getFullYear())}
              onValueChange={(yearValue) => {
                const nextYear = Number.parseInt(yearValue, 10);
                if (!Number.isNaN(nextYear)) {
                  setViewMonth((current) => setYear(current, nextYear));
                }
              }}
            >
              <SelectTrigger className="h-9 w-full rounded-md bg-background text-foreground">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                {yearOptions.map((yearValue) => (
                  <SelectItem key={yearValue} value={String(yearValue)}>
                    {yearValue}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Calendar
            mode="single"
            selected={selectedDate}
            month={viewMonth}
            onMonthChange={setViewMonth}
            onSelect={(date) => {
              onChange(date ? format(date, 'yyyy-MM-dd') : '');
              if (date) {
                setOpen(false);
              }
            }}
            startMonth={new Date(minimumYear, 0)}
            endMonth={new Date(maximumYear, 11)}
            hideNavigation
            className="w-full p-0 [--cell-size:--spacing(7)]"
            classNames={{
              root: 'w-full',
              months: 'w-full',
              month: 'w-full',
              month_caption: 'hidden',
            }}
            autoFocus
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

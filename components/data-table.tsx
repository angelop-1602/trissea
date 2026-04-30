'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface DataTableColumn<T> {
  key: keyof T;
  label: string;
  render?: (value: any, row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  onRowClick?: (row: T) => void;
  isLoading?: boolean;
  loadingRowCount?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  embedded?: boolean;
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  onRowClick,
  isLoading = false,
  loadingRowCount = 8,
  emptyTitle = 'No data available',
  emptyDescription,
  embedded = false,
}: DataTableProps<T>) {
  const Wrapper = embedded ? ({ children }: { children: React.ReactNode }) => <>{children}</> : Card;
  const wrapperProps = {};

  if (isLoading) {
    return (
      <Wrapper {...wrapperProps}>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={String(col.key)} className={col.className}>
                  <Skeleton className="h-4 w-20" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: loadingRowCount }).map((_, rowIndex) => (
              <TableRow key={rowIndex}>
                {columns.map((col, columnIndex) => (
                  <TableCell key={`${String(col.key)}-${rowIndex}`} className={col.className}>
                    <Skeleton
                      className={
                        columnIndex === 0
                          ? 'h-4 w-40 max-w-[42vw]'
                          : columnIndex === columns.length - 1
                            ? 'h-4 w-16'
                            : 'h-4 w-24'
                      }
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Wrapper>
    );
  }

  if (data.length === 0) {
    return (
      <Wrapper {...wrapperProps}>
        <div className="flex h-36 flex-col items-center justify-center gap-1 px-4 text-center">
          <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
          {emptyDescription ? (
            <p className="text-sm text-muted-foreground">{emptyDescription}</p>
          ) : null}
        </div>
      </Wrapper>
    );
  }

  return (
    <Wrapper {...wrapperProps}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={String(col.key)} className={col.className}>
                {col.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow
              key={row.id}
              className={onRowClick ? 'cursor-pointer hover:bg-muted/50' : ''}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col) => (
                <TableCell key={String(col.key)} className={col.className}>
                  {col.render
                    ? col.render(row[col.key], row)
                    : String(row[col.key])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Wrapper>
  );
}

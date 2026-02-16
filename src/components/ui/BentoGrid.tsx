import type { ReactNode } from 'react';

interface BentoGridProps {
  children: ReactNode;
  columns?: 1 | 2 | 3 | 4;
  gap?: number;
  className?: string;
}

export function BentoGrid({ children, columns = 3, gap = 6, className = '' }: BentoGridProps) {
  const colClass: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  };

  const gapClass: Record<number, string> = {
    4: 'gap-4',
    5: 'gap-5',
    6: 'gap-6',
    8: 'gap-8',
  };

  return (
    <div className={`grid ${colClass[columns]} ${gapClass[gap] || 'gap-6'} ${className}`}>
      {children}
    </div>
  );
}

interface BentoItemProps {
  children: ReactNode;
  colSpan?: 1 | 2 | 3;
  rowSpan?: 1 | 2;
  className?: string;
}

export function BentoItem({ children, colSpan = 1, rowSpan = 1, className = '' }: BentoItemProps) {
  const colSpanClass: Record<number, string> = {
    1: '',
    2: 'md:col-span-2',
    3: 'md:col-span-3',
  };

  const rowSpanClass: Record<number, string> = {
    1: '',
    2: 'row-span-2',
  };

  return (
    <div className={`${colSpanClass[colSpan]} ${rowSpanClass[rowSpan]} ${className}`}>
      {children}
    </div>
  );
}

import React from 'react';
import { ReviewPriority } from '@/types';

interface PriorityBadgeProps {
  priority: ReviewPriority;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const styles: Record<ReviewPriority, string> = {
    low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    high: 'bg-rose-50 text-rose-700 border-rose-200',
    critical: 'bg-red-50 text-red-700 border-red-200',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${styles[priority]}`}>
      {priority}
    </span>
  );
}

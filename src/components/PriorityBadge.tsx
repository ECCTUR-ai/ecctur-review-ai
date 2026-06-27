import React from 'react';
import { ReviewPriority } from '@/types';

interface PriorityBadgeProps {
  priority: ReviewPriority;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const styles: Record<ReviewPriority, string> = {
    low: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    medium: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    high: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    critical: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${styles[priority]}`}>
      {priority}
    </span>
  );
}

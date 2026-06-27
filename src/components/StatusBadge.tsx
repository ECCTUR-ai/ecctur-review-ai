import React from 'react';
import { ReviewStatus } from '@/types';

interface StatusBadgeProps {
  status: ReviewStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const styles: Record<ReviewStatus, string> = {
    draft: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    waiting_approval: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    published: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  };

  const labels: Record<ReviewStatus, string> = {
    draft: 'Draft',
    waiting_approval: 'Waiting Approval',
    published: 'Published',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${styles[status]}`}>
      {labels[status] || status}
    </span>
  );
}

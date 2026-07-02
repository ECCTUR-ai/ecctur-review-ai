import React from 'react';
import { ReviewStatus } from '@/types';

interface StatusBadgeProps {
  status: ReviewStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const styles: Record<ReviewStatus, string> = {
    draft: 'bg-slate-100 text-slate-700 border-slate-200',
    waiting_approval: 'bg-amber-50 text-amber-700 border-amber-200',
    published: 'bg-emerald-50 text-emerald-700 border-emerald-200',
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

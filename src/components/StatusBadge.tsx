import React from 'react';
import { ReviewStatus } from '@/types';

interface StatusBadgeProps {
  status: ReviewStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const styles: Record<ReviewStatus, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    draft: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    archived: 'bg-slate-100 text-slate-500 border-slate-200',
    manual_replied: 'bg-slate-200 text-slate-700 border-slate-300',
    // Legacy mapping for compatibility
    waiting_approval: 'bg-amber-50 text-amber-700 border-amber-200',
    pending_approval: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    published: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  const labels: Record<ReviewStatus, string> = {
    pending: 'Yanıt Bekliyor',
    draft: 'Taslak Hazır',
    approved: 'Onaylandı',
    archived: 'Arşivde',
    manual_replied: 'Manuel Cevaplandı',
    // Legacy mapping
    waiting_approval: 'Yanıt Bekliyor',
    pending_approval: 'Taslak Hazır',
    published: 'Onaylandı',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${styles[status]}`}>
      {labels[status] || status}
    </span>
  );
}

import React from 'react';
import { Search } from 'lucide-react';
import { ReviewSource, ReviewStatus, ReviewPriority } from '@/types';

interface ReviewFiltersProps {
  search: string;
  setSearch: (val: string) => void;
  source: string;
  setSource: (val: any) => void;
  rating: string;
  setRating: (val: string) => void;
  status: string;
  setStatus: (val: any) => void;
  priority: string;
  setPriority: (val: any) => void;
}

export function ReviewFilters({
  search,
  setSearch,
  source,
  setSource,
  rating,
  setRating,
  status,
  setStatus,
  priority,
  setPriority,
}: ReviewFiltersProps) {
  return (
    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Yorumlarda ara..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-700 placeholder:text-slate-400"
        />
      </div>

      {/* Platform */}
      <div>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-700"
        >
          <option value="">Tüm Platformlar</option>
          <option value="Google">Google</option>
          <option value="Booking">Booking</option>
          <option value="TripAdvisor">TripAdvisor</option>
          <option value="Expedia">Expedia</option>
          <option value="HolidayCheck">HolidayCheck</option>
        </select>
      </div>

      {/* Rating */}
      <div>
        <select
          value={rating}
          onChange={(e) => setRating(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-700"
        >
          <option value="">Tüm Puanlar</option>
          <option value="5">5 Yıldız</option>
          <option value="4">4 Yıldız</option>
          <option value="3">3 Yıldız</option>
          <option value="2">2 Yıldız</option>
          <option value="1">1 Yıldız</option>
        </select>
      </div>

      {/* Status */}
      <div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-700"
        >
          <option value="">Tüm Durumlar</option>
          <option value="draft">Draft</option>
          <option value="waiting_approval">Waiting Approval</option>
          <option value="published">Published</option>
        </select>
      </div>

      {/* Priority */}
      <div>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-700"
        >
          <option value="">Tüm Öncelikler</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </div>
    </div>
  );
}

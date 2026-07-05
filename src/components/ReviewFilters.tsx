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
  sortBy?: 'newest' | 'oldest';
  setSortBy?: (val: 'newest' | 'oldest') => void;
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
  sortBy,
  setSortBy,
}: ReviewFiltersProps) {
  const gridColsClass = sortBy !== undefined ? 'md:grid-cols-6' : 'md:grid-cols-5';
  return (
    <div className={`p-4 rounded-2xl bg-white border border-slate-200 shadow-sm grid grid-cols-1 ${gridColsClass} gap-4 items-center`}>
      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Misafir adına göre ara..."
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
          <option value="Google">Google Reviews</option>
          <option value="TripAdvisor">TripAdvisor</option>
          <option value="Booking">Booking.com</option>
          <option value="Hotels.com">Hotels.com</option>
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

      {/* Sıralama */}
      {sortBy !== undefined && setSortBy !== undefined && (
        <div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest')}
            className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-700 font-medium"
          >
            <option value="newest">En Yeni</option>
            <option value="oldest">En Eski</option>
          </select>
        </div>
      )}
    </div>
  );
}

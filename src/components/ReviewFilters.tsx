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
    <div className="p-4 rounded-2xl glass-panel grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search comments..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-white/[0.06] text-xs focus:outline-none focus:border-blue-500 text-slate-300 placeholder:text-slate-500"
        />
      </div>

      {/* Platform */}
      <div>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/[0.06] text-xs focus:outline-none focus:border-blue-500 text-slate-300"
        >
          <option value="">All Platforms</option>
          <option value="Google">Google</option>
          <option value="Booking">Booking</option>
          <option value="TripAdvisor">TripAdvisor</option>
          <option value="Expedia">Expedia</option>
        </select>
      </div>

      {/* Rating */}
      <div>
        <select
          value={rating}
          onChange={(e) => setRating(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/[0.06] text-xs focus:outline-none focus:border-blue-500 text-slate-300"
        >
          <option value="">All Ratings</option>
          <option value="5">5 Stars</option>
          <option value="4">4 Stars</option>
          <option value="3">3 Stars</option>
          <option value="2">2 Stars</option>
          <option value="1">1 Star</option>
        </select>
      </div>

      {/* Status */}
      <div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/[0.06] text-xs focus:outline-none focus:border-blue-500 text-slate-300"
        >
          <option value="">All Statuses</option>
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
          className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/[0.06] text-xs focus:outline-none focus:border-blue-500 text-slate-300"
        >
          <option value="">All Priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </div>
    </div>
  );
}

import React from 'react';
import { Search } from 'lucide-react';
import { ReviewStatus, ReviewPriority } from '@/types';

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
  rating,
  setRating,
  status,
  setStatus,
  priority,
  setPriority,
  sortBy,
  setSortBy,
}: ReviewFiltersProps) {
  return (
    <div className="p-3.5 rounded-3xl bg-white border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-5 gap-3.5 items-center">
      {/* 🔍 Arama */}
      <div className="relative">
        <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Misafir adına göre ara..."
          className="w-full pl-10 pr-4 h-10 rounded-2xl bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200/60 text-xs focus:outline-none focus:border-indigo-600 text-slate-700 placeholder:text-slate-450 transition-all font-semibold"
        />
      </div>

      {/* ⭐ Puan */}
      <div className="relative">
        <select
          value={rating}
          onChange={(e) => setRating(e.target.value)}
          className="w-full px-3.5 h-10 rounded-2xl bg-slate-50 hover:bg-slate-100/50 border border-slate-200/60 text-xs focus:outline-none focus:border-indigo-600 text-slate-700 font-bold cursor-pointer transition-all appearance-none"
        >
          <option value="">⭐ Tüm Puanlar</option>
          <option value="5">5 Yıldız</option>
          <option value="4">4 Yıldız</option>
          <option value="3">3 Yıldız</option>
          <option value="2">2 Yıldız</option>
          <option value="1">1 Yıldız</option>
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-slate-450 text-[10px] font-bold">
          ▼
        </div>
      </div>

      {/* 📍 Durum */}
      <div className="relative">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full px-3.5 h-10 rounded-2xl bg-slate-50 hover:bg-slate-100/50 border border-slate-200/60 text-xs focus:outline-none focus:border-indigo-600 text-slate-700 font-bold cursor-pointer transition-all appearance-none"
        >
          <option value="">📍 Tüm Durumlar</option>
          <option value="draft">Taslak</option>
          <option value="waiting_approval">Onay Bekleyen</option>
          <option value="published">Yayınlandı</option>
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-slate-450 text-[10px] font-bold">
          ▼
        </div>
      </div>

      {/* 🚩 Öncelik */}
      <div className="relative">
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="w-full px-3.5 h-10 rounded-2xl bg-slate-50 hover:bg-slate-100/50 border border-slate-200/60 text-xs focus:outline-none focus:border-indigo-600 text-slate-700 font-bold cursor-pointer transition-all appearance-none"
        >
          <option value="">🚩 Tüm Öncelikler</option>
          <option value="low">Düşük</option>
          <option value="medium">Orta</option>
          <option value="high">Yüksek</option>
          <option value="critical">Kritik</option>
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-slate-450 text-[10px] font-bold">
          ▼
        </div>
      </div>

      {/* ↓ Sıralama */}
      {sortBy !== undefined && setSortBy !== undefined && (
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest')}
            className="w-full px-3.5 h-10 rounded-2xl bg-slate-50 hover:bg-slate-100/50 border border-slate-200/60 text-xs focus:outline-none focus:border-indigo-600 text-slate-700 font-bold cursor-pointer transition-all appearance-none"
          >
            <option value="newest">↓ En Yeni</option>
            <option value="oldest">↑ En Eski</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-slate-450 text-[10px] font-bold">
            ▼
          </div>
        </div>
      )}
    </div>
  );
}

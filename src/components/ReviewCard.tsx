import React from 'react';
import { Review } from '@/types';
import { StarRating } from './StarRating';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { 
  Calendar, 
  Building,
  Globe,
  Compass,
  Compass as TripAdvisorIcon, // We'll represent TripAdvisor with Compass
  Bookmark, // Booking representation
  Plane, // Expedia representation
  MessageCircle
} from 'lucide-react';

interface ReviewCardProps {
  review: Review;
  isSelected: boolean;
  onClick: () => void;
}

export function ReviewCard({ review, isSelected, onClick }: ReviewCardProps) {
  // Helper to choose platform icon representation
  const getPlatformIcon = () => {
    switch (review.source) {
      case 'Google':
        return <Globe size={14} className="text-blue-400" />;
      case 'TripAdvisor':
        return <TripAdvisorIcon size={14} className="text-emerald-400" />;
      case 'Booking':
        return <Bookmark size={14} className="text-sky-400" />;
      case 'Expedia':
        return <Plane size={14} className="text-amber-400" />;
      default:
        return <MessageCircle size={14} className="text-slate-400" />;
    }
  };

  // Helper for relative time mock (safely calculated based on dates)
  const getRelativeTime = (dateStr: string) => {
    try {
      const diff = Date.now() - new Date(dateStr).getTime();
      const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      return `${Math.floor(diffDays / 30)} months ago`;
    } catch (e) {
      return dateStr;
    }
  };

  // Sentiment dot styles
  const getSentimentStyles = () => {
    switch (review.sentiment) {
      case 'positive':
        return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
      case 'negative':
        return 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]';
      default:
        return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]';
    }
  };

  return (
    <div
      onClick={onClick}
      className={`p-5 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col justify-between gap-4 relative overflow-hidden transform hover:-translate-y-1 hover:shadow-xl ${
        isSelected
          ? 'bg-blue-600/5 border-blue-500/40 shadow-[0_6px_24px_rgba(59,130,246,0.1)]'
          : 'bg-[#090a14] border-white/[0.04] hover:bg-slate-900/40 hover:border-white/[0.08]'
      }`}
    >
      {/* Sentiment indicator strip or dot */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] w-full ${
        review.sentiment === 'positive' ? 'bg-emerald-500' : review.sentiment === 'negative' ? 'bg-rose-500' : 'bg-amber-500'
      }`} />

      {/* Card Header */}
      <div className="flex justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-200 text-sm tracking-wide">{review.guestName}</span>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/[0.02] border border-white/[0.04] text-[9px] font-mono text-slate-400">
              {getPlatformIcon()}
              <span>{review.source}</span>
            </div>
            
            {/* Sentiment small indicator dot */}
            <span className={`w-1.5 h-1.5 rounded-full ${getSentimentStyles()}`} title={`Sentiment: ${review.sentiment}`} />
          </div>
          
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-500 mt-2 font-mono">
            <span className="flex items-center gap-1">
              <Building size={11} className="text-slate-600" />
              {review.hotel || 'ECCTUR Deluxe Resort'}
            </span>
            <span>&bull;</span>
            <span className="flex items-center gap-1">
              <Calendar size={11} className="text-slate-600" />
              <span>{getRelativeTime(review.date)}</span>
            </span>
          </div>
        </div>

        {/* Badges / Rating */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <StarRating rating={review.rating} />
          <div className="flex items-center gap-1.5">
            <PriorityBadge priority={review.priority} />
            <StatusBadge status={review.status} />
          </div>
        </div>
      </div>

      {/* Review preview text (limited to 2 lines) */}
      <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
        "{review.comment}"
      </p>

      {/* Department badges */}
      {review.departments && review.departments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-white/[0.03] pt-3">
          {review.departments.map((dept, i) => (
            <span
              key={i}
              className="px-2.5 py-0.5 rounded-full bg-blue-500/5 border border-blue-500/10 text-[9px] font-semibold text-blue-400 tracking-wide uppercase"
            >
              {dept}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

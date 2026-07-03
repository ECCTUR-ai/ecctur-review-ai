import React from 'react';
import { Review } from '@/types';
import { StarRating } from './StarRating';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { 
  Calendar, 
  Building,
  Globe,
  Compass as TripAdvisorIcon,
  Bookmark,
  Plane,
  MessageCircle
} from 'lucide-react';

interface ReviewCardProps {
  review: Review;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export const ReviewCard = React.memo(function ReviewCard({ review, isSelected, onSelect }: ReviewCardProps) {
  // Helper to choose platform icon representation
  const getPlatformIcon = () => {
    switch (review.source) {
      case 'Google':
        return <Globe size={13} className="text-blue-600" />;
      case 'TripAdvisor':
        return <TripAdvisorIcon size={13} className="text-emerald-600" />;
      case 'Booking':
        return <Bookmark size={13} className="text-sky-600" />;
      case 'Expedia':
        return <Plane size={13} className="text-amber-600" />;
      default:
        return <MessageCircle size={13} className="text-slate-500" />;
    }
  };

  // Helper for relative time calculation
  const getRelativeTime = (dateStr: string) => {
    try {
      const diff = Date.now() - new Date(dateStr).getTime();
      const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) return 'Bugün';
      if (diffDays === 1) return 'Dün';
      if (diffDays < 7) return `${diffDays} gün önce`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} hafta önce`;
      return `${Math.floor(diffDays / 30)} ay önce`;
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div
      onClick={() => onSelect(review.id)}
      className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col gap-3 group relative ${
        isSelected
          ? 'bg-blue-50/50 border-blue-200 shadow-sm shadow-blue-500/5'
          : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-md hover:shadow-slate-100'
      }`}
    >
      {/* Top row: Platform, name, date */}
      <div className="flex justify-between items-start gap-4">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-colors ${
            isSelected 
              ? 'bg-white border-blue-100' 
              : 'bg-slate-50 border-slate-100 group-hover:bg-white group-hover:border-slate-200'
          }`}>
            {getPlatformIcon()}
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 line-clamp-1">
              {review.guestName}
            </h4>
            <div className="flex items-center gap-1 text-[10.5px] text-slate-500 font-medium">
              <Calendar size={11} className="text-slate-400" />
              <span>{getRelativeTime(review.date)}</span>
            </div>
          </div>
        </div>

        {/* Badges / Rating */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <StarRating rating={review.rating} />
          <div className="flex items-center gap-1.5">
            <PriorityBadge priority={review.priority} />
            <StatusBadge status={review.status} />
            {((review as any).google_reply_status === 'published' || (review as any).google_reply_status === 'mock_published') && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-blue-50 text-blue-700 border-blue-200">
                Google'da Yayınlandı
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Review comments */}
      <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 italic">
        "{review.comment}"
      </p>

      {/* Department tags */}
      {review.departments && review.departments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
          {review.departments.map((dept, i) => (
            <span
              key={i}
              className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-[9px] font-bold text-blue-600 tracking-wide uppercase"
            >
              {dept}
            </span>
          ))}
        </div>
      )}
    </div>
  );
});

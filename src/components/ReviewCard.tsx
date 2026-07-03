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
  onClick: () => void;
}

export function ReviewCard({ review, isSelected, onClick }: ReviewCardProps) {
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

  // Sentiment dot styles
  const getSentimentDot = () => {
    switch (review.sentiment) {
      case 'positive':
        return 'bg-emerald-500 ring-2 ring-emerald-100';
      case 'negative':
        return 'bg-rose-500 ring-2 ring-rose-100';
      default:
        return 'bg-amber-500 ring-2 ring-amber-100';
    }
  };

  // Sentiment strip colors
  const getSentimentStrip = () => {
    switch (review.sentiment) {
      case 'positive':
        return 'bg-emerald-500';
      case 'negative':
        return 'bg-rose-500';
      default:
        return 'bg-amber-500';
    }
  };

  return (
    <div
      onClick={onClick}
      className={`p-5 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col justify-between gap-4 relative overflow-hidden transform hover:-translate-y-0.5 ${
        isSelected
          ? 'bg-blue-50/50 border-blue-200 shadow-md shadow-blue-500/5'
          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-lg shadow-sm'
      }`}
    >
      {/* Sentiment indicator strip */}
      <div className={`absolute top-0 left-0 right-0 h-[3px] w-full ${getSentimentStrip()}`} />

      {/* Card Header */}
      <div className="flex justify-between items-start gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-800 text-sm tracking-tight">{review.guestName}</span>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-50 border border-slate-100 text-[10px] text-slate-600 font-medium">
              {getPlatformIcon()}
              <span>{review.source}</span>
            </div>
            
            {/* Sentiment indicator dot */}
            <span className={`w-2.5 h-2.5 rounded-full ${getSentimentDot()}`} title={`Duygu Analizi: ${review.sentiment}`} />
          </div>
          
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10.5px] text-slate-500 font-medium">
            <span className="flex items-center gap-1">
              <Building size={11} className="text-slate-400" />
              {review.hotel || 'Demo Hotel'}
            </span>
            <span>&bull;</span>
            <span className="flex items-center gap-1">
              <Calendar size={11} className="text-slate-400" />
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
}

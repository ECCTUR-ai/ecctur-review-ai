import React, { useState } from 'react';
import { Review } from '@/types';
import { reviewService } from '@/services/reviewService';
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
  MessageCircle,
  Sun,
  Sparkles,
  Eye,
  ChevronDown,
  ChevronUp,
  Languages,
  ArrowRight,
  Loader2,
  Check,
  RefreshCw
} from 'lucide-react';
import { getPlatformLabel, getPlatformColorClass } from '@/utils/platform';

interface ReviewCardProps {
  review: Review;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onGenerateAiReply?: (id: string) => Promise<string>;
  onPublishReply?: (id: string, replyText: string) => Promise<void>;
}

export const ReviewCard = React.memo(function ReviewCard({ 
  review, 
  isSelected, 
  onSelect,
  onGenerateAiReply,
  onPublishReply
}: ReviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [translationLang, setTranslationLang] = useState<'tr' | 'en' | 'ru' | null>(null);
  const [translationText, setTranslationText] = useState<string | null>(null);
  
  // AI Response states
  const [showAiDrawer, setShowAiDrawer] = useState(false);
  const [aiReplyText, setAiReplyText] = useState(review.response || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);

  const getPlatformIcon = () => {
    switch (review.source as any) {
      case 'Google':
        return <Globe size={13} className="text-blue-600" />;
      case 'TripAdvisor':
        return <TripAdvisorIcon size={13} className="text-emerald-600" />;
      case 'Booking':
      case 'Booking.com':
        return <Bookmark size={13} className="text-sky-600" />;
      case 'Expedia':
        return <Plane size={13} className="text-amber-600" />;
      case 'HolidayCheck':
        return <Sun size={13} className="text-rose-500" />;
      case 'Hotels.com':
        return <Building size={13} className="text-indigo-500" />;
      default:
        return <MessageCircle size={13} className="text-slate-500" />;
    }
  };

  const getPlatformBadge = () => {
    const rawPlat = review.source || (review as any).platform || '';
    const name = getPlatformLabel(rawPlat);
    const colorClass = getPlatformColorClass(rawPlat);
    
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border transition-colors ${colorClass}`}>
        {name}
      </span>
    );
  };

  const getRelativeTime = (dateStr: string) => {
    if (!dateStr) return '';
    const lower = dateStr.toLowerCase();
    if (
      lower.includes('önce') || 
      lower.includes('ago') || 
      lower.includes('month') || 
      lower.includes('year') || 
      lower.includes('day') || 
      lower.includes('week') || 
      lower.includes('monat') || 
      lower.includes('recently') || 
      lower.includes('tarih yok')
    ) {
      return dateStr;
    }

    try {
      const parsedDate = new Date(dateStr);
      if (isNaN(parsedDate.getTime())) {
        return dateStr;
      }
      const diff = Date.now() - parsedDate.getTime();
      const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) return 'Bugün';
      if (diffDays === 1) return 'Dün';
      if (diffDays < 7) return `${diffDays} gün önce`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} hafta önce`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)} ay önce`;
      
      const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
      return parsedDate.toLocaleDateString('tr-TR', options);
    } catch (e) {
      return dateStr;
    }
  };

  const getReviewDateToShow = () => {
    const rawDate = review.review_date;
    if (rawDate) {
      return getRelativeTime(rawDate);
    }
    const relativeDate = review.metadata?.display_date || review.metadata?.google_relative_date;
    if (relativeDate) {
      return relativeDate;
    }
    return 'Tarih yok';
  };

  const [isTranslating, setIsTranslating] = useState(false);

  const detectLang = () => {
    const metaLang = review.metadata?.language || review.metadata?.detected_language || review.metadata?.source_language;
    if (metaLang) {
      const parsed = String(metaLang).toUpperCase();
      if (parsed === 'TR' || parsed === 'TURKISH' || parsed === 'TUR') return 'TR';
      if (parsed === 'EN' || parsed === 'ENGLISH' || parsed === 'ENG') return 'EN';
      if (parsed === 'RU' || parsed === 'RUSSIAN' || parsed === 'RUS') return 'RU';
      if (parsed === 'DE' || parsed === 'GERMAN' || parsed === 'GER' || parsed === 'DEU') return 'DE';
    }

    const text = (review.comment || '').toLowerCase();
    if (text.includes('the ') || text.includes(' and ') || text.includes(' room ') || text.includes(' was ')) return 'EN';
    if (text.includes('было') || text.includes('отель') || text.includes('очень')) return 'RU';
    if (text.includes('das ') || text.includes(' war ') || text.includes(' ist ')) return 'DE';
    return 'TR';
  };

  const handleTranslate = async (lang: 'tr' | 'en' | 'ru') => {
    if (translationLang === lang) {
      setTranslationLang(null);
      setTranslationText(null);
      return;
    }

    const comment = review.comment || '';
    if (!comment.trim()) {
      setTranslationLang(lang);
      setTranslationText('Yorum metni bulunmuyor.');
      return;
    }

    const sourceLang = detectLang().toLowerCase();
    if (sourceLang === lang) {
      setTranslationLang(lang);
      setTranslationText(comment);
      return;
    }

    setTranslationLang(lang);
    setIsTranslating(true);
    try {
      const translated = await reviewService.translateReview(comment, lang);
      
      let finalText = translated || '';
      const isBooking = (review.source || '').toLowerCase().includes('booking');
      if (isBooking && lang === 'tr') {
        finalText = finalText
          .replace(/Liked:/gi, 'Beğenilen:')
          .replace(/Disliked:/gi, 'Beğenilmeyen:');
      }

      if (finalText.length < comment.length * 0.4 && comment.length > 50) {
        console.warn(`[Translation warning] Possible summarization detected. Target: ${lang}, output length: ${finalText.length} vs original: ${comment.length}. Falling back to original.`);
        setTranslationText(comment);
      } else {
        setTranslationText(finalText);
      }
    } catch (e) {
      console.error('[Translation API Error]', e);
      setTranslationText(comment);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleAiReplyGenerate = async () => {
    if (!onGenerateAiReply) return;
    setIsGenerating(true);
    try {
      const generated = await onGenerateAiReply(review.id);
      setAiReplyText(generated);
    } catch (e) {
      console.error(e);
      setAiReplyText("Yapay zeka yanıtı oluşturulurken bir hata oluştu.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAiReplyPublish = async () => {
    if (!onPublishReply) return;
    setIsPublishing(true);
    try {
      await onPublishReply(review.id, aiReplyText);
      setPublishSuccess(true);
      setTimeout(() => setPublishSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsPublishing(false);
    }
  };

  const normalizeReviewPlatform = (p: string) => {
    const raw = (p || '').toLowerCase();
    if (raw.includes('google')) return 'Google';
    if (raw.includes('booking')) return 'Booking.com';
    if (raw.includes('tripadvisor')) return 'TripAdvisor';
    if (raw.includes('hotels.com')) return 'Hotels.com';
    if (raw.includes('holidaycheck')) return 'HolidayCheck';
    return p;
  };

  return (
    <div
      className={`p-6 rounded-2xl border transition-all duration-350 flex flex-col gap-4 group relative bg-white border-slate-100 hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-500/[0.02] ${
        isSelected ? 'border-indigo-200 ring-2 ring-indigo-50/50 bg-indigo-50/[0.01]' : ''
      }`}
    >
      {/* Top row: Avatar, Platform, Details, Actions */}
      <div className="flex justify-between items-start gap-4 flex-wrap sm:flex-nowrap">
        {/* Left Side: Guest Info & Meta */}
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-slate-100 to-indigo-50/50 flex items-center justify-center font-bold text-slate-700 uppercase shrink-0 border border-slate-200/50 text-xs shadow-sm">
            {review.guestName ? review.guestName.split(' ').map(p => p[0]).join('').slice(0, 2) : 'G'}
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-800 line-clamp-1 flex items-center gap-1.5">
              {review.guestName}
              <span className="text-[10px] text-indigo-500 font-bold bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-100/30">
                {detectLang()}
              </span>
            </h4>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                <Calendar size={12} className="text-slate-400" />
                <span>{getReviewDateToShow()}</span>
              </div>
              {review.hotel && (
                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  <Building size={11} className="text-slate-400 shrink-0" />
                  <span className="line-clamp-1">{review.hotel}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center: Rating stars & Badge Group */}
        <div className="flex flex-col items-start sm:items-center gap-2">
          <StarRating rating={review.rating} />
          <div className="flex flex-wrap items-center gap-1.5">
            {getPlatformBadge()}
            <PriorityBadge priority={review.priority} />
            <StatusBadge status={review.status} />
          </div>
        </div>

        {/* Right Side: Action Buttons */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <button
            onClick={() => onSelect(review.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-650 hover:text-slate-800 font-bold text-xs rounded-xl border border-slate-250/50 transition-all cursor-pointer shadow-sm"
            title="İncele"
          >
            <Eye size={12} />
            <span>İncele</span>
          </button>

          <button
            onClick={() => {
              setShowAiDrawer(!showAiDrawer);
              if (!aiReplyText && !review.response) {
                handleAiReplyGenerate();
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-bold text-xs rounded-xl border transition-all cursor-pointer shadow-sm ${
              showAiDrawer
                ? 'bg-indigo-650 border-indigo-600 text-white hover:bg-indigo-500'
                : 'bg-indigo-50 border-indigo-100 text-indigo-600 hover:bg-indigo-100/70'
            }`}
          >
            <Sparkles size={12} />
            <span>AI Yanıt</span>
          </button>

          {/* Translation mini menu */}
          <div className="flex items-center bg-slate-100 border border-slate-200 rounded-xl p-0.5 shadow-inner">
            <button
              onClick={() => handleTranslate('tr')}
              className={`px-2 py-1 text-[9px] font-bold rounded-lg transition-all cursor-pointer ${
                translationLang === 'tr' ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              TR
            </button>
            <button
              onClick={() => handleTranslate('en')}
              className={`px-2 py-1 text-[9px] font-bold rounded-lg transition-all cursor-pointer ${
                translationLang === 'en' ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => handleTranslate('ru')}
              className={`px-2 py-1 text-[9px] font-bold rounded-lg transition-all cursor-pointer ${
                translationLang === 'ru' ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              RU
            </button>
          </div>
        </div>
      </div>

      {/* Review Comments Body with dynamic expansion */}
      <div className="space-y-2">
        <p className={`text-xs text-slate-650 leading-relaxed italic transition-all duration-300 ${
          isExpanded ? '' : 'line-clamp-4'
        }`}>
          "{review.comment?.trim() ? review.comment : 'Yorum metni bulunmuyor'}"
        </p>

        {review.comment && review.comment.length > 150 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[10px] text-indigo-650 hover:text-indigo-755 font-bold transition-all cursor-pointer flex items-center gap-1 focus:outline-none"
          >
            {isExpanded ? (
              <span>▲ Daha Az Göster</span>
            ) : (
              <span>▼ Devamını Gör</span>
            )}
          </button>
        )}
      </div>

      {/* Translation Accordion Panel (Google Translate styled) */}
      {(translationText || isTranslating) && (
        <div className="bg-slate-50/70 border border-slate-200/60 rounded-xl overflow-hidden animate-slide-in shadow-inner">
          <div className="flex justify-between items-center bg-slate-100/80 px-3.5 py-2 border-b border-slate-200/50 text-[10px]">
            <div className="flex items-center gap-2">
              <span className="font-black text-blue-600 tracking-tight">G</span>
              <span className="font-extrabold text-slate-700">Translate</span>
              <span className="text-slate-350">|</span>
              <span className="text-[9px] font-bold text-slate-500">
                {isTranslating ? (
                  `Çevriliyor (${translationLang?.toUpperCase()})...`
                ) : detectLang().toLowerCase() === translationLang?.toLowerCase() ? (
                  `Orijinal Metin (${translationLang?.toUpperCase()})`
                ) : (
                  `Birebir Çeviri (${translationLang?.toUpperCase()})`
                )}
              </span>
            </div>
            <button
              onClick={() => {
                setTranslationLang(null);
                setTranslationText(null);
              }}
              className="text-[9px] font-bold text-slate-550 hover:text-slate-800 hover:underline cursor-pointer"
            >
              Kapat
            </button>
          </div>
          <div className="p-3.5 text-xs text-slate-700 leading-relaxed italic">
            {isTranslating ? (
              <div className="flex items-center gap-2 text-slate-400 font-semibold py-1">
                <Loader2 size={12} className="animate-spin text-blue-500" />
                <span>Çeviriliyor...</span>
              </div>
            ) : (
              <p className="font-medium text-slate-850">
                "{translationText}"
              </p>
            )}
          </div>
        </div>
      )}

      {/* AI Reply Collapsible Drawer inside the Card */}
      {showAiDrawer && (
        <div className="bg-indigo-50/[0.15] border border-indigo-100/50 p-4 rounded-xl space-y-3.5 animate-slide-in">
          <div className="flex justify-between items-center text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
            <span className="flex items-center gap-1">
              <Sparkles size={11} />
              Yapay Zeka Yanıt Asistanı
            </span>
            <button 
              onClick={() => setShowAiDrawer(false)}
              className="text-slate-500 hover:text-slate-700 font-bold cursor-pointer"
            >
              Kapat
            </button>
          </div>

          <div className="relative">
            <textarea
              value={aiReplyText}
              onChange={(e) => setAiReplyText(e.target.value)}
              disabled={isGenerating || isPublishing}
              className="w-full min-h-[90px] p-3 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 leading-relaxed"
              placeholder="Yapay zeka yanıtı burada görüntülenecek, düzenleyebilirsiniz..."
            />
            {isGenerating && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-xl">
                <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold">
                  <Loader2 size={16} className="animate-spin" />
                  <span>Yanıt Oluşturuluyor...</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center gap-3">
            <button
              onClick={handleAiReplyGenerate}
              disabled={isGenerating || isPublishing}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw size={11} className={isGenerating ? 'animate-spin' : ''} />
              <span>Yeniden Üret</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAiDrawer(false)}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-600 font-semibold text-xs rounded-xl border border-slate-200 transition-all cursor-pointer"
              >
                İptal
              </button>
              <button
                onClick={handleAiReplyPublish}
                disabled={isGenerating || isPublishing || !aiReplyText.trim()}
                className={`px-4 py-1.5 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-white ${
                  publishSuccess
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-indigo-600 hover:bg-indigo-500'
                }`}
              >
                {isPublishing ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    <span>Yayınlanıyor...</span>
                  </>
                ) : publishSuccess ? (
                  <>
                    <Check size={12} />
                    <span>Yayınlandı!</span>
                  </>
                ) : (
                  <>
                    <span>Cevabı Yayınla</span>
                    <ArrowRight size={12} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Department tags & Sentiment */}
      {review.departments && review.departments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
          {review.departments.map((dept, i) => (
            <span
              key={i}
              className="px-2.5 py-0.5 rounded-full bg-slate-50 hover:bg-indigo-50/30 border border-slate-200/50 hover:border-indigo-100 text-[9px] font-extrabold text-slate-500 hover:text-indigo-600 tracking-wide uppercase transition-all"
            >
              {dept}
            </span>
          ))}
        </div>
      )}
    </div>
  );
});

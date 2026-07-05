import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Review, ReviewStatus } from '@/types';
import { reviewService } from '@/services/reviewService';
import { StarRating } from './StarRating';
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
  Languages,
  ArrowRight,
  Loader2,
  Check,
  RefreshCw
} from 'lucide-react';
import { getPlatformLabel } from '@/utils/platform';
import { matchesCategory } from '@/utils/categoryMappings';

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
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [translationLang, setTranslationLang] = useState<'tr' | 'en' | 'ru' | 'de' | 'fr' | 'it' | 'es' | null>(null);
  const [translationText, setTranslationText] = useState<string | null>(null);
  
  // AI Response states
  const [showAiDrawer, setShowAiDrawer] = useState(false);
  const [aiReplyText, setAiReplyText] = useState(review.response || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

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

  const detectLang = () => {
    const metaLang = review.metadata?.language || review.metadata?.detected_language || review.metadata?.source_language;
    if (metaLang) {
      const parsed = String(metaLang).toUpperCase();
      if (parsed === 'TR' || parsed === 'TURKISH' || parsed === 'TUR') return 'TR';
      if (parsed === 'EN' || parsed === 'ENGLISH' || parsed === 'ENG') return 'EN';
      if (parsed === 'RU' || parsed === 'RUSSIAN' || parsed === 'RUS') return 'RU';
      if (parsed === 'DE' || parsed === 'GERMAN' || parsed === 'GER' || parsed === 'DEU') return 'DE';
      if (parsed === 'FR' || parsed === 'FRENCH') return 'FR';
      if (parsed === 'IT' || parsed === 'ITALIAN') return 'IT';
      if (parsed === 'ES' || parsed === 'SPANISH') return 'ES';
    }

    const text = (review.comment || '').toLowerCase();
    if (text.includes('the ') || text.includes(' and ') || text.includes(' room ') || text.includes(' was ')) return 'EN';
    if (text.includes('было') || text.includes('отель') || text.includes('очень')) return 'RU';
    if (text.includes('das ') || text.includes(' war ') || text.includes(' ist ')) return 'DE';
    return 'TR';
  };

  const getCountryFlag = () => {
    const metaCountry = review.metadata?.country || review.metadata?.country_code;
    if (metaCountry) {
      const cUpper = String(metaCountry).toUpperCase();
      if (['TR', 'TURKEY', 'TÜRKIYE'].some(x => cUpper.includes(x))) return '🇹🇷';
      if (['RU', 'RUSSIA', 'RUSYA'].some(x => cUpper.includes(x))) return '🇷🇺';
      if (['DE', 'GERMANY', 'ALMANYA'].some(x => cUpper.includes(x))) return '🇩🇪';
      if (['GB', 'UK', 'ENGLAND', 'İNGİLTERE', 'US', 'USA'].some(x => cUpper.includes(x))) return '🇬🇧';
      if (['FR', 'FRANCE', 'FRANSA'].some(x => cUpper.includes(x))) return '🇫🇷';
      if (['IT', 'ITALY', 'İTALYA'].some(x => cUpper.includes(x))) return '🇮🇹';
      if (['ES', 'SPAIN', 'İSPANYA'].some(x => cUpper.includes(x))) return '🇪🇸';
    }
    
    // Inferred from language
    const lang = detectLang();
    if (lang === 'TR') return '🇹🇷';
    if (lang === 'RU') return '🇷🇺';
    if (lang === 'DE') return '🇩🇪';
    if (lang === 'EN') return '🇬🇧';
    if (lang === 'FR') return '🇫🇷';
    if (lang === 'IT') return '🇮🇹';
    if (lang === 'ES') return '🇪🇸';
    return '🌐';
  };

  const handleTranslate = async (lang: 'tr' | 'en' | 'ru' | 'de' | 'fr' | 'it' | 'es') => {
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
      const translated = await reviewService.translateReview(comment, lang as any);
      
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

  // Workflow Actions
  const handleSaveAsDraft = async () => {
    setIsPublishing(true);
    try {
      await reviewService.saveResponseDraft(review.id, aiReplyText);
      setPublishSuccess(true);
      setTimeout(() => {
        setPublishSuccess(false);
        setShowAiDrawer(false);
      }, 1000);
      if (onPublishReply) {
        await onPublishReply(review.id, aiReplyText);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleApproveReply = async () => {
    setIsPublishing(true);
    try {
      await reviewService.submitResponse(review.id, aiReplyText);
      setPublishSuccess(true);
      setTimeout(() => {
        setPublishSuccess(false);
        setShowAiDrawer(false);
      }, 1000);
      if (onPublishReply) {
        await onPublishReply(review.id, aiReplyText);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleArchiveReview = async () => {
    setIsPublishing(true);
    try {
      await reviewService.updateReviewStatus(review.id, 'archived');
      setPublishSuccess(true);
      setTimeout(() => {
        setPublishSuccess(false);
        setShowAiDrawer(false);
      }, 1000);
      if (onPublishReply) {
        await onPublishReply(review.id, aiReplyText);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleMarkAsManuallyReplied = async () => {
    setIsPublishing(true);
    try {
      await reviewService.updateReviewStatus(review.id, 'manual_replied');
      setPublishSuccess(true);
      setTimeout(() => {
        setPublishSuccess(false);
        setShowAiDrawer(false);
      }, 1000);
      if (onPublishReply) {
        await onPublishReply(review.id, aiReplyText);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsPublishing(false);
    }
  };

  // Dynamic category tags discovery
  const detectedCategories = useMemo(() => {
    const categories = [
      { key: 'yemek', label: 'Yemek & Restoran' },
      { key: 'oda', label: 'Oda Konforu' },
      { key: 'personel', label: 'Personel & Hizmet' },
      { key: 'otopark', label: 'Otopark' },
      { key: 'havuz', label: 'Havuz' },
      { key: 'plaj', label: 'Plaj' },
      { key: 'temizlik', label: 'Temizlik' },
      { key: 'klima', label: 'Klima / Teknik' },
      { key: 'konum', label: 'Konum' },
      { key: 'manzara', label: 'Manzara' }
    ];
    return categories.filter(cat => matchesCategory(review, cat.key));
  }, [review]);

  const getSentimentBadge = () => {
    const s = review.sentiment || 'neutral';
    if (s === 'positive') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-600 border border-emerald-200/50 uppercase tracking-wider">
          Pozitif
        </span>
      );
    }
    if (s === 'negative') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-600 border border-rose-200/50 uppercase tracking-wider">
          Negatif
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-600 border border-amber-200/50 uppercase tracking-wider">
        Nötr
      </span>
    );
  };

  const getPlatformLabelLocal = (plat: string) => {
    const norm = (plat || '').toLowerCase();
    if (norm.includes('google')) return 'Google';
    if (norm.includes('booking')) return 'Booking.com';
    if (norm.includes('tripadvisor')) return 'TripAdvisor';
    if (norm.includes('hotels')) return 'Hotels.com';
    if (norm.includes('holidaycheck')) return 'HolidayCheck';
    return getPlatformLabel(plat);
  };

  const getStatusBadge = () => {
    const s = review.status;
    if (s === 'approved' || s === 'published') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-55 text-emerald-700 border border-emerald-200/50 uppercase tracking-wider">
          Onaylandı
        </span>
      );
    }
    if (s === 'draft') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-55 text-indigo-700 border border-indigo-200/50 uppercase tracking-wider">
          Taslak Hazır
        </span>
      );
    }
    if (s === 'archived') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-500 border border-slate-200/50 uppercase tracking-wider">
          Arşivde
        </span>
      );
    }
    if (s === 'manual_replied') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-200 text-slate-700 border border-slate-300/50 uppercase tracking-wider">
          Manuel Cevaplandı
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-55 text-amber-700 border border-amber-200/50 uppercase tracking-wider">
        Yanıt Bekliyor
      </span>
    );
  };

  return (
    <div
      className={`p-6 rounded-3xl border transition-all duration-200 flex flex-col md:grid md:grid-cols-12 gap-6 bg-white shadow-sm border-slate-100 hover:border-indigo-150 hover:shadow-md ${
        isSelected ? 'border-indigo-200 ring-2 ring-indigo-50/50 bg-indigo-50/[0.01]' : ''
      }`}
    >
      {/* SOL KOLON (Left Column - Spans 3 cols) */}
      <div className="md:col-span-3 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-100/80 flex items-center justify-center font-bold text-slate-700 uppercase shrink-0 border border-slate-200/50 text-[11px] shadow-sm">
            {review.guestName ? review.guestName.split(' ').map(p => p[0]).join('').slice(0, 2) : 'G'}
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-slate-800 line-clamp-1 flex items-center gap-1.5">
              {review.guestName || 'Misafir'}
              <span className="text-[10px]" title="Konuk Ülkesi">{getCountryFlag()}</span>
            </h4>
            <span className="text-[10px] text-indigo-550 font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100/30">
              {detectLang()}
            </span>
          </div>
        </div>

        <div className="space-y-1.5 text-[11px] text-slate-500 font-semibold border-t border-slate-50 pt-2.5">
          <div className="flex items-center gap-1.5">
            {getPlatformIcon()}
            <span className="text-slate-700">{getPlatformLabelLocal(review.source || (review as any).platform)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar size={12} className="text-slate-400" />
            <span>{getReviewDateToShow()}</span>
          </div>
          {review.hotel && (
            <div className="flex items-center gap-1.5">
              <Building size={12} className="text-slate-400 shrink-0" />
              <span className="truncate">{review.hotel}</span>
            </div>
          )}
        </div>
      </div>

      {/* ORTA KOLON (Middle Column - Spans 6 cols) */}
      <div className="md:col-span-6 flex flex-col gap-3">
        {/* Rating Badge Row */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-amber-50 border border-amber-200/50 px-2 py-0.5 rounded-lg text-amber-700 text-xs font-extrabold shadow-sm shrink-0">
            <span>{review.rating.toFixed(1)}</span>
            <StarRating rating={review.rating} />
          </div>
          {getSentimentBadge()}
          <div className="flex items-center gap-1.5">
            <PriorityBadge priority={review.priority} />
            {review.status === 'manual_replied' && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-slate-100 text-slate-600 border border-slate-200">
                Manuel Cevaplandı
              </span>
            )}
          </div>
        </div>

        {/* Translation google-translate themed bar */}
        <div className="flex flex-wrap items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/50 w-fit">
          <span className="px-2 py-1 text-[9px] font-black text-slate-455 uppercase border-r border-slate-200/70 mr-1 flex items-center gap-0.5">
            <Languages size={10} />
            Translate
          </span>
          {(['tr', 'en', 'ru', 'de', 'fr', 'it', 'es'] as const).map(langCode => (
            <button
              key={langCode}
              onClick={() => handleTranslate(langCode)}
              className={`px-2 py-1 text-[9px] font-bold rounded-lg transition-all cursor-pointer ${
                translationLang === langCode ? 'bg-white text-indigo-650 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-750'
              }`}
            >
              {langCode.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Translation panel (accordion styled) */}
        {(translationText || isTranslating) && (
          <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl overflow-hidden animate-slide-in shadow-inner">
            <div className="flex justify-between items-center bg-slate-100/80 px-3 py-1.5 border-b border-slate-200/50 text-[9.5px]">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-700">Çeviri ({translationLang?.toUpperCase()})</span>
              </div>
              <button
                onClick={() => {
                  setTranslationLang(null);
                  setTranslationText(null);
                }}
                className="text-[9px] font-bold text-slate-505 hover:text-slate-800 hover:underline cursor-pointer"
              >
                Orijinali Göster
              </button>
            </div>
            <div className="p-3 text-[11.5px] text-slate-700 leading-relaxed italic">
              {isTranslating ? (
                <div className="flex items-center gap-2 text-slate-400 font-semibold py-1">
                  <Loader2 size={12} className="animate-spin text-indigo-600" />
                  <span>Çeviriliyor...</span>
                </div>
              ) : (
                <p className="font-medium text-slate-800">
                  "{translationText}"
                </p>
              )}
            </div>
          </div>
        )}

        {/* Comment text */}
        <div className="space-y-1.5">
          <p className={`text-xs text-slate-650 leading-relaxed italic font-medium transition-all duration-300 ${
            isExpanded ? '' : 'line-clamp-4'
          }`}>
            "{review.comment?.trim() ? review.comment : 'Yorum metni bulunmuyor'}"
          </p>

          {review.comment && review.comment.length > 150 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[10px] text-indigo-600 hover:text-indigo-750 font-bold transition-all cursor-pointer flex items-center gap-1 focus:outline-none"
            >
              {isExpanded ? (
                <span>▲ Daha Az Göster</span>
              ) : (
                <span>▼ Devamını Gör</span>
              )}
            </button>
          )}
        </div>

        {/* Dynamic Category Tags */}
        {detectedCategories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-t border-slate-50 pt-2.5 mt-1">
            {detectedCategories.map(cat => (
              <button
                key={cat.key}
                onClick={() => navigate(`/reviews?category=${cat.key}`)}
                className="px-2.5 py-0.5 rounded-full bg-slate-50 hover:bg-indigo-50 border border-slate-200/60 hover:border-indigo-200 text-[9px] font-bold text-slate-550 hover:text-indigo-650 transition-all cursor-pointer uppercase tracking-wider"
              >
                #{cat.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* SAĞ KOLON (Right Column - Spans 3 cols) */}
      <div className="md:col-span-3 flex flex-col justify-between items-end gap-4">
        {/* Buttons row */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSelect(review.id)}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition-all cursor-pointer shadow-sm"
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
            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm shadow-indigo-500/10"
          >
            <Sparkles size={12} />
            <span>AI Yanıt</span>
          </button>

          <button
            onClick={() => onSelect(review.id)}
            className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-850 rounded-xl border border-slate-200 transition-all cursor-pointer shadow-sm flex items-center justify-center shrink-0 w-8 h-8 font-extrabold"
            title="Seçenekler"
          >
            •••
          </button>
        </div>

        {/* Status card at the bottom */}
        <div className="text-right border-t border-slate-50 pt-2.5 w-full flex flex-col items-end gap-1">
          {getStatusBadge()}
          {review.respondedAt && (
            <span className="text-[9px] text-slate-400 font-medium block">
              {new Date(review.respondedAt).toLocaleDateString('tr-TR')}
            </span>
          )}
        </div>
      </div>

      {/* AI Reply Right Slide-Over Drawer Overlay */}
      {showAiDrawer && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-xs transition-opacity animate-fade-in" 
            onClick={() => setShowAiDrawer(false)} 
          />
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            {/* Panel */}
            <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between p-6 border-l border-slate-200 animate-slide-in-right">
              <div className="space-y-6 flex-1 overflow-y-auto pr-1">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                  <h3 className="text-xs font-black text-slate-800 flex items-center gap-2 m-0 uppercase tracking-wider">
                    <Sparkles className="text-purple-600" size={14} />
                    <span>Yapay Zeka Yanıt Asistanı</span>
                  </h3>
                  <button 
                    onClick={() => setShowAiDrawer(false)}
                    className="text-slate-400 hover:text-slate-655 font-bold cursor-pointer text-xs focus:outline-none"
                  >
                    Kapat
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-[11px] text-slate-600 space-y-1.5">
                    <span className="font-extrabold text-slate-700 block">Misafir Yorumu:</span>
                    <p className="italic leading-relaxed">"{review.comment}"</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Yapay Zeka Taslak Cevabı</label>
                    <textarea
                      value={aiReplyText}
                      onChange={(e) => setAiReplyText(e.target.value)}
                      disabled={isGenerating || isPublishing}
                      className="w-full min-h-[160px] p-3 text-xs bg-white border border-slate-200 rounded-2xl focus:outline-none focus:border-purple-650 leading-relaxed shadow-inner"
                      placeholder="AI cevabı hazırlanıyor..."
                    />
                    {isGenerating && (
                      <div className="flex items-center gap-2 text-indigo-655 text-xs font-bold py-1">
                        <Loader2 size={14} className="animate-spin text-purple-600" />
                        <span>Yeni yanıt oluşturuluyor...</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 mt-4 shrink-0 space-y-3">
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center gap-2">
                    <button
                      onClick={handleAiReplyGenerate}
                      disabled={isGenerating || isPublishing}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <RefreshCw size={12} className={isGenerating ? 'animate-spin' : ''} />
                      <span>Yeniden Üret</span>
                    </button>
                    
                    <button
                      onClick={handleSaveAsDraft}
                      disabled={isGenerating || isPublishing || !aiReplyText.trim()}
                      className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-xs rounded-xl border border-slate-200 transition-all cursor-pointer"
                    >
                      Taslak Olarak Kaydet
                    </button>
                  </div>

                  <div className="flex items-center gap-2 w-full">
                    <button
                      onClick={handleMarkAsManuallyReplied}
                      disabled={isGenerating || isPublishing}
                      className="flex-1 py-2 bg-slate-105 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer text-center border border-slate-200"
                    >
                      Manuel Cevaplandı İşaretle
                    </button>
                    
                    <button
                      onClick={handleArchiveReview}
                      disabled={isGenerating || isPublishing}
                      className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-xl border border-rose-250/30 transition-all cursor-pointer"
                    >
                      Arşivle
                    </button>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => setShowAiDrawer(false)}
                      className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-600 font-semibold text-xs rounded-xl border border-slate-200 transition-all cursor-pointer"
                    >
                      İptal
                    </button>
                    <button
                      onClick={handleApproveReply}
                      disabled={isGenerating || isPublishing || !aiReplyText.trim()}
                      className={`px-5 py-2 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-white bg-indigo-600 hover:bg-indigo-500`}
                    >
                      {isPublishing ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          <span>İşleniyor...</span>
                        </>
                      ) : publishSuccess ? (
                        <>
                          <Check size={12} />
                          <span>Tamamlandı!</span>
                        </>
                      ) : (
                        <>
                          <span>Cevabı Onayla (Approve)</span>
                          <ArrowRight size={12} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

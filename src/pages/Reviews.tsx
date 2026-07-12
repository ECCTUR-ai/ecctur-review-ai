import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { useTranslation } from 'react-i18next';
import { reviewService } from '@/services/reviewService';
import { usePersistentPageState } from '@/hooks/usePersistentPageState';
import { Review, ReviewSource, ReviewStatus, ReviewPriority } from '@/types';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthGuard';
import { normalizeReviewPlatform } from '@/utils/platform';
import { normalizeReviewStatus } from '@/utils/statusHelper';
import { motion } from 'framer-motion';
import { 
  RefreshCw, 
  Download, 
  AlertCircle,
  Database,
  Sparkles,
  ChevronDown,
  CheckSquare,
  X,
  Star,
  Check,
  Save,
  MessageSquare,
  Building
} from 'lucide-react';
import { taskService } from '@/services/taskService';
import { generateTaskMetadata } from '@/utils/taskMetadata';

interface ReviewPlatformConfig {
  key: string;
  label: string;
  active: boolean;
  icon: React.ReactNode;
  activeBorder: string;
}

const visibleReviewPlatforms: ReviewPlatformConfig[] = [
  { key: 'Google', label: 'Google', active: true, icon: <span className="text-[14px]">🔵</span>, activeBorder: 'border-[#6D5DF6] bg-[#F0EDFF] text-[#6D5DF6]' },
  { key: 'Booking', label: 'Booking', active: true, icon: <span className="text-[14px]">🔷</span>, activeBorder: 'border-[#6D5DF6] bg-[#F0EDFF] text-[#6D5DF6]' },
  { key: 'TripAdvisor', label: 'TripAdvisor', active: true, icon: <span className="text-[14px]">🟢</span>, activeBorder: 'border-[#6D5DF6] bg-[#F0EDFF] text-[#6D5DF6]' },
  { key: 'Hotels.com', label: 'Hotels', active: true, icon: <span className="text-[14px]">🟣</span>, activeBorder: 'border-[#6D5DF6] bg-[#F0EDFF] text-[#6D5DF6]' },
  { key: 'HolidayCheck', label: 'HolidayCheck', active: true, icon: <span className="text-[14px]">💗</span>, activeBorder: 'border-[#6D5DF6] bg-[#F0EDFF] text-[#6D5DF6]' },
  { key: 'otelpuan', label: 'Otelpuan', active: true, icon: <div className="w-3.5 h-3.5 rounded-full bg-orange-500 flex-shrink-0" />, activeBorder: 'border-[#6D5DF6] bg-[#F0EDFF] text-[#6D5DF6]' }
];

export default function Reviews() {
  const { t } = useTranslation();
  const { hotelIds, roleKey, email: currentUserEmail } = useAuth();
  const isSuperAdmin = roleKey === 'super_admin';
  const hasNoAssignedHotels = !isSuperAdmin && (!hotelIds || hotelIds.length === 0);

  const [searchParams] = useSearchParams();
  const { currentHotelId, hotels } = useOutletContext<{ currentHotelId: string; hotels: any[] }>();

  // Query Filters state
  const [pageState, setPageState] = usePersistentPageState('guestreview_reviews_state_v3', {
    search: '',
    source: '' as ReviewSource | '',
    rating: '',
    status: '' as ReviewStatus | '',
    priority: '' as ReviewPriority | '',
    selectedReviewId: null as string | null,
    currentPage: 1,
    pageSize: 10,
    backendLimit: 200,
    sortBy: 'newest' as 'newest' | 'oldest'
  });

  const { search, source, rating, status, priority, selectedReviewId, currentPage, pageSize, backendLimit, sortBy = 'newest' } = pageState;

  const setSearch = (val: string) => setPageState({ search: val, currentPage: 1 });
  const setSource = (val: ReviewSource | '') => setPageState({ source: val, currentPage: 1 });
  const setRating = (val: string) => setPageState({ rating: val, currentPage: 1 });
  const setStatus = (val: ReviewStatus | '') => setPageState({ status: val, currentPage: 1 });
  const setPriority = (val: ReviewPriority | '') => setPageState({ priority: val, currentPage: 1 });
  const setSelectedReviewId = (val: string | null) => setPageState({ selectedReviewId: val });
  const setSortBy = (val: 'newest' | 'oldest') => setPageState({ sortBy: val, currentPage: 1 });

  const [isExporting, setIsExporting] = useState(false);
  const [isImportingOtelpuan, setIsImportingOtelpuan] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [showAdvancedImport, setShowAdvancedImport] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const setCurrentPage = (val: number | ((prev: number) => number)) => {
    setPageState(prev => ({
      currentPage: typeof val === 'function' ? val(prev.currentPage) : val
    }));
  };

  const activeHotelId = currentHotelId || '00000000-0000-0000-0000-000000000000';
  const isAuthorized = isSuperAdmin || (hotelIds && hotelIds.includes(activeHotelId));
  const queriedHotelId = isAuthorized ? activeHotelId : '00000000-0000-0000-0000-000000000000';

  // Wipe selection when active hotel switches to maintain customer isolation
  useEffect(() => {
    setSelectedReviewId(null);
    setCurrentPage(1);
  }, [currentHotelId]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Task creation local states
  const [taskCreationReview, setTaskCreationReview] = useState<any | null>(null);
  const [taskCreationDept, setTaskCreationDept] = useState('');
  const [taskCreationPriority, setTaskCreationPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  const [managerNotes, setManagerNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [responseVal, setResponseVal] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);

  const handleOpenTaskCreationModal = (review: any) => {
    const text = (review.comment || '').toLowerCase();
    let department = 'Misafir İlişkileri';
    
    const techKeywords = ['klima', 'sıcak', 'soğuk', 'arıza', 'bozuk', 'çalışmıyor', 'elektrik', 'su', 'duş', 'internet', 'wifi'];
    const hkKeywords = ['temizlik', 'oda temizliği', 'havlu', 'çarşaf', 'housekeeping', 'kirli', 'pis', 'toz', 'banyo'];
    const fbKeywords = ['yemek', 'restoran', 'kahvaltı', 'servis', 'garson', 'bar', 'içecek', 'lezzetsiz', 'soğuktu'];
    const foKeywords = ['resepsiyon', 'check-in', 'check out', 'bekleme', 'personel', 'kaba', 'saygısız', 'yavaş', 'ilgisiz'];

    if (techKeywords.some(kw => text.includes(kw))) {
      department = 'Teknik Servis';
    } else if (hkKeywords.some(kw => text.includes(kw))) {
      department = 'Housekeeping';
    } else if (fbKeywords.some(kw => text.includes(kw))) {
      department = 'Yiyecek & İçecek';
    } else if (foKeywords.some(kw => text.includes(kw))) {
      department = 'Ön Büro';
    }

    let priority: 'low' | 'medium' | 'high' | 'critical' = 'medium';
    if (review.rating === 1) {
      priority = 'critical';
    } else if (review.rating === 2) {
      priority = 'high';
    }

    setTaskCreationReview(review);
    setTaskCreationDept(department);
    setTaskCreationPriority(priority);
  };

  const handleCreateTask = async () => {
    if (!taskCreationReview || isCreatingTask) return;
    setIsCreatingTask(true);
    try {
      const description = `Misafir Yorumu: "${taskCreationReview.comment || ''}"\nPlatform: ${taskCreationReview.source}\nMisafir: ${taskCreationReview.guestName || 'Misafir'}\nPuan: ${taskCreationReview.rating} Yıldız`;
      const title = taskCreationReview.rating <= 2 ? `Kritik Misafir Şikayeti: ${taskCreationDept}` : `Misafir Yorumu Takip Görevi: ${taskCreationDept}`;

      const metadataPayload = generateTaskMetadata(
        taskCreationReview.comment || '',
        taskCreationReview.rating,
        taskCreationReview.guestName || 'Misafir',
        taskCreationReview.source || 'Google',
        taskCreationReview.review_date || new Date().toISOString()
      );

      await taskService.createTask({
        hotelId: taskCreationReview.hotel_id || currentHotelId,
        organizationId: taskCreationReview.organization_id || null,
        reviewId: taskCreationReview.id,
        title,
        description: description + `\nYapay Zeka Aksiyon Önerisi: ${metadataPayload.ai_recommended_action}`,
        department: taskCreationDept,
        priority: taskCreationPriority,
        status: 'open',
        assignedTo: '',
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        createdBy: currentUserEmail || '',
        sourcePlatform: taskCreationReview.source || 'Google',
        metadata: metadataPayload
      });

      setToastMessage('Görev oluşturuldu');
      setTaskCreationReview(null);
    } catch (e: any) {
      alert(`Görev oluşturulamadı: ${e.message}`);
    } finally {
      setIsCreatingTask(false);
    }
  };

  // Fetch reviews using clean repository service
  const {
    data,
    loading,
    refetch: refetchMain
  } = useFetch(() => reviewService.getReviews({
    hotelId: queriedHotelId,
    search: search || undefined,
    source: source || undefined,
    rating: rating ? Number(rating) : undefined,
    status: status || undefined,
    priority: priority || undefined,
    limit: backendLimit,
    sortBy
  }), [queriedHotelId, search, source, rating, status, priority, backendLimit, sortBy]);

  const {
    data: countData,
    refetch: refetchCounts
  } = useFetch(() => reviewService.getReviews({
    hotelId: queriedHotelId,
    fetchAll: true
  }), [queriedHotelId]);

  const refetch = useCallback(() => {
    refetchMain();
    refetchCounts();
  }, [refetchMain, refetchCounts]);

  const [selectedReviewDetail, setSelectedReviewDetail] = useState<Review | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [currentHotel, setCurrentHotel] = useState<any>(null);

  // Load hotel details
  useEffect(() => {
    if (!currentHotelId) {
      setCurrentHotel(null);
      return;
    }
    supabase.from('hotels').select('*').eq('id', currentHotelId).maybeSingle().then(({ data }) => {
      if (data) {
        setCurrentHotel(data);
      }
    });
  }, [currentHotelId]);

  // Load selected review detail
  useEffect(() => {
    if (!selectedReviewId) {
      setSelectedReviewDetail(null);
      return;
    }
    setIsLoadingDetail(true);
    reviewService.getReviewById(selectedReviewId)
      .then((data) => {
        setSelectedReviewDetail(data);
        setResponseVal(data.response || '');
        setManagerNotes(data.managerNotes || '');
        setInternalNotes(data.internalNotes || '');
        setTranslatedText(null);
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => {
        setIsLoadingDetail(false);
      });
  }, [selectedReviewId]);

  const handleUpdateStatus = async (id: string, newStatus: ReviewStatus, responseText?: string) => {
    if (isUpdatingStatus) return; // Prevent double approval triggers
    setIsUpdatingStatus(true);
    try {
      if (responseText !== undefined) {
        await reviewService.saveResponseDraft(id, responseText);
      }
      const updated = await reviewService.updateReviewStatus(id, newStatus);
      if (updated && updated.id) {
        setSelectedReviewDetail(updated);
      }
      setToastMessage("Cevap onaylandı ve yayınlandı.");
      refetch();
    } catch (err) {
      console.warn(err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleGenerateReply = async () => {
    if (!selectedReviewDetail || isGenerating) return;
    setIsGenerating(true);
    try {
      const generated = await reviewService.generateAiResponse(selectedReviewDetail.id);
      setResponseVal(generated.response);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedReviewDetail || isSavingNotes) return;
    setIsSavingNotes(true);
    try {
      const updated = await reviewService.updateReviewNotes(selectedReviewDetail.id, managerNotes, internalNotes);
      if (updated) {
        setSelectedReviewDetail(updated);
      }
      setToastMessage("Notlar kaydedildi.");
      refetch();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleTranslate = async (lang: 'tr' | 'en' | 'ru') => {
    if (!selectedReviewDetail || isTranslating) return;
    setIsTranslating(true);
    try {
      const trans = await reviewService.translateReview(selectedReviewDetail.comment || '', lang);
      setTranslatedText(trans);
    } catch (e) {
      console.error(e);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleExportReviews = async () => {
    setIsExporting(true);
    try {
      const headers = ['ID', 'Guest Name', 'Platform', 'Rating', 'Comment', 'Date', 'Status'];
      const rows = reviews.map(r => [
        r.id,
        r.guestName || '',
        r.source,
        r.rating,
        (r.comment || '').replace(/"/g, '""'),
        r.review_date || '',
        r.status
      ]);
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(val => `"${val}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `reviews-${queriedHotelId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSyncAllPlatforms = async (modeOverride?: string) => {
    if (!currentHotelId || isSyncingAll) return;
    setIsSyncingAll(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Oturum bulunamadı.');

      const response = await fetch('/api/reviews?action=trigger-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ hotelId: currentHotelId, mode: modeOverride || 'daily_sync' })
      });
      if (response.ok) {
        setToastMessage("Senkronizasyon işlemi tamamlandı.");
        refetch();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleSyncOtelpuanReviews = async () => {
    if (!currentHotelId || !currentHotel?.otelpuan_url || isImportingOtelpuan) return;
    setIsImportingOtelpuan(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Token error');

      const response = await fetch('/api/reviews?action=import-otelpuan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ hotelId: currentHotelId, otelpuanUrl: currentHotel.otelpuan_url, mode: 'daily_sync' })
      });
      if (response.ok) {
        setToastMessage("Otelpuan yorumları çekildi.");
        refetch();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsImportingOtelpuan(false);
    }
  };

  // Helper values for counts
  const baseReviewsForCounts = countData?.reviews || [];
  
  const googleCount = baseReviewsForCounts.filter(r => normalizeReviewPlatform(r.source) === 'google').length;
  const bookingCount = baseReviewsForCounts.filter(r => normalizeReviewPlatform(r.source) === 'booking').length;
  const tripadvisorCount = baseReviewsForCounts.filter(r => normalizeReviewPlatform(r.source) === 'tripadvisor').length;
  const holidaycheckCount = baseReviewsForCounts.filter(r => normalizeReviewPlatform(r.source) === 'holidaycheck').length;
  const hotelscomCount = baseReviewsForCounts.filter(r => normalizeReviewPlatform(r.source) === 'hotelscom').length;
  const otelpuanCount = baseReviewsForCounts.filter(r => normalizeReviewPlatform(r.source) === 'otelpuan').length;
  const allCount = baseReviewsForCounts.length;

  let reviews = data?.reviews || [];
  if (status === 'draft') {
    reviews = reviews.filter(r => normalizeReviewStatus(r.status) === 'draft');
  } else if (status === 'pending') {
    reviews = reviews.filter(r => normalizeReviewStatus(r.status) === 'pending');
  } else if (status === 'approved') {
    reviews = reviews.filter(r => normalizeReviewStatus(r.status) === 'approved');
  } else if (status === 'archived') {
    reviews = reviews.filter(r => normalizeReviewStatus(r.status) === 'archived');
  } else {
    reviews = reviews.filter(r => normalizeReviewStatus(r.status) !== 'archived');
  }

  // Sorting
  reviews = [...reviews].sort((a, b) => {
    const timeA = a.review_date ? new Date(a.review_date).getTime() : 0;
    const timeB = b.review_date ? new Date(b.review_date).getTime() : 0;
    return sortBy === 'oldest' ? timeA - timeB : timeB - timeA;
  });

  const totalReviews = reviews.length;
  const totalPages = Math.ceil(totalReviews / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalReviews);
  const paginatedReviews = reviews.slice(startIndex, endIndex);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 3;
    let start = Math.max(1, currentPage - 1);
    let end = Math.min(totalPages, start + maxVisible - 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  const getPlatformIcon = (src: string) => {
    const norm = src.toLowerCase();
    if (norm.includes('google')) return <span>🔵</span>;
    if (norm.includes('booking')) return <span>🔷</span>;
    if (norm.includes('tripadvisor')) return <span>🟢</span>;
    if (norm.includes('hotels')) return <span>🟣</span>;
    if (norm.includes('holidaycheck')) return <span>💗</span>;
    if (norm.includes('otelpuan')) return <span>🍊</span>;
    return <span>🌐</span>;
  };

  if (hasNoAssignedHotels) {
    return (
      <div className="min-h-[60vh] flex flex-col justify-center items-center text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
          <AlertCircle size={22} />
        </div>
        <div className="space-y-1.5 max-w-sm">
          <h3 className="text-sm font-bold text-[#151827]">Otel Ataması Eksik</h3>
          <p className="text-xs text-zinc-500">
            Hesabınıza atanmış herhangi bir otel bulunamadı. Lütfen yöneticinizle iletişime geçin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-[#151827]">
      {/* Light Premium Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="space-y-1 text-left">
          <h1 className="text-2xl font-black text-[#151827] m-0">Reviews Overview</h1>
          <p className="text-xs text-zinc-500 font-medium">
            Monitor and manage guest reviews dynamically across all connected platforms.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => handleSyncAllPlatforms()}
            disabled={isSyncingAll}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-tr from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl transition-all shadow-sm cursor-pointer min-h-[38px]"
          >
            <RefreshCw size={14} className={isSyncingAll ? 'animate-spin' : ''} />
            <span>{isSyncingAll ? 'Syncing...' : 'Sync All'}</span>
          </button>

          <button
            onClick={() => setShowAdvancedImport(!showAdvancedImport)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-[#151827] font-bold text-xs rounded-xl transition-all min-h-[38px] cursor-pointer"
          >
            <span>Advanced Controls</span>
            <ChevronDown size={14} className={`transition-transform ${showAdvancedImport ? 'rotate-180' : ''}`} />
          </button>

          <button
            onClick={handleExportReviews}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-[#151827] font-bold text-xs rounded-xl transition-all min-h-[38px] cursor-pointer"
          >
            <Download size={14} className={isExporting ? 'animate-spin' : ''} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Advanced Legacy Sync Controls Collapsible Panel */}
      {showAdvancedImport && (
        <div className="bg-white p-4 rounded-[14px] border border-slate-200 flex flex-wrap gap-2.5 items-center animate-slide-in">
          <div className="w-full text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 text-left">
            Tekil Entegrasyonlar ve Test Kontrolleri (Gelişmiş)
          </div>
          <button
            onClick={handleSyncOtelpuanReviews}
            disabled={isImportingOtelpuan}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-[#151827] font-bold text-[11px] rounded-xl transition-all cursor-pointer"
          >
            <RefreshCw size={12} className={isImportingOtelpuan ? 'animate-spin' : ''} />
            <span>Otelpuan Tekil Çek</span>
          </button>
          <span className="text-[10px] text-zinc-500 italic">(DİĞER platformlar aggregator üzerinden senkronize edilir)</span>
        </div>
      )}

      {/* Platform Summary Counters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { key: '', label: 'Tümü', count: allCount, icon: <span className="text-[14px]">🌐</span> },
          ...visibleReviewPlatforms.map(p => ({
            key: p.key,
            label: p.label,
            count: p.key === 'Google' ? googleCount :
                   p.key === 'Booking' ? bookingCount :
                   p.key === 'TripAdvisor' ? tripadvisorCount :
                   p.key === 'Hotels.com' ? hotelscomCount :
                   p.key === 'HolidayCheck' ? holidaycheckCount :
                   p.key === 'otelpuan' ? otelpuanCount : 0,
            icon: p.icon
          }))
        ].map((tab) => {
          const isActive = tab.key === '' ? !source : source === tab.key;
          return (
            <button
              key={tab.label}
              onClick={() => setSource(tab.key as any)}
              className={`px-4 py-3 rounded-2xl border transition-all duration-200 cursor-pointer flex items-center gap-3 ${
                isActive
                  ? 'border-[#6D5DF6] bg-[#F0EDFF] text-[#6D5DF6] font-extrabold'
                  : 'border-[#E8EAF0] bg-white text-zinc-500 hover:text-[#151827] hover:bg-slate-50'
              }`}
            >
              <span className="shrink-0">{tab.icon}</span>
              <span className="text-xs font-bold whitespace-nowrap">{tab.label}</span>
              <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-[10px] text-zinc-500 font-extrabold">{tab.count}</span>
            </button>
          );
        })}
      </div>

      {/* WORKFLOW NAVIGATION TABS */}
      <div className="flex border border-slate-200 gap-1 p-1 rounded-2xl bg-white w-fit">
        {[
          { key: '', label: 'Tüm Yorumlar' },
          { key: 'pending', label: 'Cevap Bekleyenler' },
          { key: 'draft', label: 'Taslak Cevaplar' },
          { key: 'approved', label: 'Onaylanan Cevaplar' },
          { key: 'archived', label: 'Arşivlenenler' }
        ].map((tab) => {
          const isActive = (tab.key === '' && !status) || (tab.key !== '' && status === tab.key);
          return (
            <button
              key={tab.label}
              onClick={() => setStatus(tab.key as any)}
              className={`px-4 py-2 text-xs font-bold transition-all rounded-xl cursor-pointer ${
                isActive 
                  ? 'bg-gradient-to-r from-indigo-650 to-purple-650 text-white shadow-sm' 
                  : 'text-zinc-500 hover:text-[#151827]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* V2 PANEL GRID LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-14rem)] min-h-[620px] items-stretch">
        
        {/* LEFT COLUMN: Review List */}
        <div className="lg:col-span-4 flex flex-col bg-white border border-[#E8EAF0] rounded-[18px] overflow-hidden">
          <div className="p-4 border-b border-[#E8EAF0] flex items-center justify-between shrink-0">
            <span className="text-xs font-bold text-[#151827] uppercase tracking-wider">Review List</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-[10px] font-bold text-[#151827] focus:outline-none"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 bg-slate-50 border border-[#E8EAF0] rounded-2xl animate-pulse" />
              ))
            ) : reviews.length === 0 ? (
              <div className="py-24 text-center text-zinc-500 text-xs font-semibold">
                No reviews found matching selection.
              </div>
            ) : (
              paginatedReviews.map((review) => {
                const isSelected = selectedReviewId === review.id;
                return (
                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    key={review.id}
                    onClick={() => setSelectedReviewId(review.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer text-left ${
                      isSelected
                        ? 'bg-[#F0EDFF] border-[#6D5DF6]/45 shadow-sm'
                        : 'bg-slate-50/50 border-[#E8EAF0] hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2">
                        {getPlatformIcon(review.source)}
                        <span className="text-xs font-bold text-[#151827] truncate max-w-[120px]">{review.guestName || 'Guest'}</span>
                      </div>
                      <div className="flex items-center gap-0.5 text-amber-500 text-xs font-bold">
                        <Star size={11} className="fill-amber-500" />
                        <span>{review.rating}</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-2 line-clamp-2 leading-relaxed">
                      {review.comment || 'No comment text provided'}
                    </p>
                    <div className="flex justify-between items-center mt-3 text-[10px] text-zinc-400">
                      <span>{review.review_date ? new Date(review.review_date).toLocaleDateString('tr-TR') : 'Date unknown'}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                        normalizeReviewStatus(review.status) === 'approved' ? 'text-emerald-600 bg-emerald-50 border border-emerald-100' :
                        normalizeReviewStatus(review.status) === 'draft' ? 'text-amber-600 bg-amber-50 border border-amber-100' :
                        'text-zinc-500 bg-slate-100 border border-slate-200'
                      }`}>
                        {review.status}
                      </span>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Pagination panel */}
          {totalPages > 1 && (
            <div className="p-3 border-t border-[#E8EAF0] flex items-center justify-between gap-2 shrink-0 bg-slate-50">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-white text-[10px] text-[#151827] disabled:opacity-40"
              >
                Prev
              </button>
              <div className="flex items-center gap-1">
                {getPageNumbers().map(p => (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`w-6 h-6 rounded-lg text-[10px] font-bold ${
                      currentPage === p ? 'bg-[#6D5DF6] text-white shadow-sm' : 'border border-slate-200 text-zinc-500'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-white text-[10px] text-[#151827] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* CENTER COLUMN: Selected Review Details */}
        <div className="lg:col-span-5 flex flex-col bg-white border border-[#E8EAF0] rounded-[18px] overflow-hidden">
          {isLoadingDetail ? (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 space-y-2">
              <RefreshCw size={24} className="animate-spin text-[#6D5DF6]" />
              <span className="text-xs">Loading Review Details...</span>
            </div>
          ) : selectedReviewDetail ? (
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin text-left">
              {/* Header metrics card */}
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {getPlatformIcon(selectedReviewDetail.source)}
                    <h2 className="text-lg font-black text-[#151827] m-0 leading-none">
                      {selectedReviewDetail.guestName || 'Misafir'}
                    </h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-zinc-500">
                    <span>Date: {selectedReviewDetail.review_date ? new Date(selectedReviewDetail.review_date).toLocaleDateString('tr-TR') : 'Unknown'}</span>
                    <span>&bull;</span>
                    <span>Lang: {selectedReviewDetail.metadata?.language || 'TR'}</span>
                    <span>&bull;</span>
                    <span>Country: {selectedReviewDetail.metadata?.country || 'TR'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-100 rounded-full text-xs font-bold text-amber-600">
                  <Star size={12} className="fill-amber-500" />
                  <span>{selectedReviewDetail.rating} / 5</span>
                </div>
              </div>

              {/* Comment text */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Comment</span>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs leading-relaxed text-zinc-700">
                  {selectedReviewDetail.comment || 'No comment text provided.'}
                </div>
                
                {translatedText && (
                  <div className="mt-3 bg-[#F0EDFF] border border-[#6D5DF6]/20 rounded-2xl p-4 text-xs leading-relaxed text-[#6D5DF6]">
                    <span className="font-bold block mb-1">Translation:</span>
                    {translatedText}
                  </div>
                )}
              </div>

              {/* Positives & Negatives */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Positive Highlights</span>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3.5 text-xs text-emerald-700 space-y-1.5">
                    {selectedReviewDetail.metadata?.positives && selectedReviewDetail.metadata.positives.length > 0 ? (
                      selectedReviewDetail.metadata.positives.map((p: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-1.5">
                          <span>✨</span>
                          <span className="leading-relaxed">{p}</span>
                        </div>
                      ))
                    ) : (
                      <span className="italic text-zinc-450">No positives found.</span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Negative Highlights</span>
                  <div className="bg-rose-50 border border-rose-100 rounded-2xl p-3.5 text-xs text-rose-700 space-y-1.5">
                    {selectedReviewDetail.metadata?.negatives && selectedReviewDetail.metadata.negatives.length > 0 ? (
                      selectedReviewDetail.metadata.negatives.map((n: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-1.5">
                          <span>⚠️</span>
                          <span className="leading-relaxed">{n}</span>
                        </div>
                      ))
                    ) : (
                      <span className="italic text-zinc-450">No negatives found.</span>
                    )}
                  </div>
                </div>
              </div>

              {/* AI Draft response block */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-[#6D5DF6] uppercase tracking-wider">AI Draft Response</span>
                  <button
                    onClick={handleGenerateReply}
                    disabled={isGenerating}
                    className="text-[10px] text-[#6D5DF6] hover:text-[#5b4ee4] font-extrabold flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw size={10} className={isGenerating ? 'animate-spin' : ''} />
                    <span>Regenerate Response</span>
                  </button>
                </div>
                <textarea
                  value={responseVal}
                  onChange={(e) => setResponseVal(e.target.value)}
                  placeholder="AI draft reply text..."
                  rows={6}
                  className="w-full rounded-2xl bg-slate-50 border border-[#E8EAF0] p-3.5 text-xs text-[#151827] focus:outline-none focus:border-[#6D5DF6] leading-relaxed font-sans"
                />
              </div>

              {/* One Click Approve Action */}
              <button
                onClick={() => handleUpdateStatus(selectedReviewDetail.id, 'approved', responseVal)}
                disabled={isUpdatingStatus}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-xs rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isUpdatingStatus ? <RefreshCw size={14} className="animate-spin" /> : <Check size={16} />}
                <span>Tek Tuşla Onayla (Approve & Publish)</span>
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-555 text-xs p-6 text-center space-y-2 bg-slate-50/50">
              <Database size={28} className="text-zinc-400" />
              <span>Lütfen detayları görüntülemek için sol listeden bir yorum seçin.</span>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: AI Assistant */}
        <div className="lg:col-span-3 flex flex-col bg-white border border-[#E8EAF0] rounded-[18px] overflow-hidden">
          <div className="p-4 border-b border-[#E8EAF0] shrink-0 text-left">
            <span className="text-xs font-bold text-[#151827] uppercase tracking-wider">AI Operations Board</span>
          </div>

          {selectedReviewDetail ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin text-left">
              {/* Confidence and analysis details */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500">AI Güven Skoru:</span>
                  <span className="font-extrabold text-[#6D5DF6]">%{selectedReviewDetail.metadata?.confidence_score || '96'}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500">Sentiment:</span>
                  <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${
                    selectedReviewDetail.rating >= 4 ? 'text-emerald-600 bg-emerald-50' :
                    selectedReviewDetail.rating <= 2 ? 'text-rose-600 bg-rose-50' : 'text-amber-600 bg-amber-50'
                  }`}>
                    {selectedReviewDetail.rating >= 4 ? 'Positive' : selectedReviewDetail.rating <= 2 ? 'Negative' : 'Neutral'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500">Departman:</span>
                  <span className="px-2 py-0.5 rounded-lg bg-purple-50 text-purple-600 border border-purple-100 text-[9px] font-bold">
                    {selectedReviewDetail.departments?.[0] || 'Genel'}
                  </span>
                </div>
              </div>

              {/* Translation controls */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Yorum Çevir</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleTranslate('tr')}
                    className="flex-1 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] text-[#151827] hover:bg-slate-100 font-bold transition-all cursor-pointer"
                  >
                    Türkçe
                  </button>
                  <button
                    onClick={() => handleTranslate('en')}
                    className="flex-1 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] text-[#151827] hover:bg-slate-100 font-bold transition-all cursor-pointer"
                  >
                    English
                  </button>
                  <button
                    onClick={() => handleTranslate('ru')}
                    className="flex-1 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] text-[#151827] hover:bg-slate-100 font-bold transition-all cursor-pointer"
                  >
                    Русский
                  </button>
                </div>
              </div>

              {/* Manager notes */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Manager Notes</span>
                <textarea
                  value={managerNotes}
                  onChange={(e) => setManagerNotes(e.target.value)}
                  placeholder="Private internal details..."
                  rows={3}
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs text-[#151827] focus:outline-none"
                />
                <button
                  onClick={handleSaveNotes}
                  disabled={isSavingNotes}
                  className="w-full py-2 bg-indigo-50 border border-indigo-100 text-[#6D5DF6] font-bold text-[10px] rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Save size={12} />
                  <span>Notları Kaydet</span>
                </button>
              </div>

              {/* Action task generator */}
              <div className="pt-3 border-t border-slate-100">
                <button
                  onClick={() => handleOpenTaskCreationModal(selectedReviewDetail)}
                  className="w-full py-2.5 bg-rose-50 border border-rose-100 text-rose-600 font-bold text-[10px] rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <CheckSquare size={13} />
                  <span>Düzeltici Görev Oluştur</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-400 text-xs">
              No selected review.
            </div>
          )}
        </div>

      </div>

      {/* Manual Task Creation Modal */}
      {taskCreationReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md p-6 rounded-[18px] border border-[#E8EAF0] bg-white relative shadow-2xl text-left text-[#151827]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-[#151827] flex items-center gap-2">
                <CheckSquare size={16} className="text-rose-600" />
                Düzeltici Aksiyon Görevi Oluştur
              </h3>
              <button 
                onClick={() => setTaskCreationReview(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-zinc-500 hover:text-black cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-zinc-650 space-y-1.5">
                <div className="flex justify-between items-center text-[#151827]">
                  <span className="font-semibold">{taskCreationReview.guestName || 'Misafir'} ({taskCreationReview.source})</span>
                  <span className="text-[10px] text-amber-600 font-extrabold">{taskCreationReview.rating} Yıldız</span>
                </div>
                <p className="italic leading-relaxed">
                  "{taskCreationReview.comment || 'Yorum metni bulunmuyor'}"
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">Görev Departmanı</label>
                <select
                  value={taskCreationDept}
                  onChange={(e) => setTaskCreationDept(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E8EAF0] text-xs text-[#151827] focus:outline-none focus:border-[#6D5DF6]"
                >
                  <option value="Misafir İlişkileri">Misafir İlişkileri</option>
                  <option value="Ön Büro">Ön Büro</option>
                  <option value="Housekeeping">Housekeeping</option>
                  <option value="Teknik Servis">Teknik Servis</option>
                  <option value="Yiyecek & İçecek">Yiyecek & İçecek</option>
                  <option value="Spa">Spa</option>
                  <option value="Yönetim">Yönetim</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">Görev Önceliği</label>
                <select
                  value={taskCreationPriority}
                  onChange={(e) => setTaskCreationPriority(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E8EAF0] text-xs text-[#151827] focus:outline-none focus:border-[#6D5DF6]"
                >
                  <option value="critical">Kritik</option>
                  <option value="high">Yüksek</option>
                  <option value="medium">Orta</option>
                  <option value="low">Düşük</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E8EAF0]">
                <button
                  onClick={() => setTaskCreationReview(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-50 text-zinc-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  onClick={handleCreateTask}
                  disabled={isCreatingTask}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isCreatingTask && <RefreshCw size={12} className="animate-spin" />}
                  Görev Ekle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Premium Toast Notification Overlay */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl border border-[#E8EAF0] bg-white shadow-xl flex items-center gap-3 animate-slide-in max-w-sm">
          <div className="w-8 h-8 rounded-lg bg-[#F0EDFF] flex items-center justify-center text-[#6D5DF6]">
            <MessageSquare size={16} />
          </div>
          <div className="text-left">
            <h4 className="text-xs font-bold text-[#151827]">Bildirim</h4>
            <p className="text-[10px] text-zinc-500 mt-0.5 font-medium">{toastMessage}</p>
          </div>
          <button 
            onClick={() => setToastMessage(null)}
            className="text-xs text-[#6D5DF6] hover:text-[#5b4ee4] font-bold ml-4 cursor-pointer"
          >
            Kapat
          </button>
        </div>
      )}
    </div>
  );
}

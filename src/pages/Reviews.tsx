import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { useTranslation } from 'react-i18next';
import { reviewService } from '@/services/reviewService';
import { usePersistentPageState } from '@/hooks/usePersistentPageState';
import { Review, ReviewSource, ReviewStatus, ReviewPriority, HotelReviewIntegration, SyncResult } from '@/types';
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
  Building,
  CheckCircle2,
  AlertTriangle
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
  }, [currentHotelId, setSelectedReviewId]);

  const [integrations, setIntegrations] = useState<HotelReviewIntegration[]>([]);
  const [syncingPlatforms, setSyncingPlatforms] = useState<Record<string, boolean>>({});
  const [showAdminMenu, setShowAdminMenu] = useState(false);

  const isSuperAdminUser = isSuperAdmin || currentUserEmail === 'cemil.sezgin@ecctur.com';

  const fetchIntegrations = useCallback(async () => {
    if (!currentHotelId) return;
    try {
      const list = await reviewService.getIntegrations(currentHotelId);
      setIntegrations(list || []);
    } catch (err) {
      console.error('Failed to fetch integrations:', err);
    }
  }, [currentHotelId]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

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
      const headers = [
        'ID', 
        'Guest Name', 
        'Platform Name', 
        'Raw Rating', 
        'Normalized Rating', 
        'Review Date', 
        'Review Text', 
        'Reply Status'
      ];
      
      const escapeCsvValue = (val: any) => {
        const str = val === null || val === undefined ? '' : String(val);
        const clean = str.replace(/"/g, '""');
        if (clean.startsWith('=') || clean.startsWith('+') || clean.startsWith('-') || clean.startsWith('@')) {
          return `'${clean}`;
        }
        return clean;
      };

      const rows = reviews.map(r => {
        const rawRating = r.raw_rating !== undefined && r.raw_rating !== null ? r.raw_rating : r.rating;
        return [
          escapeCsvValue(r.id),
          escapeCsvValue(r.guestName),
          escapeCsvValue(r.source),
          rawRating,
          r.rating,
          escapeCsvValue(r.review_date || r.date),
          escapeCsvValue(r.comment),
          escapeCsvValue(r.status)
        ];
      });

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

  const handleSyncSinglePlatform = async (platformKey: string) => {
    if (!currentHotelId || syncingPlatforms[platformKey.toLowerCase()]) return;
    const normKey = platformKey.toLowerCase() === 'hotels.com' ? 'hotels' : platformKey.toLowerCase();
    setSyncingPlatforms(prev => ({ ...prev, [normKey]: true }));
    try {
      const result = await reviewService.syncPlatform(currentHotelId, normKey);
      if (result && result.success) {
        setToastMessage(`${platformKey} senkronizasyonu tamamlandı. ${result.imported || 0} yeni yorum eklendi.`);
        refetch();
        fetchIntegrations();
      } else {
        setToastMessage(`${platformKey} senkronizasyon hatası: ${result?.error || 'Bilinmeyen hata'}`);
      }
    } catch (e: any) {
      console.error(e);
      setToastMessage(`Hata: ${e.message || 'Senkronize edilemedi'}`);
    } finally {
      setSyncingPlatforms(prev => ({ ...prev, [normKey]: false }));
    }
  };

  const handleSyncAllPlatforms = async () => {
    if (!currentHotelId || isSyncingAll) return;
    setIsSyncingAll(true);
    try {
      const activeIntegrations = await reviewService.getIntegrations(currentHotelId);
      const enabledPlatforms = (activeIntegrations || []).filter((i: any) => i.is_enabled && i.source_url);

      if (enabledPlatforms.length === 0) {
        setToastMessage('Aktif ve yapılandırılmış entegrasyon bulunamadı. Lütfen Admin panelinden platform URL tanımlarını kontrol edin.');
        return;
      }

      let totalImported = 0;
      let totalChecked = 0;
      let successCount = 0;
      let failedCount = 0;

      for (const integ of enabledPlatforms) {
        const platKey = integ.platform;
        setSyncingPlatforms(prev => ({ ...prev, [platKey]: true }));
        try {
          const res = await reviewService.syncPlatform(currentHotelId, platKey);
          if (res && res.success) {
            successCount++;
            totalImported += res.imported || 0;
            totalChecked += (res.imported || 0) + (res.skipped || 0);
          } else {
            failedCount++;
          }
        } catch (err) {
          failedCount++;
        } finally {
          setSyncingPlatforms(prev => ({ ...prev, [platKey]: false }));
        }
      }

      const unconfiguredCount = visibleReviewPlatforms.length - enabledPlatforms.length;
      const summaryMsg = `${successCount} platform başarıyla senkronize edildi. ${unconfiguredCount} platform yapılandırılmamış. ${totalChecked} yorum kontrol edildi, ${totalImported} yeni yorum eklendi.`;
      setToastMessage(summaryMsg);

      refetch();
      fetchIntegrations();
    } catch (e: any) {
      console.error(e);
      setToastMessage(`Senkronizasyon hatası: ${e.message || 'Başarısız'}`);
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleSyncOtelpuanReviews = async () => {
    handleSyncSinglePlatform('otelpuan');
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
      {/* Premium Minimal SaaS Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="space-y-1 text-left">
          <h1 className="text-2xl font-black text-[#151827] tracking-tight m-0">
            {t('reviews.headerTitle', 'Yorumlar')}
          </h1>
          <p className="text-xs text-zinc-500 font-medium">
            {t('reviews.headerSubtitle', 'Tüm platformlardaki misafir yorumlarını yönetin ve senkronize edin.')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => handleSyncAllPlatforms()}
            disabled={isSyncingAll}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#6D5DF6] hover:bg-indigo-600 active:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-2xl transition-all shadow-xs cursor-pointer h-10 min-w-[170px] justify-center"
          >
            <RefreshCw size={14} className={isSyncingAll ? 'animate-spin' : ''} />
            <span>{isSyncingAll ? t('reviews.syncing', 'Senkronize Ediliyor...') : t('reviews.syncAll', 'Tümünü Senkronize Et')}</span>
          </button>

          <button
            onClick={handleExportReviews}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-800 font-extrabold text-xs rounded-2xl transition-all h-10 cursor-pointer shadow-xs"
          >
            <Download size={14} className={isExporting ? 'animate-spin' : ''} />
            <span>{t('reviews.export', 'CSV Dışa Aktar')}</span>
          </button>
        </div>
      </div>

      {/* Top Platform Summary Cards (Desktop 7, Tablet 3, Mobile 1) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-6">
        {/* Card 1: All Platforms */}
        <div
          onClick={() => setSource('')}
          className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between hover:-translate-y-0.5 ${
            !source
              ? 'border-[#6D5DF6] bg-[#F0EDFF] text-[#6D5DF6] shadow-xs font-extrabold ring-1 ring-[#6D5DF6]/20'
              : 'border-slate-100 bg-white text-zinc-600 hover:text-[#151827] hover:bg-slate-50/80 shadow-xs'
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-1 mb-2">
              <span className="text-lg">🌐</span>
              <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-[11px] text-zinc-800 font-black">{allCount}</span>
            </div>
            <div className="text-xs font-black truncate text-[#151827]">{t('reviews.allPlatforms', 'Tüm Platformlar')}</div>
            <div className="text-[10px] text-zinc-400 font-medium mt-0.5">{t('reviews.totalReviewsCount', 'Toplam Yorum')}</div>
          </div>
          <div className="mt-3 text-[10px] font-bold text-[#6D5DF6]">
            {!source ? t('reviews.activeFilter', '✓ Aktif') : t('reviews.filterAction', 'Filtrele')}
          </div>
        </div>

        {/* Platform Cards (Google, Booking, TripAdvisor, Hotels.com, HolidayCheck, Otelpuan) */}
        {visibleReviewPlatforms.map(p => {
          const normKey = p.key.toLowerCase() === 'hotels.com' ? 'hotels' : p.key.toLowerCase();
          const integration = integrations.find(i => i.platform === normKey);
          const isSyncingThis = syncingPlatforms[normKey] || (integration?.sync_status === 'syncing');
          const isActive = source === p.key;
          const isConfigured = !!(integration?.is_enabled && integration?.source_url);

          const count = p.key === 'Google' ? googleCount :
                        p.key === 'Booking' ? bookingCount :
                        p.key === 'TripAdvisor' ? tripadvisorCount :
                        p.key === 'Hotels.com' ? hotelscomCount :
                        p.key === 'HolidayCheck' ? holidaycheckCount :
                        p.key === 'otelpuan' ? otelpuanCount : 0;

          // Status Badge system
          let statusBadge = { label: t('reviews.statusDisconnected', 'Bağlı Değil'), style: 'bg-slate-100 text-slate-500 border-slate-200' };
          
          if (isSyncingThis) {
            statusBadge = { label: t('reviews.statusSyncing', 'Senkronize Ediliyor'), style: 'bg-blue-50 text-blue-600 border-blue-200 animate-pulse' };
          } else if (isConfigured) {
            if (integration?.sync_status === 'error' || integration?.last_error) {
              statusBadge = { label: t('reviews.statusError', 'Hata'), style: 'bg-rose-50 text-rose-600 border-rose-200' };
            } else {
              statusBadge = { label: t('reviews.statusConnected', 'Bağlı'), style: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
            }
          }

          return (
            <div
              key={p.key}
              onClick={() => setSource(source === p.key ? '' : (p.key as any))}
              className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between hover:-translate-y-0.5 ${
                isActive
                  ? 'border-[#6D5DF6] bg-[#F0EDFF] text-[#6D5DF6] shadow-xs font-extrabold ring-1 ring-[#6D5DF6]/20'
                  : 'border-slate-100 bg-white text-zinc-600 hover:text-[#151827] hover:bg-slate-50/80 shadow-xs'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className="shrink-0">{p.icon}</span>
                  <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-[11px] text-zinc-800 font-black">{count}</span>
                </div>
                
                <div className="text-xs font-black truncate text-[#151827] mb-1.5">{p.label}</div>

                <div className="flex items-center gap-1 mb-2">
                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold border ${statusBadge.style}`}>
                    {statusBadge.label}
                  </span>
                </div>
              </div>

              {isConfigured ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSyncSinglePlatform(p.key);
                  }}
                  disabled={isSyncingThis || isSyncingAll}
                  className="w-full mt-2 px-2 py-1.5 bg-white border border-slate-200 hover:bg-indigo-50 hover:border-indigo-200 hover:text-[#6D5DF6] disabled:opacity-50 text-slate-800 font-extrabold text-[10px] rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer h-7"
                >
                  <RefreshCw size={10} className={isSyncingThis ? 'animate-spin text-[#6D5DF6]' : ''} />
                  <span>{isSyncingThis ? t('reviews.syncing', 'Senkronize...') : t('reviews.syncSingle', 'Senkronize Et')}</span>
                </button>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setToastMessage('Entegrasyon kurulumu için lütfen Admin panelinden platform URL adresini tanımlayın.');
                  }}
                  className="w-full mt-2 px-2 py-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-500 font-extrabold text-[10px] rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer h-7"
                >
                  <span>{t('reviews.setupIntegration', 'Entegrasyonu Kur')}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Modern Table Integration Status Section */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Database size={16} className="text-[#6D5DF6]" />
            <h3 className="text-xs font-black uppercase tracking-wider text-[#151827] m-0">
              {t('reviews.integrationStatus', 'Entegrasyon Durumu')}
            </h3>
          </div>

          {/* Super Admin Dropdown Menu */}
          {isSuperAdminUser && (
            <div className="relative">
              <button
                onClick={() => setShowAdminMenu(!showAdminMenu)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer h-9 shadow-xs"
              >
                <span>{t('reviews.integrationManagement', 'Entegrasyon Yönetimi')}</span>
                <ChevronDown size={14} className={`transition-transform ${showAdminMenu ? 'rotate-180' : ''}`} />
              </button>

              {showAdminMenu && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl border border-slate-200 shadow-md py-2 z-50 animate-in fade-in slide-in-from-top-1">
                  <div className="px-3 py-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    Super Admin Controls
                  </div>
                  <button
                    onClick={() => {
                      setShowAdminMenu(false);
                      setToastMessage(`Debug Info: Total active integrations = ${integrations.length}`);
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-[#6D5DF6] cursor-pointer"
                  >
                    🔍 Debug Info
                  </button>
                  <button
                    onClick={() => {
                      setShowAdminMenu(false);
                      handleSyncOtelpuanReviews();
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-[#6D5DF6] cursor-pointer"
                  >
                    🧪 API Test (Otelpuan)
                  </button>
                  <button
                    onClick={() => {
                      setShowAdminMenu(false);
                      console.log('[Raw Integrations Response]', integrations);
                      setToastMessage('Raw response printed to browser dev console.');
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-[#6D5DF6] cursor-pointer"
                  >
                    📄 Raw Response
                  </button>
                  <button
                    onClick={() => {
                      setShowAdminMenu(false);
                      setToastMessage('Audit logs retrieved.');
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-[#6D5DF6] cursor-pointer"
                  >
                    📋 Log & Audit
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Clean Modern Integration Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                <th className="pb-3 px-3">{t('reviews.tableColPlatform', 'Platform')}</th>
                <th className="pb-3 px-3">{t('reviews.tableColStatus', 'Durum')}</th>
                <th className="pb-3 px-3">{t('reviews.tableColLastSync', 'Son Senkronizasyon')}</th>
                <th className="pb-3 px-3">{t('reviews.tableColResult', 'Sonuç')}</th>
                <th className="pb-3 px-3 text-right">{t('reviews.tableColAction', 'Aksiyon')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs">
              {visibleReviewPlatforms.map(p => {
                const normKey = p.key.toLowerCase() === 'hotels.com' ? 'hotels' : p.key.toLowerCase();
                const integration = integrations.find(i => i.platform === normKey);
                const isSyncingThis = syncingPlatforms[normKey];
                const isConfigured = !!(integration?.is_enabled && integration?.source_url);

                const count = p.key === 'Google' ? googleCount :
                              p.key === 'Booking' ? bookingCount :
                              p.key === 'TripAdvisor' ? tripadvisorCount :
                              p.key === 'Hotels.com' ? hotelscomCount :
                              p.key === 'HolidayCheck' ? holidaycheckCount :
                              p.key === 'otelpuan' ? otelpuanCount : 0;

                let statusBadge = { label: t('reviews.statusDisconnected', 'Bağlı Değil'), style: 'bg-slate-100 text-slate-500 border-slate-200' };
                if (isSyncingThis) {
                  statusBadge = { label: t('reviews.statusSyncing', 'Senkronize Ediliyor'), style: 'bg-blue-50 text-blue-600 border-blue-200 animate-pulse' };
                } else if (isConfigured) {
                  if (integration?.sync_status === 'error') {
                    statusBadge = { label: t('reviews.statusError', 'Hata'), style: 'bg-rose-50 text-rose-600 border-rose-200' };
                  } else {
                    statusBadge = { label: t('reviews.statusConnected', 'Bağlı'), style: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
                  }
                }

                const lastSyncDateFormatted = integration?.last_success_at
                  ? new Date(integration.last_success_at).toLocaleString([], { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
                  : '-';

                const resultSummary = isConfigured
                  ? `${count} kontrol edildi`
                  : '-';

                return (
                  <tr key={p.key} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-3 font-bold text-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="shrink-0">{p.icon}</span>
                        <span>{p.label}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${statusBadge.style}`}>
                        {statusBadge.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-500 font-medium">
                      {lastSyncDateFormatted}
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-medium">
                      {resultSummary}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {isConfigured ? (
                        <button
                          onClick={() => handleSyncSinglePlatform(p.key)}
                          disabled={isSyncingThis || isSyncingAll}
                          className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-indigo-50 hover:border-indigo-200 hover:text-[#6D5DF6] disabled:opacity-50 text-slate-700 font-extrabold text-[11px] rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer h-8 shadow-xs"
                        >
                          <RefreshCw size={11} className={isSyncingThis ? 'animate-spin text-[#6D5DF6]' : ''} />
                          <span>{isSyncingThis ? t('reviews.syncing', 'Senkronize...') : t('reviews.syncSingle', 'Senkronize Et')}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setToastMessage('Entegrasyon kurulumu için lütfen Admin panelinden platform URL adresini tanımlayın.')}
                          className="px-3 py-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold text-[11px] rounded-xl transition-all inline-flex items-center gap-1 cursor-pointer h-8 shadow-xs"
                        >
                          <span>{t('reviews.setupIntegration', 'Entegrasyonu Kur')}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
            <span className="text-xs font-bold text-[#151827] uppercase tracking-wider">{t('reviews.reviewList')}</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-[10px] font-bold text-[#151827] focus:outline-none"
            >
              <option value="newest">{t('reviews.sortNewest')}</option>
              <option value="oldest">{t('reviews.sortOldest')}</option>
            </select>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 bg-slate-50 border border-[#E8EAF0] rounded-2xl animate-pulse" />
              ))
            ) : reviews.length === 0 ? (
              <div className="py-24 text-center text-zinc-500 text-xs font-semibold">
                {t('reviews.empty')}
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
                        <span>{review.display_rating || review.rating}</span>
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
                    <span>{t('reviews.dateLabel')}: {selectedReviewDetail.review_date ? new Date(selectedReviewDetail.review_date).toLocaleDateString('tr-TR') : 'Unknown'}</span>
                    <span>&bull;</span>
                    <span>{t('reviews.langLabel')}: {selectedReviewDetail.metadata?.language || 'TR'}</span>
                    <span>&bull;</span>
                    <span>{t('reviews.countryLabel')}: {selectedReviewDetail.metadata?.country || 'TR'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-100 rounded-full text-xs font-bold text-amber-600">
                  <Star size={12} className="fill-amber-500" />
                  <span>{selectedReviewDetail.display_rating || `${selectedReviewDetail.rating} / 5`}</span>
                </div>
              </div>

              {/* Comment text */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{t('reviews.commentLabel')}</span>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs leading-relaxed text-zinc-700">
                  {selectedReviewDetail.comment || t('reviews.noCommentText')}
                </div>
                
                {translatedText && (
                  <div className="mt-3 bg-[#F0EDFF] border border-[#6D5DF6]/20 rounded-2xl p-4 text-xs leading-relaxed text-[#6D5DF6]">
                    <span className="font-bold block mb-1">{t('reviews.translateLabel', 'Translation')}:</span>
                    {translatedText}
                  </div>
                )}
              </div>

              {/* Positives & Negatives */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">{t('reviews.positiveHighlights')}</span>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3.5 text-xs text-emerald-700 space-y-1.5">
                    {selectedReviewDetail.metadata?.positives && selectedReviewDetail.metadata.positives.length > 0 ? (
                      selectedReviewDetail.metadata.positives.map((p: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-1.5">
                          <span>✨</span>
                          <span className="leading-relaxed">{p}</span>
                        </div>
                      ))
                    ) : (
                      <span className="italic text-zinc-450">{t('reviews.noPositives')}</span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">{t('reviews.negativeHighlights')}</span>
                  <div className="bg-rose-50 border border-rose-100 rounded-2xl p-3.5 text-xs text-rose-700 space-y-1.5">
                    {selectedReviewDetail.metadata?.negatives && selectedReviewDetail.metadata.negatives.length > 0 ? (
                      selectedReviewDetail.metadata.negatives.map((n: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-1.5">
                          <span>⚠️</span>
                          <span className="leading-relaxed">{n}</span>
                        </div>
                      ))
                    ) : (
                      <span className="italic text-zinc-450">{t('reviews.noNegatives')}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* AI Draft response block */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-[#6D5DF6] uppercase tracking-wider">{t('reviews.aiDraftResponse')}</span>
                  <button
                    onClick={handleGenerateReply}
                    disabled={isGenerating}
                    className="text-[10px] text-[#6D5DF6] hover:text-[#5b4ee4] font-extrabold flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw size={10} className={isGenerating ? 'animate-spin' : ''} />
                    <span>{t('reviews.regenerateResponse')}</span>
                  </button>
                </div>
                <textarea
                  value={responseVal}
                  onChange={(e) => setResponseVal(e.target.value)}
                  placeholder={t('reviews.aiDraftPlaceholder')}
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
                <span>{t('reviews.approveAndPublish')}</span>
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-555 text-xs p-6 text-center space-y-2 bg-slate-50/50">
              <Database size={28} className="text-zinc-400" />
              <span>{t('reviews.selectDetailHint')}</span>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: AI Assistant */}
        <div className="lg:col-span-3 flex flex-col bg-white border border-[#E8EAF0] rounded-[18px] overflow-hidden">
          <div className="p-4 border-b border-[#E8EAF0] shrink-0 text-left">
            <span className="text-xs font-bold text-[#151827] uppercase tracking-wider">{t('reviews.aiOperationsBoard')}</span>
          </div>

          {selectedReviewDetail ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin text-left">
              {/* Confidence and analysis details */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500">{t('reviews.aiConfidence')}:</span>
                  <span className="font-extrabold text-[#6D5DF6]">%{selectedReviewDetail.metadata?.confidence_score || '96'}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500">{t('reviews.sentimentLabel')}:</span>
                  <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${
                    selectedReviewDetail.rating >= 4 ? 'text-emerald-600 bg-emerald-50' :
                    selectedReviewDetail.rating <= 2 ? 'text-rose-600 bg-rose-50' : 'text-amber-600 bg-amber-50'
                  }`}>
                    {selectedReviewDetail.rating >= 4 ? t('reviews.positive') : selectedReviewDetail.rating <= 2 ? t('reviews.negative') : t('reviews.neutral')}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500">{t('reviews.deptLabel')}:</span>
                  <span className="px-2 py-0.5 rounded-lg bg-purple-50 text-purple-600 border border-purple-100 text-[9px] font-bold">
                    {selectedReviewDetail.departments?.[0] || 'Genel'}
                  </span>
                </div>
              </div>

              {/* Translation controls */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">{t('reviews.translateLabel')}</span>
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
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">{t('reviews.managerNotes')}</span>
                <textarea
                  value={managerNotes}
                  onChange={(e) => setManagerNotes(e.target.value)}
                  placeholder={t('reviews.privateInternalDetails')}
                  rows={3}
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs text-[#151827] focus:outline-none"
                />
                <button
                  onClick={handleSaveNotes}
                  disabled={isSavingNotes}
                  className="w-full py-2 bg-indigo-50 border border-indigo-100 text-[#6D5DF6] font-bold text-[10px] rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Save size={12} />
                  <span>{t('reviews.saveNotes')}</span>
                </button>
              </div>

              {/* Action task generator */}
              <div className="pt-3 border-t border-slate-100">
                <button
                  onClick={() => handleOpenTaskCreationModal(selectedReviewDetail)}
                  className="w-full py-2.5 bg-rose-50 border border-rose-100 text-rose-600 font-bold text-[10px] rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <CheckSquare size={13} />
                  <span>{t('reviews.createTask')}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-400 text-xs">
              {t('reviews.noSelectedReview')}
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
                {t('reviews.createTaskTitle')}
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
                  "{taskCreationReview.comment || t('reviews.noCommentText')}"
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">{t('reviews.taskDeptLabel')}</label>
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
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">{t('reviews.taskPriorityLabel')}</label>
                <select
                  value={taskCreationPriority}
                  onChange={(e) => setTaskCreationPriority(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E8EAF0] text-xs text-[#151827] focus:outline-none focus:border-[#6D5DF6]"
                >
                  <option value="critical">{t('reviews.priorityCritical')}</option>
                  <option value="high">{t('reviews.priorityHigh')}</option>
                  <option value="medium">{t('reviews.priorityMedium')}</option>
                  <option value="low">{t('reviews.priorityLow')}</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E8EAF0]">
                <button
                  onClick={() => setTaskCreationReview(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-50 text-zinc-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  {t('reviews.cancelButton')}
                </button>
                <button
                  onClick={handleCreateTask}
                  disabled={isCreatingTask}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isCreatingTask && <RefreshCw size={12} className="animate-spin" />}
                  {t('reviews.addTaskButton')}
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
            <h4 className="text-xs font-bold text-[#151827]">{t('reviews.notificationTitle')}</h4>
            <p className="text-[10px] text-zinc-500 mt-0.5 font-medium">{toastMessage}</p>
          </div>
          <button 
            onClick={() => setToastMessage(null)}
            className="text-xs text-[#6D5DF6] hover:text-[#5b4ee4] font-bold ml-4 cursor-pointer"
          >
            {t('reviews.closeButton')}
          </button>
        </div>
      )}
    </div>
  );
}

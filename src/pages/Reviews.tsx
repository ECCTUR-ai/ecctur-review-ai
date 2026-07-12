import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { useTranslation } from 'react-i18next';
import { reviewService } from '@/services/reviewService';
import { matchesDepartment } from '@/utils/departmentMatcher';
import { usePersistentPageState } from '@/hooks/usePersistentPageState';
import { Review, ReviewSource, ReviewStatus, ReviewPriority, Hotel } from '@/types';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthGuard';
import { normalizeReviewPlatform } from '@/utils/platform';
import { matchesCategory } from '@/utils/categoryMappings';
import { normalizeReviewStatus } from '@/utils/statusHelper';
import { motion, AnimatePresence } from 'framer-motion';
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
  Languages,
  Save,
  MessageSquare,
  Activity,
  Heart,
  Frown,
  MapPin,
  Building,
  User,
  ExternalLink,
  ChevronRight
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
  { key: 'Google', label: 'Google', active: true, icon: <span className="text-[14px]">🔵</span>, activeBorder: 'border-indigo-500 bg-indigo-500/10' },
  { key: 'Booking', label: 'Booking', active: true, icon: <span className="text-[14px]">🔷</span>, activeBorder: 'border-indigo-500 bg-indigo-500/10' },
  { key: 'TripAdvisor', label: 'TripAdvisor', active: true, icon: <span className="text-[14px]">🟢</span>, activeBorder: 'border-indigo-500 bg-indigo-500/10' },
  { key: 'Hotels.com', label: 'Hotels', active: true, icon: <span className="text-[14px]">🟣</span>, activeBorder: 'border-indigo-500 bg-indigo-500/10' },
  { key: 'HolidayCheck', label: 'HolidayCheck', active: true, icon: <span className="text-[14px]">💗</span>, activeBorder: 'border-indigo-500 bg-indigo-500/10' },
  { key: 'otelpuan', label: 'Otelpuan', active: true, icon: <div className="w-3.5 h-3.5 rounded-full bg-orange-500 flex-shrink-0" />, activeBorder: 'border-indigo-500 bg-indigo-500/10' }
];

export default function Reviews() {
  const { t } = useTranslation();
  const { hotelIds, roleKey, email: currentUserEmail } = useAuth();
  const isSuperAdmin = roleKey === 'super_admin';
  const hasNoAssignedHotels = !isSuperAdmin && (!hotelIds || hotelIds.length === 0);

  const [searchParams, setSearchParams] = useSearchParams();
  const departmentParam = searchParams.get('department');
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
  const sentimentParam = searchParams.get('sentiment');
  const categoryParam = searchParams.get('category');
  const { currentHotelId, hotels } = useOutletContext<{ currentHotelId: string; hotels: any[] }>();

  // Query Filters state persisted globally
  const [pageState, setPageState, resetPageState] = usePersistentPageState('guestreview_reviews_state', {
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

  const [isSyncing, setIsSyncing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImportingOtelpuan, setIsImportingOtelpuan] = useState(false);
  const [isImportingGoogleMaps, setIsImportingGoogleMaps] = useState(false);
  const [isImportingTripadvisor, setIsImportingTripadvisor] = useState(false);
  const [isImportingBooking, setIsImportingBooking] = useState(false);
  const [isImportingHolidaycheck, setIsImportingHolidaycheck] = useState(false);
  const [isImportingHotelscom, setIsImportingHotelscom] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [showAdvancedImport, setShowAdvancedImport] = useState(false);
  
  const setCurrentPage = (val: number | ((prev: number) => number)) => {
    setPageState(prev => ({
      currentPage: typeof val === 'function' ? val(prev.currentPage) : val
    }));
  };
  const setPageSize = (val: number) => setPageState({ pageSize: val, currentPage: 1 });
  const setBackendLimit = (val: number | ((prev: number) => number)) => {
    setPageState(prev => ({
      backendLimit: typeof val === 'function' ? val(prev.backendLimit) : val
    }));
  };

  const activeHotelId = currentHotelId || '00000000-0000-0000-0000-000000000000';
  const isAuthorized = isSuperAdmin || (hotelIds && hotelIds.includes(activeHotelId));
  const queriedHotelId = isAuthorized ? activeHotelId : '00000000-0000-0000-0000-000000000000';

  useEffect(() => {
    setCurrentPage(1);
  }, [queriedHotelId, search, source, rating, status, priority]);

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
  const [isPublishing, setIsPublishing] = useState(false);
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
    if (!taskCreationReview) return;
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

      setToastMessage('Görevler modülüne eklendi');
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
    error,
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
  const [currentHotel, setCurrentHotel] = useState<Hotel | null>(null);

  // Load hotel details
  useEffect(() => {
    if (!currentHotelId) {
      setCurrentHotel(null);
      return;
    }
    supabase.from('hotels').select('*').eq('id', currentHotelId).maybeSingle().then(({ data }) => {
      if (data) {
        setCurrentHotel({
          id: data.id,
          organizationId: data.organization_id,
          name: data.name,
          createdAt: data.created_at,
          googleMapsLink: data.google_maps_url || data.google_maps_link || '',
          googleMapsUrl: data.google_maps_url || data.google_maps_link || '',
          tripadvisorUrl: data.tripadvisor_url || '',
          bookingUrl: data.booking_url || '',
          holidaycheckUrl: data.holidaycheck_url || '',
          hotelscomUrl: data.hotelscom_url || '',
          otelpuanUrl: data.otelpuan_url || '',
          address: data.address || '',
          phone: data.phone || '',
          website: data.website || ''
        });
      }
    });
  }, [currentHotelId]);

  // Sync state loaded when selection changes
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
    }
  };

  const handleGenerateReply = async () => {
    if (!selectedReviewDetail) return;
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
    if (!selectedReviewDetail) return;
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
    if (!selectedReviewDetail) return;
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
    if (!currentHotelId) return;
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
    if (!currentHotelId || !currentHotel?.otelpuanUrl) return;
    setIsImportingOtelpuan(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Token error');

      const response = await fetch('/api/reviews?action=import-otelpuan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ hotelId: currentHotelId, otelpuanUrl: currentHotel.otelpuanUrl, mode: 'daily_sync' })
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
  const fullReviewsForCounts = countData?.reviews || [];
  let baseReviewsForCounts = fullReviewsForCounts;
  
  if (status === 'archived') {
    baseReviewsForCounts = baseReviewsForCounts.filter(r => normalizeReviewStatus(r.status) === 'archived');
  } else if (status === 'pending') {
    baseReviewsForCounts = baseReviewsForCounts.filter(r => normalizeReviewStatus(r.status) === 'pending');
  } else if (status === 'draft') {
    baseReviewsForCounts = baseReviewsForCounts.filter(r => normalizeReviewStatus(r.status) === 'draft');
  } else if (status === 'approved') {
    baseReviewsForCounts = baseReviewsForCounts.filter(r => normalizeReviewStatus(r.status) === 'approved');
  } else {
    baseReviewsForCounts = baseReviewsForCounts.filter(r => normalizeReviewStatus(r.status) !== 'archived');
  }

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

  // Sorting dates
  reviews = [...reviews].sort((a, b) => {
    const hasDateA = !!a.review_date;
    const hasDateB = !!b.review_date;
    if (!hasDateA && !hasDateB) {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return sortBy === 'oldest' ? timeA - timeB : timeB - timeA;
    }
    if (!hasDateA) return 1;
    if (!hasDateB) return -1;
    const timeA = new Date(a.review_date!).getTime();
    const timeB = new Date(b.review_date!).getTime();
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
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
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
          <h3 className="text-sm font-bold text-white">Otel Ataması Eksik</h3>
          <p className="text-xs text-zinc-400">
            Hesabınıza atanmış herhangi bir otel bulunamadı. Lütfen yöneticinizle iletişime geçin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Redesigned Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="space-y-1 flex-1">
          <h1 className="text-2xl font-black text-white m-0">Reviews Overview</h1>
          <p className="text-xs text-zinc-400 font-medium leading-relaxed">
            Monitor and manage guest reviews dynamically across all connected platforms.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => handleSyncAllPlatforms()}
            disabled={isSyncingAll}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-tr from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-indigo-500/15 cursor-pointer min-h-[38px]"
          >
            <RefreshCw size={14} className={isSyncingAll ? 'animate-spin' : ''} />
            <span>{isSyncingAll ? 'Syncing...' : 'Sync All'}</span>
          </button>

          <button
            onClick={() => setShowAdvancedImport(!showAdvancedImport)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-xs rounded-xl transition-all min-h-[38px] cursor-pointer"
          >
            <span>Advanced Controls</span>
            <ChevronDown size={14} className={`transition-transform ${showAdvancedImport ? 'rotate-180' : ''}`} />
          </button>

          <button
            onClick={handleExportReviews}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-semibold text-xs rounded-xl transition-all min-h-[38px] cursor-pointer"
          >
            <Download size={14} className={isExporting ? 'animate-spin' : ''} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Advanced Legacy Sync Controls Collapsible Panel */}
      {showAdvancedImport && (
        <div className="bg-white/5 p-4 rounded-[22px] border border-white/10 flex flex-wrap gap-2.5 items-center animate-slide-in">
          <div className="w-full text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
            Tekil Entegrasyonlar ve Test Kontrolleri (Gelişmiş)
          </div>
          <button
            onClick={handleSyncOtelpuanReviews}
            disabled={isImportingOtelpuan}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-[11px] rounded-xl transition-all cursor-pointer"
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
              className={`px-4 py-3 rounded-2xl border transition-all duration-200 cursor-pointer flex items-center gap-3 shadow-sm ${
                isActive
                  ? 'border-indigo-500 bg-indigo-500/10 text-white font-extrabold'
                  : 'border-white/10 text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="shrink-0">{tab.icon}</span>
              <span className="text-xs font-bold whitespace-nowrap">{tab.label}</span>
              <span className="px-2 py-0.5 rounded-lg bg-black/20 text-[10px] text-zinc-400 font-extrabold">{tab.count}</span>
            </button>
          );
        })}
      </div>

      {/* WORKFLOW NAVIGATION TABS */}
      <div className="flex border border-white/10 gap-1 p-1 rounded-2xl bg-white/5 w-fit">
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
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* V2 PANEL GRID LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-14rem)] min-h-[620px] items-stretch">
        
        {/* LEFT COLUMN: Review List (Width 30%) */}
        <div className="lg:col-span-4 flex flex-col bg-[#121216]/40 backdrop-blur-xl border border-white/10 rounded-[24px] overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
            <span className="text-xs font-bold text-white uppercase tracking-wider">Review List</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-white/5 border border-white/10 rounded-xl px-2.5 py-1 text-[10px] font-bold text-white focus:outline-none"
            >
              <option value="newest" className="bg-[#121216]">Newest</option>
              <option value="oldest" className="bg-[#121216]">Oldest</option>
            </select>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 bg-white/[0.02] border border-white/5 rounded-2xl animate-pulse" />
              ))
            ) : reviews.length === 0 ? (
              <div className="py-24 text-center text-zinc-500 text-xs">
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
                        ? 'bg-indigo-500/10 border-indigo-500/40 shadow-lg'
                        : 'bg-white/[0.02] border-white/5 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2">
                        {getPlatformIcon(review.source)}
                        <span className="text-xs font-bold text-white truncate max-w-[120px]">{review.guestName || 'Guest'}</span>
                      </div>
                      <div className="flex items-center gap-0.5 text-amber-400 text-xs font-bold">
                        <Star size={11} className="fill-amber-400" />
                        <span>{review.rating}</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-2 line-clamp-2 leading-relaxed">
                      {review.comment || 'No comment text provided'}
                    </p>
                    <div className="flex justify-between items-center mt-3 text-[10px] text-zinc-500">
                      <span>{review.review_date ? new Date(review.review_date).toLocaleDateString('tr-TR') : 'Date unknown'}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                        normalizeReviewStatus(review.status) === 'approved' ? 'text-emerald-400 bg-emerald-500/10' :
                        normalizeReviewStatus(review.status) === 'draft' ? 'text-amber-400 bg-amber-500/10' :
                        'text-zinc-500 bg-white/5'
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
            <div className="p-3 border-t border-white/10 flex items-center justify-between gap-2 shrink-0 bg-black/10">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded-lg border border-white/10 hover:bg-white/5 text-[10px] text-white disabled:opacity-40"
              >
                Prev
              </button>
              <div className="flex items-center gap-1">
                {getPageNumbers().map(p => (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`w-6 h-6 rounded-lg text-[10px] font-bold ${
                      currentPage === p ? 'bg-indigo-600 text-white' : 'border border-white/10 text-zinc-400'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded-lg border border-white/10 hover:bg-white/5 text-[10px] text-white disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* CENTER COLUMN: Selected Review Details (Width 45%) */}
        <div className="lg:col-span-5 flex flex-col bg-[#121216]/40 backdrop-blur-xl border border-white/10 rounded-[24px] overflow-hidden">
          {isLoadingDetail ? (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 space-y-2">
              <RefreshCw size={24} className="animate-spin text-indigo-400" />
              <span className="text-xs">Loading Review Details...</span>
            </div>
          ) : selectedReviewDetail ? (
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin text-left">
              {/* Header metrics card */}
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {getPlatformIcon(selectedReviewDetail.source)}
                    <h2 className="text-lg font-black text-white m-0 leading-none">
                      {selectedReviewDetail.guestName || 'Misafir'}
                    </h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-zinc-400">
                    <span>Date: {selectedReviewDetail.review_date ? new Date(selectedReviewDetail.review_date).toLocaleDateString('tr-TR') : 'Unknown'}</span>
                    <span>&bull;</span>
                    <span>Lang: {selectedReviewDetail.metadata?.language || 'TR'}</span>
                    <span>&bull;</span>
                    <span>Country: {selectedReviewDetail.metadata?.country || 'TR'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-bold text-amber-400">
                  <Star size={12} className="fill-amber-400" />
                  <span>{selectedReviewDetail.rating} / 5</span>
                </div>
              </div>

              {/* Comment text */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Comment</span>
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 text-xs leading-relaxed text-zinc-300">
                  {selectedReviewDetail.comment || 'No comment text provided.'}
                </div>
                
                {translatedText && (
                  <div className="mt-3 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-4 text-xs leading-relaxed text-indigo-300">
                    <span className="font-bold block mb-1">Translation:</span>
                    {translatedText}
                  </div>
                )}
              </div>

              {/* Positives & Negatives */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Positive Highlights</span>
                  <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-3.5 text-xs text-emerald-300 space-y-1.5">
                    {selectedReviewDetail.metadata?.positives && selectedReviewDetail.metadata.positives.length > 0 ? (
                      selectedReviewDetail.metadata.positives.map((p: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-1.5">
                          <span>✨</span>
                          <span className="leading-relaxed">{p}</span>
                        </div>
                      ))
                    ) : (
                      <span className="italic text-zinc-500">No positives found.</span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Negative Highlights</span>
                  <div className="bg-rose-500/5 border border-rose-500/10 rounded-2xl p-3.5 text-xs text-rose-300 space-y-1.5">
                    {selectedReviewDetail.metadata?.negatives && selectedReviewDetail.metadata.negatives.length > 0 ? (
                      selectedReviewDetail.metadata.negatives.map((n: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-1.5">
                          <span>⚠️</span>
                          <span className="leading-relaxed">{n}</span>
                        </div>
                      ))
                    ) : (
                      <span className="italic text-zinc-500">No negatives found.</span>
                    )}
                  </div>
                </div>
              </div>

              {/* AI Draft response block */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">AI Draft Response</span>
                  <button
                    onClick={handleGenerateReply}
                    disabled={isGenerating}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-extrabold flex items-center gap-1 cursor-pointer"
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
                  className="w-full rounded-2xl bg-white/[0.02] border border-white/10 p-3.5 text-xs text-white focus:outline-none focus:border-indigo-500 leading-relaxed font-sans"
                />
              </div>

              {/* One Click Approve Action */}
              <button
                onClick={() => handleUpdateStatus(selectedReviewDetail.id, 'approved', responseVal)}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-xs rounded-2xl transition-all shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check size={16} />
                <span>Tek Tuşla Onayla (Approve & Publish)</span>
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 text-xs p-6 text-center space-y-2">
              <Database size={28} className="text-zinc-600" />
              <span>Lütfen detayları görüntülemek için sol listeden bir yorum seçin.</span>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: AI Assistant (Width 25%) */}
        <div className="lg:col-span-3 flex flex-col bg-[#121216]/40 backdrop-blur-xl border border-white/10 rounded-[24px] overflow-hidden">
          <div className="p-4 border-b border-white/10 shrink-0 text-left">
            <span className="text-xs font-bold text-white uppercase tracking-wider">AI Operations Board</span>
          </div>

          {selectedReviewDetail ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin text-left">
              {/* Confidence and analysis details */}
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">AI Güven Skoru:</span>
                  <span className="font-extrabold text-indigo-400">%{selectedReviewDetail.metadata?.confidence_score || '96'}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">Sentiment:</span>
                  <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${
                    selectedReviewDetail.rating >= 4 ? 'text-emerald-400 bg-emerald-500/10' :
                    selectedReviewDetail.rating <= 2 ? 'text-rose-400 bg-rose-500/10' : 'text-amber-400 bg-amber-500/10'
                  }`}>
                    {selectedReviewDetail.rating >= 4 ? 'Positive' : selectedReviewDetail.rating <= 2 ? 'Negative' : 'Neutral'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">Departman:</span>
                  <span className="px-2 py-0.5 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[9px] font-bold">
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
                    className="flex-1 py-1.5 bg-white/5 border border-white/10 rounded-xl text-[10px] text-white hover:bg-white/10 font-bold transition-all cursor-pointer"
                  >
                    Türkçe
                  </button>
                  <button
                    onClick={() => handleTranslate('en')}
                    className="flex-1 py-1.5 bg-white/5 border border-white/10 rounded-xl text-[10px] text-white hover:bg-white/10 font-bold transition-all cursor-pointer"
                  >
                    English
                  </button>
                  <button
                    onClick={() => handleTranslate('ru')}
                    className="flex-1 py-1.5 bg-white/5 border border-white/10 rounded-xl text-[10px] text-white hover:bg-white/10 font-bold transition-all cursor-pointer"
                  >
                    Русский
                  </button>
                </div>
              </div>

              {/* Manager notes */}
              <div className="space-y-3 pt-3 border-t border-white/5">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Manager Notes</span>
                <textarea
                  value={managerNotes}
                  onChange={(e) => setManagerNotes(e.target.value)}
                  placeholder="Private internal details..."
                  rows={3}
                  className="w-full rounded-xl bg-white/[0.02] border border-white/10 p-2.5 text-xs text-white focus:outline-none"
                />
                <button
                  onClick={handleSaveNotes}
                  disabled={isSavingNotes}
                  className="w-full py-2 bg-indigo-600/30 hover:bg-indigo-600/40 border border-indigo-500/20 text-indigo-300 font-bold text-[10px] rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Save size={12} />
                  <span>Notları Kaydet</span>
                </button>
              </div>

              {/* Action task generator */}
              <div className="pt-3 border-t border-white/5">
                <button
                  onClick={() => handleOpenTaskCreationModal(selectedReviewDetail)}
                  className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 font-bold text-[10px] rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <CheckSquare size={13} />
                  <span>Düzeltici Görev Oluştur</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-600 text-xs">
              No selected review.
            </div>
          )}
        </div>

      </div>

      {/* Manual Task Creation Modal */}
      {taskCreationReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-white/10 bg-zinc-900/95 relative card-glow text-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <CheckSquare size={16} className="text-rose-500" />
                Düzeltici Aksiyon Görevi Oluştur
              </h3>
              <button 
                onClick={() => setTaskCreationReview(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-black/40 p-3 rounded-xl border border-white/5 text-xs text-zinc-400 space-y-1.5">
                <div className="flex justify-between items-center text-white">
                  <span className="font-semibold">{taskCreationReview.guestName || 'Misafir'} ({taskCreationReview.source})</span>
                  <span className="text-[10px] text-amber-400 font-extrabold">{taskCreationReview.rating} Yıldız</span>
                </div>
                <p className="italic leading-relaxed">
                  "{taskCreationReview.comment || 'Yorum metni bulunmuyor'}"
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">Görev Departmanı</label>
                <select
                  value={taskCreationDept}
                  onChange={(e) => setTaskCreationDept(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black border border-white/10 text-xs focus:outline-none focus:border-indigo-500 text-white"
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
                <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">Görev Önceliği</label>
                <select
                  value={taskCreationPriority}
                  onChange={(e) => setTaskCreationPriority(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black border border-white/10 text-xs focus:outline-none focus:border-indigo-500 text-white"
                >
                  <option value="critical">Kritik</option>
                  <option value="high">Yüksek</option>
                  <option value="medium">Orta</option>
                  <option value="low">Düşük</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  onClick={() => setTaskCreationReview(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 text-zinc-300 hover:bg-white/10 transition-colors"
                >
                  Vazgeç
                </button>
                <button
                  onClick={handleCreateTask}
                  disabled={isCreatingTask}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl border border-white/10 bg-[#121216]/90 backdrop-blur-xl shadow-2xl flex items-center gap-3 animate-slide-in max-w-sm">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <MessageSquare size={16} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Bildirim</h4>
            <p className="text-[10px] text-zinc-400 mt-0.5 font-medium">{toastMessage}</p>
          </div>
          <button 
            onClick={() => setToastMessage(null)}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-bold ml-4"
          >
            Kapat
          </button>
        </div>
      )}
    </div>
  );
}

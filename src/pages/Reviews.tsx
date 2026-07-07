import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { useTranslation } from 'react-i18next';
import { reviewService } from '@/services/reviewService';
import { matchesDepartment } from '@/utils/departmentMatcher';
import { ReviewCard } from '@/components/ReviewCard';
import { ReviewFilters } from '@/components/ReviewFilters';
import { ReviewDetailPanel } from '@/components/ReviewDetailPanel';
import { usePersistentPageState } from '@/hooks/usePersistentPageState';
import { Review, ReviewSource, ReviewStatus, ReviewPriority, Hotel } from '@/types';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthGuard';
import { normalizeReviewPlatform } from '@/utils/platform';
import { matchesCategory } from '@/utils/categoryMappings';
import { normalizeReviewStatus } from '@/utils/statusHelper';
import { 
  RefreshCw, 
  Download, 
  AlertCircle,
  Database,
  ArrowLeft,
  Bell,
  Sparkles,
  ShieldAlert,
  ChevronDown,
  CheckSquare,
  X
} from 'lucide-react';
import { taskService } from '@/services/taskService';
import { generateTaskMetadata } from '@/utils/taskMetadata';

import { hotelRepository } from '@/repositories/hotelRepository';

interface ReviewPlatformConfig {
  key: string;
  label: string;
  active: boolean;
  icon: React.ReactNode;
  activeBorder: string;
}

const visibleReviewPlatforms: ReviewPlatformConfig[] = [
  { key: 'Google', label: 'Google', active: true, icon: <span className="text-[14px]">🔵</span>, activeBorder: 'border-indigo-600 ring-2 ring-indigo-100 shadow-indigo-500/10' },
  { key: 'Booking', label: 'Booking', active: true, icon: <span className="text-[14px]">🔷</span>, activeBorder: 'border-indigo-600 ring-2 ring-indigo-100 shadow-indigo-500/10' },
  { key: 'TripAdvisor', label: 'TripAdvisor', active: true, icon: <span className="text-[14px]">🟢</span>, activeBorder: 'border-indigo-600 ring-2 ring-indigo-100 shadow-indigo-500/10' },
  { key: 'Hotels.com', label: 'Hotels', active: true, icon: <span className="text-[14px]">🟣</span>, activeBorder: 'border-indigo-600 ring-2 ring-indigo-100 shadow-indigo-500/10' },
  { key: 'HolidayCheck', label: 'HolidayCheck', active: true, icon: <span className="text-[14px]">💗</span>, activeBorder: 'border-indigo-600 ring-2 ring-indigo-100 shadow-indigo-500/10' },
  { key: 'Expedia', label: 'Expedia', active: false, icon: <span className="text-[14px]">🟡</span>, activeBorder: 'border-indigo-600 ring-2 ring-indigo-100 shadow-indigo-500/10' },
  { key: 'Airbnb', label: 'Airbnb', active: false, icon: <span className="text-[14px]">🔴</span>, activeBorder: 'border-indigo-600 ring-2 ring-indigo-100 shadow-indigo-500/10' },
  { key: 'Yelp', label: 'Yelp', active: false, icon: <span className="text-[14px]">🟥</span>, activeBorder: 'border-indigo-600 ring-2 ring-indigo-100 shadow-indigo-500/10' }
];

const isTimeoutError = (err: any, responseText?: string) => {
  const msg = String(err?.message || err || '').toLowerCase();
  const txt = String(responseText || '').toLowerCase();
  return (
    msg.includes('timeout') ||
    msg.includes('time out') ||
    msg.includes('504') ||
    msg.includes('502') ||
    msg.includes('function_invocation_timeout') ||
    txt.includes('timeout') ||
    txt.includes('time out') ||
    txt.includes('504') ||
    txt.includes('502') ||
    txt.includes('function_invocation_timeout')
  );
};

const formatImportPopupMessage = (platform: string, res: any) => {
  const modeKey = res.effectiveMode || 'initial_import';
  let modeText = 'İlk Kurulum';
  if (modeKey === 'daily_sync') {
    modeText = 'Günlük Senkronizasyon';
  } else if (modeKey === 'backfill_import') {
    modeText = 'Geçmiş Yorum Tamamlama';
  }

  const fetchedCount = res.fetchedCount !== undefined ? res.fetchedCount : 0;
  const insertedCount = res.insertedCount !== undefined ? res.insertedCount : 0;
  const duplicateCount = res.duplicateCount !== undefined ? res.duplicateCount : 0;
  const failedCount = res.failedCount !== undefined ? res.failedCount : 0;

  return `${platform} Reviews Senkronizasyonu\n\nMod:\n${modeText}\n\nToplam Kontrol Edilen: ${fetchedCount}\nYeni Eklenen: ${insertedCount}\nDuplicate Atlanan: ${duplicateCount}\nHata Sayısı: ${failedCount}`;
};

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

  // Sync / Export loading animation helper states
  const [isSyncing, setIsSyncing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isImportingGoogleMaps, setIsImportingGoogleMaps] = useState(false);
  const [isImportingTripadvisor, setIsImportingTripadvisor] = useState(false);
  const [isImportingBooking, setIsImportingBooking] = useState(false);
  const [isImportingHolidaycheck, setIsImportingHolidaycheck] = useState(false);
  const [isImportingHotelscom, setIsImportingHotelscom] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [importRange, setImportRange] = useState('365');
  
  // Pagination State Setters
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

  const paramHotelId = searchParams.get('hotelId') || searchParams.get('hotel_id');
  const activeHotelId = paramHotelId || currentHotelId || '00000000-0000-0000-0000-000000000000';
  
  // Strict tenant security check
  const isAuthorized = isSuperAdmin || (hotelIds && hotelIds.includes(activeHotelId));
  const queriedHotelId = isAuthorized ? activeHotelId : '00000000-0000-0000-0000-000000000000';

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [queriedHotelId, search, source, rating, status, priority]);

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  const [importSummary, setImportSummary] = useState<{
    totalFetched: number;
    importedCount: number;
    duplicateCount: number;
    failedCount: number;
    range: string;
    detailedErrors?: any[];
    importDetails?: any[];
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Low Rating Review to Task Automation states
  const [taskCreationReview, setTaskCreationReview] = useState<any | null>(null);
  const [taskCreationDept, setTaskCreationDept] = useState('');
  const [taskCreationPriority, setTaskCreationPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  const handleOpenTaskCreationModal = (review: any) => {
    const text = (review.comment || '').toLowerCase();
    let department = 'Misafir İlişkileri';
    
    const techKeywords = ['klima', 'sıcak', 'soğuk', 'arıza', 'bozuk', 'çalışmıyor', 'elektrik', 'su', 'duş', 'internet', 'wifi'];
    const hkKeywords = ['temizlik', 'oda temizliği', 'havlu', 'çarşaf', 'housekeeping', 'kirli', 'pis', 'toz', 'banyo'];
    const fbKeywords = ['yemek', 'restoran', 'kahvaltı', 'servis', 'garson', 'bar', 'içecek', 'lezzetsiz', 'soğuktu'];
    const foKeywords = ['resepsiyon', 'check-in', 'check out', 'bekleme', 'personel', 'kaba', 'saygısız', 'yavaş', 'ilgisiz'];
    const spaKeywords = ['spa', 'masaj', 'hamam', 'sauna'];

    if (techKeywords.some(kw => text.includes(kw))) {
      department = 'Teknik Servis';
    } else if (hkKeywords.some(kw => text.includes(kw))) {
      department = 'Housekeeping';
    } else if (fbKeywords.some(kw => text.includes(kw))) {
      department = 'Yiyecek & İçecek';
    } else if (foKeywords.some(kw => text.includes(kw))) {
      department = 'Ön Büro';
    } else if (spaKeywords.some(kw => text.includes(kw))) {
      department = 'Spa';
    }

    let priority: 'low' | 'medium' | 'high' | 'critical' = 'medium';
    if (review.rating === 1) {
      priority = 'critical';
    } else if (review.rating === 2) {
      priority = 'high';
    } else if (review.rating === 3) {
      priority = 'medium';
    }

    const criticalKeywords = ['kavga', 'hakaret', 'güvenlik', 'sağlık', 'yangın', 'hırsızlık', 'tehdit'];
    if (criticalKeywords.some(kw => text.includes(kw))) {
      priority = 'critical';
    }

    setTaskCreationReview(review);
    setTaskCreationDept(department);
    setTaskCreationPriority(priority);
  };

  const handleCreateTask = async () => {
    if (!taskCreationReview) return;
    setIsCreatingTask(true);
    try {
      const { data: existing, error: checkErr } = await supabase
        .from('tasks')
        .select('id, metadata')
        .eq('review_id', taskCreationReview.id);

      if (checkErr) {
        console.warn('Error checking duplicate task:', checkErr);
      }

      const duplicateExists = existing?.some((t: any) => {
        const meta = t.metadata || {};
        return meta.ai_action_required === true;
      });

      if (duplicateExists) {
        alert('Bu yorum için zaten oluşturulmuş bir görev bulunuyor!');
        setTaskCreationReview(null);
        setIsCreatingTask(false);
        return;
      }

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

  const [isImportingAggregator, setIsImportingAggregator] = useState(false);
  const [aggregatorResult, setAggregatorResult] = useState<any | null>(null);
  const [unifiedSyncResult, setUnifiedSyncResult] = useState<any | null>(null);
  const [lastSyncHealth, setLastSyncHealth] = useState<any | null>(null);
  const [showAdvancedImport, setShowAdvancedImport] = useState(false);

  const handleImportAggregatorReviews = async () => {
    if (!currentHotelId) {
      alert('Lütfen bir otel seçin.');
      return;
    }

    const selectedHotel = hotels?.find(h => h.id === currentHotelId);
    const googleMapsUrlFromLink = selectedHotel?.googleMapsLink;
    const googleMapsUrlFromUrl = selectedHotel?.googleMapsUrl;
    
    let dbRow: any = null;
    try {
      const { data } = await supabase
        .from('hotels')
        .select('id, name, google_maps_url, google_maps_link, google_place_id')
        .eq('id', currentHotelId)
        .maybeSingle();
      dbRow = data;
    } catch (e) {
      console.error('[DEBUG] Direct Supabase query failed:', e);
    }

    const finalUrlToSend = googleMapsUrlFromLink || googleMapsUrlFromUrl || dbRow?.google_maps_link || dbRow?.google_maps_url;
    const googlePlaceId = selectedHotel?.googlePlaceId || dbRow?.google_place_id;

    if (!finalUrlToSend && !googlePlaceId) {
      alert('Bu otel için Google Maps işletme linki veya Place ID tanımlanmamış. Lütfen Admin > Otel Yönetimi sayfasından tanımlayın.');
      return;
    }

    setIsImportingAggregator(true);
    setAggregatorResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Oturum bulunamadı.');

      const response = await fetch('/api/reviews?action=import-hotel-review-aggregator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'import-hotel-review-aggregator',
          hotelId: currentHotelId,
          googleMapsUrl: finalUrlToSend
        })
      });

      const responseText = await response.text();
      const contentType = response.headers.get('content-type') || '';
      let result: any = null;

      if (contentType.toLowerCase().includes('application/json')) {
        try {
          result = JSON.parse(responseText);
        } catch (jsonErr: any) {
          throw new Error(`JSON parse error on response: ${jsonErr.message}. Raw body: ${responseText}`);
        }
      }

      if (!response.ok) {
        throw new Error(result?.error || result?.rawResponse || responseText || `HTTP error! status: ${response.status}`);
      }

      console.log('[Reviews Page Debug] aggregator raw response:', result);
      setAggregatorResult(result);
      refetch();
    } catch (err: any) {
      console.error('[Aggregator Import Error]', err);
      setAggregatorResult({
        success: false,
        hotelName: selectedHotel?.name || '',
        provider: 'hotel-review-aggregator',
        imported: 0,
        duplicates: 0,
        skipped: 0,
        errors: [],
        rawError: err.message || String(err)
      });
    } finally {
      setIsImportingAggregator(false);
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

  // Console logs for debugging Reviews page data retrieval
  useEffect(() => {
    const selectedHotelObj = hotels?.find(h => h.id === currentHotelId);
    console.log('[Reviews Page Debug] selectedHotel.id:', currentHotelId);
    console.log('[Reviews Page Debug] selectedHotel.name:', selectedHotelObj?.name);
    console.log('[Reviews Page Debug] reviews fetch request params:', {
      hotelId: queriedHotelId,
      search: search || undefined,
      source: source || undefined,
      rating: rating ? Number(rating) : undefined,
      status: status || undefined,
      priority: priority || undefined,
      limit: backendLimit,
      sortBy
    });
    console.log('[Reviews Page Debug] reviews fetch response count:', data?.reviews?.length ?? 0);
    console.log('[Reviews Page Debug] First 3 review records:', data?.reviews?.slice(0, 3) ?? []);
  }, [currentHotelId, hotels, queriedHotelId, search, source, rating, status, priority, backendLimit, sortBy, data]);

  useEffect(() => {
    console.log('[Reviews Page Debug] modal result state (aggregatorResult):', aggregatorResult);
  }, [aggregatorResult]);

  // Trigger automatic sync from dashboard redirect
  useEffect(() => {
    if (searchParams.get('triggerSync') === 'true' && currentHotelId && !isSyncingAll) {
      const url = new URL(window.location.href);
      url.searchParams.delete('triggerSync');
      window.history.replaceState(null, '', url.pathname + url.search);
      handleSyncAllPlatforms();
    }
  }, [searchParams, currentHotelId, isSyncingAll]);

  // Load last sync health status from localStorage
  useEffect(() => {
    if (currentHotelId) {
      try {
        const stored = localStorage.getItem(`sync_health_${currentHotelId}`);
        if (stored) {
          setLastSyncHealth(JSON.parse(stored));
        } else {
          setLastSyncHealth(null);
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, [currentHotelId, unifiedSyncResult]);

  // One-time repair backfill trigger
  useEffect(() => {
    const triggerBackfill = async () => {
      const hasBackfilled = localStorage.getItem('backfill_google_dates_done');
      if (hasBackfilled) return;
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        console.log('[Backfill] Triggering one-time Google reviews date repair...');
        const response = await fetch('/api/reviews?action=backfill-google-dates', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
        const result = await response.json();
        console.log('[Backfill] Result:', result);
        if (result.success) {
          localStorage.setItem('backfill_google_dates_done', 'true');
          // Refetch reviews list to show the repaired dates immediately
          refetchMain();
        }
      } catch (err) {
        console.error('[Backfill] Trigger failed:', err);
      }
    };

    triggerBackfill();
  }, [refetchMain]);

  // Fetch count base list with only hotelId to calculate platform tab counts
  const {
    data: countData,
    refetch: refetchCounts
  } = useFetch(() => reviewService.getReviews({
    hotelId: queriedHotelId,
    limit: 1000
  }), [queriedHotelId]);

  const refetch = useCallback(() => {
    refetchMain();
    refetchCounts();
  }, [refetchMain, refetchCounts]);

  if (hasNoAssignedHotels) {
    return (
      <div className="min-h-[60vh] flex flex-col justify-center items-center text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
          <ShieldAlert size={22} />
        </div>
        <div className="space-y-1.5 max-w-sm">
          <h3 className="text-sm font-bold text-slate-200">Otel Ataması Eksik</h3>
          <p className="text-xs text-slate-400">
            Hesabınıza atanmış herhangi bir otel bulunamadı. Lütfen yöneticinizle iletişime geçin.
          </p>
        </div>
      </div>
    );
  }

  // Supabase Realtime insertion listener
  useEffect(() => {
    if (!currentHotelId) return;

    const channel = supabase
      .channel('reviews-page-realtime-reviews')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reviews' },
        (payload: any) => {
          if (payload.new?.hotel_id !== currentHotelId) return;

          const platform = payload.new?.source || 'Google';
          setToastMessage(`New ${platform} Review Received`);
          refetch();

          // Auto dismiss toast after 4 seconds
          setTimeout(() => {
            setToastMessage(null);
          }, 4000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentHotelId, refetch]);

  const [selectedReviewDetail, setSelectedReviewDetail] = useState<Review | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [currentHotel, setCurrentHotel] = useState<Hotel | null>(null);

  // Load selected hotel info directly from database to get fresh values
  useEffect(() => {
    if (!currentHotelId) {
      setCurrentHotel(null);
      return;
    }
    
    const fetchHotelDetails = async () => {
      try {
        const { data, error } = await supabase
          .from('hotels')
          .select('id, organization_id, name, created_at, google_maps_url, google_maps_link, tripadvisor_url, booking_url, holidaycheck_url, address, phone, website')
          .eq('id', currentHotelId)
          .maybeSingle();

        if (error) throw error;
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
            address: data.address || '',
            phone: data.phone || '',
            website: data.website || ''
          });
        }
      } catch (err) {
        console.error('Failed to load current hotel for details:', err);
      }
    };

    fetchHotelDetails();
  }, [currentHotelId]);

  // Log TripAdvisor URL details on state changes
  useEffect(() => {
    console.log('[DEBUG-TRIPADVISOR]', {
      currentHotel,
      tripadvisorUrl: currentHotel?.tripadvisorUrl
    });
  }, [currentHotel]);

  // Load full review details from Supabase when selectedReviewId changes
  useEffect(() => {
    if (!selectedReviewId) {
      setSelectedReviewDetail(null);
      return;
    }
    setIsLoadingDetail(true);
    reviewService.getReviewById(selectedReviewId)
      .then((data) => {
        setSelectedReviewDetail(data);
      })
      .catch((err) => {
        console.error('Failed to fetch full review details:', err);
      })
      .finally(() => {
        setIsLoadingDetail(false);
      });
  }, [selectedReviewId]);

  const fullReviewsForCounts = countData?.reviews || [];
  
  // Apply date and department filters to the count base so counts match active date/dept filters
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
  if (fromParam || toParam) {
    const startLimit = fromParam ? new Date(fromParam) : new Date(0);
    const endLimit = toParam ? new Date(toParam) : new Date();
    endLimit.setHours(23, 59, 59);
    baseReviewsForCounts = baseReviewsForCounts.filter(r => {
      if (!r.date) return false;
      const rDate = new Date(r.date);
      return rDate >= startLimit && rDate <= endLimit;
    });
  }
  if (departmentParam) {
    baseReviewsForCounts = baseReviewsForCounts.filter(r => matchesDepartment(r, departmentParam));
  }
  if (sentimentParam) {
    baseReviewsForCounts = baseReviewsForCounts.filter((r: any) => {
      if (sentimentParam === 'positive') return r.rating >= 4;
      if (sentimentParam === 'negative') return r.rating <= 3;
      return true;
    });
  }
  if (categoryParam) {
    baseReviewsForCounts = baseReviewsForCounts.filter((r: any) => matchesCategory(r, categoryParam));
  }

  const googleCount = baseReviewsForCounts.filter(r => normalizeReviewPlatform(r.source) === 'google').length;
  const tripadvisorCount = baseReviewsForCounts.filter(r => normalizeReviewPlatform(r.source) === 'tripadvisor').length;
  const bookingCount = baseReviewsForCounts.filter(r => normalizeReviewPlatform(r.source) === 'booking').length;
  const holidaycheckCount = baseReviewsForCounts.filter(r => normalizeReviewPlatform(r.source) === 'holidaycheck').length;
  const hotelscomCount = baseReviewsForCounts.filter(r => normalizeReviewPlatform(r.source) === 'hotelscom').length;
  const expediaCount = baseReviewsForCounts.filter(r => normalizeReviewPlatform(r.source) === 'expedia').length;
  const airbnbCount = baseReviewsForCounts.filter(r => normalizeReviewPlatform(r.source) === 'airbnb').length;
  const yelpCount = baseReviewsForCounts.filter(r => normalizeReviewPlatform(r.source) === 'yelp').length;
  const otherCount = baseReviewsForCounts.filter(r => {
    const normalized = normalizeReviewPlatform(r.source);
    return normalized !== 'google' && normalized !== 'tripadvisor' && normalized !== 'booking' && normalized !== 'holidaycheck' && normalized !== 'hotelscom' && normalized !== 'expedia' && normalized !== 'airbnb' && normalized !== 'yelp';
  }).length;

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

  // Filter reviews by date query parameters if present (passed from Reports dashboard click)
  if (fromParam || toParam) {
    const startLimit = fromParam ? new Date(fromParam) : new Date(0);
    const endLimit = toParam ? new Date(toParam) : new Date();
    // Set to 23:59:59 to capture all reviews from the last day
    endLimit.setHours(23, 59, 59);

    reviews = reviews.filter(r => {
      if (!r.date) return false;
      const rDate = new Date(r.date);
      return rDate >= startLimit && rDate <= endLimit;
    });
  }

  // Filter reviews by department query parameter if present using utility matchesDepartment
  if (departmentParam) {
    reviews = reviews.filter(r => matchesDepartment(r, departmentParam));
  }
  if (sentimentParam) {
    reviews = reviews.filter((r: any) => {
      if (sentimentParam === 'positive') return r.rating >= 4;
      if (sentimentParam === 'negative') return r.rating <= 3;
      return true;
    });
  }
  if (categoryParam) {
    reviews = reviews.filter((r: any) => matchesCategory(r, categoryParam));
  }

  // Sort reviews: priority review_date, fallback created_at, dateless (Tarih yok) at the bottom
  reviews = [...reviews].sort((a, b) => {
    const hasDateA = !!a.review_date;
    const hasDateB = !!b.review_date;

    // Rule 4: Tarihi (review_date) olmayan kayıtlar listenin en altında kalsın.
    if (!hasDateA && !hasDateB) {
      // Both have no review_date, sort by created_at fallback
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return sortBy === 'oldest' ? timeA - timeB : timeB - timeA;
    }
    if (!hasDateA) return 1; // a has no review_date, goes to bottom
    if (!hasDateB) return -1; // b has no review_date, goes to bottom

    // Both have review_date, sort by review_date
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
    const maxVisible = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  const handleSyncReviews = async () => {
    setIsSyncing(true);
    // Simulate API synchronization wait
    setTimeout(() => {
      setIsSyncing(false);
      refetch();
    }, 1500);
  };

  const handleImport30DaysReviews = async () => {
    if (!currentHotelId) {
      alert('Lütfen bir otel seçin.');
      return;
    }
    setIsImporting(true);
    setImportSummary(null);
    try {
      const res = await reviewService.importLast30DaysReviews(currentHotelId, importRange);
      if (res.importedCount === 0) {
        setToastMessage('Bu tarih aralığında yeni yorum bulunamadı');
      } else {
        setToastMessage(
          `İçe aktarım tamamlandı: ${res.importedCount} yeni yorum eklendi.`
        );
      }
      setImportSummary({
        totalFetched: res.totalFetched,
        importedCount: res.importedCount,
        duplicateCount: res.duplicateCount,
        failedCount: res.failedCount,
        range: importRange,
        detailedErrors: res.detailedErrors,
        importDetails: res.importDetails
      });
      refetch();
      setTimeout(() => {
        setToastMessage(null);
      }, 5000);
    } catch (err: any) {
      console.error(err);
      setImportSummary({
        totalFetched: 0,
        importedCount: 0,
        duplicateCount: 0,
        failedCount: 1,
        range: importRange,
        detailedErrors: [
          {
            type: 'SERVER_ERROR',
            message: err.message || 'İçe aktarım başarısız oldu',
            reviewId: 'Genel Sistem Hatası',
            webhookUrl: '/api/reviews?action=import',
            status: err.message?.match(/Status\s*(\d+)/i)?.[1] ? parseInt(err.message.match(/Status\s*(\d+)/i)[1], 10) : 500,
            responseBody: err.message || String(err)
          }
        ],
        importDetails: []
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportReviews = async () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      alert('Reviews exported successfully as CSV.');
    }, 1000);
  };

  const handleImportGoogleMapsReviews = async () => {
    if (!currentHotelId) {
      alert('Lütfen bir otel seçin.');
      return;
    }

    const currentHotel = hotels?.find(h => h.id === currentHotelId);
    
    // Direct Supabase query to get direct record columns for comparison
    let dbRow: any = null;
    try {
      const { data } = await supabase
        .from('hotels')
        .select('id, name, google_maps_url, google_maps_link')
        .eq('id', currentHotelId)
        .maybeSingle();
      dbRow = data;
    } catch (e) {
      console.error('[DEBUG] Direct Supabase query failed:', e);
    }

    const googleMapsUrlFromLink = currentHotel?.googleMapsLink;
    const googleMapsUrlFromUrl = currentHotel?.googleMapsUrl;
    const directMapsLinkCol = dbRow?.google_maps_link;
    const directMapsUrlCol = dbRow?.google_maps_url;
    const finalUrlToSend = googleMapsUrlFromLink || googleMapsUrlFromUrl || directMapsLinkCol || directMapsUrlCol;

    console.log('========================================================================');
    console.log('[DEBUG-REVIEWS-READ] Reading selected hotel link properties:');
    console.log('  - currentHotelId:', currentHotelId);
    console.log('  - currentHotel.googleMapsLink:', googleMapsUrlFromLink);
    console.log('  - currentHotel.googleMapsUrl:', googleMapsUrlFromUrl);
    console.log('  - DB Row google_maps_link:', directMapsLinkCol);
    console.log('  - DB Row google_maps_url:', directMapsUrlCol);
    console.log('  - Final URL to be sent in POST body:', finalUrlToSend);
    console.log('========================================================================');
    
    console.log('========================================================================');
    console.log('DEBUG TRACE TABLE:');
    console.table([
      { Step: '1. Admin Input', Value: googleMapsUrlFromUrl || googleMapsUrlFromLink },
      { Step: '2. Supabase Record (google_maps_url)', Value: directMapsUrlCol },
      { Step: '3. Supabase Record (google_maps_link)', Value: directMapsLinkCol },
      { Step: '4. Repository Output (googleMapsUrl)', Value: googleMapsUrlFromUrl },
      { Step: '5. Repository Output (googleMapsLink)', Value: googleMapsUrlFromLink },
      { Step: '6. POST Body Parameter (googleMapsUrl)', Value: finalUrlToSend }
    ]);
    console.log('========================================================================');

    // Log hotelRepository.getHotels() result
    try {
      const dbHotels = await hotelRepository.getHotels();
      console.log('[DEBUG] hotelRepository.getHotels() return:', dbHotels);
    } catch (e) {
      console.error('[DEBUG] hotelRepository.getHotels() failed:', e);
    }

    const googleMapsUrl = finalUrlToSend;

    if (!googleMapsUrl) {
      alert('Bu otel için Google Maps işletme linki tanımlanmamış. Lütfen Admin > Otel Yönetimi sayfasından tanımlayın.');
      return;
    }

    if (isImportingGoogleMaps) return;
    setIsImportingGoogleMaps(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Oturum bulunamadı.');

      let existingCount = 0;
      try {
        const { count, error } = await supabase
          .from('reviews')
          .select('id', { count: 'exact', head: true })
          .eq('hotel_id', currentHotelId)
          .eq('platform', 'Google');
        if (!error && count !== null) {
          existingCount = count;
        }
      } catch (e) {
        console.error('Failed to get existing Google review count:', e);
      }

      const mode = existingCount === 0 ? 'initial_import' : 'daily_sync';

      const response = await fetch('/api/reviews?action=import-google-maps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          hotelId: currentHotelId,
          googleMapsUrl,
          mode
        })
      });

      let res: any;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        res = await response.json();
      } else {
        const textError = await response.text();
        if (response.status === 504 || response.status === 502 || isTimeoutError(null, textError)) {
          throw new Error('TIMEOUT_ERROR');
        }
        throw new Error(textError || 'Bilinmeyen bir sunucu hatası oluştu (JSON yerine düz metin dönüldü).');
      }

      if (!response.ok) {
        if (response.status === 504 || response.status === 502 || isTimeoutError(null, JSON.stringify(res))) {
          throw new Error('TIMEOUT_ERROR');
        }
        if (res.error === 'apify_token_missing') {
          throw new Error('Apify Token Eksik: Vercel Environment Variables içerisine APIFY_TOKEN tanımlanmalıdır.');
        }
        if (res.error === 'apify_actor_failed') {
          throw new Error(`Apify Actor Hatası: Google Maps Actor çalıştırılamadı. Detay: ${res.message || ''} | Raw: ${res.rawError || ''}`);
        }
        if (res.error === 'no_reviews_found') {
          throw new Error('Yorum Bulunamadı: Bu Google Maps linkinden yorum çekilemedi veya çekilen yorumlar boş döndü.');
        }
        throw new Error(res.error || 'İçe aktarım başarısız oldu.');
      }

      const alertMsg = formatImportPopupMessage('Google', res);
      alert(alertMsg);
      setToastMessage(`Google: ${res.insertedCount !== undefined ? res.insertedCount : 0} yeni yorum eklendi.`);
      refetch();
    } catch (err: any) {
      console.error(err);
      if (err.message === 'TIMEOUT_ERROR' || isTimeoutError(err)) {
        alert("Senkronizasyon zaman aşımına uğradı. Lütfen birazdan tekrar deneyin veya daha küçük aralıkla çalıştırın.");
      } else {
        alert(`Hata: ${err.message || 'İçe aktarım sırasında bir sorun oluştu.'}`);
      }
    } finally {
      setIsImportingGoogleMaps(false);
    }
  };

  const handleImportTripadvisorReviews = async () => {
    if (!currentHotelId) {
      alert('Lütfen bir otel seçin.');
      return;
    }

    const currentHotel = hotels?.find(h => h.id === currentHotelId);
    let dbRow: any = null;
    try {
      const { data } = await supabase
        .from('hotels')
        .select('id, name, tripadvisor_url')
        .eq('id', currentHotelId)
        .maybeSingle();
      dbRow = data;
    } catch (e) {
      console.error('[DEBUG] Direct Supabase query failed:', e);
    }

    const tripadvisorUrl = currentHotel?.tripadvisorUrl || dbRow?.tripadvisor_url;

    if (!tripadvisorUrl) {
      alert('Bu otel için TripAdvisor işletme linki tanımlanmamış. Lütfen Admin > Otel Yönetimi sayfasından tanımlayın.');
      return;
    }

    if (isImportingTripadvisor) return;
    setIsImportingTripadvisor(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Oturum bulunamadı.');

      let existingCount = 0;
      try {
        const { count, error } = await supabase
          .from('reviews')
          .select('id', { count: 'exact', head: true })
          .eq('hotel_id', currentHotelId)
          .eq('platform', 'Tripadvisor');
        if (!error && count !== null) {
          existingCount = count;
        }
      } catch (e) {
        console.error('Failed to get existing TripAdvisor review count:', e);
      }

      const mode = existingCount === 0 ? 'initial_import' : 'daily_sync';

      const response = await fetch('/api/reviews?action=import-tripadvisor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          hotelId: currentHotelId,
          tripadvisorUrl,
          mode
        })
      });

      let res: any;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        res = await response.json();
      } else {
        const textError = await response.text();
        if (response.status === 504 || response.status === 502 || isTimeoutError(null, textError)) {
          throw new Error('TIMEOUT_ERROR');
        }
        throw new Error(textError || 'Bilinmeyen bir sunucu hatası oluştu.');
      }

      if (!response.ok) {
        console.log('[DEBUG-TRIPADVISOR-IMPORT-RESPONSE-ERROR]', res);
        if (response.status === 504 || response.status === 502 || isTimeoutError(null, JSON.stringify(res))) {
          throw new Error('TIMEOUT_ERROR');
        }
        const errDetails = [
          `Hata: ${res.error || 'İçe aktarım başarısız oldu.'}`,
          res.message ? `Mesaj: ${res.message}` : null,
          res.apifyError ? `Apify Hatası: ${res.apifyError}` : null,
          res.rawError ? `Raw: ${res.rawError}` : null
        ].filter(Boolean).join('\n');
        throw new Error(errDetails);
      }

      console.log('[DEBUG-TRIPADVISOR-IMPORT-RESPONSE-SUCCESS]', res);
      
      const alertMsg = formatImportPopupMessage('TripAdvisor', res);
      alert(alertMsg);
      setToastMessage(`TripAdvisor: ${res.insertedCount !== undefined ? res.insertedCount : 0} yeni yorum eklendi.`);
      refetch();
    } catch (err: any) {
      console.error(err);
      if (err.message === 'TIMEOUT_ERROR' || isTimeoutError(err)) {
        alert("Senkronizasyon zaman aşımına uğradı. Lütfen birazdan tekrar deneyin veya daha küçük aralıkla çalıştırın.");
      } else {
        alert(err.message || 'İçe aktarım sırasında bir sorun oluştu.');
      }
    } finally {
      setIsImportingTripadvisor(false);
    }
  };

  const handleImportBookingReviews = async () => {
    if (!currentHotelId) {
      alert('Lütfen bir otel seçin.');
      return;
    }

    const { data: dbRow } = await supabase
      .from('hotels')
      .select('id, name, booking_url')
      .eq('id', currentHotelId)
      .maybeSingle();

    const bookingUrl = currentHotel?.bookingUrl || dbRow?.booking_url || '';
    if (!bookingUrl) {
      alert('Bu otel için Booking.com URL tanımlanmamış. Lütfen Admin > Otel Yönetimi sayfasından tanımlayın.');
      return;
    }

    setIsImportingBooking(true);
    try {
      let existingCount = 0;
      try {
        const { count, error } = await supabase
          .from('reviews')
          .select('id', { count: 'exact', head: true })
          .eq('hotel_id', currentHotelId)
          .eq('platform', 'booking');
        if (!error && count !== null) {
          existingCount = count;
        }
      } catch (e) {
        console.error('Failed to get existing Booking review count:', e);
      }

      const mode = existingCount === 0 ? 'initial_import' : 'daily_sync';

      const res = await reviewService.importBookingReviews(currentHotelId, importRange, mode);
      console.log('[DEBUG-BOOKING-IMPORT-RESPONSE-SUCCESS]', res);

      const insertedCount = res.insertedCount ?? res.importedCount ?? 0;
      const updatedCount = res.updatedCount ?? 0;
      const duplicateCount = res.duplicateCount ?? 0;
      const failedCount = res.failedCount ?? 0;

      const alertMsg = `Booking.com yorumları içe aktarıldı:\n` +
                       `Yeni Eklenen: ${insertedCount}\n` +
                       `Güncellenen: ${updatedCount}\n` +
                       `Duplicate Atlanan: ${duplicateCount}\n` +
                       `Hata: ${failedCount}`;
      
      alert(alertMsg);
      setToastMessage(alertMsg);
      refetch();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'İçe aktarım sırasında bir sorun oluştu.');
    } finally {
      setIsImportingBooking(false);
    }
  };

  const handleSyncHolidaycheckReviews = async () => {
    if (!currentHotelId) {
      alert('Lütfen bir otel seçin.');
      return;
    }

    const currentHotel = hotels?.find(h => h.id === currentHotelId);
    let dbRow: any = null;
    try {
      const { data } = await supabase
        .from('hotels')
        .select('id, name, holidaycheck_url')
        .eq('id', currentHotelId)
        .maybeSingle();
      dbRow = data;
    } catch (e) {
      console.error('[DEBUG] Direct Supabase query failed:', e);
    }

    const selectedHotel = currentHotel;
    const holidaycheckUrl =
      selectedHotel?.holidaycheckUrl ||
      selectedHotel?.holidaycheck_url ||
      selectedHotel?.holidayCheckUrl ||
      dbRow?.holidaycheck_url ||
      '';

    if (!holidaycheckUrl) {
      alert('Bu otel için HolidayCheck linki kayıtlı değil.');
      return;
    }

    if (isImportingHolidaycheck) return;
    setIsImportingHolidaycheck(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Oturum bulunamadı.');

      // Check existing count to determine mode
      let existingCount = 0;
      try {
        const { count, error } = await supabase
          .from('reviews')
          .select('id', { count: 'exact', head: true })
          .eq('hotel_id', currentHotelId)
          .eq('platform', 'holidaycheck');
        if (!error && count !== null) {
          existingCount = count;
        }
      } catch (e) {
        console.error('Failed to get existing HolidayCheck review count:', e);
      }

      const mode = existingCount === 0 ? 'initial_import' : 'daily_sync';

      const response = await fetch('/api/reviews?action=import-holidaycheck', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          hotelId: currentHotelId,
          hotelName: currentHotel?.name || dbRow?.name || '',
          holidaycheckUrl,
          mode
        })
      });

      const res = await response.json();
      if (!response.ok) {
        throw new Error(res.error || 'İçe aktarım başarısız oldu.');
      }

      const insertedCount = res.insertedCount ?? 0;
      const duplicateCount = res.duplicateCount ?? 0;
      const failedCount = res.failedCount ?? 0;

      const alertMsg = `HolidayCheck yorumları içe aktarıldı:\n` +
                       `Yeni: ${insertedCount} Duplicate: ${duplicateCount} Hata: ${failedCount}`;
      
      alert(alertMsg);
      setToastMessage(alertMsg);
      refetch();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'İçe aktarım sırasında bir sorun oluştu.');
    } finally {
      setIsImportingHolidaycheck(false);
    }
  };

  const handleSyncHotelscomReviews = async () => {
    if (!currentHotelId) {
      alert('Lütfen bir otel seçin.');
      return;
    }

    const currentHotel = hotels?.find(h => h.id === currentHotelId);
    const selectedHotel = currentHotel;
    console.log("[SELECTED HOTEL FOR HOTELS.COM]", selectedHotel);

    let dbRow: any = null;
    try {
      const { data } = await supabase
        .from('hotels')
        .select('id, name, hotelscom_url')
        .eq('id', currentHotelId)
        .maybeSingle();
      dbRow = data;
    } catch (e) {
      console.error('[DEBUG] Direct Supabase query failed:', e);
    }

    const hotelscomUrl =
      selectedHotel?.hotelscomUrl ||
      selectedHotel?.hotelscom_url ||
      selectedHotel?.hotelsComUrl ||
      dbRow?.hotelscom_url ||
      '';

    if (!hotelscomUrl) {
      alert('Bu otel için Hotels.com linki kayıtlı değil.');
      return;
    }

    if (isImportingHotelscom) return;
    setIsImportingHotelscom(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Oturum bulunamadı.');

      // Check existing count to determine mode
      let existingCount = 0;
      try {
        const { count, error } = await supabase
          .from('reviews')
          .select('id', { count: 'exact', head: true })
          .eq('hotel_id', currentHotelId)
          .eq('platform', 'hotels.com');
        if (!error && count !== null) {
          existingCount = count;
        }
      } catch (e) {
        console.error('Failed to get existing Hotels.com review count:', e);
      }

      const mode = existingCount === 0 ? 'initial_import' : 'daily_sync';

      const response = await fetch('/api/reviews?action=import-hotelscom', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          hotelId: currentHotelId,
          hotelName: currentHotel?.name || dbRow?.name || '',
          hotelscomUrl,
          mode
        })
      });

      const res = await response.json();
      if (!response.ok) {
        throw new Error(res.error || 'İçe aktarım başarısız oldu.');
      }

      const insertedCount = res.insertedCount ?? 0;
      const duplicateCount = res.duplicateCount ?? 0;
      const failedCount = res.failedCount ?? 0;

      const alertMsg = `Hotels.com yorumları içe aktarıldı:\n` +
                       `Yeni: ${insertedCount} Duplicate: ${duplicateCount} Hata: ${failedCount}`;
      
      alert(alertMsg);
      setToastMessage(alertMsg);
      refetch();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'İçe aktarım sırasında bir sorun oluştu.');
    } finally {
      setIsImportingHotelscom(false);
    }
  };

  const handleSyncAllPlatforms = (modeOverride?: string) => {
    if (!currentHotelId) {
      alert('Lütfen bir otel seçin.');
      return;
    }

    if (isSyncingAll) return;
    setIsSyncingAll(true);
    setTimeout(async () => {
      const currentHotel = hotels?.find(h => h.id === currentHotelId);
      let dbRow: any = null;
      try {
        const { data } = await supabase
          .from('hotels')
          .select('google_maps_url, google_maps_link, tripadvisor_url, booking_url, holidaycheck_url, hotelscom_url')
          .eq('id', currentHotelId)
          .maybeSingle();
        dbRow = data;
      } catch (e) {
        console.error(e);
      }

      const googleMapsUrl = currentHotel?.googleMapsLink || currentHotel?.googleMapsUrl || dbRow?.google_maps_link || dbRow?.google_maps_url;
      const tripadvisorUrl = currentHotel?.tripadvisorUrl || dbRow?.tripadvisor_url;
      const bookingUrl = currentHotel?.bookingUrl || dbRow?.booking_url || '';
      const holidaycheckUrl = currentHotel?.holidaycheckUrl || dbRow?.holidaycheck_url;
      const hotelscomUrl = currentHotel?.hotelscomUrl || dbRow?.hotelscom_url;

      if (!googleMapsUrl && !tripadvisorUrl && !bookingUrl && !holidaycheckUrl && !hotelscomUrl) {
        alert('Bu otel için tanımlı hiçbir platform linki bulunamadı.');
        setIsSyncingAll(false);
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error('Oturum bulunamadı.');

        // Check existing Google reviews count
        let googleExistingCount = 0;
        try {
          const { count } = await supabase
            .from('reviews')
            .select('id', { count: 'exact', head: true })
            .eq('hotel_id', currentHotelId)
            .eq('platform', 'Google');
          if (count !== null) googleExistingCount = count;
        } catch (e) {}
        const googleMode = googleExistingCount === 0 ? 'initial_import' : 'daily_sync';

        // Check existing TripAdvisor reviews count
        let taExistingCount = 0;
        try {
          const { count } = await supabase
            .from('reviews')
            .select('id', { count: 'exact', head: true })
            .eq('hotel_id', currentHotelId)
            .eq('platform', 'Tripadvisor');
          if (count !== null) taExistingCount = count;
        } catch (e) {}
        const taMode = taExistingCount === 0 ? 'initial_import' : 'daily_sync';

        // Check existing Booking reviews count
        let bookingExistingCount = 0;
        try {
          const { count } = await supabase
            .from('reviews')
            .select('id', { count: 'exact', head: true })
            .eq('hotel_id', currentHotelId)
            .eq('platform', 'booking');
          if (count !== null) bookingExistingCount = count;
        } catch (e) {}
        const bookingMode = bookingExistingCount === 0 ? 'initial_import' : 'daily_sync';

        // Check existing HolidayCheck reviews count
        let hcExistingCount = 0;
        try {
          const { count } = await supabase
            .from('reviews')
            .select('id', { count: 'exact', head: true })
            .eq('hotel_id', currentHotelId)
            .eq('platform', 'holidaycheck');
          if (count !== null) hcExistingCount = count;
        } catch (e) {}
        const hcMode = hcExistingCount === 0 ? 'initial_import' : 'daily_sync';

        // Check existing Hotels.com reviews count
        let hotelscomExistingCount = 0;
        try {
          const { count } = await supabase
            .from('reviews')
            .select('id', { count: 'exact', head: true })
            .eq('hotel_id', currentHotelId)
            .eq('platform', 'hotels.com');
          if (count !== null) hotelscomExistingCount = count;
        } catch (e) {}
        const hotelscomMode = hotelscomExistingCount === 0 ? 'initial_import' : 'daily_sync';

        const finalResults: any = {
          Google: { imported: 0, duplicates: 0, skipped: 0, errors: [], syncMode: '', syncStartDate: '', lastReviewDate: '', nextRecommendedSyncAt: '', estimatedCostSavingMessage: '', elapsedMs: 0 },
          "Booking.com": { imported: 0, duplicates: 0, skipped: 0, errors: [], syncMode: '', syncStartDate: '', lastReviewDate: '', nextRecommendedSyncAt: '', estimatedCostSavingMessage: '', elapsedMs: 0 },
          TripAdvisor: { imported: 0, duplicates: 0, skipped: 0, errors: [], syncMode: '', syncStartDate: '', lastReviewDate: '', nextRecommendedSyncAt: '', estimatedCostSavingMessage: '', elapsedMs: 0 },
          "Hotels.com": { imported: 0, duplicates: 0, skipped: 0, errors: [], syncMode: '', syncStartDate: '', lastReviewDate: '', nextRecommendedSyncAt: '', estimatedCostSavingMessage: '', elapsedMs: 0 },
          HolidayCheck: { imported: 0, duplicates: 0, skipped: 0, errors: [], syncMode: '', syncStartDate: '', lastReviewDate: '', nextRecommendedSyncAt: '', estimatedCostSavingMessage: '', elapsedMs: 0 }
        };

        const cleanErrorMessage = (text: string, defaultMsg: string): string => {
          if (!text) return defaultMsg;
          const clean = text.trim();
          if (clean.startsWith('{') || clean.startsWith('[')) {
            try {
              const parsed = JSON.parse(clean);
              return parsed.error || parsed.message || defaultMsg;
            } catch (_) {}
          }
          if (clean.includes('FUNCTION_INVOCATION_FAILED')) {
            return 'Vercel Serverless Function: FUNCTION_INVOCATION_FAILED (İşlem süresi limitini aştığı için timeout oldu. Platform bazlı aralıklar ile tekrar deneyebilirsiniz.)';
          }
          if (clean.includes('504 Gateway Timeout')) {
            return '504 Gateway Timeout (Sunucu zaman aşımına uğradı.)';
          }
          if (clean.includes('502 Bad Gateway')) {
            return '502 Bad Gateway (Sunucu geçidi hatası.)';
          }
          if (clean.includes('<html') || clean.includes('<!DOCTYPE html')) {
            const bodyMatch = clean.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
            const searchArea = bodyMatch ? bodyMatch[1] : clean;
            const h1Match = searchArea.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
            const pMatch = searchArea.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
            let msg = '';
            if (h1Match) msg += h1Match[1].replace(/<[^>]*>/g, '').trim() + ': ';
            if (pMatch) msg += pMatch[1].replace(/<[^>]*>/g, '').trim();
            if (msg.trim()) return msg.trim().substring(0, 200);
            return `Sunucu Hatası (Kod: ${defaultMsg})`;
          }
          return clean.substring(0, 300);
        };

        // A) Aggregator (Google & Booking.com)
        const aggStart = Date.now();
        try {
          const finalUrlToSend = googleMapsUrl;
          const googlePlaceId = currentHotel?.googlePlaceId || dbRow?.google_place_id;

          if (finalUrlToSend || googlePlaceId) {
            const aggResponse = await fetch('/api/reviews?action=import-hotel-review-aggregator', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({
                action: 'import-hotel-review-aggregator',
                hotelId: currentHotelId,
                googleMapsUrl: finalUrlToSend,
                syncMode: modeOverride || 'incremental_sync'
              })
            });
            const aggText = await aggResponse.text();
            const elapsed = Date.now() - aggStart;
            finalResults.Google.elapsedMs = elapsed;
            finalResults["Booking.com"].elapsedMs = elapsed;

            if (aggResponse.ok && aggResponse.headers.get('content-type')?.includes('application/json')) {
              const aggResult = JSON.parse(aggText);
              const summary = aggResult.platformSummary || {};
              const gDetails = aggResult.googleSyncDetails || {};
              const bDetails = aggResult.bookingSyncDetails || {};

              finalResults.Google.imported = summary.Google?.imported ?? 0;
              finalResults.Google.duplicates = summary.Google?.duplicates ?? 0;
              finalResults.Google.skipped = summary.Google?.skipped ?? 0;
              finalResults.Google.syncMode = gDetails.syncMode;
              finalResults.Google.syncStartDate = gDetails.syncStartDate;
              finalResults.Google.lastReviewDate = gDetails.lastReviewDate;
              finalResults.Google.nextRecommendedSyncAt = gDetails.nextRecommendedSyncAt;
              finalResults.Google.estimatedCostSavingMessage = aggResult.estimatedCostSavingMessage || '';
              finalResults.Google.hasMorePotentialReviews = gDetails.hasMorePotentialReviews;

              finalResults["Booking.com"].imported = summary["Booking.com"]?.imported ?? 0;
              finalResults["Booking.com"].duplicates = summary["Booking.com"]?.duplicates ?? 0;
              finalResults["Booking.com"].skipped = summary["Booking.com"]?.skipped ?? 0;
              finalResults["Booking.com"].syncMode = bDetails.syncMode;
              finalResults["Booking.com"].syncStartDate = bDetails.syncStartDate;
              finalResults["Booking.com"].lastReviewDate = bDetails.lastReviewDate;
              finalResults["Booking.com"].nextRecommendedSyncAt = bDetails.nextRecommendedSyncAt;
              finalResults["Booking.com"].estimatedCostSavingMessage = aggResult.estimatedCostSavingMessage || '';
              finalResults["Booking.com"].hasMorePotentialReviews = bDetails.hasMorePotentialReviews;

              if (aggResult.errors && aggResult.errors.length > 0) {
                finalResults.Google.errors.push(...aggResult.errors);
                finalResults["Booking.com"].errors.push(...aggResult.errors);
              }
            } else {
              const cleanMsg = cleanErrorMessage(aggText, `Aggregator error status ${aggResponse.status}`);
              let rawObj: any = null;
              try { if (aggText.trim().startsWith('{')) rawObj = JSON.parse(aggText); } catch (_) {}
              const errPayload = {
                message: cleanMsg,
                action: rawObj?.action || 'import-hotel-review-aggregator',
                stack: rawObj?.stack,
                elapsedMs: rawObj?.elapsedMs
              };
              finalResults.Google.errors.push(errPayload);
              finalResults["Booking.com"].errors.push(errPayload);
            }
          } else {
            finalResults.Google.errors.push({ message: "No Google Maps URL or Place ID configured." });
            finalResults["Booking.com"].errors.push({ message: "No Google Maps URL or Place ID configured." });
          }
        } catch (e: any) {
          const cleanMsg = cleanErrorMessage(e.message || String(e), 'Aggregator network exception');
          let rawObj: any = null;
          try { if (typeof e.message === 'string' && e.message.trim().startsWith('{')) rawObj = JSON.parse(e.message); } catch (_) {}
          const errPayload = {
            message: cleanMsg,
            action: rawObj?.action || 'import-hotel-review-aggregator',
            stack: rawObj?.stack || e.stack,
            elapsedMs: rawObj?.elapsedMs
          };
          finalResults.Google.errors.push(errPayload);
          finalResults["Booking.com"].errors.push(errPayload);
        }

        // B) TripAdvisor (Legacy)
        if (tripadvisorUrl) {
          const taStart = Date.now();
          try {
            const response = await fetch('/api/reviews?action=import-tripadvisor', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ hotelId: currentHotelId, tripadvisorUrl, mode: taMode, syncMode: modeOverride || 'incremental_sync' })
            });
            const text = await response.text();
            finalResults.TripAdvisor.elapsedMs = Date.now() - taStart;

            if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
              const res = JSON.parse(text);
              finalResults.TripAdvisor.imported = res.imported ?? 0;
              finalResults.TripAdvisor.duplicates = res.duplicates ?? 0;
              finalResults.TripAdvisor.skipped = res.skipped ?? 0;
              finalResults.TripAdvisor.syncMode = res.syncMode;
              finalResults.TripAdvisor.syncStartDate = res.syncStartDate;
              finalResults.TripAdvisor.lastReviewDate = res.lastReviewDate;
              finalResults.TripAdvisor.nextRecommendedSyncAt = res.nextRecommendedSyncAt;
              finalResults.TripAdvisor.estimatedCostSavingMessage = res.estimatedCostSavingMessage || '';
              if (res.errors) finalResults.TripAdvisor.errors.push(...res.errors);
            } else {
              let rawObj: any = null;
              try { if (text.trim().startsWith('{')) rawObj = JSON.parse(text); } catch (_) {}
              finalResults.TripAdvisor.errors.push({
                message: cleanErrorMessage(text, `TripAdvisor error status ${response.status}`),
                action: rawObj?.action || 'import-tripadvisor',
                stack: rawObj?.stack,
                elapsedMs: rawObj?.elapsedMs
              });
            }
          } catch (e: any) {
            let rawObj: any = null;
            try { if (typeof e.message === 'string' && e.message.trim().startsWith('{')) rawObj = JSON.parse(e.message); } catch (_) {}
            finalResults.TripAdvisor.errors.push({
              message: cleanErrorMessage(e.message || String(e), 'TripAdvisor network exception'),
              action: rawObj?.action || 'import-tripadvisor',
              stack: rawObj?.stack || e.stack,
              elapsedMs: rawObj?.elapsedMs
            });
          }
        }

        // C) Hotels.com (Legacy)
        if (hotelscomUrl) {
          const hcomStart = Date.now();
          try {
            const response = await fetch('/api/reviews?action=import-hotelscom', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({
                hotelId: currentHotelId,
                hotelName: currentHotel?.name || dbRow?.name || '',
                hotelscomUrl,
                mode: hotelscomMode,
                syncMode: modeOverride || 'incremental_sync'
              })
            });
            const text = await response.text();
            finalResults["Hotels.com"].elapsedMs = Date.now() - hcomStart;

            if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
              const res = JSON.parse(text);
              finalResults["Hotels.com"].imported = res.imported ?? 0;
              finalResults["Hotels.com"].duplicates = res.duplicates ?? 0;
              finalResults["Hotels.com"].skipped = res.skipped ?? 0;
              finalResults["Hotels.com"].syncMode = res.syncMode;
              finalResults["Hotels.com"].syncStartDate = res.syncStartDate;
              finalResults["Hotels.com"].lastReviewDate = res.lastReviewDate;
              finalResults["Hotels.com"].nextRecommendedSyncAt = res.nextRecommendedSyncAt;
              finalResults["Hotels.com"].estimatedCostSavingMessage = res.estimatedCostSavingMessage || '';
              if (res.errors) finalResults["Hotels.com"].errors.push(...res.errors);
            } else {
              let rawObj: any = null;
              try { if (text.trim().startsWith('{')) rawObj = JSON.parse(text); } catch (_) {}
              finalResults["Hotels.com"].errors.push({
                message: cleanErrorMessage(text, `Hotels.com error status ${response.status}`),
                action: rawObj?.action || 'import-hotelscom',
                stack: rawObj?.stack,
                elapsedMs: rawObj?.elapsedMs
              });
            }
          } catch (e: any) {
            let rawObj: any = null;
            try { if (typeof e.message === 'string' && e.message.trim().startsWith('{')) rawObj = JSON.parse(e.message); } catch (_) {}
            finalResults["Hotels.com"].errors.push({
              message: cleanErrorMessage(e.message || String(e), 'Hotels.com network exception'),
              action: rawObj?.action || 'import-hotelscom',
              stack: rawObj?.stack || e.stack,
              elapsedMs: rawObj?.elapsedMs
            });
          }
        }

        // D) HolidayCheck (Legacy)
        if (holidaycheckUrl) {
          const hcStart = Date.now();
          try {
            const response = await fetch('/api/reviews?action=import-holidaycheck', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ hotelId: currentHotelId, holidaycheckUrl, mode: hcMode, syncMode: modeOverride || 'incremental_sync' })
            });
            const text = await response.text();
            finalResults.HolidayCheck.elapsedMs = Date.now() - hcStart;

            if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
              const res = JSON.parse(text);
              finalResults.HolidayCheck.imported = res.imported ?? 0;
              finalResults.HolidayCheck.duplicates = res.duplicates ?? 0;
              finalResults.HolidayCheck.skipped = res.skipped ?? 0;
              finalResults.HolidayCheck.syncMode = res.syncMode;
              finalResults.HolidayCheck.syncStartDate = res.syncStartDate;
              finalResults.HolidayCheck.lastReviewDate = res.lastReviewDate;
              finalResults.HolidayCheck.nextRecommendedSyncAt = res.nextRecommendedSyncAt;
              finalResults.HolidayCheck.estimatedCostSavingMessage = res.estimatedCostSavingMessage || '';
              if (res.errors) finalResults.HolidayCheck.errors.push(...res.errors);
            } else {
              let rawObj: any = null;
              try { if (text.trim().startsWith('{')) rawObj = JSON.parse(text); } catch (_) {}
              finalResults.HolidayCheck.errors.push({
                message: cleanErrorMessage(text, `HolidayCheck error status ${response.status}`),
                action: rawObj?.action || 'import-holidaycheck',
                stack: rawObj?.stack,
                elapsedMs: rawObj?.elapsedMs
              });
            }
          } catch (e: any) {
            let rawObj: any = null;
            try { if (typeof e.message === 'string' && e.message.trim().startsWith('{')) rawObj = JSON.parse(e.message); } catch (_) {}
            finalResults.HolidayCheck.errors.push({
              message: cleanErrorMessage(e.message || String(e), 'HolidayCheck network exception'),
              action: rawObj?.action || 'import-holidaycheck',
              stack: rawObj?.stack || e.stack,
              elapsedMs: rawObj?.elapsedMs
            });
          }
        }

        const syncTime = new Date().toISOString();
        const healthStatus = {
          lastSyncTime: syncTime,
          Google: {
            imported: finalResults.Google.imported,
            duplicates: finalResults.Google.duplicates,
            skipped: finalResults.Google.skipped,
            status: finalResults.Google.errors.length > 0 ? "error" : "active",
            errors: finalResults.Google.errors,
            syncMode: finalResults.Google.syncMode || 'incremental_sync',
            syncStartDate: finalResults.Google.syncStartDate || 'Tüm geçmiş',
            lastReviewDate: finalResults.Google.lastReviewDate,
            nextRecommendedSyncAt: finalResults.Google.nextRecommendedSyncAt,
            estimatedCostSavingMessage: finalResults.Google.estimatedCostSavingMessage,
            elapsedMs: finalResults.Google.elapsedMs,
            hasMorePotentialReviews: finalResults.Google.hasMorePotentialReviews
          },
          "Booking.com": {
            imported: finalResults["Booking.com"].imported,
            duplicates: finalResults["Booking.com"].duplicates,
            skipped: finalResults["Booking.com"].skipped,
            status: finalResults["Booking.com"].errors.length > 0 ? "error" : "active",
            errors: finalResults["Booking.com"].errors,
            syncMode: finalResults["Booking.com"].syncMode || 'incremental_sync',
            syncStartDate: finalResults["Booking.com"].syncStartDate || 'Tüm geçmiş',
            lastReviewDate: finalResults["Booking.com"].lastReviewDate,
            nextRecommendedSyncAt: finalResults["Booking.com"].nextRecommendedSyncAt,
            estimatedCostSavingMessage: finalResults["Booking.com"].estimatedCostSavingMessage,
            elapsedMs: finalResults["Booking.com"].elapsedMs,
            hasMorePotentialReviews: finalResults["Booking.com"].hasMorePotentialReviews
          },
          "TripAdvisor": {
            imported: finalResults.TripAdvisor.imported,
            duplicates: finalResults.TripAdvisor.duplicates,
            skipped: finalResults.TripAdvisor.skipped,
            status: finalResults.TripAdvisor.errors.length > 0 ? "error" : "active",
            errors: finalResults.TripAdvisor.errors,
            syncMode: finalResults.TripAdvisor.syncMode || 'incremental_sync',
            syncStartDate: finalResults.TripAdvisor.syncStartDate || 'Tüm geçmiş',
            lastReviewDate: finalResults.TripAdvisor.lastReviewDate,
            nextRecommendedSyncAt: finalResults.TripAdvisor.nextRecommendedSyncAt,
            estimatedCostSavingMessage: finalResults.TripAdvisor.estimatedCostSavingMessage,
            elapsedMs: finalResults.TripAdvisor.elapsedMs
          },
          "Hotels.com": {
            imported: finalResults["Hotels.com"].imported,
            duplicates: finalResults["Hotels.com"].duplicates,
            skipped: finalResults["Hotels.com"].skipped,
            status: finalResults["Hotels.com"].errors.length > 0 ? "error" : "active",
            errors: finalResults["Hotels.com"].errors,
            syncMode: finalResults["Hotels.com"].syncMode || 'incremental_sync',
            syncStartDate: finalResults["Hotels.com"].syncStartDate || 'Tüm geçmiş',
            lastReviewDate: finalResults["Hotels.com"].lastReviewDate,
            nextRecommendedSyncAt: finalResults["Hotels.com"].nextRecommendedSyncAt,
            estimatedCostSavingMessage: finalResults["Hotels.com"].estimatedCostSavingMessage,
            elapsedMs: finalResults["Hotels.com"].elapsedMs
          },
          "HolidayCheck": {
            imported: finalResults.HolidayCheck.imported,
            duplicates: finalResults.HolidayCheck.duplicates,
            skipped: finalResults.HolidayCheck.skipped,
            status: finalResults.HolidayCheck.errors.length > 0 ? "error" : "active",
            errors: finalResults.HolidayCheck.errors,
            syncMode: finalResults.HolidayCheck.syncMode || 'incremental_sync',
            syncStartDate: finalResults.HolidayCheck.syncStartDate || 'Tüm geçmiş',
            lastReviewDate: finalResults.HolidayCheck.lastReviewDate,
            nextRecommendedSyncAt: finalResults.HolidayCheck.nextRecommendedSyncAt,
            estimatedCostSavingMessage: finalResults.HolidayCheck.estimatedCostSavingMessage,
            elapsedMs: finalResults.HolidayCheck.elapsedMs
          }
        };
        localStorage.setItem(`sync_health_${currentHotelId}`, JSON.stringify(healthStatus));

        setUnifiedSyncResult({
          success: true,
          hotelName: currentHotel?.name || dbRow?.name || 'Seçili Otel',
          results: finalResults
        });
        refetch();
      } catch (err: any) {
        console.error(err);
        alert(`Hata: ${err.message || 'Senkronizasyon sırasında bir sorun oluştu.'}`);
      } finally {
        setIsSyncingAll(false);
      }
    }, 50);
  };

  const handleUpdateStatus = useCallback(async (id: string, newStatus: ReviewStatus, responseText?: string) => {
    try {
      if (responseText !== undefined) {
        await reviewService.saveResponseDraft(id, responseText);
      }
      const updated = await reviewService.updateReviewStatus(id, newStatus);
      if (updated && updated.id) {
        setSelectedReviewDetail(updated);
      }
      refetch();

      if (newStatus === 'pending_approval') {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          if (token) {
            await fetch('/api/whatsapp?action=send-approval', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ reviewId: id })
            });
            console.log('[WhatsApp] Approval notification triggered.');
            setToastMessage('Yorum onaya gönderildi ve WhatsApp onay bildirimi tetiklendi.');
          }
        } catch (wErr) {
          console.warn('[WhatsApp] Failed to send approval notification:', wErr);
        }
      }
    } catch (err: any) {
      console.warn('Failed to update review status:', err);
      refetch();
    }
  }, [refetch]);

  const handleSubmitResponse = useCallback(async (id: string, responseText: string) => {
    try {
      const updated = await reviewService.submitResponse(id, responseText);
      if (updated && updated.id) {
        setSelectedReviewDetail(updated);
      }
      refetch();
    } catch (err: any) {
      console.warn('Failed to submit response:', err);
      refetch();
    }
  }, [refetch]);

  const handlePublishGoogleReply = useCallback(async (id: string, replyText: string) => {
    setToastMessage("İşlem başarıyla tamamlandı.");
    refetch();
  }, [refetch]);


  const handleSaveDraft = useCallback(async (id: string, responseText: string) => {
    try {
      const updated = await reviewService.saveResponseDraft(id, responseText);
      if (updated && updated.id) {
        setSelectedReviewDetail(updated);
      }
      refetch();
    } catch (err: any) {
      console.warn('Failed to save response draft:', err);
      refetch();
    }
  }, [refetch]);

  const handleUpdateNotes = useCallback(async (id: string, managerNotes: string, internalNotes: string) => {
    try {
      const updated = await reviewService.updateReviewNotes(id, managerNotes, internalNotes);
      if (updated && updated.id) {
        setSelectedReviewDetail(updated);
      }
      refetch();
    } catch (err: any) {
      console.warn('Failed to update notes:', err);
      refetch();
    }
  }, [refetch]);

  const handleGenerateAiReply = useCallback(async (id: string): Promise<string> => {
    const res = await reviewService.generateAiResponse(id);
    return res.response;
  }, []);

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="space-y-2 flex-1">
          <h1 className="text-xl font-bold text-slate-800 m-0">{t('reviews.title')}</h1>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            İlk kurulumda tüm geçmiş yorumlar alınır. Sonraki senkronizasyonlarda yalnızca yeni yorumlar eklenir.
          </p>
          <p className="text-[10px] text-slate-400 font-semibold italic">
            * Google ve Booking.com Aggregator ile; TripAdvisor, Hotels.com ve HolidayCheck kendi entegrasyonlarıyla senkronize edilir.
          </p>
          {lastSyncHealth ? (
            <div className="text-[10px] text-slate-500 font-semibold flex items-center gap-1.5 mt-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 self-start w-fit">
              <span>Son Senkronizasyon:</span>
              <span className="font-bold text-slate-700">
                {new Date(lastSyncHealth.lastSyncTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(lastSyncHealth.lastSyncTime).toLocaleDateString('tr-TR')}
              </span>
              <span className="text-slate-300">|</span>
              <span>Durum:</span>
              {Object.values(lastSyncHealth).some((v: any) => v && v.status === 'error') ? (
                <span className="text-rose-600 font-bold bg-rose-50 px-1 py-0.5 rounded text-[8px] border border-rose-100">Hatalı</span>
              ) : (
                <span className="text-emerald-600 font-bold bg-emerald-50 px-1 py-0.5 rounded text-[8px] border border-emerald-100">Başarılı</span>
              )}
            </div>
          ) : (
            <div className="text-[10px] text-slate-400 font-semibold mt-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 self-start w-fit">
              Son Senkronizasyon: Bekliyor (Henüz senkronize edilmedi)
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {(() => {
            const hasTripadvisor = !!(currentHotel?.tripadvisorUrl);
            const hasGoogle = !!(currentHotel?.googleMapsLink || currentHotel?.googleMapsUrl);
            const hasBooking = !!(currentHotel?.bookingUrl);
            const hasHolidaycheck = !!(currentHotel?.holidaycheckUrl);
            const hasHotelscom = !!(currentHotel?.hotelscomUrl);
            const hasAnyLink = hasGoogle || hasTripadvisor || hasBooking || hasHolidaycheck || hasHotelscom;

            return (
              <>
                <button
                  onClick={() => handleSyncAllPlatforms()}
                  disabled={isSyncingAll || !hasAnyLink}
                  title={!hasAnyLink ? "Bu otel için tanımlı hiçbir platform linki bulunamadı." : "Tüm platformları senkronize et"}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-tr from-indigo-600 to-purple-500 hover:from-indigo-500 hover:to-purple-400 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-indigo-500/20 min-h-[38px] cursor-pointer animate-pulse-slow"
                >
                  <RefreshCw size={14} className={isSyncingAll ? 'animate-spin' : ''} />
                  <span>{isSyncingAll ? 'Senkronize Ediliyor...' : 'Tüm Platformları Senkronize Et'}</span>
                </button>

                <button
                  onClick={() => setShowAdvancedImport(!showAdvancedImport)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-800 font-bold text-xs rounded-xl transition-all min-h-[36px] cursor-pointer"
                >
                  <span>Gelişmiş</span>
                  <ChevronDown size={14} className={`transition-transform ${showAdvancedImport ? 'rotate-180' : ''}`} />
                </button>

                <button
                  onClick={handleExportReviews}
                  disabled={isExporting}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-semibold text-xs rounded-xl transition-all min-h-[36px] cursor-pointer"
                >
                  <Download size={14} className={isExporting ? 'animate-spin' : ''} />
                  <span>{isExporting ? 'Exporting...' : t('reviews.export')}</span>
                </button>
              </>
            );
          })()}
        </div>
      </div>

      {/* Advanced Legacy Sync Controls Collapsible Panel */}
      {showAdvancedImport && (
        <div className="bg-slate-50/75 p-4 rounded-2xl border border-slate-200 flex flex-wrap gap-3 items-center animate-slide-in">
          <div className="w-full text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Tekil Entegrasyonlar ve Test Kontrolleri (Gelişmiş)
          </div>
          {(() => {
            const hasTripadvisor = !!(currentHotel?.tripadvisorUrl);
            const hasGoogle = !!(currentHotel?.googleMapsLink || currentHotel?.googleMapsUrl);
            const hasBooking = !!(currentHotel?.bookingUrl);
            const hasHolidaycheck = !!(currentHotel?.holidaycheckUrl);
            const hasHotelscom = !!(currentHotel?.hotelscomUrl);
            
            return (
              <>
                <button
                  onClick={() => {
                    if (confirm('DİKKAT: Bu işlem tüm geçmiş yorumları yeniden çekecektir. API tarama maliyetini artırabilir. Devam etmek istiyor musunuz?')) {
                      handleSyncAllPlatforms('manual_full_resync');
                    }
                  }}
                  disabled={isSyncingAll}
                  className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 font-bold text-[11px] rounded-xl transition-all cursor-pointer"
                >
                  <RefreshCw size={12} className={isSyncingAll ? 'animate-spin' : ''} />
                  <span>Tam Yeniden Senkronize Et (Full Sync)</span>
                </button>

                <button
                  onClick={handleImportGoogleMapsReviews}
                  disabled={isImportingGoogleMaps || !hasGoogle}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-bold text-[11px] rounded-xl transition-all cursor-pointer"
                >
                  <RefreshCw size={12} className={isImportingGoogleMaps ? 'animate-spin' : ''} />
                  <span>Google Maps Tekil Çek</span>
                </button>

                <button
                  onClick={handleImportTripadvisorReviews}
                  disabled={isImportingTripadvisor || !hasTripadvisor}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-bold text-[11px] rounded-xl transition-all cursor-pointer"
                >
                  <RefreshCw size={12} className={isImportingTripadvisor ? 'animate-spin' : ''} />
                  <span>TripAdvisor Tekil Çek</span>
                </button>

                <button
                  onClick={handleImportBookingReviews}
                  disabled={isImportingBooking || !hasBooking}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-bold text-[11px] rounded-xl transition-all cursor-pointer"
                >
                  <RefreshCw size={12} className={isImportingBooking ? 'animate-spin' : ''} />
                  <span>Booking.com Tekil Çek</span>
                </button>

                <button
                  onClick={handleSyncHolidaycheckReviews}
                  disabled={isImportingHolidaycheck}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-bold text-[11px] rounded-xl transition-all cursor-pointer"
                >
                  <RefreshCw size={12} className={isImportingHolidaycheck ? 'animate-spin' : ''} />
                  <span>HolidayCheck Tekil Çek</span>
                </button>

                <button
                  onClick={handleSyncHotelscomReviews}
                  disabled={isImportingHotelscom}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-bold text-[11px] rounded-xl transition-all cursor-pointer"
                >
                  <RefreshCw size={12} className={isImportingHotelscom ? 'animate-spin' : ''} />
                  <span>Hotels.com Tekil Çek</span>
                </button>

                <button
                  onClick={handleImportAggregatorReviews}
                  disabled={isImportingAggregator}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-bold text-[11px] rounded-xl transition-all cursor-pointer"
                >
                  <RefreshCw size={12} className={isImportingAggregator ? 'animate-spin' : ''} />
                  <span>Google & Booking Aggregator Tekil Çek</span>
                </button>
              </>
            );
          })()}
        </div>
      )}

      {/* Workflow Tabs */}
      <div className="flex border-b border-slate-200 gap-1 pb-px mb-6 bg-white p-1 rounded-2xl shadow-sm">
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
              className={`px-4 py-2.5 text-xs font-extrabold transition-all relative rounded-xl cursor-pointer ${
                isActive 
                  ? 'bg-indigo-50 text-indigo-650 shadow-sm border border-indigo-100/50' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Platform Summary Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-6">
        {(() => {
          const activeReviewPlatforms = visibleReviewPlatforms.filter(p => p.active);
          
          const getPlatformCount = (key: string) => {
            if (key === 'Google') return googleCount;
            if (key === 'Booking') return bookingCount;
            if (key === 'TripAdvisor') return tripadvisorCount;
            if (key === 'Hotels.com') return hotelscomCount;
            if (key === 'HolidayCheck') return holidaycheckCount;
            if (key === 'Expedia') return expediaCount;
            if (key === 'Airbnb') return airbnbCount;
            if (key === 'Yelp') return yelpCount;
            return 0;
          };

          const platformTabs = [
            { key: '', label: 'Tümü', count: allCount, icon: <span className="text-[14px]">🌐</span>, activeBorder: 'border-indigo-600 ring-2 ring-indigo-100 shadow-indigo-500/10' },
            ...activeReviewPlatforms.map(p => ({
              key: p.key,
              label: p.label,
              count: getPlatformCount(p.key),
              icon: p.icon,
              activeBorder: p.activeBorder
            }))
          ];

          return platformTabs.map((tab) => {
            const isActive = tab.key === '' ? !source : source === tab.key;
            return (
              <button
                key={tab.label}
                onClick={() => setSource(tab.key as any)}
                className={`p-3 rounded-2xl bg-white border transition-all duration-200 cursor-pointer flex flex-col justify-between items-start gap-2 shadow-sm text-left hover:border-slate-350 hover:scale-[1.02] ${
                  isActive
                    ? `${tab.activeBorder} scale-[1.02] border-indigo-600`
                    : 'border-slate-100 text-slate-655'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="shrink-0">{tab.icon}</span>
                  <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">{tab.label}</span>
                </div>
                <div className="text-xs font-black text-slate-600">
                  {tab.count} <span className="text-[9px] font-semibold text-slate-400 uppercase">Yorum</span>
                </div>
              </button>
            );
          });
        })()}
      </div>
      {/* Filters Bar */}
      <div className="space-y-2">
        <ReviewFilters
          search={search}
          setSearch={setSearch}
          source={source}
          setSource={setSource}
          rating={rating}
          setRating={setRating}
          status={status}
          setStatus={setStatus}
          priority={priority}
          setPriority={setPriority}
          sortBy={sortBy}
          setSortBy={setSortBy}
        />
        {(search || source || rating || status || priority) && (
          <div className="flex justify-end">
            <button
              onClick={() => resetPageState()}
              className="text-xs text-rose-600 hover:text-rose-700 hover:underline font-bold transition-all cursor-pointer flex items-center gap-1 focus:outline-none"
            >
              Filtreleri Sıfırla
            </button>
          </div>
        )}
      </div>

      {/* Reviews list container (Full Width) */}
      <div className="space-y-4">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-32 rounded-2xl bg-white border border-slate-200 animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl border border-rose-200 text-rose-700 bg-rose-50 flex items-center gap-3">
              <AlertCircle size={20} className="text-rose-500" />
              <span className="font-semibold text-xs">{error}</span>
            </div>
          ) : reviews.length === 0 ? (
            <div className="rounded-2xl p-12 text-center space-y-4 bg-white border border-slate-200 shadow-sm">
              <Database className="mx-auto text-slate-300" size={40} />
              <h3 className="text-sm font-bold text-slate-800">Bu otel için henüz yorum bulunmuyor.</h3>
              <p className="text-xs text-slate-500 max-w-[280px] mx-auto leading-relaxed">
                Yorumları içe aktarmak için yukarıdaki senkronizasyon butonlarını kullanabilirsiniz.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {departmentParam && (
                <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs px-4 py-2.5 rounded-xl flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                    <span className="font-semibold">
                      {departmentParam === 'reception' && `Resepsiyon ile ilgili ${reviews.length} yorum`}
                      {departmentParam === 'housekeeping' && `Kat Hizmetleri ile ilgili ${reviews.length} yorum`}
                      {departmentParam === 'fb' && `Yiyecek & İçecek ile ilgili ${reviews.length} yorum`}
                      {departmentParam === 'technical' && `Teknik Servis ile ilgili ${reviews.length} yorum`}
                      {departmentParam === 'spa' && `Spa & Havuz ile ilgili ${reviews.length} yorum`}
                      {departmentParam === 'general' && `Genel / Tesis ile ilgili ${reviews.length} yorum`}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      const newParams = new URLSearchParams(searchParams);
                      newParams.delete('department');
                      newParams.delete('from');
                      newParams.delete('to');
                      setSearchParams(newParams);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-2 py-0.5 rounded transition-all text-[10px]"
                  >
                    Temizle
                  </button>
                </div>
              )}

              {(sentimentParam || categoryParam) && (
                <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs px-4 py-2.5 rounded-xl flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                    <span className="font-semibold">
                      Filtre: {sentimentParam === 'negative' ? 'Olumsuz' : sentimentParam === 'positive' ? 'Olumlu' : ''}
                      {sentimentParam && categoryParam && ' + '}
                      {categoryParam && (
                        categoryParam === 'yemek' ? 'Yemek & Restoran' :
                        categoryParam === 'oda' ? 'Oda Konforu' :
                        categoryParam === 'personel' ? 'Personel & Hizmet' :
                        categoryParam === 'otopark' ? 'Otopark Alanı' :
                        categoryParam === 'havuz' ? 'Havuz & Aqua' :
                        categoryParam === 'plaj' ? 'Plaj & Kum' :
                        categoryParam === 'temizlik' ? 'Temizlik Kalitesi' :
                        categoryParam === 'konum' ? 'Konum & Ulaşım' :
                        categoryParam === 'manzara' ? 'Manzara' :
                        categoryParam === 'fiyat' ? 'Fiyat / Performans' : categoryParam
                      )}
                      {` (${reviews.length} yorum listeleniyor)`}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      const newParams = new URLSearchParams(searchParams);
                      newParams.delete('sentiment');
                      newParams.delete('category');
                      setSearchParams(newParams);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1 rounded-lg transition-all text-[10px] cursor-pointer"
                  >
                    Filtreyi Temizle
                  </button>
                </div>
              )}

              <div className="space-y-4">
                {paginatedReviews.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    isSelected={selectedReviewId === review.id}
                    onSelect={setSelectedReviewId}
                    onGenerateAiReply={handleGenerateAiReply}
                    onPublishReply={handlePublishGoogleReply}
                    onGenerateTask={handleOpenTaskCreationModal}
                  />
                ))}
              </div>

              {/* Pagination controls */}
              {totalReviews > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-slate-100 text-[11px] text-slate-500 font-semibold bg-white p-4 rounded-3xl shadow-sm">
                  <div>
                    Toplam <span className="font-bold text-slate-800">{totalReviews}</span> yorumdan{' '}
                    <span className="font-bold text-slate-800">{totalReviews === 0 ? 0 : startIndex + 1}</span>-
                    <span className="font-bold text-slate-800">{endIndex}</span> arası gösteriliyor
                  </div>

                  <div className="flex items-center gap-6">
                    {/* Page size selection */}
                    <div className="flex items-center gap-2">
                      <span>Gösterim:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="px-3 h-8 rounded-xl bg-slate-50 hover:bg-slate-100/50 border border-slate-200 text-slate-700 focus:outline-none focus:border-indigo-600 text-[11px] font-bold cursor-pointer transition-all"
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                    </div>

                    {/* Page numbers navigation */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-3 h-8 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-bold cursor-pointer disabled:cursor-not-allowed text-[11px]"
                      >
                        Önceki
                      </button>

                      {getPageNumbers().map((pageNum) => (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-8 h-8 rounded-xl font-black transition-all cursor-pointer text-[11px] ${
                            currentPage === pageNum
                              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                              : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      ))}

                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages || totalPages === 0}
                        className="px-3 h-8 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-bold cursor-pointer disabled:cursor-not-allowed text-[11px]"
                      >
                        Sonraki
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Load More from database if there are more reviews in db */}
              {data && data.total > data.reviews.length && (
                <div className="flex justify-center pt-2">
                  <button
                    onClick={() => setBackendLimit(prev => prev + 200)}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/[0.08] text-xs font-semibold text-slate-300 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="w-3.5 h-3.5 border-2 border-slate-500 border-t-white animate-spin rounded-full" />
                    ) : (
                      <ChevronDown size={14} />
                    )}
                    Daha Fazla Yorum Yükle ({data.reviews.length} / {data.total})
                  </button>
                </div>
              )}
            </div>
          )}
      </div>

      {/* Import Debug Summary Modal */}
      {importSummary && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg p-6 rounded-2xl border border-slate-200 shadow-2xl relative overflow-hidden space-y-6 text-slate-800">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-850 flex items-center gap-2 m-0">
                <Bell size={16} className="text-blue-600" />
                <span>İçe Aktarım Sonuç Özeti</span>
              </h3>
              <button 
                onClick={() => setImportSummary(null)}
                className="text-xs text-slate-500 hover:text-slate-800 font-bold"
              >
                Kapat
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-3.5 text-xs">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Tarih Aralığı:</span>
                  <span className="font-semibold text-slate-800">
                    {importSummary.range === '30' && 'Son 30 gün'}
                    {importSummary.range === '90' && 'Son 90 gün'}
                    {importSummary.range === '180' && 'Son 180 gün'}
                    {importSummary.range === '365' && 'Son 365 gün'}
                    {importSummary.range === 'all' && 'Tüm zamanlar'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Google’dan çekilen toplam:</span>
                  <span className="font-bold text-blue-600">{importSummary.totalFetched}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Mükerrer (Atlanan):</span>
                  <span className="font-semibold text-amber-600">{importSummary.duplicateCount}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Sisteme eklenen yeni:</span>
                  <span className="font-bold text-emerald-600">{importSummary.importedCount}</span>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-slate-500">Hata alan yorum:</span>
                  <span className="font-semibold text-rose-600">{importSummary.failedCount}</span>
                </div>
              </div>

              <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h4 className="text-[10px] text-slate-550 font-bold uppercase tracking-wider mb-2">Entegrasyon Durumu</h4>
                <div className="text-[11px] text-slate-650 space-y-1.5 leading-relaxed">
                  <div>
                    <span className="text-slate-500">Entegrasyon Durumu:</span>{' '}
                    {importSummary.importedCount > 0 ? (
                      <span className="text-emerald-600 font-semibold">Aktif (Veri İletiliyor)</span>
                    ) : importSummary.failedCount > 0 ? (
                      <span className="text-rose-600 font-semibold">Hatalı (Bağlantı Sorunu)</span>
                    ) : (
                      <span className="text-slate-500">Beklemede</span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500">Google API Sınıfı:</span>{' '}
                    <span className="text-slate-600 font-mono text-[10px]">MockGoogleProvider</span>
                  </div>
                </div>
              </div>
            </div>

            {importSummary.importDetails && importSummary.importDetails.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                  Senkronizasyon Detayları ({importSummary.importDetails.length} Yorum)
                </span>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {importSummary.importDetails.map((detail: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[10px]">
                      <code className="text-slate-600 font-mono text-[9px] truncate max-w-[200px]">{detail.reviewId}</code>
                      <span className={`px-2 py-0.5 rounded font-bold text-[8px] uppercase tracking-wider border ${
                        detail.status === 'sent' ? 'bg-emerald-55 text-emerald-600 border-emerald-200' :
                        detail.status === 'duplicate_skipped' ? 'bg-amber-55 text-amber-600 border-amber-200' :
                        'bg-rose-55 text-rose-600 border-rose-200'
                      }`}>
                        {detail.status === 'sent' && 'İletildi'}
                        {detail.status === 'duplicate_skipped' && 'Mükerrer'}
                        {detail.status === 'failed' && 'Hata'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {importSummary.detailedErrors && importSummary.detailedErrors.length > 0 && (
              <div className="space-y-3.5 pt-4 border-t border-slate-200">
                <span className="text-[10px] text-rose-600 font-bold uppercase tracking-wider block">
                  Hata Detayları ({importSummary.detailedErrors.length})
                </span>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {importSummary.detailedErrors.map((err, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-[10px] text-rose-700 space-y-1.5 leading-normal">
                      <div className="flex justify-between items-center text-[9px] border-b border-rose-200 pb-1 mb-1">
                        <span className="text-rose-700 font-bold">HATA #{idx + 1}</span>
                        <code className="text-slate-600 font-mono">ID: {err.reviewId}</code>
                      </div>
                      {err.webhookUrl && (
                        <div className="flex items-start gap-1">
                          <span className="text-slate-500 shrink-0 font-medium">Webhook URL:</span>
                          <code className="text-slate-600 font-mono break-all">{err.webhookUrl}</code>
                        </div>
                      )}
                      {err.status !== undefined && (
                        <div>
                          <span className="text-slate-500 font-medium">HTTP Durum Kodu:</span>{' '}
                          <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-bold font-mono text-[9px]">{err.status}</span>
                        </div>
                      )}
                      {err.responseBody && (
                        <div className="space-y-0.5">
                          <span className="text-slate-500 font-medium block">Yanıt Gövdesi:</span>
                          <pre className="mt-1 bg-white border border-slate-200 p-2 rounded-lg text-slate-600 font-mono text-[9px] overflow-x-auto whitespace-pre-wrap max-h-20 leading-relaxed">
                            {err.responseBody}
                          </pre>
                        </div>
                      )}
                      {err.message && (
                        <div className="text-rose-700 font-mono text-[9px] bg-white p-2 rounded-lg border border-rose-200">
                          {err.message}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-200">
              <button
                onClick={() => setImportSummary(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Aggregator Import Result Modal */}
      {aggregatorResult && (() => {
        const modalData = aggregatorResult.data || aggregatorResult;
        return (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg p-6 rounded-2xl border border-slate-200 shadow-2xl relative overflow-hidden space-y-6 text-slate-800">
              <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-850 flex items-center gap-2 m-0">
                  <Bell size={16} className="text-violet-600" />
                  <span>Aggregator İçe Aktarım Sonuç Özeti (Beta)</span>
                </h3>
                <button 
                  onClick={() => setAggregatorResult(null)}
                  className="text-xs text-slate-500 hover:text-slate-800 font-bold"
                >
                  Kapat
                </button>
              </div>
              
              <div className="space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-4 py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-semibold">Otel Adı:</span>
                  <span className="text-slate-800 font-bold text-right">{modalData.hotelName || 'Bilinmiyor'}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-semibold">Sağlayıcı:</span>
                  <span className="text-slate-800 font-bold text-right">{modalData.provider || 'Bilinmiyor'}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-semibold">Normalize Edilen (Normalized):</span>
                  <span className="text-slate-800 font-bold text-right">{modalData.normalized ?? 0}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-semibold">Yeni Eklenen (Imported):</span>
                  <span className="text-emerald-600 font-bold text-right">{modalData.imported ?? 0}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-semibold">Mükerrer Atlanan (Duplicates):</span>
                  <span className="text-amber-600 font-bold text-right">{modalData.duplicates ?? 0}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-semibold">Atlanan (Skipped):</span>
                  <span className="text-slate-600 font-bold text-right">{modalData.skipped ?? 0}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-semibold">Cevaplanmış Yorumlar (Answered):</span>
                  <span className="text-blue-600 font-bold text-right">{modalData.answeredReviews ?? 0}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-semibold">Cevaplanmamış Yorumlar (Unanswered):</span>
                  <span className="text-orange-600 font-bold text-right">{modalData.unansweredReviews ?? 0}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-semibold">Cevaplama Oranı (Response Rate):</span>
                  <span className="text-indigo-600 font-bold text-right">%{Number(modalData.responseRate ?? 0).toFixed(1)}</span>
                </div>
              </div>

              {/* Platform Summary Table */}
              {modalData.platformSummary && (
                <div className="space-y-2 border-t border-slate-200 pt-4">
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5 mb-2">
                    <span className="w-1.5 h-3 bg-violet-600 rounded-full"></span>
                    <span>Platform Bazlı İçe Aktarım Özeti</span>
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-slate-100 shadow-sm">
                    <table className="min-w-full divide-y divide-slate-100 text-[10px]">
                      <thead className="bg-slate-50 font-bold text-slate-500">
                        <tr>
                          <th className="px-2 py-1.5 text-left">Platform</th>
                          <th className="px-2 py-1.5 text-center">Normalize</th>
                          <th className="px-2 py-1.5 text-center">Eklenen</th>
                          <th className="px-2 py-1.5 text-center">Mükerrer</th>
                          <th className="px-2 py-1.5 text-center">Atlanan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                        {Object.entries(modalData.platformSummary).map(([platform, stats]: [string, any]) => {
                          const hasData = (stats.normalized || 0) > 0;
                          return (
                            <tr key={platform} className={hasData ? "bg-slate-50/50 font-bold" : "opacity-50"}>
                              <td className="px-2 py-1 text-left font-bold text-slate-800">{platform}</td>
                              <td className="px-2 py-1 text-center">{stats.normalized ?? 0}</td>
                              <td className="px-2 py-1 text-center text-emerald-600">{stats.imported ?? 0}</td>
                              <td className="px-2 py-1 text-center text-amber-600">{stats.duplicates ?? 0}</td>
                              <td className="px-2 py-1 text-center text-slate-400">{stats.skipped ?? 0}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Errors List */}
              {modalData.errors && modalData.errors.length > 0 && (
                <div className="space-y-2 border-t border-slate-200 pt-4">
                  <h4 className="font-bold text-rose-600 text-xs">Hata Detayları ({modalData.errors.length}):</h4>
                  <div className="max-h-24 overflow-y-auto space-y-1 bg-rose-50 p-2 rounded-xl border border-rose-100">
                    {modalData.errors.map((err: any, idx: number) => (
                      <div key={idx} className="text-[10px] text-rose-700 leading-normal font-mono">
                        {err.externalId ? `[Id: ${err.externalId}] ` : ''}{err.message || String(err)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw Backend Response */}
              <div className="space-y-2 border-t border-slate-200 pt-4">
                <details className="group">
                  <summary className="font-bold text-slate-700 text-xs cursor-pointer select-none flex items-center justify-between group-open:mb-2 hover:text-slate-900 transition-colors">
                    <span>Ham Backend Yanıtı (Raw JSON)</span>
                    <span className="text-[10px] text-slate-400 font-mono group-hover:text-slate-600">
                      [Göster / Gizle]
                    </span>
                  </summary>
                  <pre className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-[9px] text-slate-600 font-mono overflow-x-auto max-h-48 leading-relaxed whitespace-pre-wrap">
                    {JSON.stringify(aggregatorResult, null, 2)}
                  </pre>
                </details>
              </div>

              {/* Raw/API Error */}
              {modalData.rawError && (
                <div className="space-y-2 border-t border-slate-200 pt-4">
                  <h4 className="font-bold text-rose-600 text-xs">Hata Mesajı:</h4>
                  <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-100 text-[10px] text-rose-700 font-mono overflow-x-auto max-h-32">
                    {modalData.rawError}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Unified Sync Results Modal */}
      {unifiedSyncResult && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl p-6 rounded-2xl border border-slate-200 shadow-2xl relative overflow-hidden space-y-6 text-slate-800">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-850 flex items-center gap-2 m-0">
                <Bell className="text-emerald-500" size={16} />
                <span>Tüm Platformlar Senkronizasyon Raporu</span>
              </h3>
              <button 
                onClick={() => setUnifiedSyncResult(null)}
                className="text-xs text-slate-500 hover:text-slate-800 font-bold"
              >
                Kapat
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="text-xs text-slate-600">
                Otel: <span className="font-bold text-slate-800">{unifiedSyncResult.hotelName}</span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-100 shadow-sm">
                <table className="min-w-full divide-y divide-slate-100 text-[11px]">
                  <thead className="bg-slate-50 font-bold text-slate-500">
                    <tr>
                      <th className="px-3 py-2.5 text-left">Platform</th>
                      <th className="px-2 py-2.5 text-center">Sync Modu</th>
                      <th className="px-2 py-2.5 text-center">Başlangıç</th>
                      <th className="px-2 py-2.5 text-center">Yeni</th>
                      <th className="px-2 py-2.5 text-center">Mükerrer</th>
                      <th className="px-2 py-2.5 text-center">Son Yorum</th>
                      <th className="px-2 py-2.5 text-left">Tasarruf / Durum</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                    {Object.entries(unifiedSyncResult.results).map(([platform, stats]: [string, any]) => {
                      const hasErrors = stats.errors && stats.errors.length > 0;
                      const modeLabel = stats.syncMode === 'initial_full_sync' 
                        ? 'İlk Kurulum' 
                        : stats.syncMode === 'manual_full_resync'
                        ? 'Manuel Tam'
                        : 'Kademeli';

                      return (
                        <tr key={platform} className="hover:bg-slate-50/30">
                          <td className="px-3 py-2 text-left font-bold text-slate-800">{platform}</td>
                          <td className="px-2 py-2 text-center font-medium text-slate-600">{modeLabel}</td>
                          <td className="px-2 py-2 text-center text-slate-500">{stats.syncStartDate || 'Tüm Geçmiş'}</td>
                          <td className="px-2 py-2 text-center text-emerald-600 font-bold">{stats.imported ?? 0}</td>
                          <td className="px-2 py-2 text-center text-amber-600 font-bold">{stats.duplicates ?? 0}</td>
                          <td className="px-2 py-2 text-center text-slate-500">
                            {stats.lastReviewDate ? new Date(stats.lastReviewDate).toLocaleDateString('tr-TR') : '-'}
                          </td>
                          <td className="px-2 py-2 text-left">
                            <div className="flex flex-col gap-1">
                              {stats.estimatedCostSavingMessage ? (
                                <span className="text-emerald-700 font-bold bg-emerald-50 px-1 py-0.5 rounded text-[8.5px] w-fit">
                                  {stats.estimatedCostSavingMessage}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[8.5px] italic">Tasarruf Yok (Tam)</span>
                              )}
                              {hasErrors ? (
                                <span className="text-rose-600 font-bold text-[8.5px]">
                                  Hata Var {stats.elapsedMs ? `(${Math.round(stats.elapsedMs / 100) / 10}s)` : ''}
                                </span>
                              ) : (
                                <span className="text-emerald-600 font-bold text-[8.5px]">
                                  Başarılı {stats.elapsedMs ? `(${Math.round(stats.elapsedMs / 100) / 10}s)` : ''}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Limit Warning Alert & Continue Sync Option */}
            {(() => {
              const platformsWithWarning = Object.entries(unifiedSyncResult.results)
                .filter(([_, stats]: [any, any]) => stats.hasMorePotentialReviews || (stats.imported + stats.duplicates >= 100))
                .map(([platform]) => platform);
              
              if (platformsWithWarning.length === 0) return null;

              return (
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 space-y-2">
                  <div className="flex items-start gap-2 text-xs">
                    <span className="text-sm">⚠️</span>
                    <div>
                      <span className="font-bold">Daha fazla yeni yorum olabilir:</span>{' '}
                      {platformsWithWarning.join(', ')} platformlarında 100 yorum limitine ulaşıldı.
                    </div>
                  </div>
                  {isSuperAdmin && (
                    <button
                      onClick={() => {
                        setUnifiedSyncResult(null);
                        handleSyncAllPlatforms('manual_full_resync');
                      }}
                      className="w-full mt-1 py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[10px] rounded-lg transition-all shadow-sm cursor-pointer text-center block"
                    >
                      Devam Sync Çalıştır (Kalan Geçmişi Çek - Full Sync)
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Error Detail Sections */}
            {(() => {
              const allErrors = Object.entries(unifiedSyncResult.results)
                .filter(([_, stats]: [any, any]) => stats.errors && stats.errors.length > 0);
              if (allErrors.length === 0) return null;
              return (
                <div className="space-y-2 border-t border-slate-200 pt-4">
                  <h4 className="font-bold text-rose-600 text-xs">Hata Detayları:</h4>
                  <div className="max-h-56 overflow-y-auto space-y-3 bg-rose-50 p-3 rounded-xl border border-rose-100 font-sans text-[10px]">
                    {allErrors.map(([platform, stats]: [any, any]) => (
                      <div key={platform} className="space-y-1">
                        <div className="font-bold text-rose-900 border-b border-rose-200/50 pb-0.5 text-xs">{platform}:</div>
                        {stats.errors.map((err: any, idx: number) => (
                          <div key={idx} className="text-rose-700 ml-2 space-y-1 bg-white/60 p-2 rounded border border-rose-200/40">
                            <div className="font-semibold text-rose-800">Hata: <span className="font-normal text-rose-750">{err.message || String(err)}</span></div>
                            {err.action && <div><span className="font-bold text-slate-505">İşlem:</span> <span className="font-mono text-[9px] bg-slate-100 px-1 py-0.5 rounded text-slate-700">{err.action}</span></div>}
                            {err.elapsedMs && <div><span className="font-bold text-slate-505">Süre:</span> <span className="font-semibold text-slate-700">{Math.round(err.elapsedMs / 100) / 10}s</span></div>}
                            {err.stack && (
                              <div className="mt-1 bg-slate-900 text-slate-200 p-2 rounded overflow-x-auto font-mono text-[9px] max-h-32 leading-normal select-all">
                                {err.stack}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div className="flex justify-end pt-2 border-t border-slate-200">
              <button
                onClick={() => setUnifiedSyncResult(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}



      {/* Manual Task Creation Modal */}
      {taskCreationReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-blue-500/20 bg-slate-900/95 relative card-glow text-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <CheckSquare size={16} className="text-rose-500" />
                Düzeltici Aksiyon Görevi Oluştur
              </h3>
              <button 
                onClick={() => setTaskCreationReview(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1.5">
                <div className="flex justify-between items-center text-slate-350">
                  <span className="font-semibold">{taskCreationReview.guestName || 'Misafir'} ({taskCreationReview.source})</span>
                  <span className="text-[10px] text-amber-400 font-extrabold">{taskCreationReview.rating} Yıldız</span>
                </div>
                <p className="italic leading-relaxed">
                  "{taskCreationReview.comment || 'Yorum metni bulunmuyor'}"
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Görev Departmanı (Önerilen)</label>
                <select
                  value={taskCreationDept}
                  onChange={(e) => setTaskCreationDept(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs focus:outline-none focus:border-blue-500 text-slate-300 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="Misafir İlişkileri" className="bg-[#090b16]">Misafir İlişkileri</option>
                  <option value="Ön Büro" className="bg-[#090b16]">Ön Büro</option>
                  <option value="Housekeeping" className="bg-[#090b16]">Housekeeping</option>
                  <option value="Teknik Servis" className="bg-[#090b16]">Teknik Servis</option>
                  <option value="Yiyecek & İçecek" className="bg-[#090b16]">Yiyecek & İçecek</option>
                  <option value="Spa" className="bg-[#090b16]">Spa</option>
                  <option value="Yönetim" className="bg-[#090b16]">Yönetim</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Görev Önceliği (Önerilen)</label>
                <select
                  value={taskCreationPriority}
                  onChange={(e) => setTaskCreationPriority(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs focus:outline-none focus:border-blue-500 text-slate-300 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="critical" className="bg-[#090b16]">Kritik</option>
                  <option value="high" className="bg-[#090b16]">Yüksek</option>
                  <option value="medium" className="bg-[#090b16]">Orta</option>
                  <option value="low" className="bg-[#090b16]">Düşük</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800/60">
                <button
                  onClick={() => setTaskCreationReview(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
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
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl border border-blue-200 bg-white shadow-2xl flex items-center gap-3 animate-slide-in max-w-sm">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
            <Bell size={16} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800">Bildirim</h4>
            <p className="text-[10px] text-slate-500 mt-0.5 font-medium">{toastMessage}</p>
          </div>
          <button 
            onClick={() => setToastMessage(null)}
            className="text-xs text-slate-500 hover:text-slate-800 font-bold ml-4"
          >
            Kapat
          </button>
        </div>
      )}
    </div>
  );
}


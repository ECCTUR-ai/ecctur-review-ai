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
import { 
  RefreshCw, 
  Download, 
  AlertCircle,
  Database,
  ArrowLeft,
  Bell,
  Sparkles,
  ShieldAlert,
  ChevronDown
} from 'lucide-react';

import { hotelRepository } from '@/repositories/hotelRepository';

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
  const { hotelIds, roleKey } = useAuth();
  const isSuperAdmin = roleKey === 'super_admin';
  const hasNoAssignedHotels = !isSuperAdmin && (!hotelIds || hotelIds.length === 0);

  const [searchParams, setSearchParams] = useSearchParams();
  const departmentParam = searchParams.get('department');
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
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

  const googleCount = baseReviewsForCounts.filter(r => normalizeReviewPlatform(r.source) === 'google').length;
  const tripadvisorCount = baseReviewsForCounts.filter(r => normalizeReviewPlatform(r.source) === 'tripadvisor').length;
  const bookingCount = baseReviewsForCounts.filter(r => normalizeReviewPlatform(r.source) === 'booking').length;
  const holidaycheckCount = baseReviewsForCounts.filter(r => normalizeReviewPlatform(r.source) === 'holidaycheck').length;
  const hotelscomCount = baseReviewsForCounts.filter(r => normalizeReviewPlatform(r.source) === 'hotelscom').length;
  const otherCount = baseReviewsForCounts.filter(r => normalizeReviewPlatform(r.source) === 'other').length;

  const allCount = baseReviewsForCounts.length;

  let reviews = data?.reviews || [];

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

  const handleSyncAllPlatforms = () => {
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

      let results: string[] = [];

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

        // 1. Google
        if (googleMapsUrl) {
          try {
            const response = await fetch('/api/reviews?action=import-google-maps', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ hotelId: currentHotelId, googleMapsUrl, mode: googleMode })
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
              throw new Error('Server error');
            }

            if (response.ok) {
              results.push(`Google: ${res.insertedCount} yeni yorum`);
            } else {
              if (response.status === 504 || response.status === 502 || isTimeoutError(null, JSON.stringify(res))) {
                results.push(`Google: Hata (Zaman aşımı)`);
              } else {
                results.push(`Google: Hata (${res.error || 'İçe aktarılamadı'})`);
              }
            }
          } catch (e: any) {
            if (e.message === 'TIMEOUT_ERROR' || isTimeoutError(e)) {
              results.push(`Google: Hata (Zaman aşımı)`);
            } else {
              results.push(`Google: Hata (${e.message})`);
            }
          }
        }

        // 2. TripAdvisor
        if (tripadvisorUrl) {
          try {
            const response = await fetch('/api/reviews?action=import-tripadvisor', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ hotelId: currentHotelId, tripadvisorUrl, mode: taMode })
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
              throw new Error('Server error');
            }

            if (response.ok) {
              results.push(`Tripadvisor: ${res.insertedCount} yeni yorum`);
            } else {
              if (response.status === 504 || response.status === 502 || isTimeoutError(null, JSON.stringify(res))) {
                results.push(`Tripadvisor: Hata (Zaman aşımı)`);
              } else {
                results.push(`Tripadvisor: Hata (${res.error || 'İçe aktarılamadı'})`);
              }
            }
          } catch (e: any) {
            if (e.message === 'TIMEOUT_ERROR' || isTimeoutError(e)) {
              results.push(`Tripadvisor: Hata (Zaman aşımı)`);
            } else {
              results.push(`Tripadvisor: Hata (${e.message})`);
            }
          }
        }

        // 3. Booking.com
        if (bookingUrl) {
          try {
            const response = await fetch('/api/reviews?action=import-booking', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ hotelId: currentHotelId, range: importRange, mode: bookingMode })
            });
            const res = await response.json();
            if (response.ok) {
              const count = res.insertedCount ?? res.importedCount ?? 0;
              const updated = res.updatedCount ?? 0;
              results.push(`Booking.com: ${count} yeni, ${updated} güncellendi`);
            } else {
              results.push(`Booking.com: Hata (${res.error || 'İçe aktarılamadı'})`);
            }
          } catch (e: any) {
            results.push(`Booking.com: Hata (${e.message})`);
          }
        }

        // 4. HolidayCheck
        if (holidaycheckUrl) {
          try {
            const response = await fetch('/api/reviews?action=import-holidaycheck', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ hotelId: currentHotelId, holidaycheckUrl, mode: hcMode })
            });
            const res = await response.json();
            if (response.ok) {
              const count = res.insertedCount ?? 0;
              results.push(`HolidayCheck: ${count} yeni yorum`);
            } else {
              results.push(`HolidayCheck: Hata (${res.error || 'İçe aktarılamadı'})`);
            }
          } catch (e: any) {
            results.push(`HolidayCheck: Hata (${e.message})`);
          }
        }

        // 5. Hotels.com
        if (hotelscomUrl) {
          try {
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
                mode: hotelscomMode
              })
            });
            const res = await response.json();
            if (response.ok) {
              const count = res.insertedCount ?? 0;
              results.push(`Hotels.com: ${count} yeni yorum`);
            } else {
              results.push(`Hotels.com: Hata (${res.error || 'İçe aktarılamadı'})`);
            }
          } catch (e: any) {
            results.push(`Hotels.com: Hata (${e.message})`);
          }
        }

        const hasTimeout = results.some(r => r.includes('Zaman aşımı'));
        if (hasTimeout) {
          alert("Senkronizasyon zaman aşımına uğradı. Lütfen birazdan tekrar deneyin veya daha küçük aralıkla çalıştırın.");
        } else {
          setToastMessage(`Senkronizasyon tamamlandı:\n${results.join('\n')}`);
        }
        refetch();
      } catch (err: any) {
        console.error(err);
        if (isTimeoutError(err)) {
          alert("Senkronizasyon zaman aşımına uğradı. Lütfen birazdan tekrar deneyin veya daha küçük aralıkla çalıştırın.");
        } else {
          alert(`Hata: ${err.message || 'Senkronizasyon sırasında bir sorun oluştu.'}`);
        }
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
    try {
      const { data: updatedRow, error } = await supabase
        .from('reviews')
        .update({
          status: 'Published',
          publish_status: 'Published',
          published: 'Yes',
          published_at: new Date().toISOString(),
          ai_reply: replyText
        })
        .eq('id', id)
        .select('*')
        .maybeSingle();

      if (error) throw error;

      setToastMessage("Cevap başarıyla yayınlandı olarak işaretlendi.");

      // Try to insert audit log
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        const userEmail = currentUser?.email || '';
        const userMetadata = currentUser?.user_metadata || {};
        const userName = [userMetadata.first_name, userMetadata.last_name].filter(Boolean).join(' ') || 'User';

        await supabase.from('review_action_logs').insert({
          review_id: id,
          hotel_id: updatedRow?.hotel_id,
          organization_id: updatedRow?.organization_id,
          action_type: 'published',
          action_by_user_id: currentUser?.id,
          action_by_user_email: userEmail,
          action_by_user_name: userName,
          action_at: new Date().toISOString(),
          previous_status: updatedRow?.status || 'draft',
          new_status: 'published',
          platform: String(updatedRow?.platform || 'google').toLowerCase(),
          guest_name: updatedRow?.guestName || 'Guest',
          review_reply_text: replyText,
          ai_generated: true,
          published_at: new Date().toISOString(),
          approved_at: new Date().toISOString()
        });
      } catch (logErr) {
        console.warn('[handlePublishGoogleReply] Failed to insert audit log:', logErr);
      }

      refetch();
    } catch (err: any) {
      console.error('Failed to publish Google reply locally:', err);
      alert("Yorum yayınlandı olarak işaretlenemedi.");
      throw err;
    }
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
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold text-slate-800 m-0">{t('reviews.title')}</h1>
          <p className="text-xs text-slate-500">
            {t('reviews.subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <select
              value={importRange}
              onChange={(e) => setImportRange(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none text-slate-700 min-h-[36px]"
            >
              <option value="30">Son 30 gün</option>
              <option value="90">Son 90 gün</option>
              <option value="180">Son 180 gün</option>
              <option value="365">Son 365 gün</option>
              <option value="all">Tüm zamanlar</option>
            </select>
          </div>

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
                  onClick={handleImportGoogleMapsReviews}
                  disabled={isImportingGoogleMaps || !hasGoogle}
                  title={!hasGoogle ? "Bu otel için Google Maps linki tanımlanmamış." : "Google Maps yorumlarını çek"}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition-all shadow-md shadow-emerald-500/10 min-h-[36px] cursor-pointer"
                >
                  <RefreshCw size={14} className={isImportingGoogleMaps ? 'animate-spin' : ''} />
                  <span>{isImportingGoogleMaps ? 'Google Çekiliyor...' : 'Google Maps Yorumlarını Çek'}</span>
                </button>

                <button
                  onClick={handleImportTripadvisorReviews}
                  disabled={isImportingTripadvisor || !hasTripadvisor}
                  title={!hasTripadvisor ? "Bu otel için TripAdvisor URL tanımlanmamış. Lütfen Admin panelinden tanımlayın." : "TripAdvisor yorumlarını çek"}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-tr from-cyan-600 to-blue-500 hover:from-cyan-500 hover:to-blue-400 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition-all shadow-md shadow-blue-500/10 min-h-[36px] cursor-pointer"
                >
                  <RefreshCw size={14} className={isImportingTripadvisor ? 'animate-spin' : ''} />
                  <span>{isImportingTripadvisor ? 'TripAdvisor Çekiliyor...' : 'Tripadvisor Yorumlarını Çek'}</span>
                </button>

                <button
                  onClick={handleImportBookingReviews}
                  disabled={isImportingBooking || !hasBooking}
                  title={!hasBooking ? "Bu otel için Booking.com URL tanımlanmamış. Lütfen Admin panelinden tanımlayın." : "Booking.com yorumlarını çek"}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-tr from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition-all shadow-md shadow-orange-500/10 min-h-[36px] cursor-pointer"
                >
                  <RefreshCw size={14} className={isImportingBooking ? 'animate-spin' : ''} />
                  <span>{isImportingBooking ? 'Booking Çekiliyor...' : 'Booking.com Yorumlarını Çek'}</span>
                </button>

                <button
                  onClick={handleSyncHolidaycheckReviews}
                  disabled={isImportingHolidaycheck}
                  title={!hasHolidaycheck ? "Bu otel için HolidayCheck URL tanımlanmamış. Lütfen Admin panelinden tanımlayın." : "HolidayCheck yorumlarını çek"}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-tr from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition-all shadow-md shadow-rose-500/10 min-h-[36px] cursor-pointer"
                >
                  <RefreshCw size={14} className={isImportingHolidaycheck ? 'animate-spin' : ''} />
                  <span>{isImportingHolidaycheck ? 'HolidayCheck Çekiliyor...' : 'HolidayCheck Yorumlarını Çek'}</span>
                </button>

                <button
                  onClick={handleSyncHotelscomReviews}
                  disabled={isImportingHotelscom}
                  title={!hasHotelscom ? "Bu otel için Hotels.com URL tanımlanmamış. Lütfen Admin panelinden tanımlayın." : "Hotels.com yorumlarını çek"}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-tr from-sky-600 to-indigo-500 hover:from-sky-500 hover:to-indigo-400 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition-all shadow-md shadow-indigo-500/10 min-h-[36px] cursor-pointer"
                >
                  <RefreshCw size={14} className={isImportingHotelscom ? 'animate-spin' : ''} />
                  <span>{isImportingHotelscom ? 'Hotels.com Çekiliyor...' : 'Hotels.com Yorumlarını Çek'}</span>
                </button>

                <button
                  onClick={handleSyncAllPlatforms}
                  disabled={isSyncingAll || !hasAnyLink}
                  title={!hasAnyLink ? "Bu otel için tanımlı hiçbir platform linki bulunamadı." : "Tüm platformları senkronize et"}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-tr from-indigo-600 to-purple-500 hover:from-indigo-500 hover:to-purple-400 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition-all shadow-md shadow-indigo-500/10 min-h-[36px] cursor-pointer"
                >
                  <RefreshCw size={14} className={isSyncingAll ? 'animate-spin' : ''} />
                  <span>{isSyncingAll ? 'Senkronize Ediliyor...' : 'Tüm Platformları Senkronize Et'}</span>
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

      {/* Platform Summary Counters */}
      <div className="flex flex-wrap gap-2 mb-4 bg-slate-50/50 p-2 rounded-2xl border border-slate-100">
        {(() => {
          const platformTabs = [
            { key: '', label: 'Tümü', count: allCount, activeClass: 'bg-slate-900 border-slate-900 text-white shadow-sm shadow-slate-900/10', countBgActive: 'bg-white/20 text-white', countBgInactive: 'bg-slate-100 text-slate-600', dotColor: '' },
            { key: 'Google', label: 'Google Reviews', count: googleCount, activeClass: 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-500/10', countBgActive: 'bg-white/20 text-white', countBgInactive: 'bg-blue-50 text-blue-600', dotColor: 'bg-blue-500' },
            { key: 'TripAdvisor', label: 'TripAdvisor', count: tripadvisorCount, activeClass: 'bg-emerald-600 border-emerald-600 text-white shadow-sm shadow-emerald-500/10', countBgActive: 'bg-white/20 text-white', countBgInactive: 'bg-emerald-50 text-emerald-600', dotColor: 'bg-emerald-500' },
            { key: 'Booking', label: 'Booking.com', count: bookingCount, activeClass: 'bg-sky-600 border-sky-600 text-white shadow-sm shadow-sky-500/10', countBgActive: 'bg-white/20 text-white', countBgInactive: 'bg-sky-50 text-sky-600', dotColor: 'bg-sky-500' },
            { key: 'Hotels.com', label: 'Hotels.com', count: hotelscomCount, activeClass: 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-500/10', countBgActive: 'bg-white/20 text-white', countBgInactive: 'bg-indigo-50 text-indigo-600', dotColor: 'bg-indigo-500' },
            { key: 'HolidayCheck', label: 'HolidayCheck', count: holidaycheckCount, activeClass: 'bg-pink-600 border-pink-600 text-white shadow-sm shadow-pink-500/10', countBgActive: 'bg-white/20 text-white', countBgInactive: 'bg-pink-50 text-pink-600', dotColor: 'bg-pink-500' }
          ];

          return platformTabs.map((tab) => {
            const isActive = tab.key === '' ? !source : source === tab.key;
            return (
              <button
                key={tab.label}
                onClick={() => setSource(tab.key as any)}
                className={`px-4 py-2.5 rounded-xl border font-bold text-xs transition-all cursor-pointer flex items-center gap-2 ${
                  isActive
                    ? tab.activeClass
                    : 'bg-white border-slate-100 text-slate-600 hover:border-slate-200'
                }`}
              >
                {tab.dotColor && <span className={`w-1.5 h-1.5 rounded-full ${tab.dotColor} shrink-0`} />}
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${isActive ? tab.countBgActive : tab.countBgInactive}`}>
                  {tab.count}
                </span>
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

              <div className="space-y-4">
                {paginatedReviews.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    isSelected={selectedReviewId === review.id}
                    onSelect={setSelectedReviewId}
                  />
                ))}
              </div>

              {/* Pagination controls */}
              {totalReviews > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200 text-xs text-slate-500">
                  <div>
                    Toplam <span className="font-semibold text-slate-700">{totalReviews}</span> yorumdan{' '}
                    <span className="font-semibold text-slate-700">{totalReviews === 0 ? 0 : startIndex + 1}</span>-
                    <span className="font-semibold text-slate-700">{endIndex}</span> arası gösteriliyor
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    {/* Page size selection */}
                    <div className="flex items-center gap-1.5">
                      <span>Gösterim:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 focus:outline-none focus:border-blue-500 text-xs font-semibold cursor-pointer"
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                    </div>

                    {/* Page numbers navigation */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-semibold cursor-pointer disabled:cursor-not-allowed text-[11px]"
                      >
                        Önceki
                      </button>

                      {getPageNumbers().map((pageNum) => (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer text-[11px] ${
                            currentPage === pageNum
                              ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                              : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      ))}

                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages || totalPages === 0}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-semibold cursor-pointer disabled:cursor-not-allowed text-[11px]"
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


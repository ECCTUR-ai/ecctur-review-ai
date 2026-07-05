import React, { useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { useTranslation } from 'react-i18next';
import { analyticsService } from '@/services/analyticsService';
import { reviewService } from '@/services/reviewService';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthGuard';
import { usePersistentPageState } from '@/hooks/usePersistentPageState';
import { normalizeReviewPlatform } from '@/utils/platform';
import { matchesCategory } from '@/utils/categoryMappings';
import {
  TrendingUp,
  Star,
  MessageSquare,
  Clock,
  CheckCircle,
  Sparkles,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  RefreshCw,
  Download
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface ScrapedReview {
  id: string;
  guestName: string;
  comment: string;
  hotel: string;
  rating: number;
  source: string;
  status: string;
  relativeDate: string;
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { hotelIds, roleKey } = useAuth();
  const isSuperAdmin = roleKey === 'super_admin';
  const hasNoAssignedHotels = !isSuperAdmin && (!hotelIds || hotelIds.length === 0);

  const { setIsApiOnline, currentHotelId, hotels } = useOutletContext<{
    setIsApiOnline: (val: boolean) => void;
    currentHotelId: string;
    hotels: any[];
  }>();

  const [pageState, setPageState, resetPageState] = usePersistentPageState('guestreview_dashboard_state', {
    isSectionOpen: true,
    showAllReviews: false,
    expandedReviews: {} as Record<string, boolean>
  });

  const { isSectionOpen, showAllReviews, expandedReviews } = pageState;

  const setIsSectionOpen = (val: boolean) => setPageState({ isSectionOpen: val });
  const setShowAllReviews = (val: boolean) => setPageState({ showAllReviews: val });
  const setExpandedReviews = (val: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => {
    setPageState(prev => ({
      expandedReviews: typeof val === 'function' ? val(prev.expandedReviews) : val
    }));
  };

  const toggleReviewExpand = (reviewId: string) => {
    setExpandedReviews(prev => ({
      ...prev,
      [reviewId]: !prev[reviewId]
    }));
  };

  const activeHotelId = currentHotelId || '00000000-0000-0000-0000-000000000000';

  const [lastSyncHealth, setLastSyncHealth] = React.useState<any | null>(null);
  const [isExporting, setIsExporting] = React.useState(false);
  const [dbSyncStates, setDbSyncStates] = React.useState<any[]>([]);
  const [timeFilter, setTimeFilter] = React.useState<string>('30_days');

  const fetchSyncStates = React.useCallback(async () => {
    if (!activeHotelId) return;
    try {
      const { data, error } = await supabase
        .from('review_sync_states')
        .select('*')
        .eq('hotel_id', activeHotelId);
      if (data && !error) {
        setDbSyncStates(data);
      }
    } catch (err) {
      console.error('Failed to fetch sync states:', err);
    }
  }, [activeHotelId]);

  React.useEffect(() => {
    fetchSyncStates();
    if (activeHotelId) {
      try {
        const stored = localStorage.getItem(`sync_health_${activeHotelId}`);
        if (stored) {
          setLastSyncHealth(JSON.parse(stored));
        } else {
          setLastSyncHealth(null);
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, [activeHotelId, fetchSyncStates]);
  
  // Strict tenant security check
  const isAuthorized = isSuperAdmin || (hotelIds && hotelIds.includes(activeHotelId));
  const queriedHotelId = isAuthorized ? activeHotelId : '00000000-0000-0000-0000-000000000000';

  const handleExportReviews = async () => {
    if (!queriedHotelId) return;
    setIsExporting(true);
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('hotel_id', queriedHotelId)
        .order('review_date', { ascending: false });
      
      if (error) throw error;
      
      const headers = ['Misafir Adı', 'Puan', 'Yorum', 'Platform', 'Tarih', 'Durum'];
      const rows = (data || []).map(r => [
        r.guest_name || 'Misafir',
        r.rating || '',
        (r.review_text || '').replace(/"/g, '""'),
        r.platform || '',
        r.review_date || '',
        r.status || ''
      ]);
      
      const csvContent = "\uFEFF" + [
        headers.join(','),
        ...rows.map(e => e.map(val => `"${val}"`).join(","))
      ].join("\n");
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `reviews_export_${queriedHotelId}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error(e);
      alert('Dışa aktarım sırasında bir hata oluştu.');
    } finally {
      setIsExporting(false);
    }
  };

  // 1. Load backend metrics
  const {
    data: metrics,
    loading: metricsLoading,
    error: metricsError,
    refetch: refetchMetrics
  } = useFetch(() => analyticsService.getMetrics(queriedHotelId), [queriedHotelId]);

  // 2. Load recent reviews
  const {
    data: recentReviewsData,
    loading: reviewsLoading,
    error: reviewsError,
    refetch: refetchReviews
  } = useFetch(() => reviewService.getReviews({ limit: 10, hotelId: queriedHotelId }), [queriedHotelId]);

  // 3. Load trends
  const {
    data: trends,
    loading: trendsLoading,
    error: trendsError,
  } = useFetch(() => analyticsService.getTrends('30d', queriedHotelId), [queriedHotelId]);

  // 4. Load platform share
  const {
    data: platformShare,
    loading: platformLoading,
    error: platformError,
  } = useFetch(() => analyticsService.getPlatformShare(queriedHotelId), [queriedHotelId]);

  // 5. Load rating distribution raw values to calculate star rating counts
  const {
    data: ratingsDistributionRaw,
    loading: ratingsLoading,
    error: ratingsError,
  } = useFetch(async () => {
    const { data, error } = await supabase
      .from('reviews')
      .select('rating')
      .eq('hotel_id', queriedHotelId);
    if (error) throw error;
    return data || [];
  }, [queriedHotelId]);

  // Load platform stats for Jura Hotels Ada Beach
  const {
    data: allReviewsForStats,
    loading: allReviewsLoading,
    error: allReviewsError,
    refetch: refetchAllReviews
  } = useFetch(async () => {
    const { data, error } = await supabase
      .from('reviews')
      .select('platform, rating, review_date, status, review_text, created_at, guest_name')
      .eq('hotel_id', queriedHotelId);
    if (error) throw error;
    return data || [];
  }, [queriedHotelId]);

  const filteredReviewsForStats = React.useMemo(() => {
    if (!allReviewsForStats) return [];
    if (timeFilter === 'all') return allReviewsForStats;

    const now = new Date();
    const limitDate = new Date();

    if (timeFilter === 'today') {
      limitDate.setHours(0, 0, 0, 0);
    } else if (timeFilter === '7_days') {
      limitDate.setDate(now.getDate() - 7);
    } else if (timeFilter === '30_days') {
      limitDate.setDate(now.getDate() - 30);
    } else if (timeFilter === '3_months') {
      limitDate.setMonth(now.getMonth() - 3);
    } else if (timeFilter === '6_months') {
      limitDate.setMonth(now.getMonth() - 6);
    } else if (timeFilter === '1_year') {
      limitDate.setFullYear(now.getFullYear() - 1);
    }

    return (allReviewsForStats as any[] || []).filter((r: any) => {
      const dateVal = r.review_date || r.created_at;
      if (!dateVal) return false;
      return new Date(dateVal) >= limitDate;
    });
  }, [allReviewsForStats, timeFilter]);


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

  // Set API status indicator based on actual connection errors
  useEffect(() => {
    if (metricsError || reviewsError || trendsError || platformError || ratingsError) {
      setIsApiOnline(false);
    } else {
      setIsApiOnline(true);
    }
  }, [metricsError, reviewsError, trendsError, platformError, ratingsError, setIsApiOnline]);

  // Compute metrics with default fallbacks
  let totalReviews = 0;
  let avgRating = 0;
  let aiResponseRate = 0;
  let draftReviews = 0;
  let publishedReviews = 0;

  if (metrics && metrics.length > 0) {
    const rawTotal = metrics.find(m => m.title === 'Total Reviews')?.value;
    if (rawTotal !== undefined) totalReviews = Number(rawTotal);

    const rawAvg = metrics.find(m => m.title === 'Average Rating')?.value;
    if (rawAvg) {
      const parsedAvg = parseFloat(String(rawAvg).split('/')[0]);
      if (!isNaN(parsedAvg)) avgRating = Number(parsedAvg.toFixed(1));
    }

    const rawAi = metrics.find(m => m.title === 'AI Response Rate')?.value;
    if (rawAi) {
      const parsedAi = parseInt(String(rawAi).replace('%', ''), 10);
      if (!isNaN(parsedAi)) aiResponseRate = parsedAi;
    }

    const rawDraft = metrics.find(m => m.title === 'Draft Reviews')?.value;
    if (rawDraft !== undefined) draftReviews = Number(rawDraft);

    const rawPub = metrics.find(m => m.title === 'Published Reviews')?.value;
    if (rawPub !== undefined) publishedReviews = Number(rawPub);
  }

  // We completely disable demo fallback
  const isDemoData = false;

  const isLoading = metricsLoading || reviewsLoading || ratingsLoading;
  const hasNoReviews = !isLoading && totalReviews === 0;

  if (hasNoReviews) {
    return (
      <div className="space-y-6 text-slate-800">
        {/* Title Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-slate-900 m-0">Dashboard</h1>
            <p className="text-xs text-slate-500">Genel bakış ve önemli istatistikler</p>
          </div>
        </div>

        <div className="min-h-[50vh] bg-white border border-slate-100 rounded-2xl flex flex-col justify-center items-center text-center p-8 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 mb-4">
            <MessageSquare size={28} />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">Yorum Bulunmuyor</h3>
          <p className="text-xs text-slate-500 max-w-sm">
            Bu otel için henüz yorum bulunmuyor.
          </p>
        </div>
      </div>
    );
  }

  // Hardcoded Demo Values mapping
  const finalTotalReviews = isDemoData ? 1248 : totalReviews;
  const finalAvgRating = isDemoData ? 4.6 : avgRating;
  const finalAiResponseRate = isDemoData ? 78 : aiResponseRate;
  const finalDraftReviews = isDemoData ? 7 : draftReviews;
  const finalPublishedReviews = isDemoData ? 942 : publishedReviews;

  // Trend Chart datasets
  const trendDataMock = [
    { date: '1 Haz', Google: 42, Tripadvisor: 23 },
    { date: '4 Haz', Google: 60, Tripadvisor: 28 },
    { date: '8 Haz', Google: 58, Tripadvisor: 24 },
    { date: '12 Haz', Google: 82, Tripadvisor: 38 },
    { date: '15 Haz', Google: 68, Tripadvisor: 34 },
    { date: '18 Haz', Google: 85, Tripadvisor: 30 },
    { date: '22 Haz', Google: 90, Tripadvisor: 32 },
    { date: '25 Haz', Google: 60, Tripadvisor: 20 },
    { date: '29 Haz', Google: 80, Tripadvisor: 28 },
  ];

  const trendData = isDemoData ? trendDataMock : (trends || []);

  // Unique platforms for trend lines
  const trendPlatforms = new Set<string>();
  if (trends && !isDemoData) {
    trends.forEach((t: any) => {
      Object.keys(t).forEach(k => {
        if (k !== 'date' && k !== 'count' && k !== 'sumRating' && k !== 'positive' && k !== 'neutral' && k !== 'negative') {
          trendPlatforms.add(k);
        }
      });
    });
  }
  const activePlatforms = isDemoData ? ['Google', 'Tripadvisor'] : Array.from(trendPlatforms);

  // Donut Chart breakdown
  const ratingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  if (ratingsDistributionRaw && ratingsDistributionRaw.length > 0) {
    ratingsDistributionRaw.forEach((r: any) => {
      const val = Math.round(Number(r.rating || 5));
      const rating = Math.max(1, Math.min(5, val)) as 5 | 4 | 3 | 2 | 1;
      ratingCounts[rating]++;
    });
  }

  const distributionData = isDemoData
    ? [
        { name: 'Mükemmel (5★)', value: 652, percentage: '52.2%', color: '#10b981' },
        { name: 'İyi (4★)', value: 382, percentage: '30.6%', color: '#3b82f6' },
        { name: 'Orta (3★)', value: 136, percentage: '10.9%', color: '#f59e0b' },
        { name: 'Kötü (2★)', value: 48, percentage: '3.8%', color: '#f97316' },
        { name: 'Çok Kötü (1★)', value: 30, percentage: '2.5%', color: '#ef4444' },
      ]
    : [
        { name: 'Mükemmel (5★)', value: ratingCounts[5], percentage: finalTotalReviews > 0 ? `${((ratingCounts[5] / finalTotalReviews) * 100).toFixed(1)}%` : '0%', color: '#10b981' },
        { name: 'İyi (4★)', value: ratingCounts[4], percentage: finalTotalReviews > 0 ? `${((ratingCounts[4] / finalTotalReviews) * 100).toFixed(1)}%` : '0%', color: '#3b82f6' },
        { name: 'Orta (3★)', value: ratingCounts[3], percentage: finalTotalReviews > 0 ? `${((ratingCounts[3] / finalTotalReviews) * 100).toFixed(1)}%` : '0%', color: '#f59e0b' },
        { name: 'Kötü (2★)', value: ratingCounts[2], percentage: finalTotalReviews > 0 ? `${((ratingCounts[2] / finalTotalReviews) * 100).toFixed(1)}%` : '0%', color: '#f97316' },
        { name: 'Çok Kötü (1★)', value: ratingCounts[1], percentage: finalTotalReviews > 0 ? `${((ratingCounts[1] / finalTotalReviews) * 100).toFixed(1)}%` : '0%', color: '#ef4444' },
      ];

  // Platform Share stats
  let googleShare = isDemoData ? 842 : 0;
  let tripadvisorShare = isDemoData ? 286 : 0;
  let bookingShare = isDemoData ? 84 : 0;
  let holidaycheckShare = 0;
  let hotelscomShare = 0;
  let otherShare = 0;

  if (!isDemoData && platformShare) {
    platformShare.forEach((p: any) => {
      const normalized = normalizeReviewPlatform(p.source);
      if (normalized === 'google') googleShare += p.count;
      else if (normalized === 'tripadvisor') tripadvisorShare += p.count;
      else if (normalized === 'booking') bookingShare += p.count;
      else if (normalized === 'holidaycheck') holidaycheckShare += p.count;
      else if (normalized === 'hotelscom') hotelscomShare += p.count;
      else otherShare += p.count;
    });
  }

  const totalMapped = googleShare + tripadvisorShare + bookingShare + holidaycheckShare + hotelscomShare;

  // Fallback Reviews list
  const fallbackReviews: ScrapedReview[] = [
    {
      id: '1',
      guestName: 'Merve G.',
      comment: 'Harika bir konaklamaydı, personel çok ilgiliydi...',
      hotel: 'Montana 2543, Uludağ',
      rating: 5,
      source: 'Google',
      status: 'AI Yanıt Hazır',
      relativeDate: '2 saat önce'
    },
    {
      id: '2',
      guestName: 'Serkan K.',
      comment: 'Otel konumu harika, ancak odalar biraz küçük...',
      hotel: 'Grand Yazıcı Uludağ',
      rating: 4,
      source: 'Google',
      status: 'Onay Bekliyor',
      relativeDate: '5 saat önce'
    },
    {
      id: '3',
      guestName: 'Ahmet A.',
      comment: 'Her şey mükemmeldi, tekrar geleceğiz!',
      hotel: 'Montana 2543, Uludağ',
      rating: 5,
      source: 'Tripadvisor',
      status: 'Yayınlandı',
      relativeDate: '8 saat önce'
    },
    {
      id: '4',
      guestName: 'Zeynep Y.',
      comment: 'Yemek kalitesi çok başarılıydı. Temizlik konusunda da son derece titiz davrandıklarını gözlemledik. Personelin güler yüzlü olması tatilimizin keyfini ikiye katladı. Herkese tavsiye ederim.',
      hotel: 'Montana 2543, Uludağ',
      rating: 5,
      source: 'Google',
      status: 'AI Yanıt Hazır',
      relativeDate: '1 gün önce'
    },
    {
      id: '5',
      guestName: 'Bora T.',
      comment: 'Spa bölümü ve havuz temizliği gayet iyiydi fakat hafta sonu yoğunluğundan dolayı servis biraz yavaş işledi. Yine de dinlendirici bir tatil geçirdik.',
      hotel: 'Grand Yazıcı Uludağ',
      rating: 4,
      source: 'Tripadvisor',
      status: 'Onay Bekliyor',
      relativeDate: '2 gün önce'
    },
    {
      id: '6',
      guestName: 'Elif Ş.',
      comment: 'Fiyat performans oranı oldukça iyi. Odaların dekorasyonu modern ve konforluydu. Isınma sistemi kusursuz çalışıyordu, soğuk kış gününde sıcak bir oda çok iyi geldi.',
      hotel: 'Montana 2543, Uludağ',
      rating: 5,
      source: 'Google',
      status: 'Yayınlandı',
      relativeDate: '3 gün önce'
    }
  ];

  // Map dynamic reviews
  const displayReviews: ScrapedReview[] = (recentReviewsData?.reviews && recentReviewsData.reviews.length > 0)
    ? recentReviewsData.reviews.map((r: any, idx: number) => {
        let statusStr = 'AI Yanıt Hazır';
        if (r.status === 'published') statusStr = 'Yayınlandı';
        else if (r.status === 'waiting_approval') statusStr = 'Onay Bekliyor';

        const hName = hotels?.find(h => h.id === r.hotelId)?.name || 'Demo Hotel';

        return {
          id: r.id || String(idx),
          guestName: r.guestName || 'Misafir',
          comment: r.reviewText || r.comment || 'Detay açıklaması girilmemiş.',
          hotel: hName,
          rating: r.rating || 5,
          source: r.source || r.platform || 'Google',
          status: statusStr,
          relativeDate: 'Şimdi'
        };
      })
    : isDemoData ? fallbackReviews : [];

  const renderStars = (count: number) => {
    return (
      <div className="flex gap-0.5 text-amber-400">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            size={12}
            className={i < count ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}
          />
        ))}
      </div>
    );
  };

  const visibleReviews = showAllReviews ? displayReviews : displayReviews.slice(0, 3);

  const connectionError = metricsError || reviewsError || trendsError || platformError || ratingsError || (!import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('placeholder') ? 'Supabase credentials are not defined. Please define VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.' : null);

  const currentHotel = hotels?.find(h => h.id === currentHotelId);
  const isJuraAdaBeach = true;

  if (isJuraAdaBeach) {
    const lastSyncTimeVal = dbSyncStates.length > 0
      ? dbSyncStates.map(s => s.last_sync_at).filter(Boolean).sort((a,b) => new Date(b).getTime() - new Date(a).getTime())[0]
      : null;
    const isGlobalError = dbSyncStates.some(s => s.status === 'error');

    const lastSuccessfulSyncTime = dbSyncStates.length > 0
      ? dbSyncStates.map(s => s.last_successful_sync_at).filter(Boolean).sort((a,b) => new Date(b).getTime() - new Date(a).getTime())[0]
      : null;

    const hasAnyInitial = dbSyncStates.some(s => s.sync_mode === 'initial_full_sync');
    const hasAnyManual = dbSyncStates.some(s => s.sync_mode === 'manual_full_resync');
    const activeSyncModeLabel = hasAnyManual 
      ? 'Manuel Tam Tarama'
      : hasAnyInitial
      ? 'İlk Kurulum'
      : dbSyncStates.length > 0
      ? 'Kademeli Güncelleme'
      : 'Bekliyor';

    const totalImported = dbSyncStates.reduce((sum, s) => sum + (s.last_imported_count || 0), 0);
    const totalDuplicates = dbSyncStates.reduce((sum, s) => sum + (s.last_duplicate_count || 0), 0);

    const incrementalSyncs = dbSyncStates.filter(s => s.sync_mode === 'incremental_sync');
    const costSavingsMsg = incrementalSyncs.length > 0
      ? `Kademeli tarama ile %85 API tasarrufu`
      : 'Kademeli tarama aktif değil';

    const getPlatformStats = (platformKey: string) => {
      const list = (filteredReviewsForStats || []).filter((r: any) => {
        const norm = normalizeReviewPlatform(r.platform).toLowerCase();
        return norm === platformKey.toLowerCase();
      });

      const count = list.length;
      const totalRating = list.reduce((sum: number, r: any) => sum + (r.rating || 0), 0);
      const avg = count > 0 ? (totalRating / count).toFixed(1) : '0.0';

      let latestDate = 'Henüz veri yok';
      const dates = list.map((r: any) => r.review_date || r.created_at).filter(Boolean);
      if (dates.length > 0) {
        dates.sort((a: any, b: any) => new Date(b).getTime() - new Date(a).getTime());
        latestDate = new Date(dates[0]).toLocaleDateString('tr-TR');
      }

      const unanswered = list.filter((r: any) => r.status === 'draft').length;

      return { count, avg, latestDate, unanswered };
    };

    let healthData: any = null;
    try {
      const stored = localStorage.getItem(`sync_health_${queriedHotelId}`);
      if (stored) {
        healthData = JSON.parse(stored);
      }
    } catch (e) {
      console.error(e);
    }

    const getHealthInfo = (platformName: string) => {
      let dbKey = platformName;
      if (platformName === 'Booking.com') dbKey = 'Booking';
      
      const dbState = dbSyncStates?.find(s => s.platform.toLowerCase() === dbKey.toLowerCase());
      
      if (dbState) {
        const timeStr = dbState.last_sync_at
          ? new Date(dbState.last_sync_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(dbState.last_sync_at).toLocaleDateString('tr-TR')
          : 'Belirsiz';

        const modeLabel = dbState.sync_mode === 'initial_full_sync'
          ? 'İlk Kurulum'
          : dbState.sync_mode === 'manual_full_resync'
          ? 'Manuel Tam'
          : 'Kademeli';

        return {
          status: dbState.status === 'error' ? 'error' : 'active',
          lastSync: timeStr,
          outcome: dbState.status === 'error' ? 'Hata Var' : 'Başarılı',
          newCount: dbState.last_imported_count ?? 0,
          dupCount: dbState.last_duplicate_count ?? 0,
          errCount: dbState.last_error_count ?? 0,
          syncMode: modeLabel,
          lastReviewDate: dbState.last_review_date ? new Date(dbState.last_review_date).toLocaleDateString('tr-TR') : '-',
          savings: dbState.metadata?.scrapeFromDate 
            ? `Son ${Math.ceil((Date.now() - new Date(dbState.metadata.scrapeFromDate).getTime()) / (24 * 60 * 60 * 1000))} gün`
            : dbState.sync_mode === 'incremental_sync' ? 'Kısmi Tarama' : 'Tasarruf Yok'
        };
      }

      if (!healthData || !healthData[platformName]) {
        return {
          status: 'veri yok',
          lastSync: 'Hiç senkronize edilmedi',
          outcome: 'Bağlantı bekliyor',
          newCount: 0,
          dupCount: 0,
          errCount: 0,
          syncMode: 'Bekliyor',
          lastReviewDate: '-',
          savings: '-'
        };
      }
      const data = healthData[platformName];
      const timeStr = healthData.lastSyncTime
        ? new Date(healthData.lastSyncTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(healthData.lastSyncTime).toLocaleDateString('tr-TR')
        : 'Belirsiz';

      const modeLabel = data.syncMode === 'initial_full_sync'
        ? 'İlk Kurulum'
        : data.syncMode === 'manual_full_resync'
        ? 'Manuel Tam'
        : 'Kademeli';

      return {
        status: data.status,
        lastSync: timeStr,
        outcome: data.status === 'error' ? 'Hata Var' : 'Başarılı',
        newCount: data.imported ?? 0,
        dupCount: data.duplicates ?? 0,
        errCount: data.errors?.length ?? 0,
        syncMode: modeLabel,
        lastReviewDate: data.lastReviewDate ? new Date(data.lastReviewDate).toLocaleDateString('tr-TR') : '-',
        savings: data.estimatedCostSavingMessage || (data.syncMode === 'incremental_sync' ? 'Kısmi Tarama' : 'Tasarruf Yok')
      };
    };

    const matchIssues = [
      { key: 'yemek', label: 'Yemek & Restoran', keywords: ['yemek', 'restoran', 'açık büfe', 'kahvaltı', 'lezzet', 'açıkbüfe'] },
      { key: 'temizlik', label: 'Temizlik & Hijyen', keywords: ['temizlik', 'kirli', 'temiz', 'hijyen', 'toz', 'havlu', 'çarşaf'] },
      { key: 'oda', label: 'Oda Konforu', keywords: ['oda', 'yatak', 'banyo', 'genişlik', 'gürültü'] },
      { key: 'personel', label: 'Personel & Hizmet', keywords: ['personel', 'çalışan', 'garson', 'resepsiyon', 'ilgi', 'güler yüz', 'hizmet'] },
      { key: 'otopark', label: 'Otopark Alanı', keywords: ['otopark', 'park', 'araba', 'vale'] },
      { key: 'plaj', label: 'Plaj & Kum', keywords: ['plaj', 'deniz', 'kum', 'şezlong', 'şemsiye'] },
      { key: 'havuz', label: 'Havuz & Aqua', keywords: ['havuz', 'kaydırak', 'şezlong', 'klor'] },
      { key: 'klima', label: 'Klima & Isıtma', keywords: ['klima', 'ısıtma', 'soğutma', 'sicak', 'soğuk'] },
      { key: 'wifi', label: 'Kablosuz İnternet (Wi-Fi)', keywords: ['wifi', 'internet', 'bağlantı', 'çekim', 'hız'] },
      { key: 'asansör', label: 'Asansör', keywords: ['asansör', 'asansor', 'çalışmıyor'] }
    ];

    const matchPraises = [
      { key: 'konum', label: 'Konum & Ulaşım', keywords: ['konum', 'merkez', 'ulaşım', 'yakın', 'sahil'] },
      { key: 'personel', label: 'Personel Hizmeti', keywords: ['personel', 'çalışan', 'garson', 'resepsiyon', 'ilgi', 'güler yüz'] },
      { key: 'temizlik', label: 'Temizlik Kalitesi', keywords: ['temizlik', 'temiz', 'hijyen', 'pırıl pırıl'] },
      { key: 'yemek', label: 'Yemek Çeşitliliği', keywords: ['yemek', 'lezzet', 'kahvaltı', 'tatlar'] },
      { key: 'manzara', label: 'Manzara', keywords: ['manzara', 'deniz', 'doğa', 'balkon'] },
      { key: 'fiyat', label: 'Fiyat / Performans', keywords: ['fiyat', 'performans', 'uygun', 'değer', 'fp'] }
    ];

    const issuesData = matchIssues.map((issue: any) => {
      const matching = (filteredReviewsForStats || []).filter((r: any) => matchesCategory(r, issue.key));
      const count = matching.length;
      const negativeCount = matching.filter((r: any) => r.rating <= 3).length;
      return { key: issue.key, label: issue.label, count, negativeCount };
    }).sort((a: any, b: any) => b.negativeCount - a.negativeCount);

    const praisesData = matchPraises.map((praise: any) => {
      const matching = (filteredReviewsForStats || []).filter((r: any) => matchesCategory(r, praise.key));
      const count = matching.length;
      const positiveCount = matching.filter((r: any) => r.rating >= 4).length;
      return { key: praise.key, label: praise.label, count, positiveCount };
    }).sort((a: any, b: any) => b.positiveCount - a.positiveCount);

    const getDynamicInsight = (platformName: string) => {
      const list = (filteredReviewsForStats || []).filter((r: any) => {
        const norm = normalizeReviewPlatform(r.platform).toLowerCase();
        const pKey = platformName === 'Booking.com' ? 'booking' : platformName.toLowerCase();
        return norm === pKey;
      });

      const negatives = list.filter((r: any) => (r.rating || 0) <= 3);
      if (negatives.length === 0) {
        return `Bu platformda son dönemde herhangi bir olumsuz geri bildirim bulunmamaktadır. Hizmet kalitesi stabil görünmektedir.`;
      }

      const matchedIssuesList: string[] = [];
      matchIssues.forEach((issue: any) => {
        const count = negatives.filter((r: any) => {
          const text = (r.review_text || '').toLowerCase();
          return issue.keywords.some((k: any) => text.includes(k));
        }).length;
        if (count > 0) {
          matchedIssuesList.push(issue.label);
        }
      });

      if (matchedIssuesList.length === 0) {
        return `Yorumlarda spesifik bir şikayet konusu öne çıkmıyor, ancak genel puan seviyesi izlenmektedir.`;
      }

      return `Platform genelinde en sık dile getirilen şikayet konuları: ${matchedIssuesList.slice(0, 3).join(', ')}.`;
    };

    const getCommonInsight = () => {
      const negatives = (filteredReviewsForStats || []).filter((r: any) => (r.rating || 0) <= 3);
      const matched: { label: string; count: number }[] = matchIssues.map((issue: any) => {
        const count = negatives.filter((r: any) => {
          const text = (r.review_text || '').toLowerCase();
          return issue.keywords.some((k: any) => text.includes(k));
        }).length;
        return { label: issue.label, count };
      }).filter((x: any) => x.count > 0).sort((a: any, b: any) => b.count - a.count);

      if (matched.length === 0) {
        return `Tüm platformlar genelinde tekrarlayan kritik bir ortak sorun tespit edilmedi.`;
      }

      return `Ortak şikayetlerin başında sırasıyla ${matched.slice(0, 3).map(m => m.label).join(', ')} konuları geliyor.`;
    };

    const juraTotalReviews = filteredReviewsForStats.length;
    const juraTotalRating = filteredReviewsForStats.reduce((sum: number, r: any) => sum + (r.rating || 0), 0);
    const juraAvgRating = juraTotalReviews > 0 ? Number((juraTotalRating / juraTotalReviews).toFixed(1)) : 0.0;
    const juraRespondedCount = filteredReviewsForStats.filter((r: any) => r.status === 'cevaplandi' || r.status === 'yayinlandi').length;
    const juraAiResponseRate = juraTotalReviews > 0 ? Math.round((juraRespondedCount / juraTotalReviews) * 100) : 0;
    const juraDraftReviews = filteredReviewsForStats.filter((r: any) => r.status === 'draft' || r.status === 'bekliyor' || r.status === 'AI Yanıt Hazır' || r.status === 'Onay Bekliyor').length;
    const juraPublishedReviews = filteredReviewsForStats.filter((r: any) => r.status === 'yayinlandi' || r.status === 'cevaplandi').length;

    const juraRatingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    filteredReviewsForStats.forEach((r: any) => {
      const val = Math.round(Number(r.rating || 5));
      const rating = Math.max(1, Math.min(5, val)) as 5 | 4 | 3 | 2 | 1;
      juraRatingCounts[rating]++;
    });

    const juraDistributionData = [
      { name: 'Mükemmel (5★)', value: juraRatingCounts[5], percentage: juraTotalReviews > 0 ? `${((juraRatingCounts[5] / juraTotalReviews) * 100).toFixed(1)}%` : '0%', color: '#10b981' },
      { name: 'İyi (4★)', value: juraRatingCounts[4], percentage: juraTotalReviews > 0 ? `${((juraRatingCounts[4] / juraTotalReviews) * 100).toFixed(1)}%` : '0%', color: '#3b82f6' },
      { name: 'Orta (3★)', value: juraRatingCounts[3], percentage: juraTotalReviews > 0 ? `${((juraRatingCounts[3] / juraTotalReviews) * 100).toFixed(1)}%` : '0%', color: '#f59e0b' },
      { name: 'Kötü (2★)', value: juraRatingCounts[2], percentage: juraTotalReviews > 0 ? `${((juraRatingCounts[2] / juraTotalReviews) * 100).toFixed(1)}%` : '0%', color: '#f97316' },
      { name: 'Çok Kötü (1★)', value: juraRatingCounts[1], percentage: juraTotalReviews > 0 ? `${((juraRatingCounts[1] / juraTotalReviews) * 100).toFixed(1)}%` : '0%', color: '#ef4444' },
    ];

    const premiumTrendData = React.useMemo(() => {
      if (!filteredReviewsForStats || filteredReviewsForStats.length === 0) return [];
      
      const dateBuckets: Record<string, Record<string, { count: number; ratingSum: number; posCount: number; negCount: number }>> = {};
      
      filteredReviewsForStats.forEach((r: any) => {
        const d = new Date(r.review_date || r.created_at);
        let dateKey = '';
        
        if (timeFilter === 'today') {
          dateKey = d.toLocaleTimeString('tr-TR', { hour: '2-digit' }) + ':00';
        } else if (timeFilter === '7_days') {
          dateKey = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
        } else if (timeFilter === '30_days' || timeFilter === '3_months') {
          dateKey = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
        } else {
          dateKey = d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
        }
        
        if (!dateBuckets[dateKey]) {
          dateBuckets[dateKey] = {
            Google: { count: 0, ratingSum: 0, posCount: 0, negCount: 0 },
            "Booking.com": { count: 0, ratingSum: 0, posCount: 0, negCount: 0 },
            TripAdvisor: { count: 0, ratingSum: 0, posCount: 0, negCount: 0 },
            "Hotels.com": { count: 0, ratingSum: 0, posCount: 0, negCount: 0 },
            HolidayCheck: { count: 0, ratingSum: 0, posCount: 0, negCount: 0 }
          } as any;
        }
        
        let platName: "Google" | "Booking.com" | "TripAdvisor" | "Hotels.com" | "HolidayCheck";
        const norm = normalizeReviewPlatform(r.platform);
        if (norm === 'google') platName = 'Google';
        else if (norm === 'booking') platName = 'Booking.com';
        else if (norm === 'tripadvisor') platName = 'TripAdvisor';
        else if (norm === 'hotelscom') platName = 'Hotels.com';
        else if (norm === 'holidaycheck') platName = 'HolidayCheck';
        else return;
        
        if (dateBuckets[dateKey][platName]) {
          dateBuckets[dateKey][platName].count++;
          dateBuckets[dateKey][platName].ratingSum += (r.rating || 0);
          if ((r.rating || 0) >= 4) dateBuckets[dateKey][platName].posCount++;
          if ((r.rating || 0) <= 3) dateBuckets[dateKey][platName].negCount++;
        }
      });
      
      return Object.entries(dateBuckets)
        .map(([date, platforms]) => {
          const row: any = { date };
          Object.entries(platforms).forEach(([plat, stats]) => {
            row[plat] = stats.count;
            row[`${plat}_stats`] = stats;
          });
          return row;
        })
        .sort((a, b) => {
          const timeA = new Date(a.date).getTime() || 0;
          const timeB = new Date(b.date).getTime() || 0;
          return timeA - timeB;
        });
    }, [filteredReviewsForStats, timeFilter]);

    const CustomTooltip = ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
        return (
          <div className="bg-slate-900 text-white p-4 rounded-xl shadow-2xl border border-slate-800 space-y-2 text-[11px] min-w-[200px]">
            <div className="font-bold border-b border-slate-850 pb-1 text-slate-400">{label}</div>
            <div className="space-y-1.5 pt-1">
              {payload.map((item: any) => {
                const platName = item.name;
                const stats = item.payload[`${platName}_stats`] || { count: 0, ratingSum: 0, posCount: 0, negCount: 0 };
                if (stats.count === 0) return null;
                
                const avg = (stats.ratingSum / stats.count).toFixed(1);
                const posPercent = ((stats.posCount / stats.count) * 100).toFixed(0);
                const negPercent = ((stats.negCount / stats.count) * 100).toFixed(0);
                
                return (
                  <div key={platName} className="space-y-0.5 border-l-2 pl-2" style={{ borderColor: item.color }}>
                    <div className="flex justify-between items-center font-extrabold text-slate-100">
                      <span>{platName}</span>
                      <span>{stats.count} Yorum</span>
                    </div>
                    <div className="flex justify-between text-slate-400 text-[10px]">
                      <span>Ortalama:</span>
                      <span className="text-amber-400 font-bold">{avg} ★</span>
                    </div>
                    <div className="flex justify-between text-slate-400 text-[10px]">
                      <span>Olumlu/Olumsuz:</span>
                      <span className="font-bold">
                        <span className="text-emerald-400">%{posPercent}</span>
                        <span className="text-slate-500 mx-1">/</span>
                        <span className="text-rose-400">%{negPercent}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }
      return null;
    };

    return (
      <div className="space-y-6 text-slate-800">
        {connectionError && (
          <div className="p-4 rounded-2xl border border-rose-200 text-rose-700 bg-rose-50 flex items-center gap-3 shadow-sm animate-pulse">
            <ShieldAlert size={20} className="text-rose-500 shrink-0" />
            <div className="text-xs">
              <span className="font-bold">Veritabanı Bağlantı Hatası:</span>{' '}
              {connectionError}
            </div>
          </div>
        )}

        {/* Title Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div className="space-y-2 flex-1">
            <h1 className="text-xl font-bold text-slate-800 m-0">Birleşik Entegrasyon Dashboard'u</h1>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              İlk kurulumda tüm geçmiş yorumlar alınır. Sonraki senkronizasyonlarda yalnızca yeni yorumlar eklenir.
            </p>
            <p className="text-[10px] text-slate-400 font-semibold italic">
              * Google ve Booking.com Aggregator ile; TripAdvisor, Hotels.com ve HolidayCheck kendi entegrasyonlarıyla senkronize edilir.
            </p>
            {lastSyncTimeVal ? (
              <div className="text-[10px] text-slate-500 font-semibold flex items-center gap-1.5 mt-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 self-start w-fit">
                <span>Son Senkronizasyon:</span>
                <span className="font-bold text-slate-700">
                  {new Date(lastSyncTimeVal).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(lastSyncTimeVal).toLocaleDateString('tr-TR')}
                </span>
                <span className="text-slate-350">|</span>
                <span>Durum:</span>
                {isGlobalError ? (
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
            <div className="flex flex-wrap items-center gap-1 bg-slate-105/80 p-1 rounded-xl border border-slate-200/50 mr-2 shadow-inner">
              {[
                { id: 'today', label: 'Bugün' },
                { id: '7_days', label: '7 Gün' },
                { id: '30_days', label: '30 Gün' },
                { id: '3_months', label: '3 Ay' },
                { id: '6_months', label: '6 Ay' },
                { id: '1_year', label: '1 Yıl' },
                { id: 'all', label: 'Tüm Zamanlar' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setTimeFilter(f.id)}
                  className={`px-3 py-1.5 text-[10px] font-extrabold rounded-lg transition-all cursor-pointer ${
                    timeFilter === f.id
                      ? 'bg-white text-indigo-650 shadow-sm border border-slate-200/30'
                      : 'text-slate-550 hover:text-slate-800'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                refetchMetrics();
                refetchReviews();
                refetchAllReviews();
                fetchSyncStates();
              }}
              className="p-2 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-xl transition-colors cursor-pointer min-h-[36px]"
              title="Verileri Yenile"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </button>

            <button
              onClick={() => window.location.href = '/reviews?triggerSync=true'}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-tr from-indigo-600 to-purple-500 hover:from-indigo-500 hover:to-purple-400 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-indigo-500/20 min-h-[38px] cursor-pointer animate-pulse-slow"
            >
              <RefreshCw size={14} />
              <span>Tüm Platformları Senkronize Et</span>
            </button>

            <button
              onClick={handleExportReviews}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-semibold text-xs rounded-xl transition-all min-h-[36px] cursor-pointer"
            >
              <Download size={14} className={isExporting ? 'animate-spin' : ''} />
              <span>{isExporting ? 'Exporting...' : 'Veriyi Dışa Aktar'}</span>
            </button>
          </div>
        </div>

        {/* Smart Sync Summary Card */}
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 p-6 rounded-2xl border border-slate-800 shadow-xl text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
          <div className="relative space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-indigo-400" />
                <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Smart Sync Akıllı Özet</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-[9px] font-bold text-indigo-200 tracking-wide uppercase">
                Aktif Platformlar: {dbSyncStates.length} / 5
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-2">
              <div className="space-y-1">
                <span className="text-[10px] text-indigo-200/70 font-semibold block">Son Başarılı Senkronizasyon</span>
                <h4 className="text-xs font-bold text-slate-100">
                  {lastSuccessfulSyncTime 
                    ? new Date(lastSuccessfulSyncTime).toLocaleDateString('tr-TR') + ' ' + new Date(lastSuccessfulSyncTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
                    : 'Hiç senkronize edilmedi'
                  }
                </h4>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-indigo-200/70 font-semibold block">Aktif Senkronizasyon Modu</span>
                <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle size={14} className="shrink-0" />
                  {activeSyncModeLabel}
                </h4>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-indigo-200/70 font-semibold block">Son Yeni / Mükerrer Yorum</span>
                <h4 className="text-xs font-bold text-slate-100">
                  <span className="text-emerald-400 font-extrabold">{totalImported} yeni</span>
                  <span className="text-slate-400 mx-1.5">/</span>
                  <span className="text-amber-400 font-extrabold">{totalDuplicates} mükerrer</span>
                </h4>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-indigo-200/70 font-semibold block">Tahmini Tasarruf Durumu</span>
                <h4 className="text-[11px] font-bold text-indigo-300">
                  {costSavingsMsg}
                </h4>
              </div>
            </div>
          </div>
        </div>

        {/* 1. Platform Bazlı Özet Kartları */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Platform Bazlı Özet Kartları</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              { name: 'Google Reviews', key: 'google', tag: 'Aggregator' },
              { name: 'Booking.com', key: 'booking', tag: 'Aggregator' },
              { name: 'TripAdvisor', key: 'tripadvisor', tag: 'Legacy' },
              { name: 'Hotels.com', key: 'hotelscom', tag: 'Legacy' },
              { name: 'HolidayCheck', key: 'holidaycheck', tag: 'Legacy' }
            ].map(plat => {
              const stats = getPlatformStats(plat.key);
              return (
                <div key={plat.key} className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm space-y-4 flex flex-col justify-between relative overflow-hidden">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-slate-900 truncate pr-2" title={plat.name}>{plat.name}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                        plat.tag === 'Aggregator' 
                          ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' 
                          : 'bg-slate-50 text-slate-500 border border-slate-100'
                      }`}>
                        {plat.tag}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2 pt-1">
                      <h4 className="text-2xl font-black text-slate-900 leading-none">{stats.count}</h4>
                      <span className="text-[10px] text-slate-400 font-semibold">yorum</span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-50 text-[10.5px]">
                    <div className="flex justify-between text-slate-500">
                      <span>Ortalama Puan:</span>
                      <span className="font-bold text-slate-800 flex items-center gap-0.5">
                        <Star size={10} className="fill-amber-400 text-amber-400" />
                        {stats.avg}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Cevaplanmamış:</span>
                      <span className={`font-bold ${stats.unanswered > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {stats.unanswered}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-400 text-[9.5px] pt-1">
                      <span>Son yorum:</span>
                      <span className="font-medium text-slate-600 truncate max-w-[80px]" title={stats.latestDate}>{stats.latestDate}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Platform Sağlık Durumu Bölümü */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Platform Sağlık Durumu</h3>
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-[11px]">
                <thead className="bg-slate-50 font-bold text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Platform</th>
                    <th className="px-4 py-3 text-left">Kaynak Türü</th>
                    <th className="px-4 py-3 text-left">Son Senkronizasyon</th>
                    <th className="px-4 py-3 text-center">Durum</th>
                    <th className="px-4 py-3 text-center">Sync Modu</th>
                    <th className="px-4 py-3 text-center">Son Yorum</th>
                    <th className="px-4 py-3 text-center">Yeni/Mük/Hat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                  {[
                    { name: 'Google', title: 'Google Reviews', source: 'Aggregator' },
                    { name: 'Booking.com', title: 'Booking.com', source: 'Aggregator' },
                    { name: 'TripAdvisor', title: 'TripAdvisor', source: 'Legacy' },
                    { name: 'Hotels.com', title: 'Hotels.com', source: 'Legacy' },
                    { name: 'HolidayCheck', title: 'HolidayCheck', source: 'Legacy' }
                  ].map(plat => {
                    const health = getHealthInfo(plat.name);
                    return (
                      <tr key={plat.name} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 font-bold text-slate-800">{plat.title}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                            plat.source === 'Aggregator'
                              ? 'bg-purple-50 text-purple-600 border border-purple-100'
                              : 'bg-slate-50 text-slate-500 border border-slate-100'
                          }`}>
                            {plat.source}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-500">{health.lastSync}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                            health.status === 'active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                            health.status === 'error' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                            'bg-amber-50 text-amber-600 border border-amber-100'
                          }`}>
                            {health.status === 'active' ? 'Aktif' :
                             health.status === 'error' ? 'Hatalı' :
                             health.status === 'veri yok' ? 'Henüz veri yok' : health.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center font-medium text-slate-600">{health.syncMode}</td>
                        <td className="px-4 py-2.5 text-center text-slate-500">{health.lastReviewDate}</td>
                        <td className="px-4 py-2.5 text-center text-slate-600 font-medium">
                          <span className="text-emerald-600 font-bold">{health.newCount}</span>
                          <span className="text-slate-350 mx-1">/</span>
                          <span className="text-amber-600 font-bold">{health.dupCount}</span>
                          <span className="text-slate-350 mx-1">/</span>
                          <span className="text-rose-600 font-bold">{health.errCount}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 3. Trendler & Donut */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Yorum Trendi */}
          <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col h-[350px]">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Yorum Dağılım Trendi</h3>
            <div className="flex-1 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={premiumTrendData as any} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorGoogle" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorBooking" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorTripadvisor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorHotelscom" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorHolidaycheck" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#e11d48" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#e11d48" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: 10, fontWeight: 500 }} tickLine={false} />
                  <YAxis stroke="#94a3b8" style={{ fontSize: 10, fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="Google" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorGoogle)" strokeWidth={2} name="Google" stackId="1" />
                  <Area type="monotone" dataKey="Booking.com" stroke="#2563eb" fillOpacity={1} fill="url(#colorBooking)" strokeWidth={2} name="Booking.com" stackId="1" />
                  <Area type="monotone" dataKey="TripAdvisor" stroke="#10b981" fillOpacity={1} fill="url(#colorTripadvisor)" strokeWidth={2} name="TripAdvisor" stackId="1" />
                  <Area type="monotone" dataKey="Hotels.com" stroke="#f59e0b" fillOpacity={1} fill="url(#colorHotelscom)" strokeWidth={2} name="Hotels.com" stackId="1" />
                  <Area type="monotone" dataKey="HolidayCheck" stroke="#e11d48" fillOpacity={1} fill="url(#colorHolidaycheck)" strokeWidth={2} name="HolidayCheck" stackId="1" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Yorum Dağılımı Donut */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col h-[350px]">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Puan Dağılımı</h3>
            <div className="relative w-full h-[140px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={juraDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {juraDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-bold text-slate-900 leading-none">{juraTotalReviews}</span>
                <span className="text-[9px] text-slate-400 font-semibold mt-1">Yorum</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 mt-2 text-[10px] pr-1">
              {juraDistributionData.map((entry, index) => (
                <div key={index} className="flex justify-between items-center py-1 border-b border-slate-50">
                  <span className="text-slate-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: entry.color }}></span>
                    {entry.name}
                  </span>
                  <span className="font-semibold text-slate-950">
                    {entry.value} <span className="text-slate-400 font-normal">({entry.percentage})</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 4. AI Business Insights & Platform Kırılımı */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">AI Business Insights (Platform Analizi)</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { title: "Google Analizi", desc: getDynamicInsight('Google'), iconBg: "bg-purple-50 text-purple-600" },
              { title: "Booking.com Analizi", desc: getDynamicInsight('Booking.com'), iconBg: "bg-blue-50 text-blue-600" },
              { title: "TripAdvisor Analizi", desc: getDynamicInsight('TripAdvisor'), iconBg: "bg-emerald-50 text-emerald-600" },
              { title: "Tekrar Eden Ortak Sorunlar", desc: getCommonInsight(), iconBg: "bg-rose-50 text-rose-600" }
            ].map((insight, idx) => (
              <div key={idx} className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm space-y-2 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className={`w-8 h-8 rounded-lg ${insight.iconBg} flex items-center justify-center text-xs font-bold`}>
                    AI
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">{insight.title}</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-medium">{insight.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 5. En çok tekrar eden sorunlar & En çok övülen konular */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* En Çok Tekrar Eden Sorunlar */}
          <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <ShieldAlert className="text-rose-500" size={16} />
              <span>En Çok Tekrar Eden Sorunlar</span>
            </h3>
            <div className="space-y-3.5">
              {issuesData.slice(0, 6).map((issue: any, idx: number) => {
                const percent = (allReviewsForStats as any)?.length ? Math.min(100, Math.round((issue.negativeCount / (allReviewsForStats as any).length) * 100)) : 0;
                return (
                  <div 
                    key={idx} 
                    onClick={() => window.location.href = `/reviews?sentiment=negative&category=${issue.key}`}
                    className="p-2.5 rounded-xl border border-transparent hover:border-slate-100 hover:bg-slate-50/70 transition-all duration-200 cursor-pointer group/row relative"
                  >
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-slate-700 font-semibold group-hover/row:text-indigo-650 transition-colors flex items-center gap-1.5">
                          {issue.label}
                          <span className="text-[10px] text-slate-400 opacity-0 group-hover/row:opacity-100 transition-opacity font-bold uppercase tracking-wider pl-1">
                            Yorumları Gör →
                          </span>
                        </span>
                        <span className="text-rose-600 font-bold">{issue.negativeCount} Olumsuz Geri Bildirim</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-rose-500 h-full rounded-full transition-all" style={{ width: `${percent || 5}%` }}></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* En Çok Övülen Konular */}
          <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="text-emerald-500" size={16} />
              <span>En Çok Övülen Konular</span>
            </h3>
            <div className="space-y-3.5">
              {praisesData.slice(0, 6).map((praise: any, idx: number) => {
                const percent = (allReviewsForStats as any)?.length ? Math.min(100, Math.round((praise.positiveCount / (allReviewsForStats as any).length) * 100)) : 0;
                return (
                  <div 
                    key={idx} 
                    onClick={() => window.location.href = `/reviews?sentiment=positive&category=${praise.key}`}
                    className="p-2.5 rounded-xl border border-transparent hover:border-slate-100 hover:bg-slate-50/70 transition-all duration-200 cursor-pointer group/row relative"
                  >
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-slate-700 font-semibold group-hover/row:text-indigo-650 transition-colors flex items-center gap-1.5">
                          {praise.label}
                          <span className="text-[10px] text-slate-400 opacity-0 group-hover/row:opacity-100 transition-opacity font-bold uppercase tracking-wider pl-1">
                            Yorumları Gör →
                          </span>
                        </span>
                        <span className="text-emerald-600 font-bold">{praise.positiveCount} Olumlu Geri Bildirim</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${percent || 5}%` }}></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Son Yorumlar Tablosu */}
        <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div 
            onClick={() => setIsSectionOpen(!isSectionOpen)}
            className="flex items-center justify-between cursor-pointer select-none group"
          >
            <h3 className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">Son Yorumlar</h3>
            <span className="text-slate-400 group-hover:text-blue-600 transition-colors">
              {isSectionOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </span>
          </div>

          {isSectionOpen && (
            <>
              <div className="space-y-4 mt-4 flex-1">
                {displayReviews.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    Henüz yorum bulunmamaktadır.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {visibleReviews.map((r) => {
                      const isExpanded = !!expandedReviews[r.id];
                      return (
                        <div key={r.id} className="py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-slate-50/50 transition-colors rounded-xl px-2">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700 uppercase shrink-0 text-xs">
                              {r.guestName.split(' ').map(part => part[0]).join('').slice(0, 2)}
                            </div>
                            <div className="space-y-1 min-w-0 flex-1 flex flex-col">
                              <div className="font-semibold text-slate-800 text-xs">{r.guestName}</div>
                              <div className={`text-[11px] text-slate-500 leading-relaxed italic break-words ${isExpanded ? '' : 'line-clamp-2'}`}>
                                "{r.comment}"
                              </div>
                              <button
                                onClick={() => toggleReviewExpand(r.id)}
                                className="text-[10px] text-blue-600 hover:text-blue-700 font-semibold mt-1 self-start cursor-pointer hover:underline focus:outline-none"
                              >
                                {isExpanded ? 'Daha az göster' : 'Devamını oku'}
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-col items-start sm:items-end gap-1.5 shrink-0 text-[10.5px] font-medium text-slate-500 w-full sm:w-auto pl-12 sm:pl-0">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider sm:hidden">Otel: </span>
                              <span className="text-slate-700 font-semibold">{r.hotel}</span>
                            </div>
                            
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider sm:hidden">Puan: </span>
                              {renderStars(r.rating)}
                            </div>

                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider sm:hidden">Platform: </span>
                              <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                r.source.toLowerCase() === 'google' 
                                  ? 'bg-red-50 text-red-500 border border-red-100' 
                                  : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                              }`}>
                                {r.source}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider sm:hidden">Durum: </span>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                r.status === 'AI Yanıt Hazır' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                r.status === 'Onay Bekliyor' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                'bg-emerald-50 text-emerald-600 border border-emerald-100'
                              }`}>
                                {r.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {displayReviews.length > 3 && (
                  <div className="flex justify-center pt-2">
                    <button
                      onClick={() => setShowAllReviews(!showAllReviews)}
                      className="px-4 py-2 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer focus:outline-none"
                    >
                      {showAllReviews ? (
                        <>
                          <span>Daha az göster</span>
                          <ChevronUp size={14} />
                        </>
                      ) : (
                        <>
                          <span>Tüm son yorumları göster</span>
                          <ChevronDown size={14} />
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 mt-4 flex justify-end">
                <a href="/reviews" className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1">
                  <span>Tüm yorumları görüntüle</span>
                  <ArrowUpRight size={14} />
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-800">
      {connectionError && (
        <div className="p-4 rounded-2xl border border-rose-200 text-rose-700 bg-rose-50 flex items-center gap-3 shadow-sm animate-pulse">
          <ShieldAlert size={20} className="text-rose-500 shrink-0" />
          <div className="text-xs">
            <span className="font-bold">Veritabanı Bağlantı Hatası:</span>{' '}
            {connectionError}
          </div>
        </div>
      )}

      {/* Title Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 m-0">Dashboard</h1>
            {isDemoData && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-700 tracking-wide uppercase">
                Demo Veri
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">Genel bakış ve önemli istatistikler</p>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Toplam Yorum */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm flex flex-col justify-between min-h-[130px]">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-500">Toplam Yorum</span>
              <h3 className="text-2xl font-bold text-slate-950">{finalTotalReviews.toLocaleString()}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-500 shrink-0">
              <MessageSquare size={18} />
            </div>
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-3">
            <span>↗ %18.6</span>
            <span className="text-slate-400 font-normal">geçen aya göre</span>
          </div>
        </div>

        {/* Ortalama Puan */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm flex flex-col justify-between min-h-[130px]">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-500">Ortalama Puan</span>
              <h3 className="text-2xl font-bold text-slate-950">{finalAvgRating}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 shrink-0">
              <Star size={18} />
            </div>
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-3">
            <span>↗ %0.3</span>
            <span className="text-slate-400 font-normal">geçen aya göre</span>
          </div>
        </div>

        {/* AI Yanıt Oranı */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm flex flex-col justify-between min-h-[130px]">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-500">AI Yanıt Oranı</span>
              <h3 className="text-2xl font-bold text-slate-950">%{finalAiResponseRate}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
              <Sparkles size={18} />
            </div>
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-3">
            <span>↗ %12.5</span>
            <span className="text-slate-400 font-normal">geçen aya göre</span>
          </div>
        </div>

        {/* Onay Bekleyen */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm flex flex-col justify-between min-h-[130px]">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-500">Onay Bekleyen</span>
              <h3 className="text-2xl font-bold text-slate-950">{finalDraftReviews}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 shrink-0">
              <Clock size={18} />
            </div>
          </div>
          <div className="text-[11px] text-rose-600 font-semibold flex items-center gap-1 mt-3">
            <span>↘ %22.2</span>
            <span className="text-slate-400 font-normal">geçen aya göre</span>
          </div>
        </div>

        {/* Yayınlanan Yanıt */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm flex flex-col justify-between min-h-[130px]">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-500">Yayınlanan Yanıt</span>
              <h3 className="text-2xl font-bold text-slate-950">{finalPublishedReviews}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center text-teal-500 shrink-0">
              <CheckCircle size={18} />
            </div>
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-3">
            <span>↗ %24.3</span>
            <span className="text-slate-400 font-normal">geçen aya göre</span>
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rating Trend (Son 30 Gün) */}
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col h-[400px]">
          <div className="flex items-center justify-between mb-6">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                Yorum Trendi <span className="text-xs font-medium text-slate-400">(Son 30 Gün)</span>
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
                {activePlatforms.map((platform, idx) => {
                  const colors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#f97316', '#ef4444'];
                  const bulletColor = colors[idx % colors.length];
                  return (
                    <span key={platform} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: bulletColor }}></span>
                      {platform}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData as any} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: 10, fontWeight: 500 }} tickLine={false} />
                <YAxis stroke="#94a3b8" style={{ fontSize: 10, fontWeight: 500 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}
                  labelStyle={{ color: '#64748b', fontSize: 11, fontWeight: 600 }}
                  itemStyle={{ fontSize: 12, fontWeight: 500 }}
                />
                {activePlatforms.map((platform, idx) => {
                  const colors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#f97316', '#ef4444'];
                  const strokeColor = colors[idx % colors.length];
                  return (
                    <Line
                      key={platform}
                      type="monotone"
                      dataKey={platform}
                      stroke={strokeColor}
                      strokeWidth={3}
                      dot={{ r: 4, fill: strokeColor, strokeWidth: 0 }}
                      activeDot={{ r: 6 }}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Rating Breakdown (Yorum Dağılımı) */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col h-[400px]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-slate-800">Yorum Dağılımı</h3>
          </div>

          <div className="relative w-full h-[150px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={72}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {/* Total count inside donut */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-slate-900 leading-none">{finalTotalReviews.toLocaleString()}</span>
              <span className="text-[10px] text-slate-400 font-semibold mt-1">Toplam</span>
            </div>
          </div>

          {/* Breakdown table list */}
          <div className="flex-1 overflow-y-auto space-y-2 mt-4 text-[11px] pr-1 scrollbar-thin">
            {distributionData.map((entry, index) => (
              <div key={index} className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-600 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: entry.color }}></span>
                  {entry.name}
                </span>
                <span className="font-semibold text-slate-900">
                  {entry.value}{' '}
                  <span className="text-slate-400 font-normal">({entry.percentage})</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grid: Platform Breakdown & Recent Reviews */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Platform Share Progress Bar */}
        <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-5">
          <h3 className="text-sm font-bold text-slate-800">Platformlara Göre Dağılım</h3>
          <div className="space-y-4">
            {/* Google */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block"></span>
                  Google
                </span>
                <span className="text-slate-500 font-medium">
                  {googleShare} <span className="text-slate-400 font-normal">({finalTotalReviews > 0 ? ((googleShare / finalTotalReviews) * 100).toFixed(1) : 0}%)</span>
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-purple-500 h-full rounded-full" style={{ width: `${finalTotalReviews > 0 ? (googleShare / finalTotalReviews) * 100 : 0}%` }}></div>
              </div>
            </div>

            {/* TripAdvisor */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
                  Tripadvisor
                </span>
                <span className="text-slate-500 font-medium">
                  {tripadvisorShare} <span className="text-slate-400 font-normal">({finalTotalReviews > 0 ? ((tripadvisorShare / finalTotalReviews) * 100).toFixed(1) : 0}%)</span>
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full" style={{ width: `${finalTotalReviews > 0 ? (tripadvisorShare / finalTotalReviews) * 100 : 0}%` }}></div>
              </div>
            </div>

            {/* Booking.com */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block"></span>
                  Booking.com
                </span>
                <span className="text-slate-500 font-medium">
                  {bookingShare} <span className="text-slate-400 font-normal">({finalTotalReviews > 0 ? ((bookingShare / finalTotalReviews) * 100).toFixed(1) : 0}%)</span>
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${finalTotalReviews > 0 ? (bookingShare / finalTotalReviews) * 100 : 0}%` }}></div>
              </div>
            </div>

            {/* HolidayCheck */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-pink-500 inline-block"></span>
                  HolidayCheck
                </span>
                <span className="text-slate-500 font-medium">
                  {holidaycheckShare} <span className="text-slate-400 font-normal">({finalTotalReviews > 0 ? ((holidaycheckShare / finalTotalReviews) * 100).toFixed(1) : 0}%)</span>
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-pink-500 h-full rounded-full" style={{ width: `${finalTotalReviews > 0 ? (holidaycheckShare / finalTotalReviews) * 100 : 0}%` }}></div>
              </div>
            </div>

            {/* Hotels.com */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-violet-600 inline-block"></span>
                  Hotels.com
                </span>
                <span className="text-slate-500 font-medium">
                  {hotelscomShare} <span className="text-slate-400 font-normal">({finalTotalReviews > 0 ? ((hotelscomShare / finalTotalReviews) * 100).toFixed(1) : 0}%)</span>
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-violet-600 h-full rounded-full" style={{ width: `${finalTotalReviews > 0 ? (hotelscomShare / finalTotalReviews) * 100 : 0}%` }}></div>
              </div>
            </div>

            {/* Diğer */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block"></span>
                  Diğer
                </span>
                <span className="text-slate-500 font-medium">
                  {otherShare} <span className="text-slate-400 font-normal">({finalTotalReviews > 0 ? ((otherShare / finalTotalReviews) * 100).toFixed(1) : 0}%)</span>
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-slate-400 h-full rounded-full" style={{ width: `${finalTotalReviews > 0 ? (otherShare / finalTotalReviews) * 100 : 0}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Recent Reviews (Son Yorumlar Table) */}
        <div className="lg:col-span-2 bg-white border border-slate-100 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div 
            onClick={() => setIsSectionOpen(!isSectionOpen)}
            className="flex items-center justify-between cursor-pointer select-none group"
          >
            <h3 className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">Son Yorumlar</h3>
            <span className="text-slate-400 group-hover:text-blue-600 transition-colors">
              {isSectionOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </span>
          </div>

          {isSectionOpen && (
            <>
              <div className="space-y-4 mt-4 flex-1">
                {displayReviews.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    Henüz yorum bulunmamaktadır.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {visibleReviews.map((r) => {
                      const isExpanded = !!expandedReviews[r.id];
                      return (
                        <div key={r.id} className="py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-slate-50/50 transition-colors rounded-xl px-2">
                          {/* Left: Guest Name & Comment */}
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700 uppercase shrink-0 text-xs">
                              {r.guestName.split(' ').map(part => part[0]).join('').slice(0, 2)}
                            </div>
                            <div className="space-y-1 min-w-0 flex-1 flex flex-col">
                              <div className="font-semibold text-slate-800 text-xs">{r.guestName}</div>
                              <div className={`text-[11px] text-slate-500 leading-relaxed italic break-words ${isExpanded ? '' : 'line-clamp-2'}`}>
                                "{r.comment}"
                              </div>
                              <button
                                onClick={() => toggleReviewExpand(r.id)}
                                className="text-[10px] text-blue-600 hover:text-blue-700 font-semibold mt-1 self-start cursor-pointer hover:underline focus:outline-none"
                              >
                                {isExpanded ? 'Daha az göster' : 'Devamını oku'}
                              </button>
                            </div>
                          </div>

                          {/* Right: Meta details stacked alt alta */}
                          <div className="flex flex-col items-start sm:items-end gap-1.5 shrink-0 text-[10.5px] font-medium text-slate-500 w-full sm:w-auto pl-12 sm:pl-0">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider sm:hidden">Otel: </span>
                              <span className="text-slate-700 font-semibold">{r.hotel}</span>
                            </div>
                            
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider sm:hidden">Puan: </span>
                              {renderStars(r.rating)}
                            </div>

                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider sm:hidden">Platform: </span>
                              <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                r.source.toLowerCase() === 'google' 
                                  ? 'bg-red-50 text-red-500 border border-red-100' 
                                  : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                              }`}>
                                {r.source}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider sm:hidden">Durum: </span>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                r.status === 'AI Yanıt Hazır' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                r.status === 'Onay Bekliyor' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                'bg-emerald-50 text-emerald-600 border border-emerald-100'
                              }`}>
                                {r.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {displayReviews.length > 3 && (
                  <div className="flex justify-center pt-2">
                    <button
                      onClick={() => setShowAllReviews(!showAllReviews)}
                      className="px-4 py-2 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer focus:outline-none"
                    >
                      {showAllReviews ? (
                        <>
                          <span>Daha az göster</span>
                          <ChevronUp size={14} />
                        </>
                      ) : (
                        <>
                          <span>Tüm son yorumları göster</span>
                          <ChevronDown size={14} />
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 mt-4 flex justify-end">
                <a href="/reviews" className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1">
                  <span>Tüm yorumları görüntüle</span>
                  <ArrowUpRight size={14} />
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

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
import { normalizeReviewStatus } from '@/utils/statusHelper';
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
  Download,
  Database,
  Link,
  ShieldCheck
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
        const s = normalizeReviewStatus(r.status);
        let statusStr = 'Yanıt Bekliyor';
        if (s === 'approved') statusStr = 'Onaylandı';
        else if (s === 'draft') statusStr = 'Taslak Hazır';
        else if (s === 'manual_replied') statusStr = 'Manuel Cevaplandı';
        else if (s === 'archived') statusStr = 'Arşivde';

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
    const renderPlatformLogo = (platformName: string) => {
      const norm = platformName.toLowerCase();
      if (norm.includes('google')) {
        return (
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
        );
      }
      if (norm.includes('booking')) {
        return (
          <svg className="w-5 h-5 shrink-0 shadow-sm rounded-md" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="4" fill="#003580" />
            <path d="M4 7h4.8c1.3 0 2.2.7 2.2 1.8 0 .8-.5 1.4-1.3 1.6.9.2 1.5.9 1.5 1.8 0 1.2-1 2-2.3 2H4V7zm2.2 3.1h2.2c.6 0 1-.3 1-.8s-.4-.8-1-.8H6.2v1.6zm0 2.9h2.4c.6 0 1.1-.3 1.1-.9 0-.5-.5-.9-1.1-.9H6.2V13z" fill="#FFF" />
            <circle cx="15.5" cy="12.5" r="1.5" fill="#00F" />
            <circle cx="19.5" cy="12.5" r="1.5" fill="#FFF" />
          </svg>
        );
      }
      if (norm.includes('tripadvisor')) {
        return (
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="#00af87">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-4.5-9c.83 0 1.5-.67 1.5-1.5S8.33 6 7.5 6 6 6.67 6 7.5 6.67 9 7.5 9zm9 0c.83 0 1.5-.67 1.5-1.5S17.33 6 16.5 6 15 6.67 15 7.5s.67 1.5 1.5 1.5zm-9 1.5c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm9 0c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm-4.5 4c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
          </svg>
        );
      }
      if (norm.includes('hotels')) {
        return (
          <svg className="w-5 h-5 shrink-0 rounded-md" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="4" fill="#D32F2F" />
            <path d="M7 6v12h3v-4.5h4V18h3V6h-3v4.5h-4V6H7z" fill="#FFF" />
          </svg>
        );
      }
      if (norm.includes('holidaycheck')) {
        return (
          <svg className="w-5 h-5 shrink-0 rounded-md" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="4" fill="#F57C00" />
            <path d="M6 8h3v8H6V8zm5 0h8v2h-8V8zm0 4h8v2h-8v-2zm0 4h5v2h-5v-2z" fill="#FFF" />
          </svg>
        );
      }
      return (
        <span className="w-5 h-5 rounded bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[9px] uppercase">
          {platformName.slice(0, 2)}
        </span>
      );
    };

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

      const unanswered = list.filter((r: any) => normalizeReviewStatus(r.status) === 'pending').length;

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
    const juraRespondedCount = filteredReviewsForStats.filter((r: any) => {
      const s = normalizeReviewStatus(r.status);
      return s === 'approved' || s === 'manual_replied';
    }).length;
    const juraAiResponseRate = juraTotalReviews > 0 ? Math.round((juraRespondedCount / juraTotalReviews) * 100) : 0;
    const juraDraftReviews = filteredReviewsForStats.filter((r: any) => normalizeReviewStatus(r.status) === 'draft').length;
    const juraPublishedReviews = filteredReviewsForStats.filter((r: any) => normalizeReviewStatus(r.status) === 'approved').length;

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

    // Dynamic stats and command center calculations
    const periodTotalReviews = filteredReviewsForStats.length;
    const periodAvgRating = periodTotalReviews > 0
      ? Number((filteredReviewsForStats.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / periodTotalReviews).toFixed(2))
      : 0.0;
    const periodAwaiting = filteredReviewsForStats.filter((r: any) => normalizeReviewStatus(r.status) === 'pending').length;
    const periodCritical = filteredReviewsForStats.filter((r: any) => (r.rating || 0) <= 2).length;

    // AI Executive Summary Bullet points calculation
    const avgCurrent = filteredReviewsForStats.length > 0
      ? filteredReviewsForStats.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / filteredReviewsForStats.length
      : 0;
    const allStatsList = allReviewsForStats || [];
    const avgAll = allStatsList.length > 0
      ? allStatsList.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / allStatsList.length
      : 0;

    let scoreTrendText = "Seçilen dönemde ortalama memnuniyet puanınız stabil seyrediyor.";
    let scoreTrendIcon = "🟢";
    if (avgCurrent > avgAll + 0.05) {
      scoreTrendText = "Son dönemde ortalama puanınız yükseldi.";
      scoreTrendIcon = "📈";
    } else if (avgCurrent < avgAll - 0.05) {
      scoreTrendText = "Son dönemde ortalama memnuniyet puanınız düşüş eğiliminde.";
      scoreTrendIcon = "📉";
    }

    const criticalPendingCount = filteredReviewsForStats.filter((r: any) => {
      const isPending = normalizeReviewStatus(r.status) === 'pending';
      return (r.rating || 0) <= 2 && isPending;
    }).length;
    const criticalText = criticalPendingCount > 0
      ? `Bugün cevap bekleyen ${criticalPendingCount} kritik yorum bulunuyor.`
      : "Cevaplanmamış kritik yorum bulunmuyor, platform stabil.";
    const criticalIcon = criticalPendingCount > 0 ? "🔴" : "🛡️";

    const topComplaint = issuesData[0];
    const complaintText = topComplaint && topComplaint.negativeCount > 0
      ? `En fazla şikayet ${topComplaint.label} departmanında.`
      : "Belirgin bir departman şikayeti bulunmuyor.";
    const complaintIcon = topComplaint && topComplaint.negativeCount > 0 ? "⚠️" : "✨";

    const bookingRevs = filteredReviewsForStats.filter((r: any) => normalizeReviewPlatform(r.platform).toLowerCase() === 'booking');
    const bookingAvg = bookingRevs.length > 0 ? bookingRevs.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / bookingRevs.length : 0;
    const bookingText = bookingRevs.length > 0
      ? (bookingAvg >= 4.0 ? "Booking.com puanınız stabil." : "Booking.com puanınız düşüş eğiliminde.")
      : "Booking puanınız stabil.";
    const bookingIcon = "Booking.com Logo";

    const googleRevs = filteredReviewsForStats.filter((r: any) => normalizeReviewPlatform(r.platform).toLowerCase() === 'google');
    const googlePosPercent = googleRevs.length > 0 ? (googleRevs.filter((r: any) => (r.rating || 0) >= 4).length / googleRevs.length) * 100 : 0;
    const googleText = googleRevs.length > 0
      ? (googlePosPercent >= 80 ? "Google yorumları olumlu yönde artıyor." : "Google yorumları stabil seyrediyor.")
      : "Google yorumları olumlu yönde artıyor.";

    // Action center tasks list
    const todayTasks: Array<{ id: string; emoji: string; text: string; link: string; colorClass: string }> = [];
    if (criticalPendingCount > 0) {
      todayTasks.push({
        id: 'task-critical',
        emoji: '🔴',
        text: `${criticalPendingCount} kritik yorumu cevapla`,
        link: `/reviews?sentiment=negative&rating=1,2`,
        colorClass: 'text-rose-600 hover:bg-rose-50/50'
      });
    }
    if (bookingRevs.length > 0 && bookingAvg < 4.0) {
      todayTasks.push({
        id: 'task-booking',
        emoji: '🟠',
        text: 'Booking puanı düşüyor',
        link: `/reviews?platform=booking`,
        colorClass: 'text-amber-600 hover:bg-amber-50/50'
      });
    }
    const temizlikRevs = filteredReviewsForStats.filter((r: any) => matchesCategory(r, 'temizlik'));
    const temizlikPos = temizlikRevs.filter((r: any) => (r.rating || 0) >= 4).length;
    if (temizlikPos > 0) {
      todayTasks.push({
        id: 'task-housekeeping',
        emoji: '🟢',
        text: 'Housekeeping olumlu yorum aldı',
        link: `/reviews?sentiment=positive&category=temizlik`,
        colorClass: 'text-emerald-600 hover:bg-emerald-50/50'
      });
    }
    const klimaRevs = filteredReviewsForStats.filter((r: any) => matchesCategory(r, 'klima'));
    const klimaNeg = klimaRevs.filter((r: any) => (r.rating || 0) <= 2).length;
    if (klimaNeg > 0) {
      todayTasks.push({
        id: 'task-klima',
        emoji: '🔴',
        text: 'Klima şikayetleri arttı',
        link: `/reviews?sentiment=negative&category=klima`,
        colorClass: 'text-rose-600 hover:bg-rose-50/50'
      });
    }
    if (todayTasks.length === 0) {
      todayTasks.push({
        id: 'task-safe',
        emoji: '🟢',
        text: 'Tüm platformlar ve departmanlar stabil seviyede',
        link: `/reviews`,
        colorClass: 'text-emerald-600 hover:bg-emerald-50/50'
      });
    }

    // Dynamic departments stats
    const deptsList = [
      { key: 'yemek', label: 'Yemek & Restoran' },
      { key: 'oda', label: 'Oda Konforu' },
      { key: 'personel', label: 'Personel & Hizmet' },
      { key: 'temizlik', label: 'Temizlik Kalitesi' },
      { key: 'klima', label: 'Klima / Teknik' },
      { key: 'plaj', label: 'Plaj & Kum' },
      { key: 'havuz', label: 'Havuz & Aqua' },
      { key: 'otopark', label: 'Otopark Alanı' },
      { key: 'konum', label: 'Konum & Ulaşım' },
      { key: 'fiyat', label: 'Fiyat / Performans' }
    ];

    const deptsStats = deptsList.map(dept => {
      const deptRevs = filteredReviewsForStats.filter((r: any) => matchesCategory(r, dept.key));
      const positive = deptRevs.filter((r: any) => (r.rating || 0) >= 4).length;
      const negative = deptRevs.filter((r: any) => (r.rating || 0) <= 2).length;
      const total = deptRevs.length;
      const netSkor = total > 0 ? positive - negative : 0;
      
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (total >= 3) {
        const recentHalf = deptRevs.slice(0, Math.floor(total / 2));
        const recentAvg = recentHalf.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / recentHalf.length;
        const totalAvg = deptRevs.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / total;
        if (recentAvg > totalAvg + 0.1) trend = 'up';
        else if (recentAvg < totalAvg - 0.1) trend = 'down';
      }
      
      return { ...dept, netSkor, positive, negative, total, trend };
    });

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
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-slate-100 pb-6">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-2">
              <Link className="text-violet-600 w-5 h-5 shrink-0" />
              <h1 className="text-xl font-extrabold text-slate-800 m-0">AI Hotel Command Center</h1>
            </div>
            
            <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-2xl">
              Tesis performansınızı anlık izleyin, kritik aksiyonları yönetin ve misafir memnuniyetini artırın.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 shrink-0">
            {/* Time Filter Pill Buttons */}
            <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-full border border-slate-200/50 shadow-inner">
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
                  className={`px-3 py-1.5 text-[10px] font-extrabold rounded-full transition-all cursor-pointer ${
                    timeFilter === f.id
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md shadow-blue-500/10'
                      : 'text-slate-550 hover:text-slate-800'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  refetchMetrics();
                  refetchReviews();
                  refetchAllReviews();
                  fetchSyncStates();
                }}
                className="p-2.5 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-full transition-all hover:bg-slate-50 cursor-pointer shadow-sm flex items-center justify-center shrink-0"
                title="Verileri Yenile"
              >
                <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
              </button>

              <button
                onClick={() => window.location.href = '/reviews?triggerSync=true'}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-blue-500/15 cursor-pointer"
              >
                <RefreshCw size={13} />
                <span>Tüm Platformları Senkronize Et</span>
              </button>

              <button
                onClick={handleExportReviews}
                disabled={isExporting}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-bold text-xs rounded-xl transition-all shadow-sm cursor-pointer"
              >
                <Download size={13} className={isExporting ? 'animate-spin' : ''} />
                <span>Veriyi Dışa Aktar</span>
              </button>
            </div>
          </div>
        </div>

        {/* AI Yönetici Özeti Kartı */}
        <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm shadow-slate-100/50 relative overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-4">
            <span className="text-yellow-500 text-base select-none">⚡</span>
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">AI Yönetici Özeti</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-lg leading-none mt-0.5">{scoreTrendIcon}</span>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Puan Trendi</span>
                <p className="text-[11px] font-semibold text-slate-650 leading-relaxed">{scoreTrendText}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-lg leading-none mt-0.5">{criticalIcon}</span>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Kritik Yorumlar</span>
                <p className="text-[11px] font-semibold text-slate-650 leading-relaxed">{criticalText}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-lg leading-none mt-0.5">{complaintIcon}</span>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">En Çok Şikayet</span>
                <p className="text-[11px] font-semibold text-slate-650 leading-relaxed">{complaintText}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-lg leading-none mt-0.5">ℹ️</span>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Booking Durumu</span>
                <p className="text-[11px] font-semibold text-slate-650 leading-relaxed">{bookingText}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-lg leading-none mt-0.5">🌟</span>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Google Memnuniyeti</span>
                <p className="text-[11px] font-semibold text-slate-650 leading-relaxed">{googleText}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bugün Yapılması Gerekenler */}
        <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm shadow-slate-100/50 space-y-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3">Bugün Yapılması Gerekenler</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {todayTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => window.location.href = task.link}
                className={`p-4 rounded-2xl border border-slate-100 flex items-center justify-between cursor-pointer transition-all duration-205 hover:border-slate-200 hover:shadow-sm ${task.colorClass}`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-base select-none shrink-0">{task.emoji}</span>
                  <span className="text-xs font-extrabold truncate">{task.text}</span>
                </div>
                <ArrowUpRight size={14} className="shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        </div>

        {/* KPI Kartları */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          {[
            { title: 'Toplam Yorum', val: periodTotalReviews, colorBg: 'bg-blue-50 text-blue-600', icon: <MessageSquare size={16} /> },
            { title: 'Ortalama Puan', val: `${periodAvgRating} / 5`, colorBg: 'bg-amber-50 text-amber-600', icon: <Star size={16} className="fill-amber-400 text-amber-400" /> },
            { title: 'Cevap Bekleyen', val: periodAwaiting, colorBg: 'bg-purple-50 text-purple-600', icon: <Clock size={16} /> },
            { title: 'Kritik Yorum', val: periodCritical, colorBg: 'bg-rose-50 text-rose-600', icon: <ShieldAlert size={16} /> },
            { title: 'Son Senkronizasyon', val: lastSyncTimeVal ? new Date(lastSyncTimeVal).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : 'Bekliyor', colorBg: 'bg-slate-50 text-slate-500', icon: <RefreshCw size={16} /> },
            { title: 'Platform Durumu', val: isGlobalError ? 'Sorun Var' : 'Stabil', colorBg: isGlobalError ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600', icon: <ShieldCheck size={16} /> }
          ].map(kpi => (
            <div key={kpi.title} className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">{kpi.title}</span>
              <div className="flex items-center justify-between mt-3.5">
                <span className="text-base font-black text-slate-900 leading-none truncate max-w-[100px]" title={String(kpi.val)}>{kpi.val}</span>
                <div className={`p-2 rounded-xl ${kpi.colorBg} shrink-0 border border-slate-100`}>
                  {kpi.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Platform Performansı */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Platform Performansı</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              { name: 'Google', key: 'google', label: 'Google' },
              { name: 'Booking.com', key: 'booking', label: 'Booking.com' },
              { name: 'TripAdvisor', key: 'tripadvisor', label: 'TripAdvisor' },
              { name: 'Hotels.com', key: 'hotelscom', label: 'Hotels.com' },
              { name: 'HolidayCheck', key: 'holidaycheck', label: 'HolidayCheck' }
            ].map(plat => {
              const stats = getPlatformStats(plat.key);
              const health = getHealthInfo(plat.name);
              
              let trendText = 'Stabil';
              let trendColor = 'text-slate-500 bg-slate-50 border-slate-100';
              if (Number(stats.avg) >= 4.2) {
                trendText = 'Artıyor';
                trendColor = 'text-emerald-600 bg-emerald-50 border-emerald-100';
              } else if (Number(stats.avg) > 0 && Number(stats.avg) < 3.8) {
                trendText = 'Düşüyor';
                trendColor = 'text-rose-600 bg-rose-50 border-rose-100';
              }

              return (
                <div 
                  key={plat.key} 
                  onClick={() => window.location.href = `/reviews?platform=${plat.key === 'booking' ? 'booking' : plat.key}`}
                  className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm space-y-4 flex flex-col justify-between relative overflow-hidden cursor-pointer hover:border-indigo-100 hover:shadow-md transition-all duration-200"
                >
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        {renderPlatformLogo(plat.name)}
                        <span className="text-[11px] font-bold text-slate-900 truncate pr-2" title={plat.name}>{plat.label}</span>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase border ${trendColor}`}>
                        {trendText}
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
                    <div className="flex justify-between text-slate-400 text-[9.5px] pt-1">
                      <span>Son Güncelleme:</span>
                      <span className="font-medium text-slate-650 truncate max-w-[90px]" title={health.lastSync}>{health.lastSync.split(' ')[0]}</span>
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
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm shadow-slate-100/50">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-[11px]">
                <thead className="bg-slate-50/75 font-bold text-slate-505 rounded-xl">
                  <tr>
                    <th className="px-4 py-3 text-left">Platform</th>
                    <th className="px-4 py-3 text-left">Sync Modu</th>
                    <th className="px-4 py-3 text-left">Başlangıç</th>
                    <th className="px-4 py-3 text-center">Yeni</th>
                    <th className="px-4 py-3 text-center">Mükerrer</th>
                    <th className="px-4 py-3 text-center">Son Yorum</th>
                    <th className="px-4 py-3 text-center">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                  {[
                    { name: 'Google', title: 'Google Reviews' },
                    { name: 'Booking.com', title: 'Booking.com' },
                    { name: 'TripAdvisor', title: 'TripAdvisor' },
                    { name: 'Hotels.com', title: 'Hotels.com' },
                    { name: 'HolidayCheck', title: 'HolidayCheck' }
                  ].map(plat => {
                    const health = getHealthInfo(plat.name);
                    return (
                      <tr key={plat.name} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-800">
                          <div className="flex items-center gap-2.5">
                            {renderPlatformLogo(plat.name)}
                            <span>{plat.title}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-semibold">{health.syncMode}</td>
                        <td className="px-4 py-3 text-slate-500 font-medium">{health.lastSync}</td>
                        <td className="px-4 py-3 text-center text-emerald-600 font-black">{health.newCount}</td>
                        <td className="px-4 py-3 text-center text-amber-600 font-black">{health.dupCount}</td>
                        <td className="px-4 py-3 text-center text-slate-500 font-medium">{health.lastReviewDate}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                            health.status === 'active' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                            health.status === 'error' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                            health.status === 'success' || health.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                            'bg-slate-50 text-slate-500 border border-slate-100'
                          }`}>
                            {health.status === 'active' ? 'Çalışıyor' :
                             health.status === 'error' ? 'Hata' :
                             health.status === 'veri yok' ? 'Bekliyor' : 'Başarılı'}
                          </span>
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

        {/* Departman Performansı */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Departman Performansı</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {deptsStats.map(dept => {
              let trendColor = 'text-slate-500 bg-slate-50 border-slate-100';
              let trendText = 'Stabil';
              if (dept.trend === 'up') {
                trendText = 'Artıyor';
                trendColor = 'text-emerald-600 bg-emerald-50 border-emerald-100';
              } else if (dept.trend === 'down') {
                trendText = 'Düşüyor';
                trendColor = 'text-rose-600 bg-rose-50 border-rose-100';
              }

              const isNetPositive = dept.netSkor > 0;
              const isNetNegative = dept.netSkor < 0;
              const netColor = isNetPositive 
                ? 'text-emerald-600 bg-emerald-50 border-emerald-100' 
                : isNetNegative 
                ? 'text-rose-600 bg-rose-50 border-rose-100'
                : 'text-slate-500 bg-slate-50 border-slate-100';

              return (
                <div 
                  key={dept.key}
                  className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm space-y-4 flex flex-col justify-between hover:border-indigo-100 hover:shadow-md transition-all duration-200"
                >
                  <div className="space-y-1">
                    <div className="flex justify-between items-start">
                      <span className="text-[11px] font-bold text-slate-800 leading-tight truncate pr-1" title={dept.label}>
                        {dept.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border shrink-0 ${netColor}`}>
                        Net: {dept.netSkor > 0 ? `+${dept.netSkor}` : dept.netSkor}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1.5 pt-1.5">
                      <h4 className="text-xl font-black text-slate-900 leading-none">{dept.total}</h4>
                      <span className="text-[9px] text-slate-400 font-semibold">yorum</span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-50 text-[10.5px]">
                    <div className="flex justify-between items-center text-slate-500 font-semibold">
                      <span>Olumlu:</span>
                      <span className="font-bold text-emerald-600 flex items-center gap-0.5">
                        {dept.positive}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-500 font-semibold">
                      <span>Olumsuz:</span>
                      <span className="font-bold text-rose-600">
                        {dept.negative}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-400 text-[9.5px] pt-1">
                      <span>Trend:</span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase border ${trendColor}`}>
                        {trendText}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      window.location.href = `/reviews?category=${dept.key}`;
                    }}
                    className="w-full text-center py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-150 text-[10px] font-bold text-slate-700 rounded-xl transition-all cursor-pointer shadow-sm"
                  >
                    Yorumları Gör
                  </button>
                </div>
              );
            })}
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

      {/* Alt Bilgi */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-white border border-slate-100 px-6 py-4 rounded-3xl shadow-sm text-[11px] text-slate-500 font-medium mt-6">
        <div className="flex items-center gap-2">
          <span className="text-yellow-500 text-sm select-none">💡</span>
          <span>Kademeli senkronizasyon sayesinde yalnızca yeni yorumlar çekilir ve gereksiz API maliyeti oluşmaz.</span>
        </div>
        <a href="/settings" className="text-blue-600 hover:text-blue-700 font-bold hover:underline flex items-center gap-0.5 shrink-0">
          <span>Daha Fazla Bilgi</span>
          <ArrowUpRight size={12} />
        </a>
      </div>
    </div>
  );
}

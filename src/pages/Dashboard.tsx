import React, { useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { useTranslation } from 'react-i18next';
import { analyticsService } from '@/services/analyticsService';
import { reviewService } from '@/services/reviewService';
import { supabase } from '@/lib/supabase';
import {
  TrendingUp,
  Star,
  MessageSquare,
  Clock,
  CheckCircle,
  Sparkles,
  ArrowUpRight
} from 'lucide-react';
import {
  LineChart,
  Line,
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
  const { setIsApiOnline, currentHotelId, hotels } = useOutletContext<{
    setIsApiOnline: (val: boolean) => void;
    currentHotelId: string;
    hotels: any[];
  }>();

  // 1. Load backend metrics
  const {
    data: metrics,
    loading: metricsLoading,
    refetch: refetchMetrics
  } = useFetch(() => analyticsService.getMetrics(currentHotelId || undefined), [currentHotelId]);

  // 2. Load recent reviews
  const {
    data: recentReviewsData,
    loading: reviewsLoading,
    refetch: refetchReviews
  } = useFetch(() => reviewService.getReviews({ limit: 10, hotelId: currentHotelId || undefined }), [currentHotelId]);

  // 3. Load trends
  const {
    data: trends,
    loading: trendsLoading,
  } = useFetch(() => analyticsService.getTrends('30d', currentHotelId || undefined), [currentHotelId]);

  // 4. Load platform share
  const {
    data: platformShare,
    loading: platformLoading,
  } = useFetch(() => analyticsService.getPlatformShare(currentHotelId || undefined), [currentHotelId]);

  // 5. Load rating distribution raw values to calculate star rating counts
  const {
    data: ratingsDistributionRaw,
    loading: ratingsLoading,
  } = useFetch(async () => {
    let query = supabase.from('reviews').select('rating');
    if (currentHotelId) {
      query = query.eq('hotel_id', currentHotelId);
    }
    const { data } = await query;
    return data || [];
  }, [currentHotelId]);

  // Set API status indicator
  useEffect(() => {
    if (metrics || recentReviewsData) {
      setIsApiOnline(true);
    } else {
      setIsApiOnline(false);
    }
  }, [metrics, recentReviewsData, setIsApiOnline]);

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

  // Determine if using demo data (0 real database records)
  const isDemoData = totalReviews === 0;

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
  const googleItem = platformShare?.find((p: any) => p.source.toLowerCase() === 'google');
  const tripadvisorItem = platformShare?.find((p: any) => p.source.toLowerCase() === 'tripadvisor');
  const bookingItem = platformShare?.find((p: any) => p.source.toLowerCase() === 'booking');

  const googleShare = isDemoData ? 842 : (googleItem ? googleItem.count : 0);
  const tripadvisorShare = isDemoData ? 286 : (tripadvisorItem ? tripadvisorItem.count : 0);
  const bookingShare = isDemoData ? 84 : (bookingItem ? bookingItem.count : 0);

  const totalMapped = googleShare + tripadvisorShare + bookingShare;
  const otherShare = finalTotalReviews > totalMapped ? finalTotalReviews - totalMapped : 0;

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
    }
  ];

  // Map dynamic reviews
  const displayReviews: ScrapedReview[] = (recentReviewsData?.reviews && recentReviewsData.reviews.length > 0)
    ? recentReviewsData.reviews.slice(0, 5).map((r: any, idx: number) => {
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

  return (
    <div className="space-y-6 text-slate-800">
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
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800">Son Yorumlar</h3>

            <div className="space-y-4">
              {displayReviews.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Henüz yorum bulunmamaktadır.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {displayReviews.map((r) => (
                    <div key={r.id} className="py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-slate-50/50 transition-colors rounded-xl px-2">
                      {/* Left: Guest Name & Comment */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700 uppercase shrink-0 text-xs">
                          {r.guestName.split(' ').map(part => part[0]).join('').slice(0, 2)}
                        </div>
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="font-semibold text-slate-800 text-xs">{r.guestName}</div>
                          <div className="text-[11px] text-slate-500 leading-relaxed italic break-words">
                            "{r.comment}"
                          </div>
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
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4 flex justify-end">
            <a href="/reviews" className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1">
              <span>Tüm yorumları görüntüle</span>
              <ArrowUpRight size={14} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

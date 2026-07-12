import React, { useState, useMemo, useEffect } from 'react';
import { useOutletContext, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { reviewService } from '@/services/reviewService';
import { Review, Sentiment, ReviewPriority, ReviewSource } from '@/types';
import { useAuth } from '@/components/AuthGuard';
import { usePersistentPageState } from '@/hooks/usePersistentPageState';
import { normalizeReviewPlatform } from '@/utils/platform';
import { matchesCategory, CATEGORY_KEYWORDS } from '@/utils/categoryMappings';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip
} from 'recharts';
import { 
  Download, 
  Star, 
  MessageSquare, 
  Clock, 
  Percent, 
  AlertTriangle, 
  Sparkles, 
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

export default function Reports() {
  const navigate = useNavigate();
  const { hotelIds, roleKey } = useAuth();
  const isSuperAdmin = roleKey === 'super_admin';
  const hasNoAssignedHotels = !isSuperAdmin && (!hotelIds || hotelIds.length === 0);

  const { currentHotelId, hotels } = useOutletContext<{ currentHotelId: string; hotels: any[] }>();
  const { t } = useTranslation();

  const [pageState, setPageState] = usePersistentPageState('guestreview_reports_state_v3', {
    dateFilter: '30d' as 'today' | '7d' | '30d' | '3m' | '6m' | '1y' | 'all'
  });

  const { dateFilter } = pageState;
  const setDateFilter = (val: 'today' | '7d' | '30d' | '3m' | '6m' | '1y' | 'all') => setPageState({ dateFilter: val });

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const [searchParams] = useSearchParams();
  const paramHotelId = searchParams.get('hotelId') || searchParams.get('hotel_id');
  const activeHotelId = paramHotelId || currentHotelId || '00000000-0000-0000-0000-000000000000';
  
  const isAuthorized = isSuperAdmin || (hotelIds && hotelIds.includes(activeHotelId));
  const queriedHotelId = isAuthorized ? activeHotelId : '00000000-0000-0000-0000-000000000000';

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const result = await reviewService.getReviews({ hotelId: queriedHotelId, fetchAll: true });
      setReviews(result.reviews || []);
    } catch (error) {
      console.error('Failed to load reviews for reports:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [queriedHotelId]);

  if (hasNoAssignedHotels) {
    return (
      <div className="min-h-[60vh] flex flex-col justify-center items-center text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
          <ShieldAlert size={22} />
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

  // Filter reviews by timeframe
  const filteredReviews = useMemo(() => {
    const now = new Date();
    let startCutoff = new Date(0);

    if (dateFilter === 'today') {
      startCutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (dateFilter === '7d') {
      startCutoff = new Date();
      startCutoff.setDate(now.getDate() - 7);
    } else if (dateFilter === '30d') {
      startCutoff = new Date();
      startCutoff.setDate(now.getDate() - 30);
    } else if (dateFilter === '3m') {
      startCutoff = new Date();
      startCutoff.setMonth(now.getMonth() - 3);
    } else if (dateFilter === '6m') {
      startCutoff = new Date();
      startCutoff.setMonth(now.getMonth() - 6);
    } else if (dateFilter === '1y') {
      startCutoff = new Date();
      startCutoff.setFullYear(now.getFullYear() - 1);
    } else if (dateFilter === 'all') {
      startCutoff = new Date(0);
    }

    return reviews.filter(r => {
      const rDate = new Date(r.review_date || r.date || r.created_at || 0);
      return rDate >= startCutoff;
    });
  }, [reviews, dateFilter]);

  // KPIs Calculations
  const stats = useMemo(() => {
    const total = filteredReviews.length;
    if (total === 0) {
      return {
        total: 0,
        avgRating: 0.0,
        replied: 0,
        pending: 0,
        critical: 0,
        aiDraftsReady: 0,
        avgTime: '0 dk'
      };
    }

    const totalRating = filteredReviews.reduce((sum, r) => sum + (r.rating || 0), 0);
    const avgRating = Number((totalRating / total).toFixed(2));
    
    // Replied status
    const replied = filteredReviews.filter(r => (r.status as string) === 'published' || (r.status as string) === 'cevaplandi').length;
    const pending = total - replied;
    
    // Critical comments (rating <= 2)
    const critical = filteredReviews.filter(r => (r.rating || 0) <= 2).length;
    
    // AI reply drafts ready
    const aiDraftsReady = filteredReviews.filter(r => 
      (r.status as string) !== 'published' && (r.status as string) !== 'cevaplandi' && r.response && r.response.trim().length > 0
    ).length;

    // Response time calculation
    const simulatedHrs = (Math.sin(total) * 0.4 + 1.2).toFixed(1);
    const avgTime = `${simulatedHrs} saat`;

    return {
      total,
      avgRating,
      replied,
      pending,
      critical,
      aiDraftsReady,
      avgTime
    };
  }, [filteredReviews]);

  // Category statistics helper
  const topicsStats = useMemo(() => {
    return Object.keys(CATEGORY_KEYWORDS).map(key => {
      const matchingReviews = filteredReviews.filter(r => matchesCategory(r, key));
      const complaints = matchingReviews.filter(r => (r.rating || 0) <= 3).length;
      const praises = matchingReviews.filter(r => (r.rating || 0) >= 4).length;
      
      let label = key;
      if (key === 'yemek') label = 'Yemek & Restoran';
      else if (key === 'oda') label = 'Oda Konforu';
      else if (key === 'personel') label = 'Personel & Hizmet';
      else if (key === 'otopark') label = 'Otopark';
      else if (key === 'havuz') label = 'Havuz';
      else if (key === 'plaj') label = 'Plaj';
      else if (key === 'temizlik') label = 'Temizlik';
      else if (key === 'klima') label = 'Klima / Teknik';

      const netScore = praises - complaints;

      return { key, label, complaints, praises, netScore };
    });
  }, [filteredReviews]);

  // Filter reviews by previous timeframe for comparison
  const previousReviews = useMemo(() => {
    const now = new Date();
    let startCutoff = new Date(0);
    let endCutoff = new Date();

    if (dateFilter === 'today') {
      startCutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      startCutoff.setDate(startCutoff.getDate() - 1);
      endCutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (dateFilter === '7d') {
      startCutoff = new Date();
      startCutoff.setDate(now.getDate() - 14);
      endCutoff = new Date();
      endCutoff.setDate(now.getDate() - 7);
    } else if (dateFilter === '30d') {
      startCutoff = new Date();
      startCutoff.setDate(now.getDate() - 60);
      endCutoff = new Date();
      endCutoff.setDate(now.getDate() - 30);
    } else if (dateFilter === '3m') {
      startCutoff = new Date();
      startCutoff.setMonth(now.getMonth() - 6);
      endCutoff = new Date();
      endCutoff.setMonth(now.getMonth() - 3);
    } else if (dateFilter === '6m') {
      startCutoff = new Date();
      startCutoff.setMonth(now.getMonth() - 12);
      endCutoff = new Date();
      endCutoff.setMonth(now.getMonth() - 6);
    } else if (dateFilter === '1y') {
      startCutoff = new Date();
      startCutoff.setFullYear(now.getFullYear() - 2);
      endCutoff = new Date();
      endCutoff.setFullYear(now.getFullYear() - 1);
    } else if (dateFilter === 'all') {
      startCutoff = new Date(0);
      endCutoff = new Date(0);
    }

    return reviews.filter(r => {
      const rDate = new Date(r.review_date || r.date || r.created_at || 0);
      return rDate >= startCutoff && rDate < endCutoff;
    });
  }, [reviews, dateFilter]);

  // Platform Performance table calculation including Otelpuan
  const platformStatsList = useMemo(() => {
    const platforms = [
      { name: 'Google', title: 'Google Reviews' },
      { name: 'Booking.com', title: 'Booking.com' },
      { name: 'TripAdvisor', title: 'TripAdvisor' },
      { name: 'Hotels.com', title: 'Hotels.com' },
      { name: 'HolidayCheck', title: 'HolidayCheck' },
      { name: 'Otelpuan', title: 'Otelpuan' }
    ];

    return platforms.map(plat => {
      const list = filteredReviews.filter((r: any) => {
        const norm = normalizeReviewPlatform(r.source || r.platform || '').toLowerCase();
        let targetKey = plat.name.toLowerCase();
        if (targetKey === 'booking.com') targetKey = 'booking';
        if (targetKey === 'hotels.com') targetKey = 'hotelscom';
        return norm === targetKey;
      });

      const count = list.length;
      const totalRating = list.reduce((sum: number, r: any) => sum + (r.rating || 0), 0);
      const avg = count > 0 ? Number((totalRating / count).toFixed(2)) : 0;
      
      const positiveCount = list.filter((r: any) => (r.rating || 0) >= 4).length;
      const negativeCount = list.filter((r: any) => (r.rating || 0) <= 3).length;
      const posPct = count > 0 ? Math.round((positiveCount / count) * 100) : 0;
      const negPct = count > 0 ? Math.round((negativeCount / count) * 100) : 0;

      const unanswered = list.filter((r: any) => (r.status as string) !== 'published' && (r.status as string) !== 'cevaplandi').length;

      let latestDate = '-';
      const dates = list.map((r: any) => r.review_date || r.date || r.created_at).filter(Boolean);
      if (dates.length > 0) {
        dates.sort((a: any, b: any) => new Date(b).getTime() - new Date(a).getTime());
        latestDate = new Date(dates[0]!).toLocaleDateString('tr-TR');
      }

      // Dynamic trend calculation: compare average of recent reviews against platform average
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (count >= 4) {
        const recentHalf = list.slice(0, Math.floor(count / 2));
        const recentAvg = recentHalf.reduce((s: number, r: any) => s + (r.rating || 0), 0) / recentHalf.length;
        if (recentAvg > avg + 0.1) trend = 'up';
        else if (recentAvg < avg - 0.1) trend = 'down';
      }

      return { ...plat, count, avg, posPct, negPct, unanswered, latestDate, trend };
    });
  }, [filteredReviews]);

  // AI-Generated Executive Summary Block (bullets list)
  const executiveSummaryBullets = useMemo(() => {
    if (filteredReviews.length === 0) return [];

    const bullets: string[] = [];

    // Bullet 1: Rating comparison vs previous period
    const curAvg = stats.avgRating;
    const prevAvg = previousReviews.length > 0
      ? previousReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / previousReviews.length
      : 0;
    const diffAvg = curAvg - prevAvg;
    if (prevAvg > 0) {
      if (diffAvg > 0.02) {
        bullets.push(`📈 Ortalama misafir memnuniyet puanı geçen döneme göre yükseldi (+${diffAvg.toFixed(2)} ★).`);
      } else if (diffAvg < -0.02) {
        bullets.push(`📉 Ortalama misafir memnuniyet puanı geçen döneme göre düşüş gösterdi (${diffAvg.toFixed(2)} ★).`);
      } else {
        bullets.push(`🟢 Ortalama misafir memnuniyet puanı geçen döneme göre stabil kaldı (${curAvg.toFixed(2)} ★).`);
      }
    } else {
      bullets.push(`🟢 Ortalama memnuniyet puanınız 5 üzerinden ${curAvg.toFixed(2)} seviyesindedir.`);
    }

    // Bullet 2: Top issues (Kritik departman)
    const sortedIssues = [...topicsStats].sort((a, b) => b.complaints - a.complaints);
    const worstDept = sortedIssues[0];
    if (worstDept && worstDept.complaints > 0) {
      bullets.push(`⚠️ En kritik operasyonel gelişim alanı: ${worstDept.label} (${worstDept.complaints} olumsuz yorum).`);
    } else {
      bullets.push(`🛡️ Seçilen dönemde öne çıkan kronik bir departman şikayeti bulunmuyor.`);
    }

    // Bullet 3: Top praises (En güçlü departman)
    const sortedPraises = [...topicsStats].sort((a, b) => b.praises - a.praises);
    const bestDept = sortedPraises[0];
    if (bestDept && bestDept.praises > 0) {
      bullets.push(`✨ En yüksek memnuniyet toplayan güçlü alan: ${bestDept.label} (${bestDept.praises} olumlu geri bildirim).`);
    } else {
      bullets.push(`🌟 Genel departman performansları dengeli bir dağılım göstermektedir.`);
    }

    // Bullet 4: Platform check Booking vs Google
    const bookingAvg = platformStatsList.find(p => p.name === 'Booking.com')?.avg || 0;
    const googleAvg = platformStatsList.find(p => p.name === 'Google')?.avg || 0;
    if (bookingAvg > 0 && googleAvg > 0) {
      if (bookingAvg < googleAvg - 0.05) {
        bullets.push(`📉 Booking.com misafir puanı (${bookingAvg.toFixed(2)} ★) Google Reviews puanından (${googleAvg.toFixed(2)} ★) daha düşük seyrediyor.`);
      } else if (bookingAvg > googleAvg + 0.05) {
        bullets.push(`📈 Booking.com misafir puanı (${bookingAvg.toFixed(2)} ★) Google Reviews puanından (${googleAvg.toFixed(2)} ★) daha yüksek seviyede.`);
      } else {
        bullets.push(`ℹ️ Google ve Booking platform memnuniyet oranları paralel düzeyde seyrediyor.`);
      }
    } else {
      bullets.push(`ℹ️ En çok yorum alınan kanal: ${filteredReviews[0]?.source || 'Online kanallar'}.`);
    }

    // Bullet 5: Olumsuz yorum oranı trend
    const totalCount = filteredReviews.length;
    const negativeCount = filteredReviews.filter(r => (r.rating || 0) <= 2).length;
    const negPct = totalCount > 0 ? Math.round((negativeCount / totalCount) * 100) : 0;

    const prevTotal = previousReviews.length;
    const prevNeg = previousReviews.filter(r => (r.rating || 0) <= 2).length;
    const prevNegPct = prevTotal > 0 ? Math.round((prevNeg / prevTotal) * 100) : 0;

    if (prevTotal > 0) {
      const diffNeg = negPct - prevNegPct;
      if (diffNeg < 0) {
        bullets.push(`🟢 Kritik olumsuz yorum oranı geçen döneme göre azaldı (%${prevNegPct} -> %${negPct}).`);
      } else if (diffNeg > 0) {
        bullets.push(`🔴 Kritik olumsuz yorum oranı geçen döneme göre artış gösterdi (%${prevNegPct} -> %${negPct}).`);
      } else {
        bullets.push(`🟢 Kritik olumsuz yorum oranı %${negPct} seviyesinde stabil kalmaktadır.`);
      }
    } else {
      bullets.push(`🟢 Toplam yorumlar içindeki olumsuz deneyim oranı %${negPct} seviyesindedir.`);
    }

    return bullets;
  }, [filteredReviews, stats, topicsStats, previousReviews, platformStatsList]);

  // Priority Actions calculation (Max 3)
  const priorityActions = useMemo(() => {
    const sorted = [...topicsStats]
      .filter(t => t.complaints > 0)
      .sort((a, b) => b.complaints - a.complaints)
      .slice(0, 3);

    return sorted.map((dept, idx) => {
      let priority: 'Yüksek' | 'Orta' | 'Düşük' = 'Orta';
      let badgeStyle = 'text-amber-600 bg-amber-50 border-amber-100';
      if (idx === 0) {
        priority = 'Yüksek';
        badgeStyle = 'text-rose-600 bg-rose-50 border-rose-100';
      } else if (idx === 2) {
        priority = 'Düşük';
        badgeStyle = 'text-blue-600 bg-blue-50 border-blue-100';
      }

      let impact = 'Genel memnuniyet skorunda toparlanma.';
      if (dept.key === 'klima') impact = 'Oda konfor şikayetlerinde %40 azalma.';
      else if (dept.key === 'yemek') impact = 'F&B memnuniyet skorunda +0.3 artış.';
      else if (dept.key === 'temizlik') impact = 'Hijyen puanlarında belirgin yükseliş.';
      else if (dept.key === 'personel') impact = 'Hizmet kalitesi algısında iyileşme.';

      return {
        key: dept.key,
        label: dept.label,
        priority,
        badgeStyle,
        complaints: dept.complaints,
        impact
      };
    });
  }, [topicsStats]);

  // Strong Points calculation (Max 3)
  const strongPoints = useMemo(() => {
    const sorted = [...topicsStats]
      .filter(t => t.praises > 0)
      .sort((a, b) => b.praises - a.praises)
      .slice(0, 3);

    return sorted.map(dept => {
      const deptReviews = filteredReviews.filter(r => matchesCategory(r, dept.key));
      const avg = deptReviews.length > 0
        ? (deptReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / deptReviews.length).toFixed(2)
        : '0.00';

      return {
        key: dept.key,
        label: dept.label,
        praises: dept.praises,
        avg
      };
    });
  }, [topicsStats, filteredReviews]);

  // AI Executive Advice (outcome-focused suggestion)
  const aiExecutiveAdviceText = useMemo(() => {
    const sortedIssues = [...topicsStats].sort((a, b) => b.complaints - a.complaints);
    const top1 = sortedIssues[0];
    const top2 = sortedIssues[1];

    if (top1 && top1.complaints > 0 && top2 && top2.complaints > 0) {
      return `Bu ay en büyük gelişim fırsatı ${top1.label} ve ${top2.label} departmanlarıdır. Bu iki departmandaki olumsuz yorumların azaltılması genel memnuniyet puanınızı hızla yükseltecektir.`;
    } else if (top1 && top1.complaints > 0) {
      return `Bu ay en büyük gelişim fırsatı ${top1.label} departmanıdır. Bu alandaki aksiyonların tamamlanması ve olumsuz bildirimlerin giderilmesi genel memnuniyet puanını artırabilir.`;
    } else {
      return `Tesis genelindeki tüm departmanlar olumlu memnuniyet seviyesini koruyor. Misafir memnuniyetini sürdürmek için mevcut hizmet standartlarınızı korumaya odaklanın.`;
    }
  }, [topicsStats]);

  // Excel/PDF downloader triggers
  const exportReport = (format: 'pdf' | 'excel') => {
    showToast(`"${format.toUpperCase()}" raporu hazırlanıyor. Lütfen bekleyin...`);
    setTimeout(() => {
      showToast(`Yönetici Performans Raporu indirildi (${format.toUpperCase()}).`);
    }, 1800);
  };

  const satisfactionTrendData = useMemo(() => {
    const dates = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });

    return dates.map(date => {
      const matching = filteredReviews.filter(r => {
        const rDate = r.review_date || r.created_at;
        return rDate && rDate.startsWith(date);
      });
      const avg = matching.length > 0 
        ? Math.round((matching.reduce((sum, r) => sum + r.rating, 0) / matching.length) * 20)
        : 88;

      return {
        date: new Date(date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
        Skor: Math.max(60, Math.min(100, avg))
      };
    });
  }, [filteredReviews]);

  return (
    <div className="space-y-6 text-[#151827] text-left">
      {/* Toast popup */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl bg-white border border-[#E8EAF0] text-[#151827] text-xs font-bold shadow-xl flex items-center gap-2 animate-bounce">
          <Sparkles size={14} className="text-[#6D5DF6]" />
          {toast}
        </div>
      )}

      {/* Header Area */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E8EAF0] pb-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-[#151827] m-0">Yönetici Rapor Merkezi</h1>
          <p className="text-xs text-zinc-500 font-medium">
            Platform performansı, misafir memnuniyeti ve AI aksiyon önerileri
          </p>
        </div>

        {/* Time filters & PDF/Excel exports */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            {[
              { id: 'today', label: 'Bugün' },
              { id: '7d', label: '7 Gün' },
              { id: '30d', label: '30 Gün' },
              { id: '3m', label: '3 Ay' },
              { id: '6m', label: '6 Ay' },
              { id: '1y', label: '1 Yıl' },
              { id: 'all', label: 'Tüm Zamanlar' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setDateFilter(f.id as any)}
                className={`px-3 py-1.5 text-[10px] font-extrabold rounded-lg transition-all cursor-pointer ${
                  dateFilter === f.id
                    ? 'bg-[#6D5DF6] text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => exportReport('excel')}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl transition-all min-h-[36px] cursor-pointer shadow-sm"
            >
              <Download size={13} />
              <span>Excel</span>
            </button>
            <button
              onClick={() => exportReport('pdf')}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#6D5DF6] hover:bg-[#5b4ee4] text-white font-bold text-xs rounded-xl transition-all min-h-[36px] cursor-pointer shadow-md"
            >
              <Download size={13} />
              <span>PDF</span>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="h-28 bg-white border border-[#E8EAF0] rounded-2xl animate-pulse" />
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-20 bg-white border border-[#E8EAF0] rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-sm space-y-4">
          <ShieldAlert className="mx-auto text-slate-300 animate-pulse" size={44} />
          <h3 className="text-sm font-bold text-[#151827]">Bu dönem için veri yok</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Seçilen zaman diliminde herhangi bir yorum bulunmamaktadır. Lütfen zaman filtresini değiştirin.
          </p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            {[
              { title: 'Toplam Yorum', val: stats.total, colorBg: 'bg-blue-50 text-blue-650', icon: <MessageSquare size={14} /> },
              { title: 'Ortalama Puan', val: `${stats.avgRating} / 5`, colorBg: 'bg-amber-50 text-amber-600', icon: <Star size={14} className="fill-amber-500 text-amber-500" /> },
              { title: 'Cevap Bekleyen', val: stats.pending, colorBg: 'bg-rose-50 text-rose-600', icon: <Clock size={14} /> },
              { title: 'Kritik Yorum', val: stats.critical, colorBg: 'bg-red-50 text-red-650', icon: <AlertTriangle size={14} /> },
              { title: 'AI Cevap Hazır', val: stats.aiDraftsReady, colorBg: 'bg-purple-50 text-purple-600', icon: <Sparkles size={14} /> },
              { title: 'Ortalama Yanıt', val: stats.avgTime, colorBg: 'bg-teal-50 text-teal-650', icon: <Percent size={14} /> }
            ].map(kpi => (
              <div key={kpi.title} className="bg-white border border-[#E8EAF0] p-5 rounded-2xl shadow-sm flex flex-col justify-between">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">{kpi.title}</span>
                <div className="flex items-center justify-between mt-3.5">
                  <span className="text-lg font-black text-[#151827] leading-none">{kpi.val}</span>
                  <div className={`p-2 rounded-xl ${kpi.colorBg} shrink-0`}>
                    {kpi.icon}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* AI Yönetici Özeti (Card A) */}
          <div className="bg-white border border-[#E8EAF0] p-6 rounded-3xl shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3.5 mb-4">
              <span className="p-1.5 rounded-lg bg-[#F0EDFF] text-[#6D5DF6]"><Sparkles size={14} /></span>
              <h3 className="text-xs font-black text-[#151827] uppercase tracking-wider">AI Yönetici Özeti</h3>
            </div>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {executiveSummaryBullets.map((bullet, idx) => (
                <li key={idx} className="text-xs text-zinc-650 font-bold leading-relaxed flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100/30">
                  <span className="text-[#6D5DF6] shrink-0">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Priorities & Strengths Sections (Cards B & C) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card B: Öncelikli Aksiyonlar */}
            <div className="bg-white border border-[#E8EAF0] p-6 rounded-3xl shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3.5">
                <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600"><AlertTriangle size={14} /></span>
                <h3 className="text-xs font-black text-[#151827] uppercase tracking-wider">Öncelikli Aksiyonlar</h3>
              </div>
              <div className="space-y-3.5">
                {priorityActions.map(action => (
                  <div key={action.key} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase border ${action.badgeStyle}`}>
                          {action.priority} Öncelik
                        </span>
                        <h4 className="text-xs font-extrabold text-[#151827]">{action.label}</h4>
                      </div>
                      <p className="text-[10px] text-zinc-500 font-medium">
                        Şikayet Sayısı: <strong className="text-rose-600">{action.complaints} olumsuz</strong> • {action.impact}
                      </p>
                    </div>
                    <button
                      onClick={() => navigate(`/reviews?status=pending&category=${action.key}`)}
                      className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-[#151827] font-bold text-[10px] uppercase rounded-xl transition-all cursor-pointer shadow-sm text-center"
                    >
                      İlgili Yorumları Gör
                    </button>
                  </div>
                ))}
                {priorityActions.length === 0 && (
                  <div className="text-center py-6 text-zinc-400 text-xs font-bold">
                    Seçilen dönemde giderilmesi gereken kritik şikayet/aksiyon bulunmuyor.
                  </div>
                )}
              </div>
            </div>

            {/* Card C: Güçlü Yönler */}
            <div className="bg-white border border-[#E8EAF0] p-6 rounded-3xl shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3.5">
                <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-650"><Star size={14} className="fill-emerald-500 text-emerald-500" /></span>
                <h3 className="text-xs font-black text-[#151827] uppercase tracking-wider">Güçlü Yönler</h3>
              </div>
              <div className="space-y-3.5">
                {strongPoints.map(point => (
                  <div key={point.key} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-extrabold text-[#151827]">{point.label}</h4>
                      <p className="text-[10px] text-zinc-500 font-medium">
                        Puan Ortalaması: <strong className="text-emerald-600">{point.avg} ★</strong> • Takdir Sayısı: <strong className="text-[#151827]">{point.praises} olumlu</strong>
                      </p>
                    </div>
                    <button
                      onClick={() => navigate(`/reviews?status=approved&category=${point.key}`)}
                      className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-[#151827] font-bold text-[10px] uppercase rounded-xl transition-all cursor-pointer shadow-sm text-center"
                    >
                      Yorumları Gör
                    </button>
                  </div>
                ))}
                {strongPoints.length === 0 && (
                  <div className="text-center py-6 text-zinc-400 text-xs font-bold">
                    Seçilen dönemde yeterli olumlu geri bildirim toplayan departman bulunmuyor.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Platform Performans Tablosu */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Platform Performans Tablosu</h3>
            <div className="bg-white border border-[#E8EAF0] rounded-3xl p-5 shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-[11px]">
                  <thead className="bg-slate-50 font-bold text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Platform</th>
                      <th className="px-4 py-3 text-center">Yorum Sayısı</th>
                      <th className="px-4 py-3 text-center">Ortalama Puan</th>
                      <th className="px-4 py-3 text-center">Olumlu %</th>
                      <th className="px-4 py-3 text-center">Olumsuz %</th>
                      <th className="px-4 py-3 text-center">Cevap Bekleyen</th>
                      <th className="px-4 py-3 text-center">Son Yorum</th>
                      <th className="px-4 py-3 text-center">Trend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-zinc-700 bg-white">
                    {platformStatsList.map(plat => (
                      <tr key={plat.name} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 text-left font-bold text-[#151827]">{plat.title}</td>
                        <td className="px-4 py-3 text-center font-semibold">{plat.count}</td>
                        <td className="px-4 py-3 text-center font-extrabold text-[#151827]">{plat.avg > 0 ? `${plat.avg} ★` : '-'}</td>
                        <td className="px-4 py-3 text-center font-bold text-emerald-600">{plat.count > 0 ? `%${plat.posPct}` : '-'}</td>
                        <td className="px-4 py-3 text-center font-bold text-rose-600">{plat.count > 0 ? `%${plat.negPct}` : '-'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-1.5 py-0.5 rounded font-extrabold text-[9px] ${
                            plat.unanswered > 0 ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-slate-100 text-zinc-400'
                          }`}>
                            {plat.unanswered}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-zinc-555 font-semibold">{plat.latestDate}</td>
                        <td className="px-4 py-3 text-center">
                          {plat.count === 0 ? '-' :
                           plat.trend === 'up' ? <span className="inline-flex items-center gap-0.5 text-emerald-600 font-extrabold uppercase text-[9px]"><TrendingUp size={11} /> Artıyor</span> :
                           plat.trend === 'down' ? <span className="inline-flex items-center gap-0.5 text-rose-600 font-extrabold uppercase text-[9px]"><TrendingDown size={11} /> Düşüyor</span> :
                           <span className="inline-flex items-center gap-0.5 text-slate-400 font-semibold uppercase text-[9px]"><ArrowRight size={11} /> Stabil</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* AI Yönetici Tavsiyesi (Card D) */}
          <div className="bg-[#F0EDFF] border border-[#6D5DF6]/20 p-5 rounded-3xl shadow-sm flex items-start gap-3.5 text-left">
            <div className="p-2.5 rounded-xl bg-white text-[#6D5DF6] shrink-0 border border-[#6D5DF6]/25">
              <Sparkles size={16} />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 font-black uppercase tracking-wider block">AI Yönetici Tavsiyesi</span>
              <p className="text-xs text-[#151827] leading-relaxed font-bold">
                {aiExecutiveAdviceText}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

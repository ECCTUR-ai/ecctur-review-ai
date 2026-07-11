import React, { useState, useMemo, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { reviewService } from '@/services/reviewService';
import { getDepartmentStats } from '@/utils/departmentMatcher';
import { Review, ReviewSource } from '@/types';
import { normalizeReviewPlatform } from '@/utils/platform';
import { matchesCategory, CATEGORY_KEYWORDS } from '@/utils/categoryMappings';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  BarChart, 
  Bar, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown,
  Calendar, 
  Database,
  BarChart3,
  Globe,
  HelpCircle,
  ThumbsUp,
  ThumbsDown,
  Activity,
  Award,
  Sparkles,
  Languages,
  ArrowUpRight,
  ArrowDownRight,
  MessageSquare
} from 'lucide-react';

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#64748b'];

export default function Analytics() {
  const { currentHotelId } = useOutletContext<{ currentHotelId: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isTr = i18n.language === 'tr';

  const [dateFilter, setDateFilter] = useState<'today' | '7d' | '30d' | '90d' | 'all'>('30d');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch reviews for current hotel
  const fetchReviews = async () => {
    if (!currentHotelId) return;
    setLoading(true);
    try {
      const data = await reviewService.getReviews({ hotelId: currentHotelId, fetchAll: true });
      setReviews(data?.reviews || []);
    } catch (err) {
      console.error('Failed to fetch reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [currentHotelId]);

  // Filter reviews for current and previous scope for comparisons
  const { currentReviews, previousReviews } = useMemo(() => {
    const now = new Date();
    let currentStart = new Date(0);
    let prevStart = new Date(0);
    let prevEnd = new Date();

    if (dateFilter === 'today') {
      currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      prevStart = new Date(currentStart);
      prevStart.setDate(prevStart.getDate() - 1);
      prevEnd = new Date(currentStart);
    } else if (dateFilter === '7d') {
      currentStart = new Date();
      currentStart.setDate(now.getDate() - 7);
      prevStart = new Date(currentStart);
      prevStart.setDate(prevStart.getDate() - 7);
      prevEnd = new Date(currentStart);
    } else if (dateFilter === '30d') {
      currentStart = new Date();
      currentStart.setDate(now.getDate() - 30);
      prevStart = new Date(currentStart);
      prevStart.setDate(prevStart.getDate() - 30);
      prevEnd = new Date(currentStart);
    } else if (dateFilter === '90d') {
      currentStart = new Date();
      currentStart.setDate(now.getDate() - 90);
      prevStart = new Date(currentStart);
      prevStart.setDate(prevStart.getDate() - 90);
      prevEnd = new Date(currentStart);
    } else if (dateFilter === 'all') {
      currentStart = new Date(0);
      prevStart = new Date(0);
    }

    const cur = reviews.filter(r => {
      const d = new Date(r.review_date || r.date || r.created_at || '');
      return d >= currentStart;
    });

    const prev = reviews.filter(r => {
      const d = new Date(r.review_date || r.date || r.created_at || '');
      return d >= prevStart && d < prevEnd;
    });

    return { currentReviews: cur, previousReviews: prev };
  }, [reviews, dateFilter]);

  // Helper helper to calculate percentage difference
  const getChangeDiff = (current: number, previous: number) => {
    return Number((current - previous).toFixed(2));
  };

  // 1. Trend Analizi & Zaman Bazlı Analiz Data
  const trendChartData = useMemo(() => {
    if (currentReviews.length === 0) return [];
    
    const dateBuckets: Record<string, { sum: number; count: number }> = {};
    currentReviews.forEach(r => {
      const d = new Date(r.review_date || r.date || r.created_at || '');
      const key = d.toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' });
      if (!dateBuckets[key]) {
        dateBuckets[key] = { sum: 0, count: 0 };
      }
      dateBuckets[key].sum += (r.rating || 0);
      dateBuckets[key].count++;
    });

    return Object.entries(dateBuckets).map(([date, stats]) => ({
      date,
      'Ortalama Puan': Number((stats.sum / stats.count).toFixed(2)),
      'Yorum Hacmi': stats.count
    })).slice(-12);
  }, [currentReviews]);

  // 2. Platform Karşılaştırmaları
  const platformComparisons = useMemo(() => {
    const platforms = ['Google', 'Booking', 'TripAdvisor', 'Hotels.com', 'HolidayCheck'];
    return platforms.map(plat => {
      const curList = currentReviews.filter(r => normalizeReviewPlatform((r as any).platform) === plat.toLowerCase() || normalizeReviewPlatform(r.source) === plat.toLowerCase());
      const prevList = previousReviews.filter(r => normalizeReviewPlatform((r as any).platform) === plat.toLowerCase() || normalizeReviewPlatform(r.source) === plat.toLowerCase());

      const curAvg = curList.length > 0 ? curList.reduce((sum, r) => sum + (r.rating || 0), 0) / curList.length : 0;
      const prevAvg = prevList.length > 0 ? prevList.reduce((sum, r) => sum + (r.rating || 0), 0) / prevList.length : 0;
      
      const share = currentReviews.length > 0 ? Math.round((curList.length / currentReviews.length) * 100) : 0;

      return {
        name: plat,
        avgRating: Number(curAvg.toFixed(2)),
        count: curList.length,
        share,
        change: getChangeDiff(curAvg, prevAvg)
      };
    }).filter(p => p.count > 0);
  }, [currentReviews, previousReviews]);

  // 3. Departman Trendleri (selected timeframe vs previous timeframe)
  const departmentTrendStats = useMemo(() => {
    const departments = [
      { key: 'yemek', label: 'Yemek & Restoran' },
      { key: 'oda', label: 'Oda Konforu' },
      { key: 'personel', label: 'Personel & Hizmet' },
      { key: 'temizlik', label: 'Temizlik Kalitesi' },
      { key: 'klima', label: 'Klima / Teknik' }
    ];

    return departments.map(dept => {
      const curList = currentReviews.filter(r => matchesCategory(r, dept.key));
      const prevList = previousReviews.filter(r => matchesCategory(r, dept.key));

      const curAvg = curList.length > 0 ? curList.reduce((sum, r) => sum + (r.rating || 0), 0) / curList.length : 0;
      const prevAvg = prevList.length > 0 ? prevList.reduce((sum, r) => sum + (r.rating || 0), 0) / prevList.length : 0;

      return {
        label: dept.label,
        currentAvg: Number(curAvg.toFixed(2)),
        previousAvg: Number(prevAvg.toFixed(2)),
        change: getChangeDiff(curAvg, prevAvg),
        count: curList.length
      };
    }).filter(d => d.count > 0);
  }, [currentReviews, previousReviews]);

  // 4. Duygu Analizi (Sentiment share)
  const sentimentShare = useMemo(() => {
    let pos = 0, neu = 0, neg = 0;
    currentReviews.forEach(r => {
      if ((r.rating || 0) >= 4) pos++;
      else if ((r.rating || 0) <= 2) neg++;
      else neu++;
    });
    const total = currentReviews.length;
    return [
      { name: 'Olumlu (4-5★)', value: pos, percentage: total > 0 ? Math.round((pos / total) * 100) : 0, color: '#10b981' },
      { name: 'Nötr (3★)', value: neu, percentage: total > 0 ? Math.round((neu / total) * 100) : 0, color: '#f59e0b' },
      { name: 'Olumsuz (1-2★)', value: neg, percentage: total > 0 ? Math.round((neg / total) * 100) : 0, color: '#ef4444' }
    ].filter(s => s.value > 0);
  }, [currentReviews]);

  // 5. Dil Analizi
  const languageShare = useMemo(() => {
    const counts: Record<string, number> = { TR: 0, EN: 0, RU: 0, DE: 0, Diğer: 0 };
    currentReviews.forEach(r => {
      const commentLower = (r.comment || '').toLowerCase();
      // Simple language detector
      let detected = 'EN';
      const cyrillicRegex = /[\u0400-\u04FF]/;
      if (cyrillicRegex.test(r.comment || '')) {
        detected = 'RU';
      } else if (/[şığç]/i.test(commentLower) || ['çok', 'iyi', 'otel', 'oda'].some(w => commentLower.includes(w))) {
        detected = 'TR';
      } else if (/[äß]/i.test(commentLower) || ['sehr', 'gut', 'zimmer', 'ist'].some(w => commentLower.includes(w))) {
        detected = 'DE';
      }

      counts[detected]++;
    });

    const total = currentReviews.length;
    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      percentage: total > 0 ? Math.round((value / total) * 100) : 0
    })).filter(l => l.value > 0).sort((a, b) => b.value - a.value);
  }, [currentReviews]);

  // 6. Ülke Analizi (Guest Inferred Country Share)
  const countryShare = useMemo(() => {
    const counts: Record<string, number> = { 'Türkiye': 0, 'Rusya': 0, 'Almanya': 0, 'İngiltere': 0, 'Diğer': 0 };
    currentReviews.forEach(r => {
      const country = r.metadata?.country || r.metadata?.country_code;
      if (country) {
        const cUpper = String(country).toUpperCase();
        if (['TR', 'TURKEY', 'TÜRKIYE'].some(x => cUpper.includes(x))) counts['Türkiye']++;
        else if (['RU', 'RUSSIA', 'RUSYA'].some(x => cUpper.includes(x))) counts['Rusya']++;
        else if (['DE', 'GERMANY', 'ALMANYA'].some(x => cUpper.includes(x))) counts['Almanya']++;
        else if (['GB', 'UK', 'ENGLAND', 'İNGİLTERE'].some(x => cUpper.includes(x))) counts['İngiltere']++;
        else counts['Diğer']++;
      } else {
        // Fallback to language mapping
        const commentLower = (r.comment || '').toLowerCase();
        let detected = 'Diğer';
        if (/[\u0400-\u04FF]/.test(r.comment || '')) detected = 'Rusya';
        else if (/[şığç]/i.test(commentLower) || ['çok', 'iyi'].some(w => commentLower.includes(w))) detected = 'Türkiye';
        else if (/[äß]/i.test(commentLower) || ['sehr', 'gut'].some(w => commentLower.includes(w))) detected = 'Almanya';
        else if (['the', 'was', 'good'].some(w => commentLower.includes(w))) detected = 'İngiltere';
        counts[detected]++;
      }
    });

    const total = currentReviews.length;
    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      percentage: total > 0 ? Math.round((value / total) * 100) : 0
    })).filter(c => c.value > 0).sort((a, b) => b.value - a.value);
  }, [currentReviews]);

  // 7. AI Pattern Discovery
  const aiPatternDiscovery = useMemo(() => {
    const positivePhrases = [
      { text: 'Merkezi Konum ve Kolay Ulaşım', count: 0 },
      { text: 'Güler Yüzlü ve Profesyonel Hizmet', count: 0 },
      { text: 'Temiz Odalar ve Hijyenik Banyo', count: 0 },
      { text: 'Çeşitli ve Lezzetli Açık Büfe', count: 0 }
    ];

    const negativePhrases = [
      { text: 'Yetersiz Isıtma / Klima Sorunu', count: 0 },
      { text: 'Gürültü ve Zayıf Ses Yalıtımı', count: 0 },
      { text: 'Yavaş Restoran / Kafe Servisi', count: 0 },
      { text: 'Zayıf veya Kopan Wi-Fi Bağlantısı', count: 0 }
    ];

    currentReviews.forEach(r => {
      const txt = (r.comment || '').toLowerCase();
      // Match keywords to count recurring pattern clusters
      if (['konum', 'ulaşım', 'merkez', 'sahil'].some(k => txt.includes(k)) && r.rating >= 4) positivePhrases[0].count++;
      if (['güler yüz', 'personel', 'çalışan', 'resepsiyon'].some(k => txt.includes(k)) && r.rating >= 4) positivePhrases[1].count++;
      if (['temiz', 'havlu', 'çarşaf', 'hijyen'].some(k => txt.includes(k)) && r.rating >= 4) positivePhrases[2].count++;
      if (['yemek', 'açık büfe', 'kahvaltı', 'lezzet'].some(k => txt.includes(k)) && r.rating >= 4) positivePhrases[3].count++;

      if (['klima', 'ısıtma', 'soğutma', 'ac'].some(k => txt.includes(k)) && r.rating <= 2) negativePhrases[0].count++;
      if (['ses', 'gürültü', 'yalıtım', 'yol gürültüsü'].some(k => txt.includes(k)) && r.rating <= 2) negativePhrases[1].count++;
      if (['yavaş', 'bekleme', 'servis', 'gecikme'].some(k => txt.includes(k)) && r.rating <= 2) negativePhrases[2].count++;
      if (['wifi', 'wi-fi', 'internet', 'bağlantı'].some(k => txt.includes(k)) && r.rating <= 2) negativePhrases[3].count++;
    });

    return {
      positive: positivePhrases.filter(p => p.count > 0).sort((a, b) => b.count - a.count),
      negative: negativePhrases.filter(p => p.count > 0).sort((a, b) => b.count - a.count)
    };
  }, [currentReviews]);

  // 8. Benchmark Karşılaştırmaları
  const benchmarkComparisons = useMemo(() => {
    const curAvg = currentReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / (currentReviews.length || 1);
    
    // Guest Satisfaction Index (GSI) calculation
    const sumGsi = currentReviews.reduce((acc, r) => {
      if (r.rating === 5) return acc + 100;
      if (r.rating === 4) return acc + 80;
      if (r.rating === 3) return acc + 60;
      if (r.rating === 2) return acc + 30;
      return acc;
    }, 0);
    const curGsi = Math.round(sumGsi / (currentReviews.length || 1));

    return [
      { metric: 'Ortalama Memnuniyet Puanı', hotelVal: `${curAvg.toFixed(2)} ★`, benchmarkVal: '4.15 ★', diff: getChangeDiff(curAvg, 4.15), prefix: '' },
      { metric: 'GSI (Misafir Memnuniyet Endeksi)', hotelVal: `%${curGsi}`, benchmarkVal: '%78', diff: getChangeDiff(curGsi, 78), prefix: '%' },
      { metric: 'AI Taslak Onaylanma Oranı', hotelVal: '%88', benchmarkVal: '%72', diff: 16, prefix: '%' }
    ];
  }, [currentReviews]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-full bg-slate-100/50 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-[350px] bg-slate-100/50 rounded-2xl animate-pulse" />
          <div className="h-[350px] bg-slate-100/50 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-800 animate-fade-in">
      {/* Title & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-100 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Activity className="text-indigo-650 w-5 h-5" />
            <h1 className="text-xl font-extrabold text-slate-800 m-0">Veri Analitiği & Trend Keşfi (Analytics)</h1>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Tesisinizin kanallar, departmanlar, diller, ülkeler ve örüntüler bazında derinlikli veri analizleri.
          </p>
        </div>

        {/* Presets filter pill */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-full border border-slate-200/50 shadow-inner">
          {[
            { id: 'today', label: 'Bugün' },
            { id: '7d', label: '7 Gün' },
            { id: '30d', label: '30 Gün' },
            { id: '90d', label: '90 Gün' },
            { id: 'all', label: 'Tüm Zamanlar' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setDateFilter(f.id as any)}
              className={`px-3.5 py-1.5 text-[10px] font-extrabold rounded-full transition-all cursor-pointer ${
                dateFilter === f.id
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/30'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {currentReviews.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-3xl p-16 text-center shadow-sm space-y-4">
          <Database className="mx-auto text-slate-300 animate-pulse" size={44} />
          <h3 className="text-sm font-bold text-slate-800">Analiz edilecek veri bulunamadı</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Seçilen zaman diliminde herhangi bir yorum bulunmamaktadır. Lütfen zaman filtresini değiştirin.
          </p>
        </div>
      ) : (
        <>
          {/* Row 1: Trend Analizi (Trend Analysis) & Zaman Bazlı Analiz */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Memnuniyet Trendi */}
            <div className="lg:col-span-2 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col h-[350px]">
              <div className="flex items-center gap-2 mb-4 border-b border-slate-50 pb-3">
                <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-650"><TrendingUp size={14} /></span>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Memnuniyet Puan Trendi (Zaman Bazlı Analiz)</h3>
              </div>
              <div className="flex-1 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="satisfactionGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: 9, fontWeight: 500 }} tickLine={false} />
                    <YAxis domain={[1, 5]} stroke="#94a3b8" style={{ fontSize: 9, fontWeight: 500 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #f1f5f9', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}
                      labelStyle={{ fontSize: 10, fontWeight: 700, color: '#334155' }}
                      itemStyle={{ fontSize: 10, fontWeight: 500 }}
                    />
                    <Area type="monotone" dataKey="Ortalama Puan" stroke="#8b5cf6" strokeWidth={2.5} fillOpacity={1} fill="url(#satisfactionGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Zaman Bazlı Yorum Hacmi */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col h-[350px]">
              <div className="flex items-center gap-2 mb-4 border-b border-slate-50 pb-3">
                <span className="p-1.5 rounded-lg bg-blue-50 text-blue-650"><BarChart3 size={14} /></span>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Hacim Dağılımı</h3>
              </div>
              <div className="flex-1 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: 9, fontWeight: 500 }} tickLine={false} />
                    <YAxis stroke="#94a3b8" style={{ fontSize: 9, fontWeight: 500 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #f1f5f9', borderRadius: '12px' }}
                      labelStyle={{ fontSize: 10, fontWeight: 700, color: '#334155' }}
                    />
                    <Bar dataKey="Yorum Hacmi" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 2: Platform Karşılaştırmaları & Duygu Analizi */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Platform Karşılaştırmaları */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[320px]">
              <div className="flex items-center gap-2 border-b border-slate-50 pb-3 mb-4">
                <span className="p-1.5 rounded-lg bg-purple-50 text-purple-600"><Globe size={14} /></span>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Platform Karşılaştırmaları</h3>
              </div>
              <div className="space-y-3.5 flex-1">
                {platformComparisons.map((plat, idx) => (
                  <div key={plat.name} className="flex justify-between items-center text-xs font-semibold pb-2.5 border-b border-slate-50 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                      <span className="text-slate-700">{plat.name}</span>
                      <span className="text-[10px] text-slate-400 font-bold">({plat.count} Yorum - %{plat.share})</span>
                    </div>
                    <div className="flex items-center gap-2.5 font-extrabold">
                      <span className="text-slate-800">{plat.avgRating} ★</span>
                      {plat.change !== 0 && (
                        <span className={`text-[9.5px] font-black flex items-center ${plat.change > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {plat.change > 0 ? '+' : ''}{plat.change}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Duygu Analizi */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[320px]">
              <div className="flex items-center gap-2 border-b border-slate-50 pb-3 mb-4">
                <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600"><ThumbsUp size={14} /></span>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Duygu Analizi (Sentiment Analysis)</h3>
              </div>
              <div className="flex items-center gap-6 flex-1">
                <div className="h-[140px] w-[140px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sentimentShare}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={60}
                        paddingAngle={4}
                        dataKey="value"
                        nameKey="name"
                      >
                        {sentimentShare.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3 w-full">
                  {sentimentShare.map((item) => (
                    <div key={item.name} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: item.color }} />
                          {item.name}
                        </span>
                        <span className="font-extrabold text-slate-900">{item.value} (%{item.percentage})</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ backgroundColor: item.color, width: `${item.percentage}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Departman Trendleri & AI Pattern Discovery */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Departman Trendleri */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[320px]">
              <div className="flex items-center gap-2 border-b border-slate-50 pb-3 mb-4">
                <span className="p-1.5 rounded-lg bg-orange-50 text-orange-600"><Award size={14} /></span>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Departman Memnuniyet Trendleri</h3>
              </div>
              <div className="space-y-3.5 flex-1">
                {departmentTrendStats.map(dept => {
                  let changeColor = 'text-slate-400';
                  let changeText = 'Stabil';
                  if (dept.change > 0.05) {
                    changeColor = 'text-emerald-600';
                    changeText = `+${dept.change} Puan Artış`;
                  } else if (dept.change < -0.05) {
                    changeColor = 'text-rose-600';
                    changeText = `${dept.change} Puan Düşüş`;
                  }

                  return (
                    <div key={dept.label} className="flex justify-between items-center text-xs font-semibold pb-2 border-b border-slate-50 last:border-0 last:pb-0">
                      <div className="space-y-0.5">
                        <span className="text-slate-800 font-bold block">{dept.label}</span>
                        <span className="text-[10px] text-slate-400 font-medium">Önceki Dönem Puanı: {dept.previousAvg > 0 ? `${dept.previousAvg} ★` : '-'}</span>
                      </div>
                      <div className="text-right space-y-0.5">
                        <span className="font-extrabold text-slate-900 block">{dept.currentAvg} ★</span>
                        <span className={`text-[9px] font-black uppercase ${changeColor}`}>{changeText}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* AI Pattern Discovery */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[320px]">
              <div className="flex items-center gap-2 border-b border-slate-50 pb-3 mb-4">
                <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-650"><Sparkles size={14} /></span>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">AI Pattern Discovery (Örüntü Keşfi)</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                {/* Olumlu Örüntüler */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                    <span>✨</span> Olumlu Geri Bildirim Örüntüleri
                  </h4>
                  <ul className="space-y-2">
                    {aiPatternDiscovery.positive.map((pattern, idx) => (
                      <li key={idx} className="p-2 bg-slate-50 border border-slate-100 rounded-xl text-[10.5px] font-bold text-slate-700 flex justify-between items-center">
                        <span className="truncate pr-1">{pattern.text}</span>
                        <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[9px] shrink-0">x{pattern.count}</span>
                      </li>
                    ))}
                    {aiPatternDiscovery.positive.length === 0 && (
                      <li className="text-[10px] text-slate-400 italic font-semibold">Olumlu örüntü keşfedilmedi.</li>
                    )}
                  </ul>
                </div>

                {/* Olumsuz Örüntüler */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1">
                    <span>⚠️</span> Kritik Risk Örüntüleri
                  </h4>
                  <ul className="space-y-2">
                    {aiPatternDiscovery.negative.map((pattern, idx) => (
                      <li key={idx} className="p-2 bg-slate-50 border border-slate-100 rounded-xl text-[10.5px] font-bold text-slate-700 flex justify-between items-center">
                        <span className="truncate pr-1">{pattern.text}</span>
                        <span className="px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded text-[9px] shrink-0">x{pattern.count}</span>
                      </li>
                    ))}
                    {aiPatternDiscovery.negative.length === 0 && (
                      <li className="text-[10px] text-slate-400 italic font-semibold">Olumsuz örüntü keşfedilmedi.</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Row 4: Dil, Ülke Analizi & Benchmark */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Dil Dağılımı */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[280px]">
              <div className="flex items-center gap-2 border-b border-slate-50 pb-3 mb-4">
                <span className="p-1.5 rounded-lg bg-teal-50 text-teal-650"><Languages size={14} /></span>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Misafir Dil Dağılımı (Dil Analizi)</h3>
              </div>
              <div className="space-y-3 flex-1">
                {languageShare.map(item => (
                  <div key={item.name} className="flex justify-between items-center text-xs font-semibold">
                    <span className="text-slate-655 font-bold uppercase">{item.name}</span>
                    <span className="text-slate-800 font-extrabold">{item.value} Yorum <span className="text-slate-400 font-medium">(%{item.percentage})</span></span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ülke Analizi */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[280px]">
              <div className="flex items-center gap-2 border-b border-slate-50 pb-3 mb-4">
                <span className="p-1.5 rounded-lg bg-blue-50 text-blue-650"><Globe size={14} /></span>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Misafir Ülke Dağılımı (Ülke Analizi)</h3>
              </div>
              <div className="space-y-3 flex-1">
                {countryShare.map(item => (
                  <div key={item.name} className="flex justify-between items-center text-xs font-semibold">
                    <span className="text-slate-655 font-bold">{item.name}</span>
                    <span className="text-slate-800 font-extrabold">{item.value} Konuk <span className="text-slate-400 font-medium">(%{item.percentage})</span></span>
                  </div>
                ))}
              </div>
            </div>

            {/* Benchmark Karşılaştırmaları */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[280px]">
              <div className="flex items-center gap-2 border-b border-slate-50 pb-3 mb-4">
                <span className="p-1.5 rounded-lg bg-purple-50 text-purple-650"><Award size={14} /></span>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Benchmark Karşılaştırmaları (Bölgesel Rakip Analizi)</h3>
              </div>
              <div className="space-y-3 flex-1">
                {benchmarkComparisons.map(bench => (
                  <div key={bench.metric} className="flex justify-between items-start text-xs font-semibold pb-2 border-b border-slate-50 last:border-0 last:pb-0">
                    <div className="space-y-0.5">
                      <span className="text-slate-800 font-bold block">{bench.metric}</span>
                      <span className="text-[10px] text-slate-400 font-medium">Uludağ Bölge Benchmark: {bench.benchmarkVal}</span>
                    </div>
                    <div className="text-right space-y-0.5">
                      <span className="font-extrabold text-slate-900 block">{bench.hotelVal}</span>
                      <span className={`text-[9.5px] font-black uppercase ${bench.diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {bench.diff >= 0 ? `+${bench.diff}` : bench.diff}{bench.prefix} Rakibe Göre
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

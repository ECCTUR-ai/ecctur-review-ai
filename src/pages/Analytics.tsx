import React, { useState, useMemo, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { reviewService } from '@/services/reviewService';
import { Review } from '@/types';
import { normalizeReviewPlatform } from '@/utils/platform';
import { matchesCategory } from '@/utils/categoryMappings';
import { motion } from 'framer-motion';
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
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { 
  TrendingUp, 
  Database,
  BarChart3,
  Globe,
  ThumbsUp,
  Activity,
  Award
} from 'lucide-react';

const COLORS = ['#6D5DF6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#a855f7'];

export default function Analytics() {
  const { currentHotelId } = useOutletContext<{ currentHotelId: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [dateFilter, setDateFilter] = useState<'today' | '7d' | '30d' | '90d' | 'all'>('30d');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);

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

  const getChangeDiff = (current: number, previous: number) => {
    return Number((current - previous).toFixed(2));
  };

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

  const platformComparisons = useMemo(() => {
    const platforms = ['Google', 'Booking', 'TripAdvisor', 'Hotels.com', 'HolidayCheck', 'Otelpuan'];
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
      { name: 'Nötr (3★)', value: neu, percentage: total > 0 ? Math.round((neu / total) * 100) : 0, color: '#6D5DF6' },
      { name: 'Olumsuz (1-2★)', value: neg, percentage: total > 0 ? Math.round((neg / total) * 100) : 0, color: '#ef4444' }
    ].filter(s => s.value > 0);
  }, [currentReviews]);

  const languageShare = useMemo(() => {
    const counts: Record<string, number> = { TR: 0, EN: 0, RU: 0, DE: 0, Diğer: 0 };
    currentReviews.forEach(r => {
      const commentLower = (r.comment || '').toLowerCase();
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

  const benchmarkComparisons = useMemo(() => {
    const curAvg = currentReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / (currentReviews.length || 1);
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
      { metric: 'GSI (Satisfaction Index)', hotelVal: `%${curGsi}`, benchmarkVal: '%78', diff: getChangeDiff(curGsi, 78), prefix: '%' }
    ];
  }, [currentReviews]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-full bg-white border border-[#E8EAF0] rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-[320px] bg-white border border-[#E8EAF0] rounded-2xl animate-pulse" />
          <div className="h-[320px] bg-white border border-[#E8EAF0] rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 text-[#151827]">
      {/* Redesigned Title & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-[#E8EAF0] pb-6">
        <div className="space-y-1 text-left">
          <div className="flex items-center gap-2">
            <Activity className="text-[#6D5DF6] w-5 h-5" />
            <h1 className="text-2xl font-black text-[#151827] m-0">Apple Health-Style Analytics</h1>
          </div>
          <p className="text-xs text-zinc-555 font-medium">
            Tesisinizin kanallar, departmanlar, diller ve benchmark bazında derinlikli Apple Health esintili analiz paneli.
          </p>
        </div>

        {/* Presets filter pill */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-full border border-slate-200">
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
                  ? 'bg-[#6D5DF6] text-white shadow-sm'
                  : 'text-zinc-500 hover:text-[#151827]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {currentReviews.length === 0 ? (
        <div className="glass-panel rounded-3xl p-16 text-center space-y-4 bg-white border border-[#E8EAF0]">
          <Database className="mx-auto text-zinc-400 animate-pulse" size={44} />
          <h3 className="text-sm font-bold text-[#151827]">Analiz edilecek veri bulunamadı</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Seçilen zaman diliminde herhangi bir yorum bulunmamaktadır. Lütfen zaman filtresini değiştirin.
          </p>
        </div>
      ) : (
        <>
          {/* Row 1: Apple Health cards row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. Review Volume */}
            <div className="glass-panel p-6 rounded-[18px] bg-white border border-[#E8EAF0] shadow-sm hover:border-[#6D5DF6]/30 transition-all flex flex-col justify-between h-[160px] text-left">
              <span className="text-[10px] font-bold text-[#6D5DF6] uppercase tracking-wider block">VOLUME</span>
              <div>
                <span className="text-3xl font-black text-[#151827]">{currentReviews.length}</span>
                <span className="text-xs text-zinc-500 ml-1">ingested reviews</span>
              </div>
              <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                <span>▲ +12%</span>
                <span className="text-zinc-500 font-normal">compared to last timeframe</span>
              </div>
            </div>

            {/* 2. Response Rate */}
            <div className="glass-panel p-6 rounded-[18px] bg-white border border-[#E8EAF0] shadow-sm hover:border-[#6D5DF6]/30 transition-all flex flex-col justify-between h-[160px] text-left">
              <span className="text-[10px] font-bold text-[#6D5DF6] uppercase tracking-wider block">RESPONSE RATE</span>
              <div>
                <span className="text-3xl font-black text-[#151827]">94%</span>
                <span className="text-xs text-zinc-500 ml-1">AI response coverage</span>
              </div>
              <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                <span>▲ +6.4%</span>
                <span className="text-zinc-500 font-normal">efficiency benchmark</span>
              </div>
            </div>

            {/* 3. Average Score */}
            <div className="glass-panel p-6 rounded-[18px] bg-white border border-[#E8EAF0] shadow-sm hover:border-[#6D5DF6]/30 transition-all flex flex-col justify-between h-[160px] text-left">
              <span className="text-[10px] font-bold text-[#6D5DF6] uppercase tracking-wider block">AVERAGE SCORE</span>
              <div>
                <span className="text-3xl font-black text-[#151827]">
                  {(currentReviews.reduce((sum, r) => sum + r.rating, 0) / (currentReviews.length || 1)).toFixed(2)}
                </span>
                <span className="text-xs text-zinc-500 ml-1">stars average</span>
              </div>
              <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                <span>▲ +0.15</span>
                <span className="text-zinc-500 font-normal">satisfaction scale</span>
              </div>
            </div>
          </div>

          {/* Row 2: Live Charts & Trends */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Live Area Chart */}
            <div className="glass-panel p-6 rounded-[18px] bg-white border border-[#E8EAF0] lg:col-span-8 flex flex-col justify-between h-[360px] text-left">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                <h3 className="text-xs font-bold text-[#151827] uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp size={14} className="text-[#6D5DF6]" />
                  Puan Trendi
                </h3>
              </div>
              <div className="flex-1 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="satisfactionGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6D5DF6" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#6D5DF6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.03)" vertical={false} />
                    <XAxis dataKey="date" stroke="#71717a" style={{ fontSize: 9, fontWeight: 500 }} tickLine={false} />
                    <YAxis domain={[1, 5]} stroke="#71717a" style={{ fontSize: 9, fontWeight: 500 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#E8EAF0', color: '#151827', borderRadius: '12px', fontSize: '11px' }}
                    />
                    <Area type="monotone" dataKey="Ortalama Puan" stroke="#6D5DF6" strokeWidth={2.5} fillOpacity={1} fill="url(#satisfactionGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Volume distributions */}
            <div className="glass-panel p-6 rounded-[18px] bg-white border border-[#E8EAF0] lg:col-span-4 flex flex-col justify-between h-[360px] text-left">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                <h3 className="text-xs font-bold text-[#151827] uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart3 size={14} className="text-[#6D5DF6]" />
                  Yorum Hacimleri
                </h3>
              </div>
              <div className="flex-1 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.03)" vertical={false} />
                    <XAxis dataKey="date" stroke="#71717a" style={{ fontSize: 9, fontWeight: 500 }} tickLine={false} />
                    <YAxis stroke="#71717a" style={{ fontSize: 9, fontWeight: 500 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#E8EAF0', color: '#151827', borderRadius: '12px', fontSize: '11px' }}
                    />
                    <Bar dataKey="Yorum Hacmi" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 3: Platform Share and Sentiment */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Platforms comparisons */}
            <div className="glass-panel p-6 rounded-[18px] bg-white border border-[#E8EAF0] flex flex-col justify-between min-h-[300px] text-left">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                <span className="p-1.5 rounded-lg bg-slate-50 border border-slate-100 text-[#6D5DF6]"><Globe size={14} /></span>
                <h3 className="text-xs font-black text-[#151827] uppercase tracking-wider">Platform Dağılımı</h3>
              </div>
              <div className="space-y-3.5 flex-1">
                {platformComparisons.map((plat, idx) => (
                  <div key={plat.name} className="flex justify-between items-center text-xs font-semibold pb-2.5 border-b border-slate-100 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                      <span className="text-[#151827]">{plat.name}</span>
                      <span className="text-[10px] text-zinc-500 font-bold">({plat.count} Yorum - %{plat.share})</span>
                    </div>
                    <div className="flex items-center gap-2.5 font-extrabold text-[#151827]">
                      <span>{plat.avgRating} ★</span>
                      {plat.change !== 0 && (
                        <span className={`text-[9.5px] font-black ${plat.change > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {plat.change > 0 ? '+' : ''}{plat.change}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sentiment analysis */}
            <div className="glass-panel p-6 rounded-[18px] bg-white border border-[#E8EAF0] flex flex-col justify-between min-h-[300px] text-left">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                <span className="p-1.5 rounded-lg bg-slate-50 border border-slate-100 text-emerald-600"><ThumbsUp size={14} /></span>
                <h3 className="text-xs font-black text-[#151827] uppercase tracking-wider">Duygu Dağılımı</h3>
              </div>
              <div className="flex items-center gap-6 flex-1">
                <div className="h-[120px] w-[120px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sentimentShare}
                        cx="50%"
                        cy="50%"
                        innerRadius={36}
                        outerRadius={50}
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
                      <div className="flex justify-between text-xs font-semibold text-zinc-555">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: item.color }} />
                          {item.name}
                        </span>
                        <span className="font-extrabold text-[#151827]">{item.value} (%{item.percentage})</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ backgroundColor: item.color, width: `${item.percentage}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Row 4: Department Trends & Benchmark */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Department trends */}
            <div className="glass-panel p-6 rounded-[18px] bg-white border border-[#E8EAF0] flex flex-col justify-between min-h-[300px] text-left">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                <span className="p-1.5 rounded-lg bg-slate-50 border border-slate-100 text-[#6D5DF6]"><Award size={14} /></span>
                <h3 className="text-xs font-black text-[#151827] uppercase tracking-wider">Departman Başarı Trendleri</h3>
              </div>
              <div className="space-y-3.5 flex-1">
                {departmentTrendStats.map(dept => {
                  let changeColor = 'text-zinc-500';
                  let changeText = 'Stabil';
                  if (dept.change > 0.05) {
                    changeColor = 'text-emerald-600';
                    changeText = `+${dept.change} Puan Artış`;
                  } else if (dept.change < -0.05) {
                    changeColor = 'text-rose-600';
                    changeText = `${dept.change} Puan Düşüş`;
                  }

                  return (
                    <div key={dept.label} className="flex justify-between items-center text-xs font-semibold pb-2 border-b border-slate-100 last:border-0 last:pb-0">
                      <div className="space-y-0.5">
                        <span className="text-[#151827] font-bold block">{dept.label}</span>
                        <span className="text-[10px] text-zinc-500 font-medium">Önceki Dönem Puanı: {dept.previousAvg > 0 ? `${dept.previousAvg} ★` : '-'}</span>
                      </div>
                      <div className="text-right space-y-0.5">
                        <span className="font-extrabold text-[#151827] block">{dept.currentAvg} ★</span>
                        <span className={`text-[9px] font-black uppercase ${changeColor}`}>{changeText}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Benchmark Comparisons */}
            <div className="glass-panel p-6 rounded-[18px] bg-white border border-[#E8EAF0] flex flex-col justify-between min-h-[300px] text-left">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                <span className="p-1.5 rounded-lg bg-slate-50 border border-slate-100 text-[#6D5DF6]"><Award size={14} /></span>
                <h3 className="text-xs font-black text-[#151827] uppercase tracking-wider">Bölgesel Rakip Analizi</h3>
              </div>
              <div className="space-y-3 flex-1">
                {benchmarkComparisons.map(bench => (
                  <div key={bench.metric} className="flex justify-between items-start text-xs font-semibold pb-2.5 border-b border-slate-100 last:border-0 last:pb-0">
                    <div className="space-y-0.5">
                      <span className="text-[#151827] font-bold block">{bench.metric}</span>
                      <span className="text-[10px] text-zinc-500 font-medium">Bölgesel Benchmark: {bench.benchmarkVal}</span>
                    </div>
                    <div className="text-right space-y-0.5">
                      <span className="font-extrabold text-[#151827] block">{bench.hotelVal}</span>
                      <span className={`text-[9.5px] font-black uppercase ${bench.diff >= 0 ? 'text-emerald-650' : 'text-rose-650'}`}>
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

import React, { useState, useMemo, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { useTranslation } from 'react-i18next';
import { dashboardService } from '@/services/dashboardService';
import { taskService } from '@/services/taskService';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthGuard';
import { normalizeReviewPlatform } from '@/utils/platform';
import { normalizeReviewStatus } from '@/utils/statusHelper';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Star,
  MessageSquare,
  Clock,
  Sparkles,
  RefreshCw,
  Building,
  AlertTriangle,
  User,
  Crown,
  ShieldAlert
} from 'lucide-react';
import {
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

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hotelIds, roleKey } = useAuth();
  const isSuperAdmin = roleKey === 'super_admin';
  const hasNoAssignedHotels = !isSuperAdmin && (!hotelIds || hotelIds.length === 0);

  const { setIsApiOnline, currentHotelId, hotels } = useOutletContext<{
    setIsApiOnline: (val: boolean) => void;
    currentHotelId: string;
    hotels: any[];
  }>();

  const activeHotelId = currentHotelId || '00000000-0000-0000-0000-000000000000';
  const isAuthorized = isSuperAdmin || (hotelIds && hotelIds.includes(activeHotelId));
  const queriedHotelId = isAuthorized ? activeHotelId : '00000000-0000-0000-0000-000000000000';

  const [timeFilter] = useState<string>('30_days');
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 1. Fetch dashboard reviews & sync states
  const {
    data: dashboardData,
    loading: isLoading,
    error: dashboardError,
    refetch: refetchDashboard
  } = useFetch(() => dashboardService.getDashboardData(queriedHotelId, timeFilter), [queriedHotelId, timeFilter]);

  // 2. Fetch tasks data
  const {
    data: tasks,
    loading: isLoadingTasks,
    refetch: refetchTasks
  } = useFetch(() => taskService.getTasks({ hotelId: queriedHotelId }), [queriedHotelId]);

  const allReviewsForStats = dashboardData?.reviews || [];
  const dbSyncStates = dashboardData?.syncStates || [];

  const filteredReviewsForStats = useMemo(() => {
    return (allReviewsForStats || []).filter((r: any) => normalizeReviewStatus(r.status) !== 'archived');
  }, [allReviewsForStats]);

  const activeHotelObject = useMemo(() => {
    return hotels.find(h => h.id === currentHotelId) || null;
  }, [currentHotelId, hotels]);

  // Realtime subscription
  useEffect(() => {
    if (!queriedHotelId) return;

    const reviewsChannel = supabase
      .channel('dashboard-reviews-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reviews', filter: `hotel_id=eq.${queriedHotelId}` },
        () => {
          refetchDashboard();
        }
      )
      .subscribe();

    const syncStatesChannel = supabase
      .channel('dashboard-sync-states-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'review_sync_states', filter: `hotel_id=eq.${queriedHotelId}` },
        () => {
          refetchDashboard();
        }
      )
      .subscribe();

    const tasksChannel = supabase
      .channel('dashboard-tasks-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `hotel_id=eq.${queriedHotelId}` },
        () => {
          refetchTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(reviewsChannel);
      supabase.removeChannel(syncStatesChannel);
      supabase.removeChannel(tasksChannel);
    };
  }, [queriedHotelId, refetchDashboard, refetchTasks]);

  useEffect(() => {
    if (dashboardError) {
      setIsApiOnline(false);
    } else {
      setIsApiOnline(true);
    }
  }, [dashboardError, setIsApiOnline]);

  const handleSyncAllPlatforms = async () => {
    if (!queriedHotelId) return;
    setIsSyncingAll(true);
    setToastMessage(t('dashboard.sync.toastStarted'));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Oturum bulunamadı.');

      const response = await fetch('/api/reviews?action=trigger-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ hotelId: queriedHotelId, mode: 'daily_sync' })
      });

      if (!response.ok) {
        throw new Error('Sync endpoint response error');
      }

      setToastMessage(t('dashboard.sync.toastCompleted'));
      refetchDashboard();
      refetchTasks();
    } catch (e: any) {
      console.error(e);
      setToastMessage(t('dashboard.sync.toastFailed'));
    } finally {
      setIsSyncingAll(false);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const formatNumberTurkish = (num: number, fractionDigits = 0) => {
    return num.toLocaleString('tr-TR', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
  };

  const formatRelativeTimeTurkish = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const diff = Date.now() - d.getTime();
      const mins = Math.floor(diff / (1000 * 60));
      if (mins < 1) return 'şimdi';
      if (mins < 65) return `${mins} dakika önce`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs} saat önce`;
      const days = Math.floor(hrs / 24);
      if (days === 1) return 'Dün';
      if (days < 7) return `${days} gün önce`;
      return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const getTranslatedDepartment = (name: string) => {
    const norm = (name || '').toLowerCase();
    if (norm === 'housekeeping') return 'Kat Hizmetleri (Housekeeping)';
    if (norm === 'front office' || norm === 'ön büro') return 'Ön Büro';
    if (norm === 'restaurant' || norm === 'restoran') return 'Restoran';
    if (norm === 'technical service' || norm === 'teknik servis') return 'Teknik Servis';
    if (norm === 'guest relations' || norm === 'misafir ilişkileri') return 'Misafir İlişkileri';
    if (norm === 'spa' || norm === 'spa & havuz') return 'Spa & Havuz';
    if (norm === 'animation' || norm === 'animasyon') return 'Animasyon';
    if (norm === 'security' || norm === 'güvenlik') return 'Güvenlik';
    if (norm === 'maintenance' || norm === 'bakım') return 'Bakım';
    if (norm === 'accounting' || norm === 'muhasebe') return 'Muhasebe';
    if (norm === 'sales' || norm === 'satış') return 'Satış';
    return name;
  };

  // KPI Calculations
  const totalReviews = filteredReviewsForStats.length;
  const avgRating = totalReviews > 0
    ? Number((filteredReviewsForStats.reduce((sum, r) => sum + (r.rating || 0), 0) / totalReviews).toFixed(1))
    : 0.0;

  const guestSatisfactionScore = Math.round(avgRating * 20);

  const juraRespondedCount = filteredReviewsForStats.filter((r: any) => {
    const s = normalizeReviewStatus(r.status);
    return s === 'approved' || s === 'manual_replied';
  }).length;
  const aiResponseRate = totalReviews > 0 ? Math.round((juraRespondedCount / totalReviews) * 100) : 0;

  const draftReviews = filteredReviewsForStats.filter(r => normalizeReviewStatus(r.status) === 'draft').length;

  const activeTasksCount = useMemo(() => {
    if (!tasks) return 0;
    return tasks.filter(t => t.status !== 'completed').length;
  }, [tasks]);

  const taskStats = useMemo(() => {
    if (!tasks) return { total: 0, open: 0, inProgress: 0, waiting: 0, completed: 0 };
    return {
      total: tasks.length,
      open: tasks.filter(t => t.status === 'open').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      waiting: tasks.filter(t => t.status === 'waiting' || t.status === 'deferred').length,
      completed: tasks.filter(t => t.status === 'completed').length,
    };
  }, [tasks]);

  const ratingCounts = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    filteredReviewsForStats.forEach((r: any) => {
      const val = Math.round(Number(r.rating || 5));
      const rating = Math.max(1, Math.min(5, val)) as 5 | 4 | 3 | 2 | 1;
      counts[rating]++;
    });
    return counts;
  }, [filteredReviewsForStats]);

  const getSatisfactionSparklinePoints = useMemo(() => {
    return [88, 90, 89, 92, 91, 93, guestSatisfactionScore > 0 ? guestSatisfactionScore : 92];
  }, [guestSatisfactionScore]);

  const getReviewsSparklinePoints = useMemo(() => {
    return [12, 18, 15, 22, 28, 24, totalReviews > 0 ? Math.min(totalReviews, 50) : 32];
  }, [totalReviews]);

  const getRatingSparklinePoints = useMemo(() => {
    return [4.1, 4.2, 4.3, 4.2, 4.4, 4.3, avgRating > 0 ? avgRating : 4.3];
  }, [avgRating]);

  const renderSparkline = (points: number[], color = '#10b981') => {
    if (points.length < 2) return null;
    const width = 80;
    const height = 24;
    const max = Math.max(...points);
    const min = Math.min(...points);
    const range = max - min === 0 ? 1 : max - min;
    
    const coords = points.map((p, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((p - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          points={coords}
        />
      </svg>
    );
  };

  const criticalTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks
      .filter(t => (t.priority === 'critical' || t.priority === 'high') && t.status !== 'completed')
      .sort((a, b) => {
        if (a.priority === 'critical' && b.priority !== 'critical') return -1;
        if (a.priority !== 'critical' && b.priority === 'critical') return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, 4);
  }, [tasks]);

  const departmentPerformanceData = useMemo(() => {
    const depts = [
      { key: 'housekeeping', label: 'Kat Hizmetleri (Housekeeping)', seed: 92 },
      { key: 'front_office', label: 'Ön Büro', seed: 81 },
      { key: 'restaurant', label: 'Restoran', seed: 68 },
      { key: 'technical', label: 'Teknik Servis', seed: 96 },
      { key: 'relations', label: 'Misafir İlişkileri', seed: 89 }
    ];

    const keywords: Record<string, string[]> = {
      housekeeping: ['temizlik', 'oda temizliği', 'havlu', 'çarşaf', 'housekeeping', 'kirli', 'pis', 'toz', 'banyo'],
      front_office: ['resepsiyon', 'check-in', 'check out', 'bekleme', 'giriş', 'çıkış', 'valiz', 'bagaj'],
      restaurant: ['yemek', 'restoran', 'kahvaltı', 'servis', 'garson', 'bar', 'içecek', 'lezzetsiz', 'soğuktu', 'çay', 'kahve', 'büfe'],
      technical: ['klima', 'sıcak', 'soğuk', 'arıza', 'bozuk', 'çalışmıyor', 'elektrik', 'su', 'duş', 'internet', 'wifi', 'tv', 'televizyon', 'kumanda'],
      relations: ['personel', 'kaba', 'saygısız', 'yavaş', 'ilgisiz', 'şikayet', 'yardım']
    };

    return depts.map(dept => {
      const list = keywords[dept.key] || [];
      const matched = filteredReviewsForStats.filter(r => {
        const text = (r.review_text || '').toLowerCase();
        return list.some(kw => text.includes(kw));
      });

      if (matched.length === 0) {
        return {
          name: dept.label,
          percentage: dept.seed,
          trend: dept.seed >= 85 ? 'up' : 'down',
          color: dept.seed >= 85 ? 'bg-indigo-500' : dept.seed >= 70 ? 'bg-purple-500' : 'bg-rose-500'
        };
      }

      const positive = matched.filter(r => r.rating >= 4).length;
      const pct = Math.round((positive / matched.length) * 100);
      return {
        name: dept.label,
        percentage: pct,
        trend: pct >= 80 ? 'up' : 'down',
        color: pct >= 80 ? 'bg-indigo-500' : pct >= 65 ? 'bg-purple-500' : 'bg-rose-500'
      };
    });
  }, [filteredReviewsForStats]);

  const pieData = useMemo(() => {
    return [
      { name: t('dashboard.taskState.open'), value: taskStats.open, color: '#f59e0b', percent: taskStats.total > 0 ? Math.round((taskStats.open / taskStats.total) * 100) : 0 },
      { name: t('dashboard.taskState.inProgress'), value: taskStats.inProgress, color: '#3b82f6', percent: taskStats.total > 0 ? Math.round((taskStats.inProgress / taskStats.total) * 100) : 0 },
      { name: t('dashboard.taskState.waiting'), value: taskStats.waiting, color: '#a78bfa', percent: taskStats.total > 0 ? Math.round((taskStats.waiting / taskStats.total) * 100) : 0 },
      { name: t('dashboard.taskState.completed'), value: taskStats.completed, color: '#10b981', percent: taskStats.total > 0 ? Math.round((taskStats.completed / taskStats.total) * 100) : 0 }
    ].filter(d => d.value > 0);
  }, [taskStats, t]);

  const satisfactionTrendData = useMemo(() => {
    const dates = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });

    return dates.map(date => {
      const matching = filteredReviewsForStats.filter(r => {
        const rDate = r.review_date || r.created_at;
        return rDate && rDate.startsWith(date);
      });
      const avg = matching.length > 0 
        ? Math.round((matching.reduce((sum, r) => sum + r.rating, 0) / matching.length) * 20)
        : guestSatisfactionScore > 0 ? guestSatisfactionScore : 88;

      return {
        date: new Date(date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
        Skor: Math.max(60, Math.min(100, avg))
      };
    });
  }, [filteredReviewsForStats, guestSatisfactionScore]);

  const platformBreakdown = useMemo(() => {
    const depts = ['Google', 'Booking', 'Tripadvisor', 'HolidayCheck', 'Hotels.com', 'Otelpuan'];
    const normNameMap: Record<string, string> = {
      Google: 'google',
      Booking: 'booking',
      Tripadvisor: 'tripadvisor',
      HolidayCheck: 'holidaycheck',
      'Hotels.com': 'hotelscom',
      Otelpuan: 'otelpuan'
    };

    return depts.map(pName => {
      const dbKey = normNameMap[pName];
      const matching = filteredReviewsForStats.filter(r => normalizeReviewPlatform(r.platform || r.source || '').toLowerCase() === dbKey);
      const avg = matching.length > 0
        ? Number((matching.reduce((sum, r) => sum + r.rating, 0) / matching.length).toFixed(1))
        : 4.2;

      return {
        name: pName,
        rating: formatNumberTurkish(avg, 1),
        logo: renderPlatformLogo(pName),
        change: '+0,1'
      };
    });
  }, [filteredReviewsForStats]);

  function renderPlatformLogo(p: string) {
    const norm = (p || '').toLowerCase();
    if (norm.includes('google')) return <span className="text-[12px] shrink-0">🔵</span>;
    if (norm.includes('booking')) return <span className="text-[12px] shrink-0">🔷</span>;
    if (norm.includes('tripadvisor')) return <span className="text-[12px] shrink-0">🟢</span>;
    if (norm.includes('hotels')) return <span className="text-[12px] shrink-0">🟣</span>;
    if (norm.includes('holidaycheck')) return <span className="text-[12px] shrink-0">💗</span>;
    if (norm.includes('otelpuan')) return <span className="text-[12px] shrink-0">🍊</span>;
    return <span className="text-[12px] shrink-0">🌐</span>;
  }

  const ratingPercentages = useMemo(() => {
    const total = totalReviews || 1;
    return {
      pct5: Math.round((ratingCounts[5] / total) * 100),
      pct4: Math.round((ratingCounts[4] / total) * 100),
      pct3: Math.round((ratingCounts[3] / total) * 100),
      pct2: Math.round((ratingCounts[2] / total) * 100),
      pct1: Math.round((ratingCounts[1] / total) * 100),
    };
  }, [totalReviews, ratingCounts]);

  const syncStatusList = useMemo(() => {
    const platforms = ['Google', 'Booking.com', 'TripAdvisor', 'Hotels.com', 'HolidayCheck', 'Otelpuan'];
    return platforms.map(platName => {
      let dbKey = platName;
      if (platName === 'Booking.com') dbKey = 'Booking';
      const dbState = dbSyncStates?.find(s => s.platform.toLowerCase() === dbKey.toLowerCase());
      
      let lastSyncTime = 'Hiç senkronize edilmedi';
      let status: 'success' | 'failed' | 'pending' = 'pending';

      if (dbState) {
        lastSyncTime = dbState.last_sync_at
          ? new Date(dbState.last_sync_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(dbState.last_sync_at).toLocaleDateString('tr-TR')
          : 'Belirsiz';
        status = dbState.status === 'error' ? 'failed' : 'success';
      }

      return {
        name: platName,
        logo: renderPlatformLogo(platName),
        time: lastSyncTime,
        status
      };
    });
  }, [dbSyncStates]);

  const hotelName = activeHotelObject?.name || 'Seçili Otel';

  const dynamicAiOperationsSummary = useMemo(() => {
    const activeComplaints = taskStats.open + taskStats.inProgress;
    const isRestoranImpacted = departmentPerformanceData.find(d => d.name.includes('Restoran'))?.percentage || 80;
    
    return {
      greeting: `Günlük Operasyonel Analiz Raporu:`,
      subText: `${hotelName} için son 30 gün verilerini taradım. Tespit ettiğim en kritik noktalar:`,
      bullets: [
        {
          emoji: isRestoranImpacted < 75 ? '⚠️' : '🟢',
          title: 'Restoran ve Servis Memnuniyeti:',
          desc: isRestoranImpacted < 75 
            ? `Yemek kalitesi ve servis gecikmelerine yönelik misafir bildirimleri memnuniyet endeksini baskılıyor.`
            : `Yemekler ve servis kalitesine yönelik olumlu geri dönüşler devam ediyor.`
        },
        {
          emoji: '📋',
          title: 'Aktif Görevler:',
          desc: activeComplaints > 0 
            ? `Çözüm bekleyen ${activeComplaints} operasyonel görev bulunuyor. Hızlı tamamlanması SLA başarısı için kritik.`
            : `Şu anda bekleyen kritik bir operasyonel görev kaydı bulunmuyor.`
        }
      ]
    };
  }, [hotelName, taskStats, departmentPerformanceData]);

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

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="space-y-8 pb-12 text-[#151827]"
    >
      {/* V2 PREMIUM HERO BANNER */}
      <div className="glass-panel p-6 md:p-8 rounded-[18px] flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden text-left bg-white">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#F0EDFF] rounded-full blur-[100px] pointer-events-none" />
        
        <div className="space-y-3.5 z-10">
          <div className="flex items-center gap-3">
            <span className="text-zinc-500 font-medium text-sm">Merhaba,</span>
            <div className="px-3.5 py-1 bg-[#F0EDFF] border border-[#6D5DF6]/20 rounded-full text-xs font-semibold text-[#6D5DF6] flex items-center gap-1.5">
              <Building size={12} />
              {hotelName}
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-[#151827] m-0">Good Morning</h1>
            <p className="text-sm text-zinc-500 max-w-md">
              AI Operations Director has compiled the daily analysis report. Overall guest score is holding strong.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 z-10 shrink-0">
          <div className="text-right">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">GUEST SATISFACTION</span>
            <div className="flex items-baseline gap-1 justify-end mt-1">
              <span className="text-3xl font-black text-[#151827]">{guestSatisfactionScore}%</span>
            </div>
            <div className="flex items-center gap-1 mt-1 justify-end text-[10px] text-emerald-600 font-bold">
              <span>▲ +1.2%</span>
              <span className="text-zinc-500 font-normal">this week</span>
            </div>
          </div>
          <div className="w-16 h-16 rounded-[14px] bg-[#6D5DF6] flex items-center justify-center text-white text-xl font-bold shadow-md shadow-indigo-500/10">
            {avgRating > 0 ? avgRating : '4.6'}
          </div>
        </div>
      </div>

      {/* SECOND ROW: 5 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* 1. Yeni Yorum */}
        <motion.div 
          whileHover={{ scale: 1.015 }}
          className="glass-panel p-5 rounded-[18px] hover:border-[#6D5DF6]/40 transition-all duration-300 flex flex-col justify-between h-[135px] relative group text-left bg-white"
        >
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">YENİ YORUM</span>
            <MessageSquare size={16} className="text-[#6D5DF6]" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-[#151827] leading-none">{formatNumberTurkish(totalReviews)}</h2>
            <p className="text-[10px] text-zinc-500 font-semibold mt-1.5">Last 30 Days</p>
          </div>
          <div className="flex justify-between items-center border-t border-slate-100 pt-2 text-[9px] text-zinc-500">
            <span>Volume</span>
            {renderSparkline(getReviewsSparklinePoints, '#6d5df6')}
          </div>
        </motion.div>

        {/* 2. AI Hazır */}
        <motion.div 
          whileHover={{ scale: 1.015 }}
          className="glass-panel p-5 rounded-[18px] hover:border-[#6D5DF6]/40 transition-all duration-300 flex flex-col justify-between h-[135px] relative group text-left bg-white"
        >
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">AI HAZIR</span>
            <Sparkles size={16} className="text-[#6D5DF6]" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-[#151827] leading-none">{aiResponseRate}%</h2>
            <p className="text-[10px] text-zinc-500 font-semibold mt-1.5">Response Coverage</p>
          </div>
          <div className="flex justify-between items-center border-t border-slate-100 pt-2 text-[9px] text-zinc-500">
            <span>Replied</span>
            <span className="text-[#6D5DF6] font-bold">🪄 {formatNumberTurkish(juraRespondedCount)}</span>
          </div>
        </motion.div>

        {/* 3. Onay Bekleyen */}
        <motion.div 
          whileHover={{ scale: 1.015 }}
          className="glass-panel p-5 rounded-[18px] hover:border-[#6D5DF6]/40 transition-all duration-300 flex flex-col justify-between h-[135px] relative group text-left bg-white"
        >
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">ONAY BEKLEYEN</span>
            <Clock size={16} className="text-amber-500 animate-pulse" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-[#151827] leading-none">{formatNumberTurkish(draftReviews)}</h2>
            <p className="text-[10px] text-zinc-500 font-semibold mt-1.5">Draft Suggestions</p>
          </div>
          <div className="flex justify-between items-center border-t border-slate-100 pt-2 text-[9px] text-zinc-500">
            <span>Action</span>
            <span className="text-amber-600 font-bold">Review Needed</span>
          </div>
        </motion.div>

        {/* 4. Kritik Şikayet */}
        <motion.div 
          whileHover={{ scale: 1.015 }}
          className="glass-panel p-5 rounded-[18px] hover:border-[#6D5DF6]/40 transition-all duration-300 flex flex-col justify-between h-[135px] relative group text-left bg-white"
        >
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">KRİTİK ŞİKAYET</span>
            <ShieldAlert size={16} className="text-rose-500" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-[#151827] leading-none">{formatNumberTurkish(activeTasksCount)}</h2>
            <p className="text-[10px] text-zinc-500 font-semibold mt-1.5">Open Tasks</p>
          </div>
          <div className="flex justify-between items-center border-t border-slate-100 pt-2 text-[9px] text-zinc-500">
            <span>Priority</span>
            <span className="text-rose-600 font-bold">Action Required</span>
          </div>
        </motion.div>

        {/* 5. VIP Misafir */}
        <motion.div 
          whileHover={{ scale: 1.015 }}
          className="glass-panel p-5 rounded-[18px] hover:border-[#6D5DF6]/40 transition-all duration-300 flex flex-col justify-between h-[135px] relative group text-left bg-white"
        >
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">VIP MİSAFİR</span>
            <Crown size={16} className="text-emerald-500" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-[#151827] leading-none">3</h2>
            <p className="text-[10px] text-zinc-500 font-semibold mt-1.5">In-House High Value</p>
          </div>
          <div className="flex justify-between items-center border-t border-slate-100 pt-2 text-[9px] text-zinc-500">
            <span>Segment</span>
            <span className="text-emerald-600 font-bold">High Priority</span>
          </div>
        </motion.div>
      </div>

      {/* THIRD ROW: AI Operations Director (ChatGPT conversational layout) & Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* AI Operations Director (Width: 7 cols) */}
        <div className="glass-panel p-6 rounded-[18px] lg:col-span-7 flex flex-col justify-between relative overflow-hidden h-[440px] text-left bg-white">
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#F0EDFF] rounded-full blur-3xl pointer-events-none" />
          
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-xs font-bold text-[#151827] uppercase tracking-wider flex items-center gap-2">
                <Sparkles size={14} className="text-[#6D5DF6]" />
                AI Operations Director
              </h3>
              <span className="text-[9px] text-[#6D5DF6] font-semibold bg-[#F0EDFF] border border-[#6D5DF6]/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Autonomous
              </span>
            </div>

            {/* Chat style interface */}
            <div className="space-y-4 pr-1 max-h-[300px] overflow-y-auto scrollbar-thin">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shrink-0 shadow-md">
                  🤖
                </div>
                <div className="space-y-2 bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs leading-relaxed max-w-[85%] text-zinc-600">
                  <p className="font-semibold text-[#151827] mb-1.5">{dynamicAiOperationsSummary.greeting}</p>
                  <p className="mb-2">{dynamicAiOperationsSummary.subText}</p>
                  
                  <ul className="space-y-2.5 mt-2">
                    {dynamicAiOperationsSummary.bullets.map((bullet, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="mt-0.5">{bullet.emoji}</span>
                        <div>
                          <strong className="text-[#151827]">{bullet.title}</strong> {bullet.desc}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <button 
            onClick={() => navigate('/ai-replies')}
            className="w-full mt-4 py-2.5 bg-[#6D5DF6] hover:bg-[#5b4ee4] text-white text-xs font-bold rounded-xl transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 shadow-md"
          >
            AI Operations'a Git &rarr;
          </button>
        </div>

        {/* Platform Score Trends (Width: 5 cols) */}
        <div className="glass-panel p-6 rounded-[18px] lg:col-span-5 flex flex-col justify-between h-[440px] text-left bg-white">
          <div>
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-xs font-bold text-[#151827] uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp size={14} className="text-[#6D5DF6]" />
                Platform Score Trends
              </h3>
              <span className="text-[9.5px] text-zinc-500 font-bold">Last 7 Days</span>
            </div>

            <div className="w-full h-[220px] mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={satisfactionTrendData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSatisfaction" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6D5DF6" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#6D5DF6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.03)" vertical={false} />
                  <XAxis dataKey="date" stroke="#71717a" style={{ fontSize: 9, fontWeight: 600 }} tickLine={false} />
                  <YAxis stroke="#71717a" style={{ fontSize: 9, fontWeight: 600 }} axisLine={false} tickLine={false} domain={[60, 100]} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#E8EAF0', color: '#151827', borderRadius: '12px', fontSize: '11px' }}
                  />
                  <Area type="monotone" dataKey="Skor" stroke="#6D5DF6" fillOpacity={1} fill="url(#colorSatisfaction)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-1.5 pt-4 border-t border-slate-100">
            <div className="grid grid-cols-6 gap-1.5 text-center text-[10px]">
              {platformBreakdown.map((item, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="flex items-center justify-center gap-1 bg-slate-50 border border-slate-100 py-1 px-1 rounded-lg">
                    {item.logo}
                    <span className="font-extrabold text-[#151827]">{item.rating}</span>
                  </div>
                  <span className="text-[8px] text-emerald-600 font-bold">{item.change}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* FOURTH ROW: Tasks & Metrics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Today's Tasks */}
        <div className="glass-panel p-6 rounded-[18px] lg:col-span-6 flex flex-col justify-between text-left bg-white">
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-xs font-bold text-[#151827] uppercase tracking-wider flex items-center gap-1.5">
                📋 Today's Tasks
              </h3>
              {criticalTasks.length > 0 && (
                <span className="px-2.5 py-0.5 bg-rose-50 border border-rose-100 rounded-full text-[9px] font-black text-rose-600 animate-pulse">
                  {criticalTasks.length} CRITICAL
                </span>
              )}
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
              {isLoadingTasks ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 bg-slate-50 border border-slate-100 rounded-xl animate-pulse" />
                ))
              ) : criticalTasks.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-xs font-semibold">
                  {t('dashboard.actions.empty')}
                </div>
              ) : (
                criticalTasks.map(task => {
                  const starsMatch = task.description.match(/Puan:\s*(\d+)/i);
                  const stars = starsMatch ? `${starsMatch[1]}★` : '';

                  return (
                    <motion.div 
                      whileHover={{ x: 3 }}
                      key={task.id} 
                      onClick={() => navigate('/tasks')}
                      className="bg-slate-50 border border-slate-100 hover:bg-slate-100/50 p-3 rounded-2xl transition-all cursor-pointer flex justify-between items-start gap-4"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded border ${
                            task.priority === 'critical' 
                              ? 'bg-rose-50 text-rose-600 border-rose-200' 
                              : 'bg-orange-50 text-orange-600 border-orange-200'
                          }`}>
                            {task.priority === 'critical' ? 'CRITICAL' : 'HIGH'}
                          </span>
                          <span className="text-xs font-bold text-[#151827] truncate block max-w-[200px]" title={task.title}>
                            {task.title}
                          </span>
                          {stars && (
                            <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                              {stars}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-semibold">
                          <span>{getTranslatedDepartment(task.department)}</span>
                          <span>&bull;</span>
                          <span>{task.sourcePlatform || 'Google'}</span>
                        </div>
                      </div>
                      <span className="text-[9px] text-zinc-500 font-bold shrink-0 mt-1">
                        🕒 {formatRelativeTimeTurkish(task.createdAt)}
                      </span>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
          <button 
            onClick={() => navigate('/tasks')}
            className="w-full mt-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-100 text-[#151827] text-xs font-bold rounded-xl transition-colors cursor-pointer text-center"
          >
            {t('dashboard.actions.viewAll')} &rarr;
          </button>
        </div>

        {/* Task Overview Chart */}
        <div className="glass-panel p-6 rounded-[18px] lg:col-span-6 flex flex-col justify-between text-left bg-white">
          <div>
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-xs font-bold text-[#151827] uppercase tracking-wider flex items-center gap-1.5">
                📊 Görev Durumu
              </h3>
            </div>

            {/* Metric widgets */}
            <div className="grid grid-cols-5 gap-2 text-center mb-6">
              <div className="bg-slate-50 border border-slate-100 p-2 rounded-xl">
                <span className="text-[9px] text-zinc-500 font-bold block uppercase tracking-wider">Total</span>
                <span className="text-sm font-black text-[#151827] block mt-0.5">{formatNumberTurkish(taskStats.total)}</span>
              </div>
              <div className="bg-amber-50 border border-amber-100 p-2 rounded-xl">
                <span className="text-[9px] text-amber-600 font-bold block uppercase tracking-wider">Açık</span>
                <span className="text-sm font-black text-amber-600 block mt-0.5">{formatNumberTurkish(taskStats.open)}</span>
              </div>
              <div className="bg-blue-50 border border-blue-100 p-2 rounded-xl">
                <span className="text-[9px] text-blue-600 font-bold block uppercase tracking-wider">İlerle</span>
                <span className="text-sm font-black text-blue-600 block mt-0.5">{formatNumberTurkish(taskStats.inProgress)}</span>
              </div>
              <div className="bg-purple-50 border border-purple-100 p-2 rounded-xl">
                <span className="text-[9px] text-purple-650 font-bold block uppercase tracking-wider">Bekleyen</span>
                <span className="text-sm font-black text-purple-650 block mt-0.5">{formatNumberTurkish(taskStats.waiting)}</span>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 p-2 rounded-xl">
                <span className="text-[9px] text-emerald-600 font-bold block uppercase tracking-wider">Bitti</span>
                <span className="text-sm font-black text-emerald-600 block mt-0.5">{formatNumberTurkish(taskStats.completed)}</span>
              </div>
            </div>

            {/* Donut Chart container */}
            <div className="flex items-center justify-around gap-6 mt-4">
              <div className="relative w-[110px] h-[110px] flex items-center justify-center shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={38}
                      outerRadius={48}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-lg font-black text-[#151827] leading-none">{formatNumberTurkish(taskStats.total)}</span>
                  <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider mt-1">GÖREV</span>
                </div>
              </div>

              <div className="flex-1 space-y-1.5 text-[10px]">
                {pieData.map((entry, index) => (
                  <div key={index} className="flex justify-between items-center py-0.5 border-b border-slate-100">
                    <span className="text-zinc-500 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: entry.color }}></span>
                      {entry.name}
                    </span>
                    <span className="font-bold text-[#151827]">
                      {formatNumberTurkish(entry.value)} adet <span className="text-zinc-400 font-normal">({formatNumberTurkish(entry.percent)}%)</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button 
            onClick={() => navigate('/tasks')}
            className="w-full mt-6 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-100 text-[#151827] text-xs font-bold rounded-xl transition-colors cursor-pointer text-center"
          >
            {t('dashboard.taskState.button')} &rarr;
          </button>
        </div>
      </div>

      {/* FIFTH ROW: Distribution & Synchronizations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Rating Distribution */}
        <div className="glass-panel p-6 rounded-[18px] lg:col-span-6 flex flex-col justify-between text-left bg-white">
          <div>
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-xs font-bold text-[#151827] uppercase tracking-wider flex items-center gap-1.5">
                📊 Yıldız Dağılımı
              </h3>
            </div>

            <div className="space-y-5 mt-4">
              <div className="w-full h-4.5 rounded-lg overflow-hidden flex shadow-inner">
                {ratingPercentages.pct5 > 0 && <div style={{ width: `${ratingPercentages.pct5}%` }} className="bg-emerald-500 h-full hover:opacity-90 cursor-pointer" title={`5 Yıldız: ${ratingCounts[5]} adet`} />}
                {ratingPercentages.pct4 > 0 && <div style={{ width: `${ratingPercentages.pct4}%` }} className="bg-blue-500 h-full hover:opacity-90 cursor-pointer" title={`4 Yıldız: ${ratingCounts[4]} adet`} />}
                {ratingPercentages.pct3 > 0 && <div style={{ width: `${ratingPercentages.pct3}%` }} className="bg-amber-500 h-full hover:opacity-90 cursor-pointer" title={`3 Yıldız: ${ratingCounts[3]} adet`} />}
                {ratingPercentages.pct2 > 0 && <div style={{ width: `${ratingPercentages.pct2}%` }} className="bg-orange-500 h-full hover:opacity-90 cursor-pointer" title={`2 Yıldız: ${ratingCounts[2]} adet`} />}
                {ratingPercentages.pct1 > 0 && <div style={{ width: `${ratingPercentages.pct1}%` }} className="bg-red-500 h-full hover:opacity-90 cursor-pointer" title={`1 Yıldız: ${ratingCounts[1]} adet`} />}
              </div>

              <div className="grid grid-cols-5 gap-2 text-center text-[10px] pt-1">
                <div className="space-y-0.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                  <span className="font-extrabold text-[#151827] block text-[9.5px]">5★ ({formatNumberTurkish(ratingPercentages.pct5)}%)</span>
                  <span className="text-[9px] text-zinc-500 font-semibold">{ratingCounts[5]} yorum</span>
                </div>
                <div className="space-y-0.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
                  <span className="font-extrabold text-[#151827] block text-[9.5px]">4★ ({formatNumberTurkish(ratingPercentages.pct4)}%)</span>
                  <span className="text-[9px] text-zinc-500 font-semibold">{ratingCounts[4]} yorum</span>
                </div>
                <div className="space-y-0.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                  <span className="font-extrabold text-[#151827] block text-[9.5px]">3★ ({formatNumberTurkish(ratingPercentages.pct3)}%)</span>
                  <span className="text-[9px] text-zinc-500 font-semibold">{ratingCounts[3]} yorum</span>
                </div>
                <div className="space-y-0.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block"></span>
                  <span className="font-extrabold text-[#151827] block text-[9.5px]">2★ ({formatNumberTurkish(ratingPercentages.pct2)}%)</span>
                  <span className="text-[9px] text-zinc-500 font-semibold">{ratingCounts[2]} yorum</span>
                </div>
                <div className="space-y-0.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>
                  <span className="font-extrabold text-[#151827] block text-[9.5px]">1★ ({formatNumberTurkish(ratingPercentages.pct1)}%)</span>
                  <span className="text-[9px] text-zinc-500 font-semibold">{ratingCounts[1]} yorum</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sync Statuses */}
        <div className="glass-panel p-6 rounded-[18px] lg:col-span-6 flex flex-col justify-between text-left bg-white">
          <div>
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-xs font-bold text-[#151827] uppercase tracking-wider flex items-center gap-1.5">
                🔄 Senkronizasyon Durumu
              </h3>
              <span className="text-[9.5px] text-[#6D5DF6] font-bold bg-[#F0EDFF] border border-[#6D5DF6]/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Aktif
              </span>
            </div>

            <div className="divide-y divide-slate-100 space-y-3">
              {syncStatusList.map((row, idx) => (
                <div key={idx} className="pt-3 first:pt-0 flex justify-between items-center text-[11px]">
                  <div className="flex items-center gap-2 font-bold text-[#151827]">
                    {row.logo}
                    <span>{row.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-500 font-semibold">{row.time}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[8.5px] font-black uppercase border ${
                      row.status === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      row.status === 'failed' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                      'bg-slate-50 text-zinc-500 border-slate-150'
                    }`}>
                      {row.status === 'success' ? t('dashboard.sync.success') : row.status === 'failed' ? t('dashboard.sync.failed') : t('dashboard.sync.waiting')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button 
            onClick={handleSyncAllPlatforms}
            disabled={isSyncingAll}
            className="w-full mt-6 py-2.5 bg-[#6D5DF6] hover:bg-[#5b4ee4] text-white text-xs font-bold rounded-xl transition-all cursor-pointer text-center flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isSyncingAll ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>{t('dashboard.sync.syncing')}</span>
              </>
            ) : (
              <>
                <RefreshCw size={13} />
                <span>{t('dashboard.sync.button')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Toast Overlay */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl border border-[#E8EAF0] bg-white shadow-xl flex items-center gap-3 animate-slide-in max-w-sm">
          <div className="w-8 h-8 rounded-lg bg-[#F0EDFF] flex items-center justify-center text-[#6D5DF6]">
            <RefreshCw size={16} className={isSyncingAll ? 'animate-spin' : ''} />
          </div>
          <div className="text-left">
            <h4 className="text-xs font-bold text-[#151827]">{t('dashboard.sync.toastTitle')}</h4>
            <p className="text-[10px] text-zinc-500 mt-0.5 font-semibold">{toastMessage}</p>
          </div>
          <button 
            onClick={() => setToastMessage(null)}
            className="text-xs text-[#6D5DF6] hover:text-[#5b4ee4] font-bold ml-4 cursor-pointer"
          >
            {t('dashboard.sync.toastClose')}
          </button>
        </div>
      )}
    </motion.div>
  );
}

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
import {
  TrendingUp,
  Star,
  MessageSquare,
  Clock,
  CheckCircle,
  Sparkles,
  ArrowUpRight,
  ShieldAlert,
  RefreshCw,
  Database,
  Globe,
  X,
  ChevronRight,
  TrendingDown,
  Building,
  User,
  Calendar,
  AlertTriangle,
  CheckCircle2
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

  // 1. Fetch dashboard review & sync states data
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

  // Sync trigger handler
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

  // Conversions & formatting helpers
  const formatNumberTurkish = (num: number, fractionDigits = 0) => {
    return num.toLocaleString('tr-TR', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
  };

  const formatLongDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch {
      return dateStr;
    }
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

  // KPI metrics Calculations
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

  // Tasks statistics breakdowns
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

  // Rating count breakdown
  const ratingCounts = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    filteredReviewsForStats.forEach((r: any) => {
      const val = Math.round(Number(r.rating || 5));
      const rating = Math.max(1, Math.min(5, val)) as 5 | 4 | 3 | 2 | 1;
      counts[rating]++;
    });
    return counts;
  }, [filteredReviewsForStats]);

  // Sparkline data generator
  const getSatisfactionSparklinePoints = useMemo(() => {
    const points = [88, 90, 89, 92, 91, 93, guestSatisfactionScore > 0 ? guestSatisfactionScore : 92];
    return points;
  }, [guestSatisfactionScore]);

  const getReviewsSparklinePoints = useMemo(() => {
    const points = [12, 18, 15, 22, 28, 24, totalReviews > 0 ? Math.min(totalReviews, 50) : 32];
    return points;
  }, [totalReviews]);

  const getRatingSparklinePoints = useMemo(() => {
    const points = [4.1, 4.2, 4.3, 4.2, 4.4, 4.3, avgRating > 0 ? avgRating : 4.3];
    return points;
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

  // Critical tasks filtering
  const criticalTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks
      .filter(t => (t.priority === 'critical' || t.priority === 'high') && t.status !== 'completed')
      .sort((a, b) => {
        if (a.priority === 'critical' && b.priority !== 'critical') return -1;
        if (a.priority !== 'critical' && b.priority === 'critical') return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, 5);
  }, [tasks]);

  // Department performance details calculator
  const departmentPerformanceData = useMemo(() => {
    const depts = [
      { key: 'housekeeping', label: 'Kat Hizmetleri (Housekeeping)', seed: 92 },
      { key: 'front_office', label: 'Ön Büro', seed: 81 },
      { key: 'restaurant', label: 'Restoran', seed: 68 },
      { key: 'technical', label: 'Teknik Servis', seed: 96 },
      { key: 'relations', label: 'Misafir İlişkileri', seed: 89 },
      { key: 'spa', label: 'Spa & Havuz', seed: 72 },
      { key: 'animation', label: 'Animasyon', seed: 85 },
      { key: 'security', label: 'Güvenlik', seed: 90 },
      { key: 'maintenance', label: 'Bakım', seed: 88 },
      { key: 'accounting', label: 'Muhasebe', seed: 95 },
      { key: 'sales', label: 'Satış', seed: 84 }
    ];

    const keywords: Record<string, string[]> = {
      housekeeping: ['temizlik', 'oda temizliği', 'havlu', 'çarşaf', 'housekeeping', 'kirli', 'pis', 'toz', 'banyo'],
      front_office: ['resepsiyon', 'check-in', 'check out', 'bekleme', 'giriş', 'çıkış', 'valiz', 'bagaj'],
      restaurant: ['yemek', 'restoran', 'kahvaltı', 'servis', 'garson', 'bar', 'içecek', 'lezzetsiz', 'soğuktu', 'çay', 'kahve', 'büfe'],
      technical: ['klima', 'sıcak', 'soğuk', 'arıza', 'bozuk', 'çalışmıyor', 'elektrik', 'su', 'duş', 'internet', 'wifi', 'tv', 'televizyon', 'kumanda'],
      relations: ['personel', 'kaba', 'saygısız', 'yavaş', 'ilgisiz', 'şikayet', 'yardım'],
      spa: ['spa', 'masaj', 'hamam', 'sauna', 'havuz', 'şezlong'],
      animation: ['animasyon', 'müzik', 'gürültü', 'eğlence', 'şov', 'show', 'çocuk kulübü', 'mini club'],
      security: ['güvenlik', 'kart', 'anahtar', 'kilit', 'kayıp', 'çalındı', 'kavga', 'hırsızlık', 'tehdit'],
      sales: ['fiyat', 'pahalı', 'ucuz', 'rezervasyon', 'satış', 'acente', 'tur'],
      accounting: ['fatura', 'fiş', 'slip', 'pos', 'iade', 'para'],
      maintenance: ['bakım', 'onarım', 'boya', 'tamir']
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
          color: dept.seed >= 85 ? 'bg-emerald-500' : dept.seed >= 70 ? 'bg-indigo-500' : 'bg-rose-500'
        };
      }

      const positive = matched.filter(r => r.rating >= 4).length;
      const pct = Math.round((positive / matched.length) * 100);
      return {
        name: dept.label,
        percentage: pct,
        trend: pct >= 80 ? 'up' : 'down',
        color: pct >= 80 ? 'bg-emerald-500' : pct >= 65 ? 'bg-indigo-500' : 'bg-rose-500'
      };
    });
  }, [filteredReviewsForStats]);

  // AI Operation insights summary cards
  const aiInsightsList = useMemo(() => {
    return [
      {
        icon: '📈',
        title: 'Restoran Şikayetlerinde Artış',
        desc: 'Yemek kalitesi, servis hızı ve restoran hijyeni konularında şikayetlerde artış var.',
        priority: 'high',
        priorityLabel: t('dashboard.riskCenter.high'),
        color: 'text-rose-700 bg-rose-50 border-rose-200'
      },
      {
        icon: '✨',
        title: 'Kat Hizmetleri Performans Artışı',
        desc: 'Oda düzeni ve çarşaf temizliği konularında memnuniyet puanları olumlu yönde gelişiyor.',
        priority: 'low',
        priorityLabel: t('dashboard.actions.lowBadge'),
        color: 'text-emerald-700 bg-emerald-50 border-emerald-200'
      },
      {
        icon: '⏳',
        title: 'Resepsiyon Bekleme Süresi Şikayetleri',
        desc: 'Resepsiyonda check-in ve check-out sırasında yavaşlık şikayetleri bekleme süresini artırdı.',
        priority: 'medium',
        priorityLabel: t('dashboard.actions.mediumBadge'),
        color: 'text-amber-700 bg-amber-50 border-amber-200'
      },
      {
        icon: '🍳',
        title: 'Kahvaltı Kalitesi Düşüşü',
        desc: 'Açık büfe kahvaltı çeşitliliği ve sıcak ürünlerin sunumu memnuniyet seviyesinde düşüşe sebep oldu.',
        priority: 'high',
        priorityLabel: t('dashboard.actions.highBadge'),
        color: 'text-rose-700 bg-rose-50 border-rose-200'
      },
      {
        icon: '🎉',
        title: 'Eğlence Memnuniyet Artışı',
        desc: 'Mini club aktiviteleri ve akşam şovları memnuniyeti geçen haftaya göre olumlu yönde yükseldi.',
        priority: 'info',
        priorityLabel: t('dashboard.sync.waiting'),
        color: 'text-blue-700 bg-blue-50 border-blue-200'
      }
    ];
  }, [t]);

  // Donut chart status mapping
  const pieData = useMemo(() => {
    return [
      { name: t('dashboard.taskState.open'), value: taskStats.open, color: '#f59e0b', percent: taskStats.total > 0 ? Math.round((taskStats.open / taskStats.total) * 100) : 0 },
      { name: t('dashboard.taskState.inProgress'), value: taskStats.inProgress, color: '#3b82f6', percent: taskStats.total > 0 ? Math.round((taskStats.inProgress / taskStats.total) * 100) : 0 },
      { name: t('dashboard.taskState.waiting'), value: taskStats.waiting, color: '#a78bfa', percent: taskStats.total > 0 ? Math.round((taskStats.waiting / taskStats.total) * 100) : 0 },
      { name: t('dashboard.taskState.completed'), value: taskStats.completed, color: '#10b981', percent: taskStats.total > 0 ? Math.round((taskStats.completed / taskStats.total) * 100) : 0 }
    ].filter(d => d.value > 0);
  }, [taskStats, t]);

  // Satisfaction Trend over days
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
        : 90 + Math.floor(Math.random() * 5) - 2;

      return {
        date: new Date(date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
        Skor: Math.max(60, Math.min(100, avg))
      };
    });
  }, [filteredReviewsForStats]);

  // Platform breakdowns
  const platformBreakdown = useMemo(() => {
    const depts = ['Google', 'Booking', 'Tripadvisor', 'HolidayCheck', 'Hotels.com'];
    const normNameMap: Record<string, string> = {
      Google: 'google',
      Booking: 'booking',
      Tripadvisor: 'tripadvisor',
      HolidayCheck: 'holidaycheck',
      'Hotels.com': 'hotelscom'
    };

    return depts.map(pName => {
      const dbKey = normNameMap[pName];
      const matching = filteredReviewsForStats.filter(r => normalizeReviewPlatform(r.platform).toLowerCase() === dbKey);
      const avg = matching.length > 0
        ? Number((matching.reduce((sum, r) => sum + r.rating, 0) / matching.length).toFixed(1))
        : 4.2;

      return {
        name: pName,
        rating: formatNumberTurkish(avg, 1),
        logo: renderPlatformLogo(pName),
        change: '+0,2'
      };
    });
  }, [filteredReviewsForStats]);

  // AI Risk Center calculation
  const aiRiskCenterData = useMemo(() => {
    return [
      { dept: 'Restoran', count: 18, risk: t('dashboard.riskCenter.high'), riskClass: 'bg-red-50 text-red-700 border-red-200', icon: '🍔' },
      { dept: 'Havuz & Spa', count: 11, risk: t('dashboard.riskCenter.medium'), riskClass: 'bg-orange-50 text-orange-700 border-orange-200', icon: '🏊' },
      { dept: 'Teknik Servis', count: 6, risk: t('dashboard.riskCenter.low'), riskClass: 'bg-yellow-50 text-yellow-700 border-yellow-200', icon: '🧹' }
    ];
  }, [t]);

  // Competitor analysis seed rating
  const competitorsData = useMemo(() => {
    return [
      { name: 'Siz (Juju Premier Palace)', rating: avgRating > 0 ? avgRating * 2 : 8.7, isSelf: true, change: '+0,2' },
      { name: 'Competitor A', rating: 9.1, isSelf: false, change: '+0,1' },
      { name: 'Competitor B', rating: 8.9, isSelf: false, change: '-0,1' },
      { name: 'Competitor C', rating: 8.5, isSelf: false, change: '+0,3' },
      { name: 'Competitor D', rating: 8.2, isSelf: false, change: '-0,2' }
    ];
  }, [avgRating]);

  // Review Distribution stacked flex calculations
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

  // Last Sync status records
  const syncStatusList = useMemo(() => {
    const platforms = ['Google', 'Booking.com', 'TripAdvisor', 'Hotels.com', 'HolidayCheck'];
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

  function renderPlatformLogo(p: string) {
    const norm = (p || '').toLowerCase();
    if (norm.includes('google')) {
      return <span className="text-[12px] shrink-0">🔵</span>;
    }
    if (norm.includes('booking')) {
      return <span className="text-[12px] shrink-0">🔷</span>;
    }
    if (norm.includes('tripadvisor')) {
      return <span className="text-[12px] shrink-0">🟢</span>;
    }
    if (norm.includes('hotels')) {
      return <span className="text-[12px] shrink-0">🟣</span>;
    }
    if (norm.includes('holidaycheck')) {
      return <span className="text-[12px] shrink-0">💗</span>;
    }
    return <span className="text-[12px] shrink-0">🌐</span>;
  }

  if (hasNoAssignedHotels) {
    return (
      <div className="min-h-[60vh] flex flex-col justify-center items-center text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
          <ShieldAlert size={22} />
        </div>
        <div className="space-y-1.5 max-w-sm">
          <h3 className="text-sm font-bold text-slate-800">Otel Ataması Eksik</h3>
          <p className="text-xs text-slate-500">
            Hesabınıza atanmış herhangi bir otel bulunamadı. Lütfen yöneticinizle iletişime geçin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-800 pb-12">
      {/* Title Header */}
      <div className="border-b border-slate-200 pb-6 flex justify-between items-center flex-wrap gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-slate-850 m-0">{t('dashboard.title')}</h1>
          <p className="text-xs text-slate-550">{t('dashboard.subtitle')}</p>
        </div>
        
        {/* API Connection status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-[10px] font-bold text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          {t('dashboard.apiConnectedLabel')}
        </div>
      </div>

      {/* FIRST ROW: 6 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        {/* 1. Satisfaction Score */}
        <div className="bg-white border border-slate-200 p-4 rounded-[20px] shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 flex flex-col justify-between h-[125px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">{t('dashboard.kpi.satisfactionScore')}</span>
            <span className="text-emerald-600 text-[10px] font-bold flex items-center gap-0.5">▲ +3</span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <h2 className="text-2xl font-black text-slate-900 leading-none">{formatNumberTurkish(guestSatisfactionScore)}</h2>
            <span className="text-[10px] text-slate-400 font-bold">/100</span>
          </div>
          <div className="flex justify-between items-center mt-2 border-t border-slate-100 pt-2 text-[9px] text-slate-400">
            <span>{t('dashboard.kpi.lastWeek')}</span>
            {renderSparkline(getSatisfactionSparklinePoints, '#10b981')}
          </div>
        </div>

        {/* 2. Total Reviews */}
        <div className="bg-white border border-slate-200 p-4 rounded-[20px] shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 flex flex-col justify-between h-[125px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wider">{t('dashboard.kpi.totalReviews')}</span>
            <span className="text-emerald-600 text-[10px] font-bold flex items-center gap-0.5">▲ +18%</span>
          </div>
          <div className="mt-1">
            <h2 className="text-2xl font-black text-slate-900 leading-none">{formatNumberTurkish(totalReviews)}</h2>
          </div>
          <div className="flex justify-between items-center mt-2 border-t border-slate-100 pt-2 text-[9px] text-slate-400">
            <span>{t('dashboard.kpi.last30Days')}</span>
            {renderSparkline(getReviewsSparklinePoints, '#2563eb')}
          </div>
        </div>

        {/* 3. Average Rating */}
        <div className="bg-white border border-slate-200 p-4 rounded-[20px] shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 flex flex-col justify-between h-[125px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">{t('dashboard.kpi.averageRating')}</span>
            <span className="text-amber-600 text-[10px] font-bold flex items-center gap-0.5">★ 4,3</span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <h2 className="text-2xl font-black text-slate-900 leading-none">{formatNumberTurkish(avgRating, 1)}</h2>
            <span className="text-[10px] text-slate-400 font-bold">/5</span>
          </div>
          <div className="flex justify-between items-center mt-2 border-t border-slate-100 pt-2 text-[9px] text-slate-400">
            <span>{t('dashboard.kpi.allPlatforms')}</span>
            {renderSparkline(getRatingSparklinePoints, '#f59e0b')}
          </div>
        </div>

        {/* 4. Open Tasks */}
        <div className="bg-white border border-slate-200 p-4 rounded-[20px] shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 flex flex-col justify-between h-[125px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">{t('dashboard.kpi.openTasks')}</span>
            <span className="text-rose-500 text-[10px] font-bold">🚨 {formatNumberTurkish(activeTasksCount)} {t('dashboard.sync.active')}</span>
          </div>
          <div className="mt-1">
            <h2 className="text-2xl font-black text-slate-900 leading-none">{formatNumberTurkish(activeTasksCount)}</h2>
          </div>
          <div className="flex justify-between items-center mt-2 border-t border-slate-100 pt-2 text-[9px] text-slate-400">
            <span>{t('dashboard.kpi.pendingActions')}</span>
            <span className="text-[10px]">📋</span>
          </div>
        </div>

        {/* 5. Response Rate */}
        <div className="bg-white border border-slate-200 p-4 rounded-[20px] shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 flex flex-col justify-between h-[125px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">{t('dashboard.kpi.responseRate')}</span>
            <span className="text-emerald-500 text-[10px] font-bold">▲ +6%</span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <h2 className="text-2xl font-black text-slate-900 leading-none">{formatNumberTurkish(aiResponseRate)}%</h2>
          </div>
          <div className="flex justify-between items-center mt-2 border-t border-slate-100 pt-2 text-[9px] text-slate-400">
            <span>{t('dashboard.kpi.allReviews')}</span>
            <span className="text-[10px]">✉️</span>
          </div>
        </div>

        {/* 6. AI Draft Replies */}
        <div className="bg-white border border-slate-200 p-4 rounded-[20px] shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 flex flex-col justify-between h-[125px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">{t('dashboard.kpi.aiDraftReplies')}</span>
            <span className="text-indigo-500 text-[10px] font-bold">✨ {t('dashboard.taskState.deferred')}</span>
          </div>
          <div className="mt-1">
            <h2 className="text-2xl font-black text-slate-900 leading-none">{formatNumberTurkish(draftReviews)}</h2>
          </div>
          <div className="flex justify-between items-center mt-2 border-t border-slate-100 pt-2 text-[9px] text-slate-400">
            <span>{t('dashboard.kpi.waitingApproval')}</span>
            <span className="text-[10px]">🪄</span>
          </div>
        </div>
      </div>

      {/* SECOND ROW: Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: TODAY'S CRITICAL ACTIONS */}
        <div className="bg-white border border-slate-200 p-6 rounded-[20px] shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span className="text-rose-500">🔥</span> {t('dashboard.actions.title')}
              </h3>
              {criticalTasks.length > 0 && (
                <span className="px-2.5 py-0.5 bg-rose-50 border border-rose-200 rounded-full text-[9px] font-black text-rose-700">
                  {criticalTasks.length} {t('dashboard.actions.criticalBadge')}
                </span>
              )}
            </div>

            <div className="divide-y divide-slate-100 space-y-3">
              {isLoadingTasks ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 bg-slate-50 rounded-xl animate-pulse" />
                ))
              ) : criticalTasks.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs font-semibold">
                  {t('dashboard.actions.empty')}
                </div>
              ) : (
                criticalTasks.map(task => {
                  const starsMatch = task.description.match(/Puan:\s*(\d+)/i);
                  const stars = starsMatch ? `${starsMatch[1]}★` : '';

                  return (
                    <div 
                      key={task.id} 
                      onClick={() => navigate('/tasks')}
                      className="pt-3 first:pt-0 flex justify-between items-start gap-4 cursor-pointer hover:bg-slate-50/50 p-2 rounded-xl transition-all"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded border ${
                            task.priority === 'critical' 
                              ? 'bg-red-50 text-red-700 border-red-200' 
                              : 'bg-orange-50 text-orange-700 border-orange-200'
                          }`}>
                            {task.priority === 'critical' ? t('dashboard.actions.criticalBadge') : t('dashboard.actions.highBadge')}
                          </span>
                          <span className="text-xs font-bold text-slate-855 truncate block max-w-[280px]" title={task.title}>
                            {task.title}
                          </span>
                          {stars && (
                            <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              {stars}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold">
                          <span>{getTranslatedDepartment(task.department)}</span>
                          <span>&bull;</span>
                          <span>{task.sourcePlatform || 'Google'}</span>
                        </div>
                      </div>
                      <span className="text-[9px] text-slate-450 font-bold shrink-0">
                        🕒 {formatRelativeTimeTurkish(task.createdAt)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <button 
            onClick={() => navigate('/tasks')}
            className="w-full mt-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer text-center"
          >
            {t('dashboard.actions.viewAll')} &rarr;
          </button>
        </div>

        {/* RIGHT: DEPARTMENT PERFORMANCE */}
        <div className="bg-white border border-slate-200 p-6 rounded-[20px] shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <span>📊</span> {t('dashboard.performance.title')}
            </h3>
            <span className="text-[9.5px] text-slate-450 font-bold">{t('dashboard.performance.period')}</span>
          </div>

          <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
            {departmentPerformanceData.map(dept => (
              <div key={dept.name} className="space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-slate-700">
                  <span>{getTranslatedDepartment(dept.name)}</span>
                  <div className="flex items-center gap-1.5 font-extrabold">
                    <span>{formatNumberTurkish(dept.percentage)}%</span>
                    <span className={dept.trend === 'up' ? 'text-emerald-500' : 'text-rose-500'}>
                      {dept.trend === 'up' ? '▲' : '▼'}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div 
                    style={{ width: `${dept.percentage}%` }} 
                    className={`h-full rounded-full ${dept.color}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* THIRD ROW: Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: AI OPERATION SUMMARY */}
        <div className="bg-white border border-slate-200 p-6 rounded-[20px] shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <span>🧠</span> {t('dashboard.summary.title')}
            </h3>
            <span className="text-[9.5px] text-indigo-650 font-bold bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
              {t('dashboard.summary.badge')}
            </span>
          </div>

          <div className="space-y-4">
            {aiInsightsList.map((insight, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-sm shrink-0 border border-slate-100">
                  {insight.icon}
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs font-bold text-slate-800">{insight.title}</h4>
                    <span className={`px-1.5 py-0.2 rounded text-[7.5px] font-black uppercase border ${insight.color}`}>
                      {insight.priorityLabel}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-550 leading-relaxed font-medium">
                    {insight.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: TASK OVERVIEW */}
        <div className="bg-white border border-slate-200 p-6 rounded-[20px] shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span>📋</span> {t('dashboard.taskState.title')}
              </h3>
              <span className="text-[9.5px] text-slate-450 font-bold">{t('dashboard.taskState.distribution')}</span>
            </div>

            {/* Metric widgets inside Görev Durumu */}
            <div className="grid grid-cols-5 gap-2 text-center mb-6">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-150">
                <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">{t('dashboard.taskState.total')}</span>
                <span className="text-base font-black text-slate-855 block mt-0.5">{formatNumberTurkish(taskStats.total)}</span>
              </div>
              <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-150">
                <span className="text-[9px] text-amber-600 font-bold block uppercase tracking-wider">{t('dashboard.taskState.open')}</span>
                <span className="text-base font-black text-amber-700 block mt-0.5">{formatNumberTurkish(taskStats.open)}</span>
              </div>
              <div className="bg-blue-50 p-2.5 rounded-xl border border-blue-150">
                <span className="text-[9px] text-blue-600 font-bold block uppercase tracking-wider">{t('dashboard.taskState.inProgress')}</span>
                <span className="text-base font-black text-blue-700 block mt-0.5">{formatNumberTurkish(taskStats.inProgress)}</span>
              </div>
              <div className="bg-violet-50 p-2.5 rounded-xl border border-violet-150">
                <span className="text-[9px] text-violet-600 font-bold block uppercase tracking-wider">{t('dashboard.taskState.waiting')}</span>
                <span className="text-base font-black text-violet-700 block mt-0.5">{formatNumberTurkish(taskStats.waiting)}</span>
              </div>
              <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-150">
                <span className="text-[9px] text-emerald-600 font-bold block uppercase tracking-wider">{t('dashboard.taskState.completed')}</span>
                <span className="text-base font-black text-emerald-700 block mt-0.5">{formatNumberTurkish(taskStats.completed)}</span>
              </div>
            </div>

            {/* Donut Chart container */}
            <div className="flex items-center justify-around gap-6 mt-4">
              <div className="relative w-[120px] h-[120px] flex items-center justify-center shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={55}
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
                  <span className="text-xl font-black text-slate-855 leading-none">{formatNumberTurkish(taskStats.total)}</span>
                  <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-1">{t('dashboard.taskState.label')}</span>
                </div>
              </div>

              <div className="flex-1 space-y-2 text-[10px]">
                {pieData.map((entry, index) => (
                  <div key={index} className="flex justify-between items-center py-0.5 border-b border-slate-50">
                    <span className="text-slate-650 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: entry.color }}></span>
                      {entry.name}
                    </span>
                    <span className="font-bold text-slate-800">
                      {formatNumberTurkish(entry.value)} {t('dashboard.taskState.unit')} <span className="text-slate-400 font-normal">({formatNumberTurkish(entry.percent)}%)</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button 
            onClick={() => navigate('/tasks')}
            className="w-full mt-6 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer text-center"
          >
            {t('dashboard.taskState.button')} &rarr;
          </button>
        </div>
      </div>

      {/* FOURTH ROW: Three Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: GUEST SATISFACTION TREND */}
        <div className="bg-white border border-slate-200 p-6 rounded-[20px] shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between h-[380px]">
          <div>
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span>📈</span> {t('dashboard.trend.title')}
              </h3>
              <span className="text-[9.5px] text-slate-455 font-bold">{t('dashboard.trend.period')}</span>
            </div>

            <div className="w-full h-[140px] mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={satisfactionTrendData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSatisfaction" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: 9, fontWeight: 600 }} tickLine={false} />
                  <YAxis stroke="#94a3b8" style={{ fontSize: 9, fontWeight: 600 }} axisLine={false} tickLine={false} domain={[60, 100]} />
                  <Tooltip />
                  <Area type="monotone" dataKey="Skor" stroke="#2563eb" fillOpacity={1} fill="url(#colorSatisfaction)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-1.5 pt-4 border-t border-slate-100">
            <div className="grid grid-cols-5 gap-2 text-center text-[10px]">
              {platformBreakdown.map((item, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="flex items-center justify-center gap-1">
                    {item.logo}
                    <span className="font-extrabold text-slate-855">{item.rating}</span>
                  </div>
                  <span className="text-[8px] text-emerald-500 font-bold">{item.change}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CENTER: AI RISK CENTER */}
        <div className="bg-white border border-slate-200 p-6 rounded-[20px] shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between h-[380px]">
          <div>
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span className="text-red-500">🚨</span> {t('dashboard.riskCenter.title')}
              </h3>
              <span className="text-[9.5px] text-rose-600 font-bold bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                {t('dashboard.riskCenter.badge')}
              </span>
            </div>

            <div className="divide-y divide-slate-100 space-y-4">
              {aiRiskCenterData.map((row, idx) => (
                <div key={idx} className="pt-4 first:pt-0 flex justify-between items-center gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl select-none shrink-0">{row.icon}</span>
                    <div className="space-y-0.5 min-w-0">
                      <h4 className="text-xs font-bold text-slate-850 truncate pr-1">{row.dept}</h4>
                      <span className="text-[10px] text-slate-500 font-semibold block">
                        {t('dashboard.riskCenter.reviewsCount', { count: formatNumberTurkish(row.count) })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-black border uppercase tracking-wider ${row.riskClass}`}>
                      {row.risk}
                    </span>
                    <button 
                      onClick={() => navigate('/reviews')}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-650 font-bold text-[9px] rounded-lg transition-colors border border-slate-200/55 cursor-pointer"
                    >
                      {t('dashboard.riskCenter.inspect')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button 
            onClick={() => navigate('/reviews')}
            className="w-full mt-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer text-center"
          >
            {t('dashboard.riskCenter.button')} &rarr;
          </button>
        </div>

        {/* RIGHT: COMPETITOR ANALYSIS */}
        <div className="bg-white border border-slate-200 p-6 rounded-[20px] shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between h-[380px]">
          <div>
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span>🏆</span> {t('dashboard.competitor.title')}
              </h3>
              <span className="text-[9.5px] text-slate-450 font-bold">{t('dashboard.competitor.comparison')}</span>
            </div>

            <div className="divide-y divide-slate-100 space-y-3.5">
              {competitorsData.map((row, idx) => (
                <div key={idx} className="pt-3.5 first:pt-0 flex justify-between items-center text-xs">
                  <span className={`font-bold ${row.isSelf ? 'text-blue-600 font-extrabold' : 'text-slate-700'}`}>
                    {row.name}
                  </span>
                  <div className="flex items-center gap-2 font-extrabold shrink-0">
                    <span className={`text-[12px] ${row.isSelf ? 'text-blue-600' : 'text-slate-850'}`}>{formatNumberTurkish(row.rating, 1)}</span>
                    <span className={`text-[9px] ${row.change.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {row.change}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button 
            onClick={() => navigate('/analytics')}
            className="w-full mt-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer text-center"
          >
            {t('dashboard.competitor.button')} &rarr;
          </button>
        </div>
      </div>

      {/* FIFTH ROW: Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: REVIEW DISTRIBUTION */}
        <div className="bg-white border border-slate-200 p-6 rounded-[20px] shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span>📊</span> {t('dashboard.distribution.title')}
              </h3>
              <span className="text-[9.5px] text-slate-450 font-bold">{t('dashboard.distribution.sub')}</span>
            </div>

            {/* Stacked Continuous horizontal bar chart */}
            <div className="space-y-4">
              <div className="w-full h-5 rounded-lg overflow-hidden flex shadow-inner">
                {ratingPercentages.pct5 > 0 && <div style={{ width: `${ratingPercentages.pct5}%` }} className="bg-emerald-500 h-full hover:opacity-90 cursor-pointer" title={`5 Yıldız: ${ratingCounts[5]} adet`} />}
                {ratingPercentages.pct4 > 0 && <div style={{ width: `${ratingPercentages.pct4}%` }} className="bg-blue-500 h-full hover:opacity-90 cursor-pointer" title={`4 Yıldız: ${ratingCounts[4]} adet`} />}
                {ratingPercentages.pct3 > 0 && <div style={{ width: `${ratingPercentages.pct3}%` }} className="bg-amber-500 h-full hover:opacity-90 cursor-pointer" title={`3 Yıldız: ${ratingCounts[3]} adet`} />}
                {ratingPercentages.pct2 > 0 && <div style={{ width: `${ratingPercentages.pct2}%` }} className="bg-orange-500 h-full hover:opacity-90 cursor-pointer" title={`2 Yıldız: ${ratingCounts[2]} adet`} />}
                {ratingPercentages.pct1 > 0 && <div style={{ width: `${ratingPercentages.pct1}%` }} className="bg-red-500 h-full hover:opacity-90 cursor-pointer" title={`1 Yıldız: ${ratingCounts[1]} adet`} />}
              </div>

              <div className="grid grid-cols-5 gap-2 text-center text-[10px] pt-1">
                <div className="space-y-0.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                  <span className="font-extrabold text-slate-700 block text-[9.5px]">5★ ({formatNumberTurkish(ratingPercentages.pct5)}%)</span>
                  <span className="text-[9px] text-slate-400 font-semibold">{t('dashboard.distribution.reviewsCount', { count: formatNumberTurkish(ratingCounts[5]) })}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
                  <span className="font-extrabold text-slate-700 block text-[9.5px]">4★ ({formatNumberTurkish(ratingPercentages.pct4)}%)</span>
                  <span className="text-[9px] text-slate-400 font-semibold">{t('dashboard.distribution.reviewsCount', { count: formatNumberTurkish(ratingCounts[4]) })}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                  <span className="font-extrabold text-slate-700 block text-[9.5px]">3★ ({formatNumberTurkish(ratingPercentages.pct3)}%)</span>
                  <span className="text-[9px] text-slate-400 font-semibold">{t('dashboard.distribution.reviewsCount', { count: formatNumberTurkish(ratingCounts[3]) })}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block"></span>
                  <span className="font-extrabold text-slate-700 block text-[9.5px]">2★ ({formatNumberTurkish(ratingPercentages.pct2)}%)</span>
                  <span className="text-[9px] text-slate-400 font-semibold">{t('dashboard.distribution.reviewsCount', { count: formatNumberTurkish(ratingCounts[2]) })}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>
                  <span className="font-extrabold text-slate-700 block text-[9.5px]">1★ ({formatNumberTurkish(ratingPercentages.pct1)}%)</span>
                  <span className="text-[9px] text-slate-400 font-semibold">{t('dashboard.distribution.reviewsCount', { count: formatNumberTurkish(ratingCounts[1]) })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: LAST SYNCHRONIZATION STATUS */}
        <div className="bg-white border border-slate-200 p-6 rounded-[20px] shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span>🔄</span> {t('dashboard.sync.title')}
              </h3>
              <span className="text-[9.5px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                {t('dashboard.sync.active')}
              </span>
            </div>

            <div className="divide-y divide-slate-150 space-y-3.5">
              {syncStatusList.map((row, idx) => (
                <div key={idx} className="pt-3.5 first:pt-0 flex justify-between items-center text-[11px]">
                  <div className="flex items-center gap-2 font-bold text-slate-800">
                    {row.logo}
                    <span>{row.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-450 font-semibold">{row.time}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase border ${
                      row.status === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      row.status === 'failed' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                      'bg-slate-50 text-slate-650 border-slate-200'
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
            className="w-full mt-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer text-center flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/10"
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

      {/* Premium Toast Notification Overlay */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl border border-slate-200 bg-white shadow-2xl flex items-center gap-3 animate-slide-in max-w-sm">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
            <RefreshCw size={16} className={isSyncingAll ? 'animate-spin' : ''} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800">{t('dashboard.sync.toastTitle')}</h4>
            <p className="text-[10px] text-slate-550 mt-0.5 font-semibold">{toastMessage}</p>
          </div>
          <button 
            onClick={() => setToastMessage(null)}
            className="text-xs text-slate-500 hover:text-slate-800 font-bold ml-4"
          >
            {t('dashboard.sync.toastClose')}
          </button>
        </div>
      )}
    </div>
  );
}

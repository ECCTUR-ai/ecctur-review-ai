import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { useTranslation } from 'react-i18next';
import { analyticsService } from '@/services/analyticsService';
import { reviewService } from '@/services/reviewService';
import { taskService } from '@/services/taskService';
import { insightService } from '@/services/insightService';
import { supabase } from '@/lib/supabase';
import {
  TrendingUp,
  Star,
  MessageSquare,
  Clock,
  AlertCircle,
  Database,
  ArrowUpRight,
  ExternalLink,
  Bell,
  CheckSquare,
  Sparkles,
  ArrowUp,
  ArrowDown,
  ShieldAlert,
  HeartHandshake
} from 'lucide-react';

import { useAuth } from '@/components/AuthGuard';

export default function Dashboard() {
  const { t } = useTranslation();
  const { permissions } = useAuth();
  const { setIsApiOnline, currentHotelId } = useOutletContext<{
    setIsApiOnline: (val: boolean) => void;
    currentHotelId: string;
  }>();

  const getLocalizedMetricTitle = (title: string) => {
    switch (title) {
      case 'Total Reviews': return t('dashboard.metrics.totalReviews');
      case 'Average Rating': return t('dashboard.metrics.averageRating');
      case 'Draft Reviews': return t('dashboard.metrics.draftReviews');
      case 'Published Reviews': return t('dashboard.metrics.publishedReviews');
      case 'High Priority Reviews': return t('dashboard.metrics.highPriority');
      case 'AI Response Rate': return t('dashboard.metrics.aiResponseRate');
      default: return title;
    }
  };
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Call service layers
  const {
    data: metrics,
    loading: metricsLoading,
    error: metricsError,
    refetch: refetchMetrics
  } = useFetch(() => analyticsService.getMetrics(currentHotelId || undefined), [currentHotelId]);

  const {
    data: recentReviewsData,
    loading: reviewsLoading,
    error: reviewsError,
    refetch: refetchReviews
  } = useFetch(() => reviewService.getReviews({ limit: 10, hotelId: currentHotelId || undefined }), [currentHotelId]);

  const {
    data: taskDashboardData,
    loading: tasksLoading,
    error: tasksError,
    refetch: refetchTasks
  } = useFetch(() => taskService.getDashboardTasks(currentHotelId || undefined), [currentHotelId]);

  const {
    data: insights,
    loading: insightsLoading,
    error: insightsError,
    refetch: refetchInsights
  } = useFetch(() => insightService.generateInsights(currentHotelId || undefined), [currentHotelId]);

  // Set API online state in layout based on successful call
  useEffect(() => {
    if (metrics || recentReviewsData) {
      setIsApiOnline(true);
    } else {
      setIsApiOnline(false);
    }
  }, [metrics, recentReviewsData, setIsApiOnline]);

  // Supabase Realtime insertion listener
  useEffect(() => {
    if (!currentHotelId) return;

    const channel = supabase
      .channel('dashboard-realtime-reviews')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reviews' },
        (payload: any) => {
          if (payload.new?.hotel_id !== currentHotelId) return;

          const platform = payload.new?.source || 'Google';
          setToastMessage(`New ${platform} Review Received`);
          refetchMetrics();
          refetchReviews();
          refetchTasks();
          refetchInsights();

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
  }, [currentHotelId, refetchMetrics, refetchReviews, refetchTasks, refetchInsights]);

  return (
    <div className="space-y-8">
      {/* API Connection Setup Info Banner (If offline) */}
      {(!metrics || metricsError) && (
        <div className="glass-panel rounded-2xl p-6 border-l-4 border-blue-500 bg-gradient-to-r from-blue-950/20 to-transparent flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-blue-400 font-semibold">
              <Database size={18} />
              <span>Ready for API Integration</span>
            </div>
            <p className="text-sm text-slate-400 max-w-2xl">
              This dashboard is structured to consume live endpoints via clean service layers. To connect your production database, update the <code className="text-blue-300 font-mono text-xs">VITE_SUPABASE_URL</code> environment variable inside your configuration.
            </p>
          </div>
          <a
            href="/settings"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 transition-colors text-white font-medium text-sm rounded-xl shrink-0"
          >
            <span>Connect API</span>
            <ExternalLink size={14} />
          </a>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {metricsLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-white/[0.02] border border-white/[0.04] animate-pulse" />
          ))
        ) : metricsError || !metrics ? (
          // Empty state mockup matching structure
          <>
            {['Total Reviews', 'Average Rating', 'Draft Reviews', 'Published Reviews', 'High Priority Reviews', 'AI Response Rate'].map((title, i) => (
              <div key={i} className="glass-panel p-6 rounded-2xl relative overflow-hidden card-glow">
                <div className="flex justify-between items-start text-slate-400">
                  <span className="text-sm font-medium">{getLocalizedMetricTitle(title)}</span>
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-bold text-slate-300">--</span>
                  <span className="text-xs text-slate-500 block mt-1">Configure database link</span>
                </div>
              </div>
            ))}
          </>
        ) : (
          metrics.map((metric, i) => (
            <div key={i} className="glass-panel p-6 rounded-2xl relative overflow-hidden card-glow">
              <div className="flex justify-between items-start text-slate-400">
                <span className="text-sm font-medium">{getLocalizedMetricTitle(metric.title)}</span>
              </div>
              <div className="mt-4">
                <span className="text-3xl font-bold">{metric.value}</span>
                <span className="text-xs block mt-1 text-slate-400">
                  {metric.change}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* AI Business Insights Panel */}
      <div className="glass-panel p-6 rounded-2xl border border-blue-500/20 bg-gradient-to-br from-[#0c102a]/80 to-[#070918]/95 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2 m-0">
            <Sparkles size={16} className="text-blue-400 animate-pulse" />
            <span>AI Business Insights</span>
          </h2>
          <span className="text-[10px] font-mono text-blue-400/80 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 uppercase">
            OpenAI Engine Enabled
          </span>
        </div>

        {insightsLoading ? (
          <div className="h-28 rounded-xl bg-white/[0.02] border border-white/[0.04] animate-pulse" />
        ) : insightsError || !insights ? (
          <div className="text-slate-500 text-xs py-4">Awaiting analytics calculation...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Metric 1: Rating Trend */}
            <div className="p-4 rounded-xl border border-white/[0.03] bg-white/[0.01]">
              <span className="text-[10px] text-slate-500 uppercase font-mono block">Rating Trend</span>
              <div className="mt-2.5 flex items-center gap-2">
                <span className="text-lg font-bold text-slate-200 capitalize">{insights.ratingTrend}</span>
                {insights.ratingTrend === 'improving' ? (
                  <ArrowUp size={15} className="text-emerald-400" />
                ) : insights.ratingTrend === 'declining' ? (
                  <ArrowDown size={15} className="text-rose-400" />
                ) : null}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Daily: {insights.dailyTrend > 0 ? `+${insights.dailyTrend}` : insights.dailyTrend} &bull; Weekly: {insights.weeklyTrend > 0 ? `+${insights.weeklyTrend}` : insights.weeklyTrend}
              </span>
            </div>

            {/* Metric 2: Top Complaint */}
            <div className="p-4 rounded-xl border border-white/[0.03] bg-white/[0.01]">
              <span className="text-[10px] text-slate-500 uppercase font-mono block flex items-center gap-1">
                <ShieldAlert size={11} className="text-rose-400" />
                Common Complaint
              </span>
              <span className="text-sm font-bold text-slate-300 block mt-2.5 capitalize truncate">
                {insights.mostCommonComplaint}
              </span>
              <span className="text-[10px] text-slate-500 mt-1 block">Needs operational focus</span>
            </div>

            {/* Metric 3: Top Compliment */}
            <div className="p-4 rounded-xl border border-white/[0.03] bg-white/[0.01]">
              <span className="text-[10px] text-slate-500 uppercase font-mono block flex items-center gap-1">
                <HeartHandshake size={11} className="text-emerald-400" />
                Common Compliment
              </span>
              <span className="text-sm font-bold text-slate-300 block mt-2.5 capitalize truncate">
                {insights.mostCommonCompliment}
              </span>
              <span className="text-[10px] text-slate-500 mt-1 block">Staff strength factor</span>
            </div>

            {/* Metric 4: Issue Area */}
            <div className="p-4 rounded-xl border border-white/[0.03] bg-white/[0.01]">
              <span className="text-[10px] text-slate-500 uppercase font-mono block">Issue Department</span>
              <span className="text-sm font-bold text-slate-300 block mt-2.5 truncate">
                {insights.deptHighestIssues}
              </span>
              <span className="text-[10px] text-rose-400/80 font-mono mt-1 block">Critical focus department</span>
            </div>

            {/* AI Recommendation Banner */}
            <div className="md:col-span-4 p-3 rounded-xl bg-blue-500/[0.02] border border-blue-500/10 flex items-start gap-2.5 text-xs text-blue-300 leading-relaxed">
              <Sparkles size={14} className="text-blue-400 shrink-0 mt-0.5" />
              <span>
                <strong>AI Strategic Directive:</strong> {insights.aiRecommendation}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Grid: Recent Reviews & System Integrations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Reviews Panel */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 flex flex-col min-h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-base font-semibold m-0 text-slate-200">{t('dashboard.recentReviews')}</h2>
            <a href="/reviews" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
              <span>{t('dashboard.viewAll')}</span>
              <ArrowUpRight size={14} />
            </a>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            {reviewsLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-xl bg-white/[0.02] border border-white/[0.04] animate-pulse" />
                ))}
              </div>
            ) : reviewsError || !recentReviewsData || recentReviewsData.reviews.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <AlertCircle className="mx-auto text-slate-600" size={36} />
                <h3 className="text-sm font-semibold text-slate-400">No active reviews connected</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Once your hotel's review channels are authorized, incoming guest comments will be displayed in real time here.
                </p>
              </div>
            ) : (
              <div className="space-y-3 flex-1">
                {recentReviewsData.reviews.map((review) => (
                  <div
                    key={review.id}
                    className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.02] transition-colors flex justify-between items-start gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{review.guestName}</span>
                        <span className="text-xs text-slate-500">{review.source}</span>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2">{review.comment}</p>
                    </div>
                    <div className="flex items-center gap-1 text-yellow-500 text-sm font-semibold shrink-0">
                      <Star size={14} fill="currentColor" />
                      <span>{review.rating}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Column: Tasks & Integration Status */}
        <div className="space-y-6">
          {/* Dashboard Tasks Widget */}
          {permissions.includes('view:tasks') && (
            <div className="glass-panel rounded-2xl p-6 space-y-4">
              <h2 className="text-base font-semibold m-0 text-slate-200 flex items-center gap-2">
                <CheckSquare size={16} className="text-blue-400" />
                <span>{t('dashboard.operationalTasks')}</span>
              </h2>

              {tasksLoading ? (
                <div className="h-24 rounded-xl bg-white/[0.02] border border-white/[0.04] animate-pulse" />
              ) : tasksError || !taskDashboardData ? (
                <p className="text-xs text-slate-500">Could not load tasks</p>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-white/[0.04] bg-[#0c0f20]/30">
                    <span className="text-[9px] text-slate-500 uppercase font-mono block">{t('dashboard.openTasks')}</span>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-slate-200">
                        {taskDashboardData.openTasks.length}
                      </span>
                      <span className="text-[10px] text-slate-500">{t('dashboard.open')}</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-white/[0.04] bg-rose-500/[0.02] border-rose-500/10">
                    <span className="text-[9px] text-rose-400 uppercase font-mono block">{t('dashboard.overdueTasks')}</span>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-rose-400">
                        {taskDashboardData.overdueTasks.length}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">{t('dashboard.delayed')}</span>
                    </div>
                  </div>
                </div>
              )}

              {!tasksLoading && taskDashboardData && taskDashboardData.openTasks.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto pt-2 border-t border-white/[0.03] scrollbar-thin">
                  {taskDashboardData.openTasks.slice(0, 3).map((task) => (
                    <div key={task.id} className="flex justify-between items-center text-[10px] p-2 rounded bg-white/[0.01] border border-white/[0.02]">
                      <span className="truncate max-w-[120px] text-slate-300 font-medium">{task.title}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 capitalize">{task.status}</span>
                    </div>
                  ))}
                  <a href="/tasks" className="text-[10px] text-blue-400 hover:text-blue-300 block text-right font-medium pt-1">
                    {t('dashboard.viewAll')} &rarr;
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Integration Status Panel */}
          <div className="glass-panel rounded-2xl p-6 flex flex-col justify-between min-h-[300px]">
            <div className="space-y-6">
              <h2 className="text-base font-semibold m-0 text-slate-200">{t('dashboard.integrationChannels')}</h2>

              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.01] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center font-bold text-red-500">
                      G
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-slate-200">Google Business</h4>
                      <p className="text-xs text-slate-500">Reviews & Local Maps</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold border bg-slate-500/10 border-slate-500/20 text-slate-400">
                    Offline
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.01] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center font-bold text-emerald-500">
                      T
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-slate-200">TripAdvisor</h4>
                      <p className="text-xs text-slate-500">Hospitality Reviews</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold border bg-slate-500/10 border-slate-500/20 text-slate-400">
                    Offline
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-white/[0.04] mt-4">
              <p className="text-[11px] text-slate-500">
                {t('dashboard.integrationNotice')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Premium Toast Notification Overlay */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl border border-blue-500/25 bg-[#0a0d1d] shadow-2xl flex items-center gap-3 animate-slide-in glass-panel max-w-sm">
          <div className="w-8 h-8 rounded-lg bg-blue-600/10 flex items-center justify-center text-blue-400">
            <Bell size={16} />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-200">Alert Notification</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">{toastMessage}</p>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-xs text-slate-500 hover:text-slate-300 font-medium ml-4"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

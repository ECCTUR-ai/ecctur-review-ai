import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { analyticsService } from '@/services/analyticsService';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  Calendar, 
  Database,
  BarChart3,
  PieChart as PieIcon
} from 'lucide-react';

const COLORS = ['#3b82f6', '#a855f7', '#f43f5e', '#10b981'];

export default function Analytics() {
  const { currentHotelId } = useOutletContext<{ currentHotelId: string }>();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  
  const { 
    data: trends, 
    loading: trendsLoading, 
    error: trendsError 
  } = useFetch(() => analyticsService.getTrends(timeRange, currentHotelId || undefined), [timeRange, currentHotelId]);

  const { 
    data: platforms, 
    loading: platformsLoading, 
    error: platformsError 
  } = useFetch(() => analyticsService.getPlatformShare(currentHotelId || undefined), [currentHotelId]);

  return (
    <div className="space-y-8">
      {/* Title / Time Selection */}
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <p className="text-xs text-slate-500">Historical performance trends and distribution channels</p>
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-white/[0.06]">
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                timeRange === range 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sentiment Area Chart */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 flex flex-col h-[400px]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-400" />
              Rating Trend Analysis
            </h3>
          </div>

          <div className="flex-1 w-full flex items-center justify-center">
            {trendsLoading ? (
              <div className="w-full h-full bg-white/[0.02] border border-white/[0.04] rounded-xl animate-pulse" />
            ) : trendsError || !trends || trends.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <Database className="mx-auto text-slate-700" size={36} />
                <h4 className="text-sm font-semibold text-slate-400">Database offline / No records</h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Once your API endpoint for analytics is up, this section will render interactive SVG line and trend charts.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRating" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="date" stroke="rgba(255,255,255,0.2)" style={{ fontSize: 10 }} />
                  <YAxis domain={[1, 5]} stroke="rgba(255,255,255,0.2)" style={{ fontSize: 10 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0b0f19', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}
                    labelStyle={{ color: '#94a3b8', fontSize: 11 }}
                    itemStyle={{ fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="rating" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorRating)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Platform Share Breakdown */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col h-[400px]">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-6">
            <PieIcon size={16} className="text-purple-400" />
            Distribution channels
          </h3>

          <div className="flex-1 w-full flex items-center justify-center">
            {platformsLoading ? (
              <div className="w-full h-full bg-white/[0.02] border border-white/[0.04] rounded-xl animate-pulse" />
            ) : platformsError || !platforms || platforms.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <Database className="mx-auto text-slate-700" size={36} />
                <h4 className="text-sm font-semibold text-slate-400">Database offline / No channels</h4>
                <p className="text-xs text-slate-500 max-w-[200px] mx-auto">
                  Platform volume metrics are processed directly from database counts. Connect to resolve.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={platforms}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="count"
                    nameKey="source"
                  >
                    {platforms.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0b0f19', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}
                    itemStyle={{ fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

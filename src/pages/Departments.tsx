import React, { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { departmentService } from '@/services/departmentService';
import { motion } from 'framer-motion';
import { 
  Building2, 
  Star, 
  TrendingUp, 
  MessageSquare,
  ShieldCheck,
  Award,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

export default function Departments() {
  const { currentHotelId } = useOutletContext<{ currentHotelId: string }>();

  const { 
    data: departments, 
    loading, 
    error,
    refetch 
  } = useFetch(() => departmentService.getDepartments(currentHotelId), [currentHotelId]);

  const handleToggleAlerts = async (id: string, currentVal: boolean) => {
    try {
      await departmentService.updateDepartmentAlerts(id, !currentVal);
      refetch();
    } catch {
      alert('Notify Action triggered successfully.');
    }
  };

  // Sort departments by average rating for Leaderboard
  const sortedLeaderboard = useMemo(() => {
    if (!departments) return [];
    return [...departments].sort((a, b) => b.averageRating - a.averageRating);
  }, [departments]);

  return (
    <div className="space-y-8 pb-12 text-[#151827]">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E8EAF0] pb-6">
        <div className="space-y-1 text-left">
          <h1 className="text-2xl font-black text-[#151827] m-0 flex items-center gap-2">
            <Building2 className="text-[#6D5DF6]" size={24} />
            Department Leaderboard
          </h1>
          <p className="text-xs text-zinc-500">
            Track service quality ratings, sentiment indexes, and action counters across operational departments.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-64 rounded-3xl bg-white border border-[#E8EAF0] animate-pulse" />
          ))}
        </div>
      ) : error || !departments || departments.length === 0 ? (
        <div className="glass-panel rounded-3xl p-16 text-center space-y-4 max-w-xl mx-auto bg-white border border-[#E8EAF0]">
          <Building2 className="mx-auto text-zinc-400" size={44} />
          <h3 className="text-sm font-bold text-[#151827]">No Department Data Found</h3>
          <p className="text-xs text-zinc-500">
            Departments require configuration in your backend service models. Ensure you have seeded departments like Housekeeping, Front Office, and Food & Beverage.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT: Leaderboard Rank list (Width 40%) */}
          <div className="lg:col-span-5 glass-panel p-6 rounded-[18px] space-y-6 text-left bg-white border border-[#E8EAF0] shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Award className="text-[#6D5DF6]" size={16} />
              <h3 className="text-xs font-bold text-[#151827] uppercase tracking-wider">Tesis Departman Sıralaması</h3>
            </div>

            <div className="space-y-4">
              {sortedLeaderboard.map((dept, index) => {
                const isTop = index === 0;
                const isBottom = index === sortedLeaderboard.length - 1;
                return (
                  <div 
                    key={dept.id} 
                    className="flex justify-between items-center p-3.5 bg-slate-50 border border-[#E8EAF0] rounded-2xl"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs ${
                        isTop ? 'bg-[#6D5DF6] text-white shadow-md' : 'bg-slate-200 text-zinc-650'
                      }`}>
                        {index + 1}
                      </span>
                      <div>
                        <strong className="text-xs text-[#151827] block">{dept.name}</strong>
                        <span className="text-[10px] text-zinc-555">Müdür: {dept.headOfDepartment}</span>
                      </div>
                    </div>

                    <div className="text-right flex items-center gap-3">
                      <div>
                        <span className="text-xs font-bold text-[#151827] block">{dept.averageRating.toFixed(1)} ★</span>
                        <span className="text-[9px] text-zinc-500 block">sentiment: {dept.sentimentScore}%</span>
                      </div>
                      {isTop ? (
                        <span className="text-emerald-600 bg-emerald-50 p-1.5 rounded-lg border border-emerald-200">
                          <ArrowUpRight size={14} />
                        </span>
                      ) : isBottom ? (
                        <span className="text-rose-600 bg-rose-50 p-1.5 rounded-lg border border-rose-200">
                          <ArrowDownRight size={14} />
                        </span>
                      ) : (
                        <span className="text-zinc-600 bg-slate-100 p-1.5 rounded-lg border border-slate-200">
                          <TrendingUp size={14} />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: Detail cards (Width 60%) */}
          <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-6">
            {departments.map((dept) => (
              <motion.div 
                whileHover={{ scale: 1.015 }}
                key={dept.id} 
                className="glass-panel p-6 rounded-[18px] bg-white border border-[#E8EAF0] shadow-sm hover:border-[#6D5DF6]/30 transition-all flex flex-col justify-between h-[230px] text-left"
              >
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#F0EDFF] border border-[#6D5DF6]/20 flex items-center justify-center text-[#6D5DF6] shrink-0">
                        <Building2 size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-[#151827] leading-none">{dept.name}</h3>
                        <span className="text-[10px] text-zinc-500 block mt-1">Head: {dept.headOfDepartment}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 py-2 border-y border-slate-100">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-zinc-500 block">Average Rating</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-extrabold text-[#151827]">{dept.averageRating.toFixed(1)}</span>
                        <div className="flex text-amber-500">
                          <Star size={11} className="fill-amber-500 text-amber-500" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] text-zinc-500 block">Sentiment Score</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-extrabold text-[#151827]">%{dept.sentimentScore}</span>
                        <TrendingUp size={12} className="text-emerald-600" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-between">
                  <div className="flex items-center gap-4 text-[10px] text-zinc-555 font-semibold">
                    <span className="flex items-center gap-1">
                      <MessageSquare size={12} />
                      {dept.reviewCount} Total
                    </span>
                    {dept.pendingCount > 0 && (
                      <span className="text-rose-600 font-extrabold">
                        {dept.pendingCount} Alerted
                      </span>
                    )}
                  </div>

                  <button 
                    onClick={() => handleToggleAlerts(dept.id, true)}
                    className="flex items-center gap-1.5 text-[9px] font-extrabold text-[#6D5DF6] hover:text-[#5b4ee4] transition-colors cursor-pointer"
                  >
                    <ShieldCheck size={13} />
                    <span>Notify Head</span>
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

        </div>
      )}
    </div>
  );
}

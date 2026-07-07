import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { departmentService } from '@/services/departmentService';
import { 
  Building2, 
  User, 
  Star, 
  TrendingUp, 
  MessageSquare,
  AlertCircle,
  ShieldCheck,
  ToggleLeft,
  ToggleRight
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
      alert('API Offline: Alert config toggle not committed.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-xs text-slate-500">Track and manage service quality metrics across hotel operations</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-64 rounded-2xl bg-slate-50 border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : error || !departments || departments.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center space-y-4 max-w-xl mx-auto">
          <Building2 className="mx-auto text-slate-700" size={40} />
          <h3 className="text-base font-semibold text-slate-400">No Operations Data Detected</h3>
          <p className="text-xs text-slate-500">
            Departments require configuration in your backend service models. Ensure you have seeded departments like Housekeeping, Front Office, and Food & Beverage.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {departments.map((dept) => (
            <div key={dept.id} className="glass-panel rounded-2xl p-6 relative overflow-hidden card-glow flex flex-col justify-between h-72">
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-200">{dept.name}</h3>
                      <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                        <User size={10} />
                        <span>Head: {dept.headOfDepartment}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Score stats */}
                <div className="grid grid-cols-2 gap-4 py-2">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-500 block">Average Rating</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-lg font-bold text-slate-200">{dept.averageRating.toFixed(1)}</span>
                      <div className="flex text-yellow-500">
                        <Star size={12} fill="currentColor" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-500 block">Sentiment Score</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-lg font-bold text-slate-200">{dept.sentimentScore}%</span>
                      <TrendingUp size={14} className="text-emerald-400" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Lower Section */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <MessageSquare size={12} />
                    {dept.reviewCount} Total
                  </span>
                  {dept.pendingCount > 0 && (
                    <span className="text-rose-400 font-medium">
                      {dept.pendingCount} Alerted
                    </span>
                  )}
                </div>

                <button 
                  onClick={() => handleToggleAlerts(dept.id, true)} // Mock function
                  className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <ShieldCheck size={14} />
                  <span>Notify Head</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

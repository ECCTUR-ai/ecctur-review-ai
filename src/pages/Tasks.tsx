import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { useTranslation } from 'react-i18next';
import { taskService } from '@/services/taskService';
import { useAuth } from '@/components/AuthGuard';
import { Task } from '@/types';
import { 
  CheckSquare, 
  AlertCircle, 
  Clock, 
  User, 
  Search, 
  Filter,
  Building,
  Calendar,
  CheckCircle2,
  Hourglass,
  HelpCircle,
  X,
  RefreshCw
} from 'lucide-react';

export default function Tasks() {
  const { t } = useTranslation();
  const { currentHotelId } = useOutletContext<{ currentHotelId: string }>();
  const { hasPermission } = useAuth();
  const canManageTasks = hasPermission('manage:tasks');

  // Filter States
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('');
  const [department, setDepartment] = useState('');
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');

  // Resolution Modal States
  const [resolvingTaskId, setResolvingTaskId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [isSubmittingResolution, setIsSubmittingResolution] = useState(false);

  // Fetch tasks with search and filters (excluding completed state filter from backend to fetch all and split in tabs)
  const {
    data: tasks,
    loading,
    error,
    refetch
  } = useFetch(() => taskService.getTasks({
    hotelId: currentHotelId || undefined,
    priority: priority || undefined,
    department: department || undefined,
    search: search || undefined
  }), [currentHotelId, priority, department, search]);

  // Frontend split for tabs
  const activeTasksList = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter(t => t.status !== 'completed');
  }, [tasks]);

  const completedTasksList = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter(t => t.status === 'completed');
  }, [tasks]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    if (newStatus === 'completed') {
      setResolvingTaskId(id);
      setResolutionNote('');
      return;
    }
    try {
      await taskService.updateTaskStatus(id, newStatus);
      refetch();
    } catch (e: any) {
      alert(`Görev durumu güncellenemedi: ${e.message}`);
    }
  };

  const handleSubmitResolution = async () => {
    if (!resolvingTaskId || !resolutionNote.trim()) return;
    setIsSubmittingResolution(true);
    try {
      const task = tasks?.find(t => t.id === resolvingTaskId);
      if (!task) throw new Error('Görev bulunamadı.');

      const cleanOrigDescription = task.description.split('\n\nÇözüm Notu: ')[0];
      const newDesc = `${cleanOrigDescription}\n\nÇözüm Notu: ${resolutionNote.trim()}`;

      await taskService.completeTask(resolvingTaskId, 'completed', newDesc);
      setResolvingTaskId(null);
      setResolutionNote('');
      refetch();
    } catch (e: any) {
      alert(`Görev tamamlanırken hata oluştu: ${e.message}`);
    } finally {
      setIsSubmittingResolution(false);
    }
  };

  // Helper styles for priority
  const getPriorityBadgeClass = (p: string) => {
    switch (p) {
      case 'critical':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      case 'high':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'medium':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
    }
  };

  // Helper icons for status
  const getStatusIcon = (s: string) => {
    switch (s) {
      case 'completed':
        return <CheckCircle2 size={13} className="text-emerald-400" />;
      case 'in_progress':
        return <Hourglass size={13} className="text-blue-400" />;
      case 'waiting':
        return <Clock size={13} className="text-amber-400" />;
      default:
        return <HelpCircle size={13} className="text-slate-400" />;
    }
  };

  const activeList = activeTab === 'active' ? activeTasksList : completedTasksList;

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="border-b border-slate-200 pb-6">
        <h1 className="text-xl font-bold text-slate-100 m-0">Misafir İlişkileri Görev Takip Modülü</h1>
        <p className="text-xs text-slate-400 mt-1.5">
          Misafir şikayet ve yorumlarına dayalı olarak oluşturulan düzeltici faaliyet ve görevlerin takibi.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl glass-panel grid grid-cols-1 md:grid-cols-3 gap-4 items-center bg-slate-900/20 border border-white/[0.05]">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Görev adı veya açıklama ile ara..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {/* Priority */}
        <div>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-700 focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Tüm Öncelikler</option>
            <option value="low">Düşük</option>
            <option value="medium">Orta</option>
            <option value="high">Yüksek</option>
            <option value="critical">Kritik</option>
          </select>
        </div>

        {/* Department */}
        <div>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-700 focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Tüm Departmanlar</option>
            <option value="Front Office">Ön Büro (Front Office)</option>
            <option value="Housekeeping">Kat Hizmetleri (Housekeeping)</option>
            <option value="Food & Beverage">Yiyecek & İçecek (F&B)</option>
            <option value="Spa & Wellness">Spa & Wellness</option>
            <option value="Technical Service">Teknik Servis (Technical Service)</option>
          </select>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-800 gap-2 mb-6">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
            activeTab === 'active' 
              ? 'border-blue-500 text-blue-400' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock size={14} />
          Aktif Görevler ({activeTasksList.length})
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
            activeTab === 'completed' 
              ? 'border-blue-500 text-blue-400' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <CheckSquare size={14} />
          Tamamlanan Görevler ({completedTasksList.length})
        </button>
      </div>

      {/* Tasks Listing */}
      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-white/[0.01] border border-white/[0.05] animate-pulse" />
          ))
        ) : error ? (
          <div className="glass-panel p-6 rounded-2xl border-l-4 border-rose-500 text-rose-400 bg-rose-950/10 flex items-center gap-3">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        ) : activeList.length === 0 ? (
          <div className="glass-panel rounded-2xl p-12 text-center space-y-4 border border-white/[0.05]">
            <CheckSquare className="mx-auto text-slate-600" size={40} />
            <h3 className="text-sm font-semibold text-slate-400">
              {activeTab === 'active' ? 'Aktif görev bulunmuyor' : 'Tamamlanan görev bulunmuyor'}
            </h3>
            <p className="text-xs text-slate-500 max-w-[280px] mx-auto">
              {activeTab === 'active' 
                ? 'Şu anda takip edilmesi gereken aktif bir aksiyon görevi bulunmamaktadır.'
                : 'Tamamlanarak arşive taşınmış bir görev kaydı bulunmamaktadır.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {activeList.map((task) => {
              // Parse resolution note if available
              const descParts = task.description.split('\n\nÇözüm Notu: ');
              const displayDescription = descParts[0];
              const resolutionText = descParts[1] || '';

              return (
                <div 
                  key={task.id} 
                  className="p-5 rounded-2xl border border-white/[0.05] bg-slate-900/10 hover:bg-slate-900/20 hover:border-slate-800 transition-all duration-300 flex flex-col md:flex-row justify-between gap-4 card-glow"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-sm font-semibold text-slate-200">{task.title}</h3>
                      <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-bold uppercase ${getPriorityBadgeClass(task.priority)}`}>
                        {task.priority === 'low' ? 'Düşük' : task.priority === 'medium' ? 'Orta' : task.priority === 'high' ? 'Yüksek' : 'Kritik'}
                      </span>
                      {task.reviewId && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          Ref Yorum: #{task.reviewId.substring(0, 8)}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">
                      {displayDescription}
                    </p>

                    {/* Resolution Note display (completed tab only) */}
                    {activeTab === 'completed' && resolutionText && (
                      <div className="mt-3 p-3.5 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/15 text-xs">
                        <div className="flex items-center gap-1.5 text-emerald-400 font-bold mb-1">
                          <CheckCircle2 size={12} />
                          <span>Çözüm Notu:</span>
                        </div>
                        <p className="text-slate-300 leading-relaxed italic">
                          "{resolutionText}"
                        </p>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-500 font-mono mt-1 pt-1.5 border-t border-white/[0.02]">
                      <span className="flex items-center gap-1">
                        <Building size={11} className="text-slate-600" />
                        {task.department}
                      </span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1">
                        <User size={11} className="text-slate-600" />
                        Atanan Kişi: {task.assignedTo || 'Atanmamış'}
                      </span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1">
                        <Calendar size={11} className="text-slate-600" />
                        Termin Tarihi: {task.dueDate}
                      </span>
                    </div>
                  </div>

                  {/* Right side actions */}
                  <div className="flex items-center gap-3 self-start md:self-center shrink-0">
                    {activeTab === 'active' ? (
                      <>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800">
                          {getStatusIcon(task.status)}
                          <select
                            value={task.status}
                            disabled={!canManageTasks}
                            onChange={(e) => handleUpdateStatus(task.id, e.target.value)}
                            className="bg-transparent border-0 text-[10px] font-bold focus:outline-none text-slate-300 capitalize cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            <option value="open" className="bg-[#090b16]">Açık</option>
                            <option value="in_progress" className="bg-[#090b16]">İşlemde</option>
                            <option value="waiting" className="bg-[#090b16]">Beklemede</option>
                            <option value="completed" className="bg-[#090b16]">Tamamlandı</option>
                          </select>
                        </div>

                        {canManageTasks && (
                          <button
                            onClick={() => {
                              setResolvingTaskId(task.id);
                              setResolutionNote('');
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 transition-colors text-white font-semibold text-xs rounded-xl shadow-md cursor-pointer"
                          >
                            <CheckCircle2 size={13} />
                            Tamamlandı
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase">
                        <CheckCircle2 size={12} />
                        Tamamlandı
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Resolution Modal */}
      {resolvingTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-blue-500/20 bg-slate-900/95 relative card-glow text-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400" />
                Görevi Tamamla & Çözüm Notu Gir
              </h3>
              <button 
                onClick={() => { setResolvingTaskId(null); setResolutionNote(''); }}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-slate-400 mb-1">Görev Başlığı:</h4>
                <p className="text-xs text-slate-200 leading-relaxed bg-slate-950/40 p-2.5 rounded-xl border border-slate-800">
                  {tasks?.find(t => t.id === resolvingTaskId)?.title}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Çözüm Açıklaması / Notu</label>
                <textarea
                  required
                  rows={4}
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Misafirin şikayetinin nasıl çözüldüğünü ve alınan önlemleri detaylıca buraya yazın..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs focus:outline-none focus:border-blue-500 text-slate-200 placeholder:text-slate-500 resize-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800/60">
                <button
                  onClick={() => { setResolvingTaskId(null); setResolutionNote(''); }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  Vazgeç
                </button>
                <button
                  onClick={handleSubmitResolution}
                  disabled={isSubmittingResolution || !resolutionNote.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingResolution && <RefreshCw size={12} className="animate-spin" />}
                  Görevi Tamamla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

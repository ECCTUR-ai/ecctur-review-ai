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
  Building, 
  Calendar, 
  CheckCircle2, 
  Hourglass, 
  HelpCircle, 
  X, 
  RefreshCw,
  AlertTriangle,
  Globe,
  Sparkles
} from 'lucide-react';

export default function Tasks() {
  const { t } = useTranslation();
  const { currentHotelId } = useOutletContext<{ currentHotelId: string }>();
  const { hasPermission, email: currentUserEmail } = useAuth();
  const canManageTasks = hasPermission('manage:tasks');

  // Filter States
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');

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

      await taskService.completeTask(
        resolvingTaskId, 
        'completed', 
        resolutionNote.trim(), 
        currentUserEmail || 'Bilinmeyen Kullanıcı', 
        newDesc
      );
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
        return 'bg-red-50 text-red-700 border border-red-200';
      case 'high':
        return 'bg-orange-50 text-orange-700 border border-orange-200';
      case 'medium':
        return 'bg-yellow-50 text-yellow-700 border border-yellow-200';
      default:
        return 'bg-slate-50 text-slate-700 border border-slate-200';
    }
  };

  const getDepartmentBadgeClass = (d: string) => {
    const norm = (d || '').toLowerCase();
    if (norm.includes('ilişki') || norm.includes('iliskileri')) {
      return 'bg-purple-50 text-purple-700 border-purple-200';
    }
    if (norm.includes('housekeeping') || norm.includes('kat hizmetleri')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (norm.includes('teknik')) {
      return 'bg-sky-50 text-sky-700 border-sky-200';
    }
    if (norm.includes('yiyecek') || norm.includes('içecek') || norm.includes('restoran')) {
      return 'bg-orange-50 text-orange-700 border-orange-200';
    }
    if (norm.includes('büro') || norm.includes('front office')) {
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    }
    if (norm.includes('spa')) {
      return 'bg-pink-50 text-pink-700 border-pink-200';
    }
    if (norm.includes('güvenlik')) {
      return 'bg-red-50 text-red-700 border-red-200';
    }
    if (norm.includes('animasyon')) {
      return 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200';
    }
    if (norm.includes('satış')) {
      return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    }
    if (norm.includes('muhasebe')) {
      return 'bg-teal-50 text-teal-700 border-teal-200';
    }
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  const getStatusStyle = (s: string) => {
    switch (s) {
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'in_progress':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'waiting':
      case 'deferred':
        return 'bg-violet-50 text-violet-700 border-violet-200';
      case 'open':
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  const getPriorityText = (p: string) => {
    switch (p) {
      case 'critical': return 'Kritik';
      case 'high': return 'Yüksek';
      case 'medium': return 'Orta';
      case 'low': return 'Düşük';
      default: return p;
    }
  };

  // Helper icons for status
  const getStatusIcon = (s: string) => {
    switch (s) {
      case 'completed':
        return <CheckCircle2 size={13} className="text-emerald-600" />;
      case 'in_progress':
        return <Hourglass size={13} className="text-sky-600" />;
      case 'waiting':
      case 'deferred':
        return <AlertTriangle size={13} className="text-violet-600" />;
      default:
        return <Clock size={13} className="text-amber-600" />;
    }
  };

  const getStatusText = (s: string) => {
    switch (s) {
      case 'completed': return 'Tamamlandı';
      case 'in_progress': return 'Devam Ediyor';
      case 'waiting':
      case 'deferred': return 'Ertelendi';
      case 'open': return 'Açık';
      default: return s;
    }
  };

  function formatDate(dateStr?: string) {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  function formatDateTime(dateStr?: string) {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('tr-TR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  }

  const activeList = activeTab === 'active' ? activeTasksList : completedTasksList;

  // Render filter status selection options matching Turkish UI
  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="border-b border-slate-200 pb-6">
        <h1 className="text-xl font-bold text-slate-800 m-0">Misafir İlişkileri Görev Takibi</h1>
        <p className="text-xs text-slate-500 mt-1.5">
          Olumsuz yorumlar, kritik uyarılar ve departman problemleri için aksiyon görevleri oluşturmak, takip etmek ve tamamlananları arşivlemek.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4 items-center bg-white border border-slate-200/80 shadow-sm">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Görevlerde ara..."
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
            <option value="critical">Kritik</option>
            <option value="high">Yüksek</option>
            <option value="medium">Orta</option>
            <option value="low">Düşük</option>
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
            <option value="Misafir İlişkileri">Misafir İlişkileri</option>
            <option value="Ön Büro">Ön Büro</option>
            <option value="Housekeeping">Housekeeping</option>
            <option value="Teknik Servis">Teknik Servis</option>
            <option value="Yiyecek & İçecek">Yiyecek & İçecek</option>
            <option value="Spa">Spa</option>
            <option value="Yönetim">Yönetim</option>
          </select>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-200 gap-2 mb-6">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
            activeTab === 'active' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock size={14} />
          Aktif Görevler ({activeTasksList.length})
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
            activeTab === 'completed' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
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
              {activeTab === 'active' ? 'Henüz aktif görev yok.' : 'Henüz tamamlanan görev bulunmuyor.'}
            </h3>
            <p className="text-xs text-slate-500 max-w-[340px] mx-auto leading-relaxed">
              {activeTab === 'active' 
                ? 'Kritik yorumlar ve operasyonel uyarılar otomatik olarak burada görev haline gelir.'
                : 'Tamamlanarak arşive taşınmış bir görev kaydı bulunmamaktadır.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {activeList.map((task) => {
              // Parse resolution note fallback if it was saved in description
              const descParts = task.description.split('\n\nÇözüm Notu: ');
              const mainDesc = descParts[0];
              const resolutionText = task.resolutionNote || descParts[1] || '';

              const { reviewText, aiRecommendedAction } = (() => {
                const commentMatch = mainDesc.match(/Misafir Yorumu:\s*"([\s\S]*?)"/i);
                const actionMatch = mainDesc.match(/Yapay Zeka Aksiyon Önerisi:\s*([\s\S]*)/i);
                
                let rText = '';
                let aAction = '';
                
                if (commentMatch) {
                  rText = commentMatch[1];
                }
                if (actionMatch) {
                  aAction = actionMatch[1].trim();
                }
                
                if (!rText) {
                  rText = mainDesc;
                }
                
                return { reviewText: rText, aiRecommendedAction: aAction };
              })();

              const guestName = task.metadata?.guest_name || 'Misafir';
              const rating = task.metadata?.rating;
              const reviewDate = task.metadata?.review_date;

              return (
                <div 
                  key={task.id} 
                  className="p-5 rounded-[18px] border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md transition-all duration-300 flex flex-col md:flex-row justify-between gap-4"
                >
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-sm font-bold text-slate-800">{task.title}</h3>
                      <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-bold uppercase border ${getPriorityBadgeClass(task.priority)}`}>
                        {getPriorityText(task.priority)}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-bold uppercase border ${getDepartmentBadgeClass(task.department)}`}>
                        {task.department}
                      </span>
                      {task.reviewId && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          Ref Yorum: #{task.reviewId.substring(0, 8)}
                        </span>
                      )}
                      {(task.sourcePlatform || task.metadata?.platform) && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-bold font-mono">
                          <Globe size={10} />
                          {task.sourcePlatform || task.metadata?.platform}
                        </span>
                      )}
                      {rating !== undefined && (
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-lg text-[10px] font-extrabold shadow-sm shrink-0">
                          ★ {rating} Yıldız
                        </span>
                      )}
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/50 text-xs">
                      <div className="flex justify-between items-center text-[10px] text-slate-450 font-semibold uppercase tracking-wide mb-1">
                        <span>Misafir Yorumu ({guestName})</span>
                        {reviewDate && <span>Yorum Tarihi: {formatDate(reviewDate)}</span>}
                      </div>
                      <p className="text-slate-650 italic font-medium leading-relaxed">
                        "{reviewText}"
                      </p>
                    </div>

                    {aiRecommendedAction && (
                      <div className="p-3.5 rounded-xl bg-blue-500/[0.03] border border-blue-500/10 text-xs">
                        <div className="flex items-center gap-1.5 text-blue-400 font-semibold mb-1">
                          <Sparkles size={12} />
                          <span>Yapay Zeka Aksiyon Önerisi</span>
                        </div>
                        <p className="text-slate-300 leading-relaxed">
                          {aiRecommendedAction}
                        </p>
                      </div>
                    )}

                    {/* Resolution Note display */}
                    {activeTab === 'completed' && resolutionText && (
                      <div className="p-3.5 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/15 text-xs">
                        <div className="flex items-center gap-1.5 text-emerald-400 font-bold mb-1">
                          <CheckCircle2 size={12} />
                          <span>Çözüm Notu:</span>
                        </div>
                        <p className="text-slate-300 leading-relaxed italic">
                          "{resolutionText}"
                        </p>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-500 font-mono mt-1 pt-1.5 border-t border-slate-100">
                      <span className="flex items-center gap-1">
                        <Building size={11} className="text-slate-600" />
                        Departman: {task.department}
                      </span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1">
                        <User size={11} className="text-slate-600" />
                        {activeTab === 'active' ? 'Atanan Kişi' : 'Tamamlayan'}: {activeTab === 'active' ? (task.assignedTo || 'Atanmamış') : (task.completedBy || 'Bilinmiyor')}
                      </span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1">
                        <Calendar size={11} className="text-slate-600" />
                        Oluşturulma: {formatDate(task.createdAt)}
                      </span>
                      {task.dueDate && (
                        <>
                          <span>&bull;</span>
                          <span className="flex items-center gap-1">
                            <Calendar size={11} className="text-slate-600" />
                            Termin: {formatDate(task.dueDate)}
                          </span>
                        </>
                      )}
                      {activeTab === 'completed' && task.completedAt && (
                        <>
                          <span>&bull;</span>
                          <span className="flex items-center gap-1 text-emerald-400">
                            <CheckCircle2 size={11} />
                            Kapatılma: {formatDateTime(task.completedAt)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right side actions */}
                  <div className="flex items-center gap-3 self-start md:self-center shrink-0">
                    {activeTab === 'active' ? (
                      <>
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border ${getStatusStyle(task.status)}`}>
                          {getStatusIcon(task.status)}
                          <select
                            value={task.status}
                            disabled={!canManageTasks}
                            onChange={(e) => handleUpdateStatus(task.id, e.target.value)}
                            className="bg-transparent border-0 text-[10px] font-bold focus:outline-none capitalize cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed text-current"
                          >
                            <option value="open" className="bg-white text-slate-900">Açık</option>
                            <option value="in_progress" className="bg-white text-slate-900">Devam Ediyor</option>
                            <option value="waiting" className="bg-white text-slate-900">Ertelendi</option>
                            <option value="completed" className="bg-white text-slate-900">Tamamlandı</option>
                          </select>
                        </div>

                        {canManageTasks && (
                          <button
                            onClick={() => {
                              setResolvingTaskId(task.id);
                              setResolutionNote('');
                            }}
                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 transition-colors text-white font-semibold text-xs rounded-xl shadow-md cursor-pointer"
                          >
                            <CheckCircle2 size={13} />
                            Tamamlandı
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase">
                        <CheckCircle2 size={12} className="text-emerald-600" />
                        {getStatusText(task.status)}
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
          <div className="w-full max-w-md p-6 rounded-2xl border border-slate-200 bg-white relative shadow-2xl text-slate-800 animate-slide-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-slate-850 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600" />
                Görevi Kapat & Çözüm Notu Gir
              </h3>
              <button 
                onClick={() => { setResolvingTaskId(null); setResolutionNote(''); }}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Görev Başlığı:</h4>
                <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-200 font-semibold">
                  {tasks?.find(t => t.id === resolvingTaskId)?.title}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Çözüm Açıklaması / Notu (Zorunlu)</label>
                <textarea
                  required
                  rows={4}
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Misafirin şikayetinin nasıl çözüldüğünü ve alınan önlemleri detaylıca buraya yazın..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-800 placeholder:text-slate-450 resize-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => { setResolvingTaskId(null); setResolutionNote(''); }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer border border-slate-200/50"
                >
                  Vazgeç
                </button>
                <button
                  onClick={handleSubmitResolution}
                  disabled={isSubmittingResolution}
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

import React, { useState, useMemo, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { useTranslation } from 'react-i18next';
import { taskService } from '@/services/taskService';
import { useAuth } from '@/components/AuthGuard';
import { Task } from '@/types';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckSquare, 
  Clock, 
  Search, 
  Calendar, 
  CheckCircle2, 
  Hourglass, 
  X, 
  RefreshCw,
  AlertTriangle,
  SlidersHorizontal,
  Building,
  User,
  Activity
} from 'lucide-react';

export default function Tasks() {
  const { t } = useTranslation();
  const { currentHotelId } = useOutletContext<{ currentHotelId: string }>();
  const { hasPermission, email: currentUserEmail, roleKey } = useAuth();
  const isSuperAdmin = roleKey === 'super_admin';
  const canManageTasks = hasPermission('manage:tasks');

  // Filter States
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('');
  const [department, setDepartment] = useState('');
  const [platform, setPlatform] = useState('');

  // Notion Columns Board Tabs
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'archived'>('active');

  // Modal details
  const [selectedTaskDetails, setSelectedTaskDetails] = useState<Task | null>(null);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [completionNote, setCompletionNote] = useState('');
  const [responsibleUser, setResponsibleUser] = useState('Ahmet Yılmaz');
  const [completionCategory, setCompletionCategory] = useState('Teknik Çözüm');
  const [internalComment, setInternalComment] = useState('');
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);

  // Fetch tasks
  const {
    data: tasks,
    loading,
    refetch
  } = useFetch(() => taskService.getTasks({
    hotelId: currentHotelId || undefined,
    priority: priority || undefined,
    department: department || undefined,
    search: search || undefined
  }), [currentHotelId, priority, department, search]);

  const handleResetFilters = () => {
    setSearch('');
    setPriority('');
    setDepartment('');
    setPlatform('');
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const getSlaStatus = (task: Task) => {
    const created = new Date(task.createdAt);
    const due = task.dueDate ? new Date(task.dueDate) : new Date(created.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();
    
    const diff = due.getTime() - now.getTime();
    const isOverdue = diff < 0;
    const absDiff = Math.abs(diff);
    
    const totalMins = Math.floor(absDiff / (1000 * 60));
    const days = Math.floor(totalMins / (24 * 60));
    const hours = Math.floor((totalMins % (24 * 60)) / 60);
    
    if (isOverdue) {
      return { text: `${days > 0 ? `${days}d ` : ''}${hours}h gecikti`, isOverdue: true, colorClass: 'text-rose-400 bg-rose-500/10 border-rose-500/20' };
    } else {
      return { text: `${days > 0 ? `${days}d ` : ''}${hours}h kaldı`, isOverdue: false, colorClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
    }
  };

  const getDepartmentBadgeClass = (d: string) => {
    const norm = (d || '').toLowerCase();
    if (norm.includes('relations') || norm.includes('ilişki')) return 'bg-purple-500/10 text-purple-300 border-purple-500/20';
    if (norm.includes('housekeeping') || norm.includes('kat')) return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
    if (norm.includes('teknik') || norm.includes('technical')) return 'bg-sky-500/10 text-sky-300 border-sky-500/20';
    if (norm.includes('restaurant') || norm.includes('yiyecek') || norm.includes('restoran')) return 'bg-orange-500/10 text-orange-300 border-orange-500/20';
    return 'bg-zinc-500/10 text-zinc-300 border-zinc-500/20';
  };

  const getPriorityBadgeClass = (p: string) => {
    switch (p) {
      case 'critical': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'high': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'medium': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      default: return 'bg-zinc-500/10 text-zinc-400 border-white/5';
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    if (newStatus === 'completed') {
      setCompletingTaskId(id);
      setCompletionNote('');
      return;
    }
    try {
      await taskService.updateTaskStatus(id, newStatus);
      refetch();
    } catch (e: any) {
      alert(`Görev durumu güncellenemedi: ${e.message}`);
    }
  };

  const handleAssignTask = async (id: string, newAssignee: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ assigned_to: newAssignee })
        .eq('id', id);
      if (error) throw error;
      refetch();
      if (selectedTaskDetails?.id === id) {
        setSelectedTaskDetails(prev => prev ? { ...prev, assignedTo: newAssignee } : null);
      }
    } catch (e: any) {
      alert(`Görev ataması güncellenemedi: ${e.message}`);
    }
  };

  const handleSubmitCompletion = async () => {
    if (!completingTaskId || !completionNote.trim()) return;
    setIsSubmittingCompletion(true);
    try {
      const task = tasks?.find(t => t.id === completingTaskId);
      if (!task) throw new Error('Görev bulunamadı.');

      const cleanOrigDescription = task.description.split('\n\nÇözüm Notu: ')[0];
      const newDesc = `${cleanOrigDescription}\n\nÇözüm Notu: ${completionNote.trim()}`;

      await taskService.completeTask(
        completingTaskId, 
        'completed', 
        completionNote.trim(), 
        responsibleUser, 
        newDesc
      );

      const updatedMetadata = {
        ...(task.metadata || {}),
        completionCategory,
        internalComment,
        completedAt: new Date().toISOString()
      };

      await supabase
        .from('tasks')
        .update({ metadata: updatedMetadata })
        .eq('id', completingTaskId);

      setCompletingTaskId(null);
      setCompletionNote('');
      setInternalComment('');
      refetch();
    } catch (e: any) {
      alert(`Görev tamamlanırken hata oldu: ${e.message}`);
    } finally {
      setIsSubmittingCompletion(false);
    }
  };

  const taskList = tasks || [];
  const filteredList = useMemo(() => {
    return taskList.filter(t => {
      if (platform && (t.sourcePlatform || t.metadata?.platform || '').toLowerCase() !== platform.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [taskList, platform]);

  const activeTasksList = useMemo(() => {
    return filteredList.filter(t => t.status !== 'completed' && t.status !== 'deferred');
  }, [filteredList]);

  const completedTasksList = useMemo(() => {
    return filteredList.filter(t => t.status === 'completed');
  }, [filteredList]);

  const archivedTasksList = useMemo(() => {
    return filteredList.filter(t => t.status === 'deferred');
  }, [filteredList]);

  return (
    <div className="space-y-6">
      {/* Notion Task Board Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/10 pb-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-white m-0 flex items-center gap-2">
            <CheckSquare className="text-indigo-400" size={24} />
            Guest Relations Tasks
          </h1>
          <p className="text-xs text-zinc-400">
            Notion-style task board organizing guest complaints and department resolutions.
          </p>
        </div>

        {/* Tab pills */}
        <div className="flex border border-white/10 gap-1 p-1 rounded-2xl bg-white/5 shrink-0">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 text-xs font-bold transition-all rounded-xl cursor-pointer ${
              activeTab === 'active' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white' : 'text-zinc-400'
            }`}
          >
            Active Tasks
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-4 py-2 text-xs font-bold transition-all rounded-xl cursor-pointer ${
              activeTab === 'completed' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white' : 'text-zinc-400'
            }`}
          >
            Completed
          </button>
          <button
            onClick={() => setActiveTab('archived')}
            className={`px-4 py-2 text-xs font-bold transition-all rounded-xl cursor-pointer ${
              activeTab === 'archived' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white' : 'text-zinc-400'
            }`}
          >
            Archived
          </button>
        </div>
      </div>

      {/* Notion Filter Toolbar */}
      <div className="bg-white/5 border border-white/10 p-5 rounded-[22px] shadow-sm flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2 text-white font-bold text-xs">
            <SlidersHorizontal size={14} className="text-indigo-400" />
            Filters
          </div>
          {(search || priority || department || platform) && (
            <button
              onClick={handleResetFilters}
              className="text-[10px] text-rose-400 hover:text-rose-300 font-extrabold focus:outline-none"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-zinc-500" size={14} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="w-full pl-9 pr-4 py-2 bg-black/20 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none"
            />
          </div>

          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="px-3 py-2 bg-black/20 border border-white/10 rounded-xl text-xs text-white focus:outline-none"
          >
            <option value="" className="bg-[#121216]">All Priorities</option>
            <option value="critical" className="bg-[#121216]">Critical</option>
            <option value="high" className="bg-[#121216]">High</option>
            <option value="medium" className="bg-[#121216]">Medium</option>
            <option value="low" className="bg-[#121216]">Low</option>
          </select>

          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="px-3 py-2 bg-black/20 border border-white/10 rounded-xl text-xs text-white focus:outline-none"
          >
            <option value="" className="bg-[#121216]">All Departments</option>
            <option value="Misafir İlişkileri" className="bg-[#121216]">Misafir İlişkileri</option>
            <option value="Housekeeping" className="bg-[#121216]">Housekeeping</option>
            <option value="Teknik Servis" className="bg-[#121216]">Teknik Servis</option>
            <option value="Yiyecek & İçecek" className="bg-[#121216]">Yiyecek & İçecek</option>
            <option value="Ön Büro" className="bg-[#121216]">Ön Büro</option>
            <option value="Spa" className="bg-[#121216]">Spa</option>
            <option value="Yönetim" className="bg-[#121216]">Yönetim</option>
          </select>

          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="px-3 py-2 bg-black/20 border border-white/10 rounded-xl text-xs text-white focus:outline-none"
          >
            <option value="" className="bg-[#121216]">All Platforms</option>
            <option value="google" className="bg-[#121216]">Google</option>
            <option value="booking" className="bg-[#121216]">Booking.com</option>
            <option value="tripadvisor" className="bg-[#121216]">TripAdvisor</option>
            <option value="hotelscom" className="bg-[#121216]">Hotels.com</option>
            <option value="holidaycheck" className="bg-[#121216]">HolidayCheck</option>
            <option value="otelpuan" className="bg-[#121216]">Otelpuan</option>
          </select>
        </div>
      </div>

      {/* NOTION TASK CARDS LIST GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
        {(() => {
          const listToShow = activeTab === 'active' ? activeTasksList :
                              activeTab === 'completed' ? completedTasksList : archivedTasksList;

          if (loading) {
            return Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-44 bg-white/[0.02] border border-white/5 rounded-3xl animate-pulse" />
            ));
          }

          if (listToShow.length === 0) {
            return (
              <div className="col-span-full py-16 text-center text-zinc-500 text-xs">
                No active tasks found matching criteria.
              </div>
            );
          }

          return listToShow.map((task) => {
            const sla = getSlaStatus(task);
            return (
              <motion.div
                whileHover={{ scale: 1.015 }}
                key={task.id}
                onClick={() => setSelectedTaskDetails(task)}
                className="glass-panel p-5 rounded-[24px] hover:border-indigo-500/30 transition-all flex flex-col justify-between min-h-[190px] relative text-left cursor-pointer"
              >
                <div className="space-y-3.5">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border ${getPriorityBadgeClass(task.priority)}`}>
                      {task.priority}
                    </span>
                    {task.status !== 'completed' && (
                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold border ${sla.colorClass}`}>
                        {sla.text}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-white leading-snug line-clamp-1">{task.title}</h3>
                  <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">{task.description.split('\n\nÇözüm Notu: ')[0]}</p>
                </div>

                <div className="mt-4 pt-3.5 border-t border-white/5 flex justify-between items-center text-[10px] text-zinc-500">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <User size={12} className="text-zinc-500 shrink-0" />
                    <span className="truncate font-semibold text-zinc-300">
                      {task.assignedTo || 'Unassigned'}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-lg border text-[9px] font-bold ${getDepartmentBadgeClass(task.department)}`}>
                    {task.department}
                  </span>
                </div>
              </motion.div>
            );
          });
        })()}
      </div>

      {/* Task Details Side Modal Drawer */}
      <AnimatePresence>
        {selectedTaskDetails && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setSelectedTaskDetails(null)}
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="relative w-full max-w-md h-full bg-[#0E0E12] border-l border-white/10 shadow-2xl p-6 flex flex-col z-10 text-left text-zinc-200"
            >
              <button 
                onClick={() => setSelectedTaskDetails(null)}
                className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white"
              >
                <X size={15} />
              </button>

              <div className="flex-1 overflow-y-auto space-y-6 pr-1 scrollbar-thin">
                <div className="space-y-1.5 pt-4">
                  <span className="px-2 py-0.5 rounded-lg text-[9px] font-black bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    {selectedTaskDetails.priority.toUpperCase()} PRIORITY
                  </span>
                  <h2 className="text-lg font-black text-white leading-snug">{selectedTaskDetails.title}</h2>
                </div>

                <div className="space-y-3.5 bg-white/[0.02] border border-white/5 rounded-2xl p-4 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Department:</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getDepartmentBadgeClass(selectedTaskDetails.department)}`}>
                      {selectedTaskDetails.department}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Owner:</span>
                    <span className="text-white font-bold">{selectedTaskDetails.assignedTo || 'Unassigned'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Due Date:</span>
                    <span className="text-white font-bold">{formatDate(selectedTaskDetails.dueDate)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Status:</span>
                    <span className="text-white font-bold uppercase">{selectedTaskDetails.status}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide block">Task Description</span>
                  <p className="text-xs text-zinc-300 leading-relaxed bg-white/[0.01] border border-white/5 p-3 rounded-xl italic">
                    "{selectedTaskDetails.description}"
                  </p>
                </div>

                {/* Operations board */}
                {selectedTaskDetails.status !== 'completed' && (
                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide block">Assign Task Owner</span>
                      <select
                        onChange={(e) => handleAssignTask(selectedTaskDetails.id, e.target.value)}
                        value={selectedTaskDetails.assignedTo || ''}
                        className="w-full px-3 py-2.5 bg-black border border-white/10 rounded-xl text-xs text-white"
                      >
                        <option value="">Select Assignee</option>
                        <option value="Ahmet Yılmaz">Ahmet Yılmaz (Misafir İlişkileri)</option>
                        <option value="Mehmet Demir">Mehmet Demir (Ön Büro Müdürü)</option>
                        <option value="Canan Kaya">Canan Kaya (Housekeeping Şefi)</option>
                        <option value="Ayşe Şen">Ayşe Şen (Teknik Servis Müdürü)</option>
                      </select>
                    </div>

                    <button
                      onClick={() => handleUpdateStatus(selectedTaskDetails.id, 'completed')}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10"
                    >
                      <CheckCircle2 size={14} />
                      <span>Mark as Completed</span>
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Completion Notes modal */}
      {completingTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-white/10 bg-zinc-900/95 relative card-glow text-zinc-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500" />
                Görevi Çözümlendi Olarak Kapat
              </h3>
              <button 
                onClick={() => setCompletingTaskId(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">Çözüm Notu</label>
                <textarea
                  value={completionNote}
                  onChange={(e) => setCompletionNote(e.target.value)}
                  placeholder="Misafire yapılan dönüş, alınan aksiyon detayları..."
                  rows={4}
                  className="w-full px-3 py-2.5 bg-black border border-white/10 rounded-xl text-xs text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">Sorumlu Kişi / Birim</label>
                <input
                  type="text"
                  value={responsibleUser}
                  onChange={(e) => setResponsibleUser(e.target.value)}
                  className="w-full px-3 py-2.5 bg-black border border-white/10 rounded-xl text-xs text-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  onClick={() => setCompletingTaskId(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 text-zinc-300 hover:bg-white/10 transition-colors"
                >
                  Vazgeç
                </button>
                <button
                  onClick={handleSubmitCompletion}
                  disabled={isSubmittingCompletion}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmittingCompletion && <RefreshCw size={12} className="animate-spin" />}
                  Çözümü Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

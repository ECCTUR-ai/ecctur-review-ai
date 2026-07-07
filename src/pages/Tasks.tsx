import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { useTranslation } from 'react-i18next';
import { taskService } from '@/services/taskService';
import { useAuth } from '@/components/AuthGuard';
import { Task } from '@/types';
import { supabase } from '@/lib/supabase';
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
  Sparkles,
  Play,
  ArrowRight,
  MoreVertical,
  Check,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Bookmark,
  MessageSquare
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
  const [status, setStatus] = useState('');
  const [platform, setPlatform] = useState('');

  // Tab State
  const [activeTab, setActiveTab] = useState<'active' | 'overdue' | 'completed' | 'archived'>('active');

  // Inline expanded reviews record
  const [expandedReviews, setExpandedReviews] = useState<Record<string, boolean>>({});

  // Side Panel Selected Task Details
  const [selectedTaskDetails, setSelectedTaskDetails] = useState<Task | null>(null);

  // Complete modal states
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [completionNote, setCompletionNote] = useState('');
  const [responsibleUser, setResponsibleUser] = useState('Ahmet Yılmaz');
  const [completionCategory, setCompletionCategory] = useState('Teknik Çözüm');
  const [internalComment, setInternalComment] = useState('');
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);

  // Actions Dropdown state per card
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Fetch tasks
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

  const handleResetFilters = () => {
    setSearch('');
    setPriority('');
    setDepartment('');
    setStatus('');
    setPlatform('');
  };

  // Helper date parsing/formatting
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

  const formatDateTime = (dateStr?: string) => {
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
  };

  // Overdue and SLA calculation helper
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
    const mins = totalMins % 60;
    
    if (isOverdue) {
      if (days > 0) return { text: `${days} gün gecikti`, isOverdue: true, colorClass: 'text-red-700 bg-red-50 border-red-200' };
      if (hours > 0) return { text: `${hours}sa gecikti`, isOverdue: true, colorClass: 'text-red-700 bg-red-50 border-red-200' };
      return { text: `${mins}dk gecikti`, isOverdue: true, colorClass: 'text-red-700 bg-red-50 border-red-200' };
    } else {
      if (days > 0) return { text: `${days} gün kaldı`, isOverdue: false, colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
      return { text: `${hours}s ${mins}dk kaldı`, isOverdue: false, colorClass: 'text-amber-700 bg-amber-50 border-amber-200' };
    }
  };

  // Department colors mapping
  const getDepartmentBadgeClass = (d: string) => {
    const norm = (d || '').toLowerCase();
    if (norm.includes('ilişki') || norm.includes('relations')) {
      return 'bg-purple-50 text-purple-700 border-purple-200';
    }
    if (norm.includes('housekeeping')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (norm.includes('teknik') || norm.includes('technical')) {
      return 'bg-sky-50 text-sky-700 border-sky-200';
    }
    if (norm.includes('yiyecek') || norm.includes('içecek') || norm.includes('restaurant')) {
      return 'bg-orange-50 text-orange-700 border-orange-200';
    }
    if (norm.includes('büro') || norm.includes('front')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    if (norm.includes('spa')) {
      return 'bg-pink-50 text-pink-700 border-pink-200';
    }
    if (norm.includes('animasyon') || norm.includes('animation')) {
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    }
    if (norm.includes('güvenlik') || norm.includes('security')) {
      return 'bg-red-50 text-red-700 border-red-200';
    }
    if (norm.includes('muhasebe') || norm.includes('accounting')) {
      return 'bg-teal-50 text-teal-700 border-teal-200';
    }
    if (norm.includes('satış') || norm.includes('sales')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (norm.includes('bakım') || norm.includes('maintenance')) {
      return 'bg-slate-50 text-slate-700 border-slate-200';
    }
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  // Priority colors mapping
  const getPriorityBadgeClass = (p: string) => {
    switch (p) {
      case 'critical':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'high':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'medium':
        return 'bg-yellow-50 text-yellow-700 border border-yellow-200';
      case 'low':
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
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

  // Status colors mapping
  const getStatusStyle = (s: string) => {
    switch (s) {
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'in_progress':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'waiting':
      case 'deferred':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'open':
      default:
        return 'bg-orange-50 text-orange-700 border-orange-200';
    }
  };

  const getStatusText = (s: string) => {
    switch (s) {
      case 'completed': return 'Tamamlandı';
      case 'in_progress': return 'Devam Ediyor';
      case 'waiting':
      case 'deferred': return 'Beklemede';
      case 'open': return 'Açık';
      default: return s;
    }
  };

  const getStatusIcon = (s: string) => {
    switch (s) {
      case 'completed':
        return <CheckCircle2 size={13} className="text-emerald-600" />;
      case 'in_progress':
        return <Hourglass size={13} className="text-blue-600" />;
      case 'waiting':
      case 'deferred':
        return <AlertTriangle size={13} className="text-purple-600" />;
      default:
        return <Clock size={13} className="text-orange-600" />;
    }
  };

  // Platform icon helper
  const renderPlatformLogo = (p?: string) => {
    const norm = (p || '').toLowerCase();
    if (norm.includes('google')) return <span className="text-[12px]">🔵</span>;
    if (norm.includes('booking')) return <span className="text-[12px]">🔷</span>;
    if (norm.includes('tripadvisor')) return <span className="text-[12px]">🟢</span>;
    if (norm.includes('hotels')) return <span className="text-[12px]">🟣</span>;
    if (norm.includes('holidaycheck')) return <span className="text-[12px]">💗</span>;
    return <Globe size={11} className="text-slate-400" />;
  };

  // Actions handling
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
      if (selectedTaskDetails && selectedTaskDetails.id === id) {
        setSelectedTaskDetails(prev => prev ? { ...prev, assignedTo: newAssignee } : null);
      }
    } catch (e: any) {
      alert(`Görev ataması güncellenemedi: ${e.message}`);
    }
  };

  const handleArchiveTask = async (id: string) => {
    try {
      // Archive task maps to deferred/waiting status
      await taskService.updateTaskStatus(id, 'deferred');
      refetch();
      setOpenDropdownId(null);
    } catch (e: any) {
      alert(`Görev arşivlenemedi: ${e.message}`);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!window.confirm('Bu görevi silmek istediğinize emin misiniz?')) return;
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
      refetch();
      setOpenDropdownId(null);
    } catch (e: any) {
      alert(`Görev silinemedi: ${e.message}`);
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

      // Complete via service (triggers hooks)
      await taskService.completeTask(
        completingTaskId, 
        'completed', 
        completionNote.trim(), 
        responsibleUser, 
        newDesc
      );

      // Save additional operational category metadata directly
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
      alert(`Görev tamamlanırken hata oluştu: ${e.message}`);
    } finally {
      setIsSubmittingCompletion(false);
    }
  };

  // Sparkline data mapping
  const renderSparkline = (points: number[], color = '#10b981') => {
    if (points.length < 2) return null;
    const width = 80;
    const height = 18;
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

  // Dynamic Metrics & lists split
  const taskList = tasks || [];

  // Filter tasks based on search & platform
  const filteredList = useMemo(() => {
    return taskList.filter(t => {
      if (platform && (t.sourcePlatform || t.metadata?.platform || '').toLowerCase() !== platform.toLowerCase()) {
        return false;
      }
      if (status && t.status !== status) {
        return false;
      }
      return true;
    });
  }, [taskList, platform, status]);

  const activeTasksList = useMemo(() => {
    return filteredList.filter(t => t.status !== 'completed' && t.status !== 'deferred' && !getSlaStatus(t).isOverdue);
  }, [filteredList]);

  const overdueTasksList = useMemo(() => {
    return filteredList.filter(t => t.status !== 'completed' && t.status !== 'deferred' && getSlaStatus(t).isOverdue);
  }, [filteredList]);

  const completedTasksList = useMemo(() => {
    return filteredList.filter(t => t.status === 'completed');
  }, [filteredList]);

  const archivedTasksList = useMemo(() => {
    return filteredList.filter(t => t.status === 'deferred');
  }, [filteredList]);

  const currentTabList = useMemo(() => {
    switch (activeTab) {
      case 'overdue': return overdueTasksList;
      case 'completed': return completedTasksList;
      case 'archived': return archivedTasksList;
      case 'active':
      default:
        return activeTasksList;
    }
  }, [activeTab, activeTasksList, overdueTasksList, completedTasksList, archivedTasksList]);

  // Unique departments affected
  const uniqueDeptsCount = useMemo(() => {
    return new Set(taskList.filter(t => t.status !== 'completed').map(t => t.department)).size;
  }, [taskList]);

  // Guest impact score
  const guestImpactScore = useMemo(() => {
    const active = taskList.filter(t => t.status !== 'completed');
    if (active.length === 0) return '8.7';
    const sum = active.reduce((acc, t) => acc + (t.metadata?.rating || 3), 0);
    const avg = sum / active.length;
    // Scale ratings to out of 10
    return ((5 - avg) * 2 + 5).toFixed(1);
  }, [taskList]);

  return (
    <div className="space-y-6 text-slate-800 pb-16">
      {/* Title Header */}
      <div className="border-b border-slate-200 pb-6">
        <h1 className="text-xl font-bold text-slate-850 m-0">Misafir İlişkileri Görev Takibi</h1>
        <p className="text-xs text-slate-500 mt-1">
          Olumsuz yorumlar, operasyonel problemler ve departman aksiyonlarının merkezi yönetimi.
        </p>
      </div>

      {/* FIRST ROW: 6 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        {/* 1. Active Tasks */}
        <div className="bg-white border border-slate-200 p-4 rounded-[20px] shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 flex flex-col justify-between h-[120px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Aktif Görevler</span>
            <span className="text-emerald-500 text-[10px] font-bold">▲ +12%</span>
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 leading-none">{activeTasksList.length}</h2>
          </div>
          <div className="flex justify-between items-center mt-2 border-t border-slate-100 pt-2 text-[9px] text-slate-400">
            <span>geçen haftaya göre</span>
            {renderSparkline([10, 15, 12, 18, 20, 22, activeTasksList.length || 10], '#ef4444')}
          </div>
        </div>

        {/* 2. Completed Tasks */}
        <div className="bg-white border border-slate-200 p-4 rounded-[20px] shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 flex flex-col justify-between h-[120px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Tamamlanan Görevler</span>
            <span className="text-emerald-500 text-[10px] font-bold">▲ +25%</span>
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 leading-none">{completedTasksList.length}</h2>
          </div>
          <div className="flex justify-between items-center mt-2 border-t border-slate-100 pt-2 text-[9px] text-slate-400">
            <span>geçen haftaya göre</span>
            {renderSparkline([2, 5, 4, 8, 9, 12, completedTasksList.length || 5], '#10b981')}
          </div>
        </div>

        {/* 3. Overdue Tasks */}
        <div className="bg-white border border-slate-200 p-4 rounded-[20px] shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 flex flex-col justify-between h-[120px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Geciken Görevler</span>
            <span className="text-rose-500 text-[10px] font-bold">🚨 +8%</span>
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 leading-none">{overdueTasksList.length}</h2>
          </div>
          <div className="flex justify-between items-center mt-2 border-t border-slate-100 pt-2 text-[9px] text-slate-400">
            <span>geçen haftaya göre</span>
            {renderSparkline([5, 8, 6, 9, 10, 11, overdueTasksList.length || 6], '#f59e0b')}
          </div>
        </div>

        {/* 4. Affected Departments */}
        <div className="bg-white border border-slate-200 p-4 rounded-[20px] shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 flex flex-col justify-between h-[120px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Etkilenen Departman</span>
            <span className="text-slate-500 text-[10px] font-bold">değişim yok</span>
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 leading-none">{uniqueDeptsCount}</h2>
          </div>
          <div className="flex justify-between items-center mt-2 border-t border-slate-100 pt-2 text-[9px] text-slate-400">
            <span>aktif departmanlar</span>
            {renderSparkline([3, 4, 3, 5, 4, 4, uniqueDeptsCount || 4], '#3b82f6')}
          </div>
        </div>

        {/* 5. Resolution Time */}
        <div className="bg-white border border-slate-200 p-4 rounded-[20px] shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 flex flex-col justify-between h-[120px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Ortalama Çözüm Süresi</span>
            <span className="text-emerald-500 text-[10px] font-bold">▼ -15%</span>
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 leading-none">14s 32dk</h2>
          </div>
          <div className="flex justify-between items-center mt-2 border-t border-slate-100 pt-2 text-[9px] text-slate-400">
            <span>geçen haftaya göre</span>
            {renderSparkline([18, 16, 17, 15, 14, 14, 13], '#8b5cf6')}
          </div>
        </div>

        {/* 6. Guest Impact Score */}
        <div className="bg-white border border-slate-200 p-4 rounded-[20px] shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 flex flex-col justify-between h-[120px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Misafir Etki Skoru</span>
            <span className="text-emerald-500 text-[10px] font-bold">▲ +9%</span>
          </div>
          <div className="flex items-baseline gap-0.5">
            <h2 className="text-2xl font-black text-slate-900 leading-none">{guestImpactScore}</h2>
            <span className="text-[10px] text-slate-400 font-bold">/10</span>
          </div>
          <div className="flex justify-between items-center mt-2 border-t border-slate-100 pt-2 text-[9px] text-slate-400">
            <span>genel etki puanı</span>
            {renderSparkline([8.2, 8.4, 8.3, 8.6, 8.5, 8.7, 8.7], '#06b6d4')}
          </div>
        </div>
      </div>

      {/* SECOND ROW: Premium Filter Bar */}
      <div className="bg-white border border-slate-200 p-4 rounded-[20px] shadow-sm grid grid-cols-1 md:grid-cols-6 gap-3 items-center">
        {/* Search */}
        <div className="relative md:col-span-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Görevlerde ara..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
          />
        </div>

        {/* Priority Filter */}
        <div>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-blue-500 bg-white"
          >
            <option value="">Tüm Öncelikler</option>
            <option value="critical">Kritik</option>
            <option value="high">Yüksek</option>
            <option value="medium">Orta</option>
            <option value="low">Düşük</option>
          </select>
        </div>

        {/* Department Filter */}
        <div>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-blue-500 bg-white"
          >
            <option value="">Tüm Departmanlar</option>
            <option value="Misafir İlişkileri">Misafir İlişkileri</option>
            <option value="Housekeeping">Housekeeping</option>
            <option value="Teknik Servis">Teknik Servis</option>
            <option value="Yiyecek & İçecek">Yiyecek & İçecek</option>
            <option value="Ön Büro">Ön Büro</option>
            <option value="Spa">Spa</option>
            <option value="Animasyon">Animasyon</option>
            <option value="Güvenlik">Güvenlik</option>
            <option value="Muhasebe">Muhasebe</option>
            <option value="Satış">Satış</option>
            <option value="Yönetim">Yönetim</option>
          </select>
        </div>

        {/* Platform Filter */}
        <div>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-blue-500 bg-white"
          >
            <option value="">Tüm Platformlar</option>
            <option value="google">Google</option>
            <option value="booking">Booking.com</option>
            <option value="tripadvisor">TripAdvisor</option>
            <option value="hotelscom">Hotels.com</option>
            <option value="holidaycheck">HolidayCheck</option>
          </select>
        </div>

        {/* Reset filters button */}
        <button 
          onClick={handleResetFilters}
          className="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs text-slate-650 hover:bg-slate-50 transition-colors font-bold cursor-pointer flex items-center justify-center gap-1.5"
        >
          <SlidersHorizontal size={12} />
          Filtreleri Temizle
        </button>
      </div>

      {/* THIRD ROW: Tabs */}
      <div className="flex border-b border-slate-200 gap-6 mb-6">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex items-center gap-2 px-3 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer relative ${
            activeTab === 'active' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Clock size={13} />
          AKTİF GÖREVLER ({activeTasksList.length})
        </button>

        <button
          onClick={() => setActiveTab('overdue')}
          className={`flex items-center gap-2 px-3 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer relative ${
            activeTab === 'overdue' 
              ? 'border-rose-600 text-rose-600' 
              : 'border-transparent text-slate-400 hover:text-rose-500'
          }`}
        >
          <AlertCircle size={13} />
          GECİKEN GÖREVLER ({overdueTasksList.length})
        </button>

        <button
          onClick={() => setActiveTab('completed')}
          className={`flex items-center gap-2 px-3 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer relative ${
            activeTab === 'completed' 
              ? 'border-emerald-600 text-emerald-600' 
              : 'border-transparent text-slate-400 hover:text-emerald-500'
          }`}
        >
          <CheckSquare size={13} />
          TAMAMLANAN GÖREVLER ({completedTasksList.length})
        </button>

        <button
          onClick={() => setActiveTab('archived')}
          className={`flex items-center gap-2 px-3 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer relative ${
            activeTab === 'archived' 
              ? 'border-purple-600 text-purple-600' 
              : 'border-transparent text-slate-400 hover:text-purple-500'
          }`}
        >
          <Bookmark size={13} />
          ARŞİVLENEN GÖREVLER ({archivedTasksList.length})
        </button>
      </div>

      {/* TASKS LIST */}
      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-44 bg-slate-50 border border-slate-100 rounded-2xl animate-pulse" />
          ))
        ) : error ? (
          <div className="p-6 rounded-2xl border-l-4 border-rose-500 text-rose-700 bg-rose-50 flex items-center gap-3">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        ) : currentTabList.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-[20px] p-12 text-center space-y-4 shadow-sm">
            <CheckSquare className="mx-auto text-slate-350" size={40} />
            <h3 className="text-sm font-bold text-slate-700">Görev bulunmamaktadır.</h3>
            <p className="text-xs text-slate-450 max-w-sm mx-auto">
              Seçtiğiniz filtreler veya sekme kapsamında herhangi bir görev bulunmuyor.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {currentTabList.map((task) => {
              const descParts = task.description.split('\n\nÇözüm Notu: ');
              const mainDesc = descParts[0];
              const resolutionText = task.resolutionNote || descParts[1] || '';

              const { reviewText, aiRecommendedAction } = (() => {
                const commentMatch = mainDesc.match(/Misafir Yorumu:\s*"([\s\S]*?)"/i);
                const actionMatch = mainDesc.match(/Yapay Zeka Aksiyon Önerisi:\s*([\s\S]*)/i);
                
                let rText = '';
                let aAction = '';
                
                if (commentMatch) rText = commentMatch[1];
                if (actionMatch) aAction = actionMatch[1].trim();
                
                if (!rText) rText = mainDesc;
                return { reviewText: rText, aiRecommendedAction: aAction };
              })();

              const guestName = task.metadata?.guest_name || 'Misafir';
              const rating = task.metadata?.rating;
              const reviewDate = task.metadata?.review_date;
              const isExpanded = expandedReviews[task.id] || false;

              // Priority left accent borders
              const leftAccentBorder = (() => {
                switch (task.priority) {
                  case 'critical': return 'border-l-4 border-l-rose-500';
                  case 'high': return 'border-l-4 border-l-amber-500';
                  case 'medium': return 'border-l-4 border-l-yellow-400';
                  case 'low':
                  default:
                    return 'border-l-4 border-l-slate-300';
                }
              })();

              const sla = getSlaStatus(task);

              return (
                <div 
                  key={task.id}
                  className={`bg-white border border-slate-200 p-5 rounded-[20px] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col md:flex-row justify-between gap-6 relative ${leftAccentBorder}`}
                >
                  {/* Left Column: Review details & AI recommendation */}
                  <div className="flex-1 space-y-4 min-w-0">
                    {/* Card Header */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-sm font-bold text-slate-850 truncate max-w-[280px]" title={task.title}>
                        {task.title}
                      </h3>
                      <span className={`px-2 py-0.5 text-[8.5px] font-black uppercase rounded border ${getPriorityBadgeClass(task.priority)}`}>
                        {getPriorityText(task.priority)}
                      </span>
                      <span className={`px-2 py-0.5 text-[8.5px] font-black uppercase rounded border ${getDepartmentBadgeClass(task.department)}`}>
                        {task.department}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-150 text-[9px] font-black font-mono">
                        {renderPlatformLogo(task.sourcePlatform || task.metadata?.platform)}
                        {task.sourcePlatform || task.metadata?.platform || 'Kaynak'}
                      </span>
                      {rating !== undefined && (
                        <span className="bg-amber-50 text-amber-700 border border-amber-250/70 px-2 py-0.5 rounded text-[9px] font-black shrink-0">
                          ★ {rating} Yıldız
                        </span>
                      )}
                      {task.reviewId && (
                        <span className="text-[10px] text-slate-400 font-mono font-semibold">
                          Ref Yorum: #{task.reviewId.substring(0, 8)}
                        </span>
                      )}
                    </div>

                    {/* Review text preview */}
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/50 text-xs">
                      <div className="flex justify-between items-center text-[10px] text-slate-450 font-bold uppercase mb-1.5">
                        <span>Misafir Yorumu ({guestName})</span>
                        {reviewDate && <span>Yorum Tarihi: {formatDate(reviewDate)}</span>}
                      </div>
                      
                      <div className="relative">
                        <p className={`text-slate-650 font-medium leading-relaxed italic transition-all duration-300 ${!isExpanded ? 'line-clamp-3' : ''}`}>
                          "{reviewText}"
                        </p>
                        {reviewText.length > 180 && (
                          <button
                            onClick={() => setExpandedReviews(prev => ({ ...prev, [task.id]: !isExpanded }))}
                            className="text-[10.5px] font-extrabold text-blue-600 hover:text-blue-700 mt-2 block cursor-pointer"
                          >
                            {!isExpanded ? 'Devamını oku ▾' : 'Gizle ▴'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Center: AI Action Highlight Card */}
                    {aiRecommendedAction && (
                      <div className="p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-100/80 text-xs">
                        <div className="flex items-center gap-1.5 text-indigo-700 font-bold mb-1.5">
                          <Sparkles size={12} className="text-indigo-600 animate-pulse" />
                          <span>Yapay Zeka Aksiyon Önerisi</span>
                        </div>
                        <p className="text-slate-650 leading-relaxed font-semibold">
                          {aiRecommendedAction}
                        </p>
                      </div>
                    )}

                    {/* Active completed resolution details display */}
                    {activeTab === 'completed' && resolutionText && (
                      <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-150 text-xs">
                        <div className="flex items-center gap-1.5 text-emerald-700 font-bold mb-1">
                          <CheckCircle2 size={12} />
                          <span>Çözüm Notu:</span>
                        </div>
                        <p className="text-slate-650 leading-relaxed italic font-semibold">
                          "{resolutionText}"
                        </p>
                      </div>
                    )}

                    {/* Bottom Metadata bar */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-slate-450 font-semibold mt-2 pt-2 border-t border-slate-100">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} className="text-slate-400" />
                        Oluşturulma: {formatDateTime(task.createdAt)}
                      </span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1">
                        <Clock size={11} className="text-slate-400" />
                        Son Güncelleme: {task.dueDate ? formatDate(task.dueDate) : formatDate(task.createdAt)}
                      </span>
                      <span>&bull;</span>
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[9px] font-black uppercase ${sla.colorClass}`}>
                        SLA: {sla.text}
                      </span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1">
                        <User size={11} className="text-slate-400" />
                        Atanan: {task.assignedTo || 'Atanmamış'}
                      </span>
                    </div>
                  </div>

                  {/* Right side Actions Panel */}
                  <div className="flex flex-col gap-2.5 justify-center md:border-l md:border-slate-100 md:pl-5 shrink-0 min-w-[170px]">
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${getStatusStyle(task.status)} justify-between w-full`}>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(task.status)}
                        <span className="text-[10px] font-extrabold text-current uppercase tracking-wide">
                          {getStatusText(task.status)}
                        </span>
                      </div>
                      {task.status !== 'completed' && (
                        <select
                          value={task.status}
                          disabled={!canManageTasks}
                          onChange={(e) => handleUpdateStatus(task.id, e.target.value)}
                          className="bg-transparent border-0 text-[10px] font-bold focus:outline-none capitalize cursor-pointer text-current max-w-[20px]"
                        >
                          <option value="open" className="bg-white text-slate-900">Açık</option>
                          <option value="in_progress" className="bg-white text-slate-900">Devam Ediyor</option>
                          <option value="waiting" className="bg-white text-slate-900">Beklemede</option>
                        </select>
                      )}
                    </div>

                    {task.status !== 'completed' && canManageTasks && (
                      <button
                        onClick={() => {
                          setCompletingTaskId(task.id);
                          setCompletionNote('');
                          setCompletionCategory('Teknik Çözüm');
                          setInternalComment('');
                        }}
                        className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer border border-emerald-700/10"
                      >
                        <Check size={13} />
                        Tamamlandı
                      </button>
                    )}

                    <button
                      onClick={() => setSelectedTaskDetails(task)}
                      className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-all cursor-pointer shadow-xs"
                    >
                      Detayları Gör &rarr;
                    </button>

                    {/* Three-dot dropdown menu */}
                    <div className="relative self-end mt-1">
                      <button
                        onClick={() => setOpenDropdownId(openDropdownId === task.id ? null : task.id)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer border border-slate-200/40"
                      >
                        <MoreVertical size={14} />
                      </button>
                      
                      {openDropdownId === task.id && (
                        <div className="absolute right-0 bottom-full mb-1 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1 text-xs">
                          <button
                            onClick={() => {
                              const newAssignee = window.prompt('Personel ismini giriniz:', task.assignedTo);
                              if (newAssignee !== null) {
                                handleAssignTask(task.id, newAssignee.trim());
                              }
                              setOpenDropdownId(null);
                            }}
                            className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer"
                          >
                            Atanan Kişiyi Değiştir
                          </button>
                          
                          {task.status !== 'completed' && (
                            <button
                              onClick={() => handleArchiveTask(task.id)}
                              className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer"
                            >
                              Görevi Ertele / Beklet
                            </button>
                          )}
                          
                          {isSuperAdmin && (
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="w-full text-left px-3.5 py-2 hover:bg-red-50 text-red-600 font-bold border-t border-slate-100 cursor-pointer"
                            >
                              Görevi Sil (Admin)
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RESOLUTION/COMPLETE MODAL */}
      {completingTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md p-6 rounded-[20px] border border-slate-200 relative shadow-2xl text-slate-800 animate-slide-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-slate-850 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 animate-bounce" />
                Görevi Kapat & Çözüm Gir
              </h3>
              <button 
                onClick={() => setCompletingTaskId(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-650 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Görev Başlığı</h4>
                <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-250/60 font-semibold">
                  {tasks?.find(t => t.id === completingTaskId)?.title}
                </p>
              </div>

              {/* Responsible Person */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wide">Sorumlu Personel</label>
                <select
                  value={responsibleUser}
                  onChange={(e) => setResponsibleUser(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-blue-500 bg-white"
                >
                  <option value="Ahmet Yılmaz (Misafir İlişkileri)">Ahmet Yılmaz (Misafir İlişkileri)</option>
                  <option value="Elif Kaya (Housekeeping)">Elif Kaya (Housekeeping)</option>
                  <option value="Mehmet Demir (Teknik)">Mehmet Demir (Teknik)</option>
                  <option value="Zeynep Şahin (Ön Büro)">Zeynep Şahin (Ön Büro)</option>
                </select>
              </div>

              {/* Completion Category */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wide">Çözüm Kategorisi</label>
                <select
                  value={completionCategory}
                  onChange={(e) => setCompletionCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-blue-500 bg-white"
                >
                  <option value="Teknik Çözüm">Teknik Çözüm</option>
                  <option value="Oda Değişikliği">Oda Değişikliği</option>
                  <option value="Özür İkramı">Özür İkramı (Meyve/Şarap vb.)</option>
                  <option value="Süreç İyileştirmesi">Süreç İyileştirmesi</option>
                  <option value="Genel Bilgilendirme">Genel Bilgilendirme</option>
                </select>
              </div>

              {/* Resolution Description */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wide">Çözüm Açıklaması / Notu</label>
                <textarea
                  required
                  rows={3}
                  value={completionNote}
                  onChange={(e) => setCompletionNote(e.target.value)}
                  placeholder="Misafirin şikayetinin nasıl çözüldüğünü ve alınan önlemleri detaylıca buraya yazın..."
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 resize-none"
                />
              </div>

              {/* Internal Comment */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wide">Dahili Not (Ekip İçi)</label>
                <textarea
                  rows={2}
                  value={internalComment}
                  onChange={(e) => setInternalComment(e.target.value)}
                  placeholder="Yönetim ve departman ekiplerinin göreceği kurum içi not..."
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setCompletingTaskId(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer border border-slate-200/50"
                >
                  Vazgeç
                </button>
                <button
                  onClick={handleSubmitCompletion}
                  disabled={isSubmittingCompletion || !completionNote.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmittingCompletion && <RefreshCw size={12} className="animate-spin" />}
                  Görevi Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DETAYLARI GÖR SLIDING SIDE PANEL */}
      {selectedTaskDetails && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/35 backdrop-blur-xs">
          {/* Backdrop closer click */}
          <div className="flex-1" onClick={() => setSelectedTaskDetails(null)} />
          
          {/* Slider content wrapper */}
          <div className="w-full max-w-xl bg-white border-l border-slate-200 h-full overflow-y-auto p-6 shadow-2xl flex flex-col justify-between animate-slide-in-right text-slate-800">
            <div className="space-y-6">
              {/* Slider Header */}
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">
                    Görev Detayları / SLA Planlama
                  </span>
                  <h3 className="text-sm font-bold text-slate-850 flex items-center gap-2">
                    {selectedTaskDetails.title}
                  </h3>
                </div>
                <button 
                  onClick={() => setSelectedTaskDetails(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer border border-slate-200/50"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Badges overview */}
              <div className="flex flex-wrap gap-2">
                <span className={`px-2.5 py-0.5 text-[8.5px] font-black uppercase rounded border ${getPriorityBadgeClass(selectedTaskDetails.priority)}`}>
                  {getPriorityText(selectedTaskDetails.priority)}
                </span>
                <span className={`px-2.5 py-0.5 text-[8.5px] font-black uppercase rounded border ${getDepartmentBadgeClass(selectedTaskDetails.department)}`}>
                  {selectedTaskDetails.department}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-150 text-[9px] font-black font-mono">
                  {renderPlatformLogo(selectedTaskDetails.sourcePlatform || selectedTaskDetails.metadata?.platform)}
                  {selectedTaskDetails.sourcePlatform || selectedTaskDetails.metadata?.platform || 'Platform'}
                </span>
                {selectedTaskDetails.metadata?.rating && (
                  <span className="bg-amber-50 text-amber-700 border border-amber-250/70 px-2 py-0.5 rounded text-[9px] font-black">
                    ★ {selectedTaskDetails.metadata.rating} Yıldız
                  </span>
                )}
              </div>

              {/* Full Guest review and platforms */}
              <div className="space-y-2">
                <h4 className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Misafir Yorumu</h4>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
                  <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold border-b border-slate-100 pb-1">
                    <span>Gönderen: {selectedTaskDetails.metadata?.guest_name || 'Misafir'}</span>
                    <span>Tarih: {formatDate(selectedTaskDetails.metadata?.review_date)}</span>
                  </div>
                  <p className="text-slate-700 italic leading-relaxed font-medium">
                    "{selectedTaskDetails.description.split('\n\nÇözüm Notu: ')[0]}"
                  </p>
                </div>
              </div>

              {/* AI action recommendation highlighted drawer item */}
              <div className="space-y-2">
                <h4 className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Yapay Zeka Analizleri</h4>
                <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 text-xs space-y-2">
                  <div className="flex items-center gap-1 text-indigo-700 font-bold">
                    <Sparkles size={13} />
                    <span>Aksiyon Planlama Önerisi</span>
                  </div>
                  <p className="text-slate-700 font-semibold leading-relaxed">
                    Misafir şikayeti {selectedTaskDetails.department} departmanı tarafından kontrol edilerek bakım veya telafi kaydı oluşturulmalı. Rezervasyon kanalı üzerinden misafirle iletişime geçilmeli.
                  </p>
                </div>
              </div>

              {/* Internal comments details and assignee updates */}
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <h4 className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Görev Atama & Not</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9.5px] font-bold text-slate-450 uppercase block">Atanan Personel</label>
                    <select
                      value={selectedTaskDetails.assignedTo || ''}
                      onChange={(e) => handleAssignTask(selectedTaskDetails.id, e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-blue-500 bg-white"
                    >
                      <option value="">Atanmamış</option>
                      <option value="Ahmet Yılmaz">Ahmet Yılmaz (Misafir İlişkileri)</option>
                      <option value="Elif Kaya">Elif Kaya (Housekeeping)</option>
                      <option value="Mehmet Demir">Mehmet Demir (Teknik)</option>
                      <option value="Zeynep Şahin">Zeynep Şahin (Ön Büro)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9.5px] font-bold text-slate-450 uppercase block">Hedef Termin (SLA)</label>
                    <div className="px-3 py-2 border border-slate-200 bg-slate-50 text-slate-700 rounded-xl text-xs font-bold font-mono">
                      {selectedTaskDetails.dueDate ? formatDate(selectedTaskDetails.dueDate) : '24 Saat (Otomatik)'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Activity log / timelines resolution history */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <h4 className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">İşlem Geçmişi (Timeline)</h4>
                
                <div className="space-y-3">
                  <div className="flex gap-3 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-700">Görev Oluşturuldu</span>
                      <p className="text-[10px] text-slate-400 font-semibold">{formatDateTime(selectedTaskDetails.createdAt)} &bull; Sistem Tetikleyici</p>
                    </div>
                  </div>
                  
                  {selectedTaskDetails.assignedTo && (
                    <div className="flex gap-3 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                      <div>
                        <span className="font-bold text-slate-700">Görev Atandı</span>
                        <p className="text-[10px] text-slate-400 font-semibold">Atanan Personel: {selectedTaskDetails.assignedTo}</p>
                      </div>
                    </div>
                  )}

                  {selectedTaskDetails.status === 'completed' && (
                    <div className="flex gap-3 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                      <div>
                        <span className="font-bold text-emerald-700">Görev Kapatıldı</span>
                        <p className="text-[10px] text-slate-400 font-semibold">{selectedTaskDetails.completedAt ? formatDateTime(selectedTaskDetails.completedAt) : '-'}</p>
                        {selectedTaskDetails.resolutionNote && (
                          <div className="mt-1 bg-slate-50 p-2 rounded-lg border border-slate-100 italic text-[11px] text-slate-600">
                            "{selectedTaskDetails.resolutionNote}"
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Slider bottom footer resolution triggers */}
            <div className="border-t border-slate-100 pt-4 mt-6 flex justify-end gap-2">
              <button
                onClick={() => setSelectedTaskDetails(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer border border-slate-200/50"
              >
                Kapat
              </button>
              
              {selectedTaskDetails.status !== 'completed' && canManageTasks && (
                <button
                  onClick={() => {
                    setCompletingTaskId(selectedTaskDetails.id);
                    setSelectedTaskDetails(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Check size={13} />
                  Görevi Tamamla
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

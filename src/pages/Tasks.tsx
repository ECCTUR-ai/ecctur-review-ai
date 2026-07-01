import React, { useState } from 'react';
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
  HelpCircle
} from 'lucide-react';

export default function Tasks() {
  const { t } = useTranslation();
  const { currentHotelId } = useOutletContext<{ currentHotelId: string }>();
  const { hasPermission } = useAuth();
  const canManageTasks = hasPermission('manage:tasks');
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');

  // Fetch tasks with filters
  const {
    data: tasks,
    loading,
    error,
    refetch
  } = useFetch(() => taskService.getTasks({
    hotelId: currentHotelId || undefined,
    status: status || undefined,
    priority: priority || undefined,
    department: department || undefined,
    search: search || undefined
  }), [currentHotelId, status, priority, department, search]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await taskService.updateTaskStatus(id, newStatus);
      refetch();
    } catch (e: any) {
      alert(`Could not update task status: ${e.message}`);
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

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="border-b border-slate-200 pb-6">
        <h1 className="text-xl font-bold text-slate-100 m-0">{t('tasks.title')}</h1>
        <p className="text-xs text-slate-400 mt-1.5">
          {t('tasks.subtitle')}
        </p>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl glass-panel grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('tasks.search')}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300 placeholder:text-slate-500"
          />
        </div>

        {/* Priority */}
        <div>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
          >
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        {/* Department */}
        <div>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
          >
            <option value="">All Departments</option>
            <option value="Front Office">Front Office</option>
            <option value="Housekeeping">Housekeeping</option>
            <option value="Food & Beverage">Food & Beverage</option>
            <option value="Spa & Wellness">Spa & Wellness</option>
            <option value="Technical Service">Technical Service</option>
          </select>
        </div>

        {/* Status */}
        <div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
          >
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="waiting">Waiting</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Tasks Listing */}
      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-white/[0.01] border border-slate-200 animate-pulse" />
          ))
        ) : error ? (
          <div className="glass-panel p-6 rounded-2xl border-l-4 border-rose-500 text-rose-400 bg-rose-950/10 flex items-center gap-3">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        ) : !tasks || tasks.length === 0 ? (
          <div className="glass-panel rounded-2xl p-12 text-center space-y-4">
            <CheckSquare className="mx-auto text-slate-600" size={40} />
            <h3 className="text-sm font-semibold text-slate-400">{t('tasks.empty')}</h3>
            <p className="text-xs text-slate-500 max-w-[280px] mx-auto">
              There are currently no internal action tasks logged.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {tasks.map((task) => (
              <div 
                key={task.id} 
                className="p-5 rounded-2xl border border-slate-200 bg-[#090b16] hover:bg-white/40 hover:border-slate-200 transition-all duration-300 flex flex-col md:flex-row justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-sm font-semibold text-slate-200">{task.title}</h3>
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-mono font-semibold uppercase ${getPriorityBadgeClass(task.priority)}`}>
                      {task.priority}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Ref: #{task.reviewId.substring(0, 8)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                    {task.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-500 font-mono mt-1">
                    <span className="flex items-center gap-1">
                      <Building size={11} className="text-slate-600" />
                      {task.department}
                    </span>
                    <span>&bull;</span>
                    <span className="flex items-center gap-1">
                      <User size={11} className="text-slate-600" />
                      Assigned to: {task.assignedTo || 'Unassigned'}
                    </span>
                    <span>&bull;</span>
                    <span className="flex items-center gap-1">
                      <Calendar size={11} className="text-slate-600" />
                      Due Date: {task.dueDate}
                    </span>
                  </div>
                </div>

                {/* Inline Status Controller */}
                <div className="flex items-center gap-3 self-start md:self-center shrink-0">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200">
                    {getStatusIcon(task.status)}
                    <select
                      value={task.status}
                      disabled={!canManageTasks}
                      onChange={(e) => handleUpdateStatus(task.id, e.target.value)}
                      className="bg-transparent border-0 text-[10px] font-semibold focus:outline-none text-slate-300 capitalize cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="waiting">Waiting</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Review, ReviewStatus } from '@/types';
import { StarRating } from './StarRating';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { taskService } from '@/services/taskService';
import { 
  Sparkles, 
  Send, 
  Globe, 
  CheckCircle, 
  Edit3, 
  MessageSquare,
  Activity,
  Heart,
  Tag,
  Check,
  Clock,
  Shield,
  MessageCircle,
  AlertTriangle,
  UserCheck,
  ChevronRight,
  UserPlus,
  Building,
  Save,
  CheckSquare,
  History,
  FileText
} from 'lucide-react';
import { useAuth } from './AuthGuard';

interface ReviewDetailPanelProps {
  review: Review;
  onUpdateStatus: (id: string, status: any) => void;
  onSubmitResponse: (id: string, response: string) => void;
  onSaveDraft: (id: string, response: string) => void;
  onGenerateAiReply: (id: string) => Promise<string>;
  onUpdateNotes: (id: string, managerNotes: string, internalNotes: string) => void;
}

export function ReviewDetailPanel({
  review,
  onUpdateStatus,
  onSubmitResponse,
  onSaveDraft,
  onGenerateAiReply,
  onUpdateNotes,
}: ReviewDetailPanelProps) {
  const { hasPermission } = useAuth();
  const canManageReviews = hasPermission('manage:reviews');
  const canManageTasks = hasPermission('manage:tasks');
  const isEditable = canManageReviews;

  const [responseVal, setResponseVal] = useState(review.response || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [managerNotes, setManagerNotes] = useState(review.managerNotes || '');
  const [internalNotes, setInternalNotes] = useState(review.internalNotes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // Task creation local states
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskDept, setTaskDept] = useState(review.departments[0] || 'Front Office');
  const [taskAssigned, setTaskAssigned] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskPriority, setTaskPriority] = useState(review.priority);
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  const [taskCreatedToast, setTaskCreatedToast] = useState(false);

  useEffect(() => {
    setResponseVal(review.response || '');
    setManagerNotes(review.managerNotes || '');
    setInternalNotes(review.internalNotes || '');
    
    // Reset task form default values
    setTaskTitle(`Action Required: Review from ${review.guestName}`);
    setTaskDescription(`Please look into the guest complaint: "${review.comment}"`);
    setTaskDept(review.departments[0] || 'Front Office');
    setTaskAssigned('');
    const d = new Date();
    d.setDate(d.getDate() + 3);
    setTaskDueDate(d.toISOString().split('T')[0]);
    setTaskPriority(review.priority);
    setShowTaskForm(false);
  }, [review]);

  const handleGenerateReply = async () => {
    setIsGenerating(true);
    try {
      const generated = await onGenerateAiReply(review.id);
      setResponseVal(generated);
    } catch (e) {
      // Handled in caller
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    try {
      await onUpdateNotes(review.id, managerNotes, internalNotes);
    } catch (e) {
      // Handled
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingTask(true);
    try {
      await taskService.createTask({
        reviewId: review.id,
        title: taskTitle,
        description: taskDescription,
        department: taskDept,
        assignedTo: taskAssigned,
        dueDate: taskDueDate,
        priority: taskPriority,
        status: 'open',
        hotelId: review.hotelId,
        organizationId: review.organizationId
      });
      setShowTaskForm(false);
      setTaskCreatedToast(true);
      setTimeout(() => setTaskCreatedToast(false), 3000);
    } catch (err: any) {
      alert(`Error creating task: ${err.message}`);
    } finally {
      setIsSubmittingTask(false);
    }
  };

  // Mock / Computed fields for operational metrics based on real data
  const confidenceScore = review.aiAnalysis?.sentimentScore || (review.rating >= 4 ? 94 : 88);
  const emotionDetected = review.aiAnalysis?.emotion || (review.rating >= 4 ? 'Gratitude' : 'Frustration');
  const topics = review.aiAnalysis?.keyTopics || ['Cleanliness', 'Service', 'Front Office'];
  const departmentName = review.departments[0] || 'Front Office';

  const isNegativeOrHighPriority = review.sentiment === 'negative' || review.priority === 'high' || review.priority === 'critical';

  // AI Summary generation based on real data values
  const aiSummaryText = review.aiAnalysis
    ? `Guest expressed ${review.aiAnalysis.sentiment} sentiment highlighting ${review.aiAnalysis.keyTopics.join(', ')}. Key emotional tone is detected as ${review.aiAnalysis.emotion}.`
    : `Guest left a ${review.rating}-star review on ${review.source} platform. Main comments emphasize "${review.comment.substring(0, 60)}...". Action is required.`;

  return (
    <div className="glass-panel rounded-2xl flex flex-col h-[85vh] overflow-hidden border border-white/[0.06] bg-[#090b16]/95 shadow-2xl relative">
      {/* Upper header section */}
      <div className="p-5 border-b border-white/[0.04] bg-[#0c0f20]/50 flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-sm font-mono text-slate-400 tracking-wider">WORKSPACE // REVIEW OPERATIONS CENTER</h2>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 border border-blue-500/20 text-blue-400">
          <Activity size={10} />
          <span>Realtime Connection Online</span>
        </div>
      </div>

      {/* Main Workspace Body - Scrollable Independently */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin scrollbar-thumb-white/10">
        
        {/* 1. Top Section */}
        <div className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.01] space-y-3">
          <div className="flex justify-between items-start gap-4">
            <div>
              <h3 className="text-base font-semibold text-slate-200">{review.guestName}</h3>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 font-mono mt-1">
                <span className="flex items-center gap-1">
                  <Building size={12} className="text-slate-400" />
                  {review.hotel || 'Demo Hotel'}
                </span>
                <span>&bull;</span>
                <span>Channel: {review.source}</span>
                <span>&bull;</span>
                <span>Date: {review.date}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <StarRating rating={review.rating} />
              <StatusBadge status={review.status} />
            </div>
          </div>
        </div>

        {/* 2. Guest Review (Beautiful Read-Only Card) */}
        <div className="p-4 rounded-xl border border-white/[0.04] bg-[#080a15] space-y-2">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <FileText size={11} className="text-slate-400" />
            Guest Review Comments
          </h4>
          <div className="p-3.5 rounded-lg bg-slate-950/60 border border-white/[0.02]">
            <p className="text-xs text-slate-300 leading-relaxed italic">
              "{review.comment}"
            </p>
          </div>
        </div>

        {/* 3. AI Summary */}
        <div className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.01] space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Sparkles size={11} className="text-blue-400" />
              AI Summary Overview
            </h4>
            {isNegativeOrHighPriority && canManageTasks && (
              <button
                onClick={() => setShowTaskForm(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 text-[10px] font-bold text-rose-400 transition-colors"
              >
                <CheckSquare size={11} />
                <span>Create Action Task</span>
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400 leading-relaxed bg-blue-500/[0.02] border border-blue-500/10 p-3 rounded-lg">
            {aiSummaryText}
          </p>
        </div>

        {/* 4. AI Reply Editor */}
        <div className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.01] space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare size={12} className="text-blue-400" />
              AI Reply Editor
            </h4>
            <span className="text-[10px] text-slate-500 font-mono">
              Status: <span className="text-blue-400 font-semibold uppercase">{review.status}</span>
            </span>
          </div>

          <div className="rounded-xl border bg-slate-900 border-blue-500/20">
            <textarea
              value={responseVal}
              onChange={(e) => setResponseVal(e.target.value)}
              disabled={!isEditable}
              className="w-full h-32 p-3 bg-transparent border-0 text-xs focus:outline-none text-slate-300 leading-relaxed resize-none disabled:opacity-50"
              placeholder={isEditable ? "Load AI suggested draft reply to edit..." : "Read only mode - drafting is disabled"}
            />
            
            <div className="flex flex-wrap justify-between items-center gap-2 px-4 py-2 border-t border-white/[0.03] bg-[#0c0f22]/20">
              <div className="flex gap-1.5">
                {isEditable && (
                  <>
                    <button
                      type="button"
                      onClick={() => onSaveDraft(review.id, responseVal)}
                      className="px-2.5 py-1 rounded bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.08] text-[10px] font-semibold text-slate-300 transition-colors"
                    >
                      Save Draft
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerateReply}
                      disabled={isGenerating}
                      className="px-2.5 py-1 rounded bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.08] text-[10px] font-semibold text-blue-400 transition-colors disabled:opacity-50"
                    >
                      {isGenerating ? 'Generating...' : 'Regenerate'}
                    </button>
                  </>
                )}
              </div>

              <div className="flex gap-1.5">
                {isEditable && (
                  <>
                    <button
                      type="button"
                      onClick={() => onUpdateStatus(review.id, 'waiting_approval')}
                      className="px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15 text-[10px] font-semibold text-amber-400 transition-colors"
                    >
                      Approve Draft
                    </button>
                    <button
                      type="button"
                      onClick={() => onSubmitResponse(review.id, responseVal)}
                      className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-[10px] font-semibold text-white transition-colors"
                    >
                      Publish Live
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 5. Manager Section */}
        <div className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.01] space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck size={12} className="text-purple-400" />
              Manager & Internal Notes
            </h4>
            {isEditable && (
              <button
                onClick={handleSaveNotes}
                disabled={isSavingNotes}
                className="text-[10px] text-purple-400 hover:text-purple-300 font-bold transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                <Save size={10} />
                {isSavingNotes ? 'Saving...' : 'Save Notes'}
              </button>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">Manager Action Notes</label>
              <textarea
                value={managerNotes}
                onChange={(e) => setManagerNotes(e.target.value)}
                disabled={!isEditable}
                placeholder={isEditable ? "Type response checklist or instructions for hotel staff..." : "Read only - notes are disabled"}
                className="w-full h-16 p-2 rounded-lg bg-slate-950/40 border border-white/[0.03] text-xs text-slate-300 focus:outline-none focus:border-purple-500/30 resize-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">Internal Log Notes</label>
              <textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                disabled={!isEditable}
                placeholder={isEditable ? "Audit logs, staff assignments, or internal follow ups..." : "Read only - notes are disabled"}
                className="w-full h-16 p-2 rounded-lg bg-slate-950/40 border border-white/[0.03] text-xs text-slate-300 focus:outline-none focus:border-purple-500/30 resize-none disabled:opacity-50"
              />
            </div>
          </div>
        </div>

        {/* 6. Workflow */}
        <div className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.01] space-y-3">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Shield size={11} className="text-purple-400" />
            Workflow Status Grid
          </h4>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-950/30 border border-white/[0.02]">
              <span className="text-[10px] text-slate-500 block mb-0.5">Current Status</span>
              <StatusBadge status={review.status} />
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950/30 border border-white/[0.02]">
              <span className="text-[10px] text-slate-500 block mb-0.5">Google Sync</span>
              <span className={`font-semibold ${review.status === 'published' ? 'text-emerald-400' : 'text-slate-400'}`}>
                {review.status === 'published' ? 'Published' : 'Pending'}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950/30 border border-white/[0.02]">
              <span className="text-[10px] text-slate-500 block mb-0.5">Priority</span>
              <PriorityBadge priority={review.priority} />
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950/30 border border-white/[0.02]">
              <span className="text-[10px] text-slate-500 block mb-0.5">Department</span>
              <span className="font-semibold text-slate-300 capitalize">{departmentName}</span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950/30 border border-white/[0.02]">
              <span className="text-[10px] text-slate-500 block mb-0.5">Sentiment</span>
              <span className={`font-semibold capitalize ${
                review.sentiment === 'positive' ? 'text-emerald-400' : review.sentiment === 'neutral' ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {review.sentiment}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950/30 border border-white/[0.02]">
              <span className="text-[10px] text-slate-500 block mb-0.5">Confidence</span>
              <span className="font-semibold text-emerald-400">{confidenceScore}%</span>
            </div>
          </div>
        </div>

        {/* 7. Timeline */}
        <div className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.01] space-y-4">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <History size={11} className="text-blue-400" />
            Audit Log Timeline
          </h4>
          
          <div className="relative border-l border-white/[0.06] ml-3 pl-6 space-y-5">
            {/* 1. Review received */}
            <div className="relative">
              <div className="absolute -left-[30px] top-1 w-4 h-4 rounded-full bg-blue-500/20 border border-blue-500 flex items-center justify-center">
                <Check size={10} className="text-blue-400" />
              </div>
              <div className="text-xs">
                <span className="font-semibold text-slate-300">Review Received</span>
                <span className="text-[10px] text-slate-500 ml-2">&bull; Ingest complete</span>
              </div>
            </div>

            {/* 2. AI Analysed */}
            <div className="relative">
              <div className="absolute -left-[30px] top-1 w-4 h-4 rounded-full bg-blue-500/20 border border-blue-500 flex items-center justify-center">
                <Check size={10} className="text-blue-400" />
              </div>
              <div className="text-xs">
                <span className="font-semibold text-slate-300">AI Analysed</span>
                <span className="text-[10px] text-slate-500 ml-2">&bull; Quality score: {review.aiAnalysis?.qualityScore || 90}%</span>
              </div>
            </div>

            {/* 3. Draft Generated */}
            <div className="relative">
              <div className="absolute -left-[30px] top-1 w-4 h-4 rounded-full bg-blue-500/20 border border-blue-500 flex items-center justify-center">
                <Check size={10} className="text-blue-400" />
              </div>
              <div className="text-xs">
                <span className="font-semibold text-slate-300">Draft Generated</span>
                <span className="text-[10px] text-slate-500 ml-2">&bull; AI response mapped</span>
              </div>
            </div>

            {/* 4. Manager Approved */}
            <div className="relative">
              <div className={`absolute -left-[30px] top-1 w-4 h-4 rounded-full flex items-center justify-center border ${
                review.status !== 'draft' ? 'bg-blue-500/20 border-blue-500' : 'bg-slate-900 border-white/[0.08]'
              }`}>
                {review.status !== 'draft' ? (
                  <Check size={10} className="text-blue-400" />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-600 animate-pulse" />
                )}
              </div>
              <div className="text-xs">
                <span className="font-semibold text-slate-300">Manager Approved</span>
                <span className="text-[10px] text-slate-500 ml-2">
                  {review.status !== 'draft' ? 'Approved & locked' : 'Awaiting review'}
                </span>
              </div>
            </div>

            {/* 5. Published */}
            <div className="relative">
              <div className={`absolute -left-[30px] top-1 w-4 h-4 rounded-full flex items-center justify-center border ${
                review.status === 'published' ? 'bg-blue-500/20 border-blue-500' : 'bg-slate-900 border-white/[0.08]'
              }`}>
                {review.status === 'published' ? (
                  <Check size={10} className="text-blue-400" />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                )}
              </div>
              <div className="text-xs">
                <span className="font-semibold text-slate-300">Published Live</span>
                <span className="text-[10px] text-slate-500 ml-2">
                  {review.status === 'published' ? 'Sync posted' : 'Sync pending'}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
      
      {/* Footer bar */}
      <div className="p-3.5 bg-[#0a0d1d]/80 border-t border-white/[0.04] flex justify-between items-center text-[10px] text-slate-500 shrink-0">
        <span>Logged in as Admin Partner</span>
        <span className="font-mono text-slate-600">v1.1.2-beta</span>
      </div>

      {/* Task Creation Modal Overlay */}
      {showTaskForm && (
        <div className="absolute inset-0 bg-[#060814]/90 backdrop-blur-sm z-30 p-5 flex flex-col justify-center overflow-y-auto">
          <form onSubmit={handleCreateTask} className="glass-panel p-5 rounded-2xl border border-white/[0.06] bg-[#090b16] space-y-4 max-w-md mx-auto w-full">
            <div>
              <h3 className="text-sm font-bold text-slate-200">Create Action Task</h3>
              <p className="text-[10px] text-slate-500 mt-1">Assign an internal action task for this review.</p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Task Title</label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/[0.06] focus:outline-none focus:border-blue-500 text-slate-300"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Description</label>
                <textarea
                  required
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  className="w-full h-20 p-2 rounded-lg bg-slate-900 border border-white/[0.06] focus:outline-none focus:border-blue-500 text-slate-300 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Department</label>
                  <select
                    value={taskDept}
                    onChange={(e) => setTaskDept(e.target.value)}
                    className="w-full px-2 py-2 rounded-lg bg-slate-900 border border-white/[0.06] focus:outline-none focus:border-blue-500 text-slate-300"
                  >
                    <option value="Front Office">Front Office</option>
                    <option value="Housekeeping">Housekeeping</option>
                    <option value="Food & Beverage">Food & Beverage</option>
                    <option value="Spa & Wellness">Spa & Wellness</option>
                    <option value="Technical Service">Technical Service</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as any)}
                    className="w-full px-2 py-2 rounded-lg bg-slate-900 border border-white/[0.06] focus:outline-none focus:border-blue-500 text-slate-300"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Assignee</label>
                  <input
                    type="text"
                    placeholder="Staff name"
                    value={taskAssigned}
                    onChange={(e) => setTaskAssigned(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/[0.06] focus:outline-none focus:border-blue-500 text-slate-300"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/[0.06] focus:outline-none focus:border-blue-500 text-slate-300"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowTaskForm(false)}
                className="px-4 py-2 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs font-semibold text-slate-300 hover:bg-white/[0.05]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingTask}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors"
              >
                {isSubmittingTask ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Task Created Toast Alert */}
      {taskCreatedToast && (
        <div className="absolute bottom-16 right-5 z-40 p-3.5 rounded-xl border border-emerald-500/25 bg-emerald-950/20 backdrop-blur-md text-emerald-400 text-[10px] font-semibold flex items-center gap-2 animate-slide-in">
          <Check size={14} />
          <span>Task logged & assigned successfully</span>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Review, ReviewStatus } from '@/types';
import { StarRating } from './StarRating';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { taskService } from '@/services/taskService';
import { generateTaskMetadata } from '@/utils/taskMetadata';
import { 
  Sparkles, 
  Send, 
  Globe, 
  CheckCircle, 
  Edit3, 
  MessageSquare,
  Activity,
  Check,
  Shield,
  Save,
  CheckSquare,
  History,
  FileText,
  Copy,
  Share2,
  Building,
  Languages,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from './AuthGuard';
import { reviewService } from '@/services/reviewService';

interface ReviewDetailPanelProps {
  review: Review;
  onUpdateStatus: (id: string, status: any, responseText?: string) => void;
  onSubmitResponse: (id: string, response: string) => void;
  onSaveDraft: (id: string, response: string) => void;
  onGenerateAiReply: (id: string) => Promise<string>;
  onUpdateNotes: (id: string, managerNotes: string, internalNotes: string) => void;
  onPublishGoogleReply?: (id: string, replyText: string) => Promise<void>;
}

export function ReviewDetailPanel({
  review,
  onUpdateStatus,
  onSubmitResponse,
  onSaveDraft,
  onGenerateAiReply,
  onUpdateNotes,
  onPublishGoogleReply,
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
  const [copied, setCopied] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingApproval, setIsSendingApproval] = useState(false);


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

  // Translation local states
  const [selectedLang, setSelectedLang] = useState<'tr' | 'en' | 'ru' | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);

  useEffect(() => {
    setResponseVal(review.response || '');
    setManagerNotes(review.managerNotes || '');
    setInternalNotes(review.internalNotes || '');
    setSelectedLang(null);
    setTranslations({});
    setTranslationError(null);
    setTranslating(false);
    
    // Reset task form default values
    setTaskTitle(`Eylem Gerekiyor: ${review.guestName} tarafından yorum`);
    setTaskDescription(`Misafir şikayetini inceleyin: "${review.comment}"`);
    setTaskDept(review.departments[0] || 'Front Office');
    setTaskAssigned('');
    const d = new Date();
    d.setDate(d.getDate() + 3);
    setTaskDueDate(d.toISOString().split('T')[0]);
    setTaskPriority(review.priority);
    setShowTaskForm(false);
  }, [review]);

  const handleTranslate = (lang: 'tr' | 'en' | 'ru') => {
    if (selectedLang === lang) {
      setSelectedLang(null);
      return;
    }
    
    setSelectedLang(lang);
    setTranslationError(null);

    if (translations[lang]) {
      return;
    }

    setTranslating(true);
    setTimeout(async () => {
      try {
        const translated = await reviewService.translateReview(review.comment || '', lang);
        setTranslations(prev => ({ ...prev, [lang]: translated }));
      } catch (err: any) {
        console.error('Translation failed:', err);
        setTranslationError('Çeviri yapılamadı.');
      } finally {
        setTranslating(false);
      }
    }, 50);
  };

  const handleGenerateReply = () => {
    setIsGenerating(true);
    setTimeout(async () => {
      try {
        const generated = await onGenerateAiReply(review.id);
        setResponseVal(generated);
      } catch (e) {
        console.error(e);
      } finally {
        setIsGenerating(false);
      }
    }, 50);
  };

  const handleSaveNotes = () => {
    setIsSavingNotes(true);
    setTimeout(async () => {
      try {
        await onUpdateNotes(review.id, managerNotes, internalNotes);
      } catch (e) {
        console.error(e);
      } finally {
        setIsSavingNotes(false);
      }
    }, 50);
  };

  const handleCopy = () => {
    if (!responseVal) return;
    navigator.clipboard.writeText(responseVal);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(`Misafir Yorumu (${review.guestName}):\n"${review.comment}"\n\nAI Önerilen Cevap:\n"${responseVal}"`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handlePublishGoogleClick = () => {
    const rawText = responseVal || review.response || (review as any).owner_reply_text || '';
    const trimmedText = rawText.trim();
    
    if (!trimmedText) {
      alert("Cevap metni boş olamaz.");
      return;
    }

    if (!onPublishGoogleReply) return;
    
    setIsPublishing(true);
    setTimeout(async () => {
      const confirmPublish = window.confirm("Bu cevabı Google Business üzerinde yayınlamak istiyor musunuz?");
      if (!confirmPublish) {
        setIsPublishing(false);
        return;
      }
      try {
        await onPublishGoogleReply(review.id, trimmedText);
      } catch (err: any) {
        console.error(err);
        alert(err.message || 'Yayınlama sırasında bir hata oluştu.');
      } finally {
        setIsPublishing(false);
      }
    }, 50);
  };

  const handleSaveDraftClick = () => {
    setIsSavingDraft(true);
    setTimeout(async () => {
      try {
        await onSaveDraft(review.id, responseVal);
      } catch (e) {
        console.error(e);
      } finally {
        setIsSavingDraft(false);
      }
    }, 50);
  };

  const handleUpdateStatusClick = () => {
    setIsSendingApproval(true);
    setTimeout(async () => {
      try {
        await onUpdateStatus(review.id, 'pending_approval', responseVal);
      } catch (e) {
        console.error(e);
      } finally {
        setIsSendingApproval(false);
      }
    }, 50);
  };

  const handleSubmitResponseClick = () => {
    setIsSubmitting(true);
    setTimeout(async () => {
      try {
        await onSubmitResponse(review.id, responseVal);
      } catch (e) {
        console.error(e);
      } finally {
        setIsSubmitting(false);
      }
    }, 50);
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingTask(true);
    setTimeout(async () => {
      try {
        const metadataPayload = generateTaskMetadata(
          review.comment || '',
          review.rating,
          review.guestName || 'Misafir',
          review.source || 'Google',
          review.date || new Date().toISOString()
        );

        await taskService.createTask({
          reviewId: review.id,
          title: taskTitle,
          description: taskDescription + `\nYapay Zeka Aksiyon Önerisi: ${metadataPayload.ai_recommended_action}`,
          department: taskDept,
          assignedTo: taskAssigned,
          dueDate: taskDueDate,
          priority: taskPriority,
          status: 'open',
          hotelId: review.hotelId,
          organizationId: review.organizationId,
          metadata: metadataPayload
        });
        setShowTaskForm(false);
        setTaskCreatedToast(true);
        setTimeout(() => setTaskCreatedToast(false), 3000);
      } catch (err: any) {
        alert(`Görev oluşturma hatası: ${err.message}`);
      } finally {
        setIsSubmittingTask(false);
      }
    }, 50);
  };

  const confidenceScore = review.aiAnalysis?.sentimentScore || (review.rating >= 4 ? 94 : 88);
  const departmentName = review.departments[0] || 'Front Office';
  const isNegativeOrHighPriority = review.sentiment === 'negative' || review.priority === 'high' || review.priority === 'critical';

  const aiSummaryText = review.aiAnalysis
    ? `Misafir ${review.aiAnalysis.sentiment === 'positive' ? 'pozitif' : review.aiAnalysis.sentiment === 'negative' ? 'negatif' : 'nötr'} deneyim bildirdi. Öne çıkan konular: ${review.aiAnalysis.keyTopics.join(', ')}. Tespit edilen duygu tonu: ${review.aiAnalysis.emotion}.`
    : `Misafir ${review.source} platformunda ${review.rating} puanlı bir yorum bıraktı. Yorum özeti: "${review.comment.substring(0, 60)}...". Aksiyon alınması önerilir.`;

  return (
    <div className="glass-panel rounded-2xl flex flex-col h-[85vh] overflow-hidden border border-slate-200 bg-white shadow-xl relative text-slate-800">
      {/* Upper header section */}
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">GuestReview.ai // ANALİZ MERKEZİ</h2>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 border border-blue-100 text-blue-600">
          <Activity size={10} />
          <span>Realtime Analiz Aktif</span>
        </div>
      </div>

      {/* Main Workspace Body - Scrollable */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin scrollbar-thumb-slate-200">
        
        {/* 1. Top Section - Guest info */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
          <div className="flex justify-between items-start gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-800">{review.guestName}</h3>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 font-semibold mt-1">
                <span className="flex items-center gap-1">
                  <Building size={12} className="text-slate-400" />
                  {review.hotel || 'Demo Hotel'}
                </span>
                <span>&bull;</span>
                <span>Platform: {review.source}</span>
                <span>&bull;</span>
                <span>Tarih: {review.date}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <StarRating rating={review.rating} />
              <StatusBadge status={review.status} />
            </div>
          </div>
        </div>

        {/* 2. Guest Review Comment */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
          <div className="flex justify-between items-center">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <FileText size={11} className="text-slate-400" />
              MİSAFİR YORUMU
            </h4>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-slate-500 font-semibold bg-white border border-slate-200 rounded-md px-1.5 py-0.5 shadow-sm">
                Orijinal Dil: {reviewService.detectLanguage(review.comment || '').toUpperCase()}
              </span>
              <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm">
                {(['tr', 'en', 'ru'] as const).map(lang => (
                  <button
                    key={lang}
                    onClick={() => handleTranslate(lang)}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider transition-all ${
                      selectedLang === lang
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-white border border-slate-200/60">
            <p className="text-xs text-slate-700 leading-relaxed italic">
              "{review.comment}"
            </p>

            {/* Translating State */}
            {translating && (
              <div className="mt-3.5 pt-3.5 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-400 font-semibold">
                <div className="w-3.5 h-3.5 rounded-full border-2 border-t-blue-500 border-slate-100 animate-spin" />
                <span>Çevriliyor...</span>
              </div>
            )}

            {/* Translation Error */}
            {!translating && translationError && (
              <div className="mt-3.5 pt-3.5 border-t border-slate-100 flex items-center gap-1.5 text-xs text-red-500 font-semibold">
                <AlertTriangle size={12} />
                <span>{translationError}</span>
              </div>
            )}

            {/* Translated Output */}
            {!translating && selectedLang && translations[selectedLang] && (
              <div className="mt-3.5 pt-3.5 border-t border-slate-100 space-y-1.5">
                <div className="flex items-center gap-1 text-[9px] text-blue-600 font-bold uppercase tracking-wider">
                  <Languages size={10} />
                  <span>Çeviri ({selectedLang.toUpperCase()}):</span>
                </div>
                <p className="text-xs text-slate-800 bg-blue-50/30 border border-blue-50/60 rounded-xl p-3 leading-relaxed italic">
                  "{translations[selectedLang]}"
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 3. AI Summary */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={11} className="text-blue-500" />
              AI Özet Analizi
            </h4>
            {isNegativeOrHighPriority && canManageTasks && (
              <button
                onClick={() => setShowTaskForm(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-100 text-[10px] font-bold text-rose-600 transition-colors"
              >
                <CheckSquare size={11} />
                <span>Görev Oluştur</span>
              </button>
            )}
          </div>
          <p className="text-xs text-slate-600 leading-relaxed bg-blue-50/50 border border-blue-100 p-3 rounded-lg">
            {aiSummaryText}
          </p>
        </div>

        {/* 4. AI Analysis Dashboard metrics */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Shield size={11} className="text-purple-500" />
            AI Analiz Kartları
          </h4>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-white border border-slate-200">
              <span className="text-[10px] text-slate-500 font-semibold block mb-1">Duygu</span>
              <span className={`font-bold capitalize ${
                review.sentiment === 'positive' ? 'text-emerald-600' : review.sentiment === 'neutral' ? 'text-amber-600' : 'text-rose-600'
              }`}>
                {review.sentiment === 'positive' ? 'Pozitif' : review.sentiment === 'negative' ? 'Negatif' : 'Nötr'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white border border-slate-200">
              <span className="text-[10px] text-slate-500 font-semibold block mb-1">Departman</span>
              <span className="font-bold text-slate-800 capitalize">{departmentName}</span>
            </div>

            <div className="p-3 rounded-xl bg-white border border-slate-200">
              <span className="text-[10px] text-slate-500 font-semibold block mb-1">Öncelik</span>
              <PriorityBadge priority={review.priority} />
            </div>

            <div className="p-3 rounded-xl bg-white border border-slate-200">
              <span className="text-[10px] text-slate-500 font-semibold block mb-1">Kalite Skoru</span>
              <span className="font-bold text-emerald-600">{confidenceScore}%</span>
            </div>
          </div>
        </div>

        {/* 5. AI Response Draft Editor */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare size={12} className="text-blue-500" />
              AI Yanıt Taslağı
            </h4>
            <span className="text-[10px] text-slate-500 font-mono">
              Durum: <span className="text-blue-600 font-bold uppercase">{review.status}</span>
            </span>
          </div>

          {!responseVal ? (
            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-xl bg-white space-y-3">
              <Sparkles size={24} className="text-blue-500 animate-pulse" />
              <p className="text-xs text-slate-500 font-semibold">AI yanıt henüz oluşturulmadı</p>
              {isEditable && (
                <button
                  type="button"
                  onClick={handleGenerateReply}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-blue-500/10"
                >
                  {isGenerating ? 'AI Oluşturuluyor...' : 'AI Yanıt Oluştur'}
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-xl border bg-white border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all overflow-hidden">
              <textarea
                value={responseVal}
                onChange={(e) => setResponseVal(e.target.value)}
                disabled={!isEditable}
                className="w-full h-36 p-3 bg-transparent border-0 text-xs focus:outline-none text-slate-700 leading-relaxed resize-none disabled:opacity-50"
                placeholder="Yorum cevabını düzenleyin..."
              />
              
              <div className="flex flex-wrap justify-between items-center gap-2 px-4 py-2.5 border-t border-slate-200 bg-slate-50">
                <div className="flex gap-1.5">
                  {isEditable && (
                    <>
                      <button
                        type="button"
                        onClick={handleSaveDraftClick}
                        disabled={isSavingDraft}
                        className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-[10px] font-bold text-slate-700 transition-colors flex items-center gap-1 disabled:opacity-50"
                        title="Taslak Kaydet"
                      >
                        <Save size={11} className={isSavingDraft ? 'animate-spin text-blue-500' : ''} />
                        {isSavingDraft ? 'Kaydediliyor...' : 'Taslak'}
                      </button>
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-[10px] font-bold text-slate-700 transition-colors flex items-center gap-1"
                        title="Metni Kopyala"
                      >
                        <Check size={11} className={copied ? 'text-emerald-500' : 'hidden'} />
                        {copied ? 'Kopyalandı' : 'Kopyala'}
                      </button>
                      <button
                        type="button"
                        onClick={handleWhatsAppShare}
                        className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-[10px] font-bold text-emerald-700 transition-colors flex items-center gap-1"
                        title="WhatsApp ile Paylaş"
                      >
                        <Share2 size={11} />
                        WhatsApp
                      </button>
                    </>
                  )}
                </div>

                <div className="flex gap-1.5">
                  {/* Google’da Yayınla (Approved veya Pending Approval durumlarında, ai_reply varsa gösterilir) */}
                  {((review.source || '').toLowerCase() === 'google') && 
                   !!(responseVal.trim() || review.response || (review as any).owner_reply_text) && 
                   (review.status === 'pending_approval' || review.status === 'waiting_approval') && (
                    <button
                      type="button"
                      disabled={isPublishing}
                      onClick={handlePublishGoogleClick}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 hover:from-blue-600 hover:to-indigo-500 disabled:opacity-50 text-[10px] font-bold text-white transition-colors flex items-center gap-1 shadow-md shadow-blue-500/10 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <Send size={11} className={isPublishing ? 'animate-spin' : ''} />
                      {isPublishing ? 'Yayınlanıyor...' : "Google'a Yayınla"}
                    </button>
                  )}

                  {isEditable && (
                    <>
                      <button
                        type="button"
                        onClick={handleUpdateStatusClick}
                        disabled={isSendingApproval}
                        className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 hover:bg-amber-100 text-[10px] font-bold text-amber-700 transition-colors disabled:opacity-50"
                      >
                        {isSendingApproval ? 'Gönderiliyor...' : 'Onaya Gönder'}
                      </button>
                      
                      {/* Default publish button for other statuses when editable */}
                      {!(((review.source || '').toLowerCase() === 'google') && 
                         (review.status === 'pending_approval' || review.status === 'waiting_approval')) && 
                       review.source === 'Google' && (
                        <button
                          type="button"
                          disabled={!(responseVal.trim() || review.response || (review as any).owner_reply_text) || isPublishing}
                          onClick={handlePublishGoogleClick}
                          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 hover:from-blue-600 hover:to-indigo-500 disabled:opacity-50 text-[10px] font-bold text-white transition-colors flex items-center gap-1 shadow-md shadow-blue-500/10 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <Send size={11} className={isPublishing ? 'animate-spin' : ''} />
                          {isPublishing ? 'Yayınlanıyor...' : "Google'a Yayınla"}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleSubmitResponseClick}
                        disabled={isSubmitting}
                        className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-[10px] font-bold text-white transition-colors flex items-center gap-1 disabled:opacity-50"
                      >
                        <Send size={11} className={isSubmitting ? 'animate-spin' : ''} />
                        {isSubmitting ? 'Yayınlanıyor...' : 'Yayınla'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 6. Manager Section - internal notes */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <CheckSquare size={12} className="text-purple-500" />
              YÖNETİCİ NOTLARI & GÖREV TAKİBİ
            </h4>
            {isEditable && (
              <button
                onClick={handleSaveNotes}
                disabled={isSavingNotes}
                className="text-[10px] text-purple-600 hover:text-purple-700 font-bold transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                <Save size={10} />
                {isSavingNotes ? 'Kaydediliyor...' : 'Notları Kaydet'}
              </button>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-slate-500 font-bold block mb-1">Yönetici Notu</label>
              <textarea
                value={managerNotes}
                onChange={(e) => setManagerNotes(e.target.value)}
                disabled={!isEditable}
                placeholder="Otel personeli veya departmanlar için talimatlar girin..."
                className="w-full h-16 p-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-purple-500 resize-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 font-bold block mb-1">Dahili Log Notu</label>
              <textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                disabled={!isEditable}
                placeholder="Takip günlüğü veya dahili notlar girin..."
                className="w-full h-16 p-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-purple-500 resize-none disabled:opacity-50"
              />
            </div>
          </div>
        </div>

        {/* 7. Audit Log Timeline */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-4">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <History size={11} className="text-slate-400" />
            İŞLEM ZAMAN TÜNELİ
          </h4>
          
          <div className="relative border-l border-slate-200 ml-3 pl-6 space-y-5">
            {/* 1. Review received */}
            <div className="relative">
              <div className="absolute -left-[30px] top-1 w-4 h-4 rounded-full bg-blue-50 border border-blue-400 flex items-center justify-center">
                <Check size={10} className="text-blue-500" />
              </div>
              <div className="text-xs">
                <span className="font-bold text-slate-700">Yorum Sistemimize Ulaştı</span>
                <span className="text-[10.5px] text-slate-500 ml-2">&bull; Giriş onaylandı</span>
              </div>
            </div>

            {/* 2. AI Analysed */}
            <div className="relative">
              <div className="absolute -left-[30px] top-1 w-4 h-4 rounded-full bg-blue-50 border border-blue-400 flex items-center justify-center">
                <Check size={10} className="text-blue-500" />
              </div>
              <div className="text-xs">
                <span className="font-bold text-slate-700">AI Analizi Yapıldı</span>
                <span className="text-[10.5px] text-slate-500 ml-2">&bull; Kalite skoru: {review.aiAnalysis?.qualityScore || 90}%</span>
              </div>
            </div>

            {/* 3. Draft Generated */}
            <div className="relative">
              <div className="absolute -left-[30px] top-1 w-4 h-4 rounded-full bg-blue-50 border border-blue-400 flex items-center justify-center">
                <Check size={10} className="text-blue-500" />
              </div>
              <div className="text-xs">
                <span className="font-bold text-slate-700">AI Cevap Taslağı Hazır</span>
                <span className="text-[10.5px] text-slate-500 ml-2">&bull; Şablon oluşturuldu</span>
              </div>
            </div>

            {/* 4. Manager Approved */}
            <div className="relative">
              <div className={`absolute -left-[30px] top-1 w-4 h-4 rounded-full flex items-center justify-center border ${
                review.status !== 'draft' ? 'bg-blue-50 border-blue-400' : 'bg-white border-slate-200'
              }`}>
                {review.status !== 'draft' ? (
                  <Check size={10} className="text-blue-500" />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
                )}
              </div>
              <div className="text-xs">
                <span className="font-bold text-slate-700">Yönetici Onayı</span>
                <span className="text-[10.5px] text-slate-500 ml-2">
                  {review.status !== 'draft' ? 'Onaylandı' : 'Beklemede'}
                </span>
              </div>
            </div>

            {/* 5. Published */}
            <div className="relative">
              <div className={`absolute -left-[30px] top-1 w-4 h-4 rounded-full flex items-center justify-center border ${
                review.status === 'published' ? 'bg-emerald-50 border-emerald-400' : 'bg-white border-slate-200'
              }`}>
                {review.status === 'published' ? (
                  <Check size={10} className="text-emerald-500" />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                )}
              </div>
              <div className="text-xs">
                <span className="font-bold text-slate-700">Yayınlandı</span>
                <span className="text-[10.5px] text-slate-500 ml-2">
                  {review.status === 'published' ? 'Canlıya gönderildi' : 'Gönderim beklemede'}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
      
      {/* Footer bar */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-500 shrink-0">
        <span>GuestReview.ai Yönetici Paneli</span>
        <span className="font-mono text-slate-400">v1.1.2-beta</span>
      </div>

      {/* Task Creation Modal Overlay */}
      {showTaskForm && (
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-30 p-5 flex flex-col justify-center overflow-y-auto">
          <form onSubmit={handleCreateTask} className="p-6 rounded-2xl border border-slate-200 bg-white space-y-4 max-w-md mx-auto w-full shadow-2xl">
            <div>
              <h3 className="text-sm font-bold text-slate-800">İç Görev Oluştur</h3>
              <p className="text-[10px] text-slate-500 mt-1">Bu yorum için ilgili departmana bir takip görevi atayın.</p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-500 font-bold block mb-1">Görev Başlığı</label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-blue-500 text-slate-700 font-medium"
                />
              </div>

              <div>
                <label className="text-slate-500 font-bold block mb-1">Açıklama</label>
                <textarea
                  required
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  className="w-full h-20 p-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-blue-500 text-slate-700 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-500 font-bold block mb-1">Departman</label>
                  <select
                    value={taskDept}
                    onChange={(e) => setTaskDept(e.target.value)}
                    className="w-full px-2 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-blue-500 text-slate-700"
                  >
                    <option value="Front Office">Front Office</option>
                    <option value="Housekeeping">Housekeeping</option>
                    <option value="Food & Beverage">Food & Beverage</option>
                    <option value="Spa & Wellness">Spa & Wellness</option>
                    <option value="Technical Service">Technical Service</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-500 font-bold block mb-1">Öncelik</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as any)}
                    className="w-full px-2 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-blue-500 text-slate-700"
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
                  <label className="text-slate-500 font-bold block mb-1">Atanan Personel</label>
                  <input
                    type="text"
                    placeholder="Personel adı"
                    value={taskAssigned}
                    onChange={(e) => setTaskAssigned(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-blue-500 text-slate-700"
                  />
                </div>

                <div>
                  <label className="text-slate-500 font-bold block mb-1">Bitiş Tarihi</label>
                  <input
                    type="date"
                    required
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-blue-500 text-slate-700"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowTaskForm(false)}
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={isSubmittingTask}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition-colors"
              >
                {isSubmittingTask ? 'Oluşturuluyor...' : 'Görevi Kaydet'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Task Created Toast Alert */}
      {taskCreatedToast && (
        <div className="absolute bottom-16 right-5 z-40 p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] font-bold flex items-center gap-2 animate-slide-in shadow-md">
          <Check size={14} />
          <span>Görev kaydedildi ve ilgili personele atandı.</span>
        </div>
      )}
    </div>
  );
}

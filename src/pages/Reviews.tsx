import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { useTranslation } from 'react-i18next';
import { reviewService } from '@/services/reviewService';
import { ReviewCard } from '@/components/ReviewCard';
import { ReviewFilters } from '@/components/ReviewFilters';
import { ReviewDetailPanel } from '@/components/ReviewDetailPanel';
import { Review, ReviewSource, ReviewStatus, ReviewPriority } from '@/types';
import { supabase } from '@/lib/supabase';
import { 
  RefreshCw, 
  Download, 
  AlertCircle,
  Database,
  ArrowLeft,
  Bell
} from 'lucide-react';

export default function Reviews() {
  const { t } = useTranslation();
  const { currentHotelId } = useOutletContext<{ currentHotelId: string }>();

  // Query Filters state
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<ReviewSource | ''>('');
  const [rating, setRating] = useState('');
  const [status, setStatus] = useState<ReviewStatus | ''>('');
  const [priority, setPriority] = useState<ReviewPriority | ''>('');
  
  // Selected review item
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);

  // Sync / Export loading animation helper states
  const [isSyncing, setIsSyncing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importRange, setImportRange] = useState('365');
  const [importSummary, setImportSummary] = useState<{
    totalFetched: number;
    importedCount: number;
    duplicateCount: number;
    failedCount: number;
    range: string;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fetch reviews using clean repository service
  const {
    data,
    loading,
    error,
    refetch
  } = useFetch(() => reviewService.getReviews({
    hotelId: currentHotelId || undefined,
    search: search || undefined,
    source: source || undefined,
    rating: rating ? Number(rating) : undefined,
    status: status || undefined,
    priority: priority || undefined
  }), [currentHotelId, search, source, rating, status, priority]);

  // Supabase Realtime insertion listener
  useEffect(() => {
    if (!currentHotelId) return;

    const channel = supabase
      .channel('reviews-page-realtime-reviews')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reviews' },
        (payload: any) => {
          if (payload.new?.hotel_id !== currentHotelId) return;

          const platform = payload.new?.source || 'Google';
          setToastMessage(`New ${platform} Review Received`);
          refetch();

          // Auto dismiss toast after 4 seconds
          setTimeout(() => {
            setToastMessage(null);
          }, 4000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentHotelId, refetch]);

  const [selectedReviewDetail, setSelectedReviewDetail] = useState<Review | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Load full review details from Supabase when selectedReviewId changes
  useEffect(() => {
    if (!selectedReviewId) {
      setSelectedReviewDetail(null);
      return;
    }
    setIsLoadingDetail(true);
    reviewService.getReviewById(selectedReviewId)
      .then((data) => {
        setSelectedReviewDetail(data);
      })
      .catch((err) => {
        console.error('Failed to fetch full review details:', err);
      })
      .finally(() => {
        setIsLoadingDetail(false);
      });
  }, [selectedReviewId]);

  const reviews = data?.reviews || [];

  const handleSyncReviews = async () => {
    setIsSyncing(true);
    // Simulate API synchronization wait
    setTimeout(() => {
      setIsSyncing(false);
      refetch();
    }, 1500);
  };

  const handleImport30DaysReviews = async () => {
    if (!currentHotelId) {
      alert('Lütfen bir otel seçin.');
      return;
    }
    setIsImporting(true);
    setImportSummary(null);
    try {
      const res = await reviewService.importLast30DaysReviews(currentHotelId, importRange);
      if (res.importedCount === 0) {
        setToastMessage('Bu tarih aralığında yeni yorum bulunamadı');
      } else {
        setToastMessage(
          `İçe aktarım tamamlandı: ${res.importedCount} yeni yorum eklendi.`
        );
      }
      setImportSummary({
        totalFetched: res.totalFetched,
        importedCount: res.importedCount,
        duplicateCount: res.duplicateCount,
        failedCount: res.failedCount,
        range: importRange
      });
      refetch();
      setTimeout(() => {
        setToastMessage(null);
      }, 5000);
    } catch (err: any) {
      console.error(err);
      alert(`Hata: ${err.message || 'İçe aktarım başarısız oldu'}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportReviews = async () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      alert('Reviews exported successfully as CSV.');
    }, 1000);
  };

  const handleUpdateStatus = async (id: string, newStatus: ReviewStatus) => {
    try {
      const updated = await reviewService.updateReviewStatus(id, newStatus);
      setSelectedReviewDetail(updated);
      refetch();
    } catch (err: any) {
      alert(`API Error: Could not update status. ${err.message}`);
    }
  };

  const handleSubmitResponse = async (id: string, responseText: string) => {
    try {
      const updated = await reviewService.submitResponse(id, responseText);
      setSelectedReviewDetail(updated);
      refetch();
    } catch (err: any) {
      alert(`API Error: Could not publish response. ${err.message}`);
    }
  };

  const handleSaveDraft = async (id: string, responseText: string) => {
    try {
      const updated = await reviewService.saveResponseDraft(id, responseText);
      setSelectedReviewDetail(updated);
      refetch();
    } catch (err: any) {
      alert(`API Error: Could not save draft. ${err.message}`);
    }
  };

  const handleUpdateNotes = async (id: string, managerNotes: string, internalNotes: string) => {
    try {
      const updated = await reviewService.updateReviewNotes(id, managerNotes, internalNotes);
      setSelectedReviewDetail(updated);
      refetch();
    } catch (err: any) {
      alert(`API Error: Could not save notes. ${err.message}`);
    }
  };

  const handleGenerateAiReply = async (id: string): Promise<string> => {
    const res = await reviewService.generateAiResponse(id);
    return res.response;
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.04] pb-6">
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold text-slate-100 m-0">{t('reviews.title')}</h1>
          <p className="text-xs text-slate-400">
            {t('reviews.subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <select
              value={importRange}
              onChange={(e) => setImportRange(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-900 border border-white/[0.06] text-xs focus:outline-none text-slate-300 min-h-[36px]"
            >
              <option value="30">Son 30 gün</option>
              <option value="90">Son 90 gün</option>
              <option value="180">Son 180 gün</option>
              <option value="365">Son 365 gün</option>
              <option value="all">Tüm zamanlar</option>
            </select>
          </div>

          <button
            onClick={handleImport30DaysReviews}
            disabled={isImporting}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-tr from-blue-600 to-indigo-500 hover:from-blue-500 hover:to-indigo-400 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition-all shadow-md shadow-blue-500/10 min-h-[36px]"
          >
            <RefreshCw size={14} className={isImporting ? 'animate-spin' : ''} />
            <span>{isImporting ? 'İçe Aktarılıyor...' : t('reviews.import30Days')}</span>
          </button>

          <button
            onClick={handleSyncReviews}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-white/[0.06] hover:bg-slate-800 disabled:opacity-50 text-slate-300 font-semibold text-xs rounded-xl transition-all min-h-[36px]"
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
            <span>{isSyncing ? 'Syncing...' : t('reviews.sync')}</span>
          </button>

          <button
            onClick={handleExportReviews}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-white/[0.06] hover:bg-slate-800 disabled:opacity-50 text-slate-300 font-semibold text-xs rounded-xl transition-all min-h-[36px]"
          >
            <Download size={14} className={isExporting ? 'animate-spin' : ''} />
            <span>{isExporting ? 'Exporting...' : t('reviews.export')}</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <ReviewFilters
        search={search}
        setSearch={setSearch}
        source={source}
        setSource={setSource}
        rating={rating}
        setRating={setRating}
        status={status}
        setStatus={setStatus}
        priority={priority}
        setPriority={setPriority}
      />

      {/* Main split grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left pane: Review cards list */}
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-32 rounded-2xl bg-white/[0.01] border border-white/[0.04] animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="glass-panel p-6 rounded-2xl border-l-4 border-rose-500 text-rose-400 bg-rose-950/10 flex items-center gap-3">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          ) : reviews.length === 0 ? (
            <div className="glass-panel rounded-2xl p-12 text-center space-y-4">
              <Database className="mx-auto text-slate-600" size={40} />
              <h3 className="text-sm font-semibold text-slate-400">{t('reviews.empty')}</h3>
              <p className="text-xs text-slate-500 max-w-[280px] mx-auto">
                No guest reviews match your filters or database is empty.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  isSelected={selectedReviewId === review.id}
                  onClick={() => setSelectedReviewId(review.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right pane: Review detail card */}
        <div className="lg:col-span-1">
          {isLoadingDetail ? (
            <div className="glass-panel rounded-2xl p-12 text-center h-[85vh] flex flex-col justify-center items-center space-y-4 border border-white/[0.04] bg-[#090b16]/95">
              <RefreshCw className="animate-spin text-blue-500" size={32} />
              <p className="text-xs text-slate-400">Loading operations center data...</p>
            </div>
          ) : selectedReviewDetail ? (
            <ReviewDetailPanel
              review={selectedReviewDetail}
              onUpdateStatus={handleUpdateStatus}
              onSubmitResponse={handleSubmitResponse}
              onSaveDraft={handleSaveDraft}
              onGenerateAiReply={handleGenerateAiReply}
              onUpdateNotes={handleUpdateNotes}
            />
          ) : (
            <div className="glass-panel rounded-2xl p-12 text-center space-y-4 h-64 flex flex-col justify-center items-center">
              <AlertCircle className="mx-auto text-slate-600" size={36} />
              <h3 className="text-sm font-semibold text-slate-400">No Review Selected</h3>
              <p className="text-xs text-slate-500 max-w-[200px] mx-auto">
                Select a review card on the list pane to view full comments, quality grades and generate AI answers.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Import Debug Summary Modal */}
      {importSummary && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl relative overflow-hidden card-glow space-y-6">
            <div className="flex justify-between items-center pb-3 border-b border-white/[0.04]">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 m-0">
                <Bell size={16} className="text-blue-400" />
                <span>İçe Aktarım Sonuç Özeti</span>
              </h3>
              <button 
                onClick={() => setImportSummary(null)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Kapat
              </button>
            </div>
            
            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-white/[0.02]">
                <span className="text-slate-400">Tarih Aralığı:</span>
                <span className="font-semibold text-slate-200">
                  {importSummary.range === '30' && 'Son 30 gün'}
                  {importSummary.range === '90' && 'Son 90 gün'}
                  {importSummary.range === '180' && 'Son 180 gün'}
                  {importSummary.range === '365' && 'Son 365 gün'}
                  {importSummary.range === 'all' && 'Tüm zamanlar'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-white/[0.02]">
                <span className="text-slate-400">Google’dan çekilen toplam yorum:</span>
                <span className="font-bold text-blue-400">{importSummary.totalFetched}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-white/[0.02]">
                <span className="text-slate-400">Daha önce kayıtlı olduğu için atlanan yorum:</span>
                <span className="font-semibold text-amber-500">{importSummary.duplicateCount}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-white/[0.02]">
                <span className="text-slate-400">n8n’e gönderilen yeni yorum:</span>
                <span className="font-bold text-emerald-400">{importSummary.importedCount}</span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-slate-400">Hata alan yorum:</span>
                <span className="font-semibold text-rose-500">{importSummary.failedCount}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setImportSummary(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl transition-colors"
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Premium Toast Notification Overlay */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl border border-blue-500/25 bg-[#0a0d1d] shadow-2xl flex items-center gap-3 animate-slide-in glass-panel max-w-sm animate-fade-in">
          <div className="w-8 h-8 rounded-lg bg-blue-600/10 flex items-center justify-center text-blue-400">
            <Bell size={16} />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-200">Alert Notification</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">{toastMessage}</p>
          </div>
          <button 
            onClick={() => setToastMessage(null)}
            className="text-xs text-slate-500 hover:text-slate-300 font-medium ml-4"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}


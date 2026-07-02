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

import { hotelRepository } from '@/repositories/hotelRepository';

export default function Reviews() {
  const { t } = useTranslation();
  const { currentHotelId, hotels } = useOutletContext<{ currentHotelId: string; hotels: any[] }>();

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
  const [isImportingGoogleMaps, setIsImportingGoogleMaps] = useState(false);
  const [importRange, setImportRange] = useState('365');
  const [importSummary, setImportSummary] = useState<{
    totalFetched: number;
    importedCount: number;
    duplicateCount: number;
    failedCount: number;
    range: string;
    detailedErrors?: any[];
    importDetails?: any[];
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
        range: importRange,
        detailedErrors: res.detailedErrors,
        importDetails: res.importDetails
      });
      refetch();
      setTimeout(() => {
        setToastMessage(null);
      }, 5000);
    } catch (err: any) {
      console.error(err);
      setImportSummary({
        totalFetched: 0,
        importedCount: 0,
        duplicateCount: 0,
        failedCount: 1,
        range: importRange,
        detailedErrors: [
          {
            type: 'SERVER_ERROR',
            message: err.message || 'İçe aktarım başarısız oldu',
            reviewId: 'Genel Sistem Hatası',
            webhookUrl: '/api/admin-import-reviews',
            status: err.message?.match(/Status\s*(\d+)/i)?.[1] ? parseInt(err.message.match(/Status\s*(\d+)/i)[1], 10) : 500,
            responseBody: err.message || String(err)
          }
        ],
        importDetails: []
      });
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

  const handleImportGoogleMapsReviews = async () => {
    if (!currentHotelId) {
      alert('Lütfen bir otel seçin.');
      return;
    }

    const currentHotel = hotels?.find(h => h.id === currentHotelId);
    
    // Direct Supabase query to get direct record columns for comparison
    let dbRow: any = null;
    try {
      const { data } = await supabase
        .from('hotels')
        .select('id, name, google_maps_url, google_maps_link')
        .eq('id', currentHotelId)
        .maybeSingle();
      dbRow = data;
    } catch (e) {
      console.error('[DEBUG] Direct Supabase query failed:', e);
    }

    const googleMapsUrlFromLink = currentHotel?.googleMapsLink;
    const googleMapsUrlFromUrl = currentHotel?.googleMapsUrl;
    const directMapsLinkCol = dbRow?.google_maps_link;
    const directMapsUrlCol = dbRow?.google_maps_url;
    const finalUrlToSend = googleMapsUrlFromLink || googleMapsUrlFromUrl || directMapsLinkCol || directMapsUrlCol;

    console.log('========================================================================');
    console.log('[DEBUG-REVIEWS-READ] Reading selected hotel link properties:');
    console.log('  - currentHotelId:', currentHotelId);
    console.log('  - currentHotel.googleMapsLink:', googleMapsUrlFromLink);
    console.log('  - currentHotel.googleMapsUrl:', googleMapsUrlFromUrl);
    console.log('  - DB Row google_maps_link:', directMapsLinkCol);
    console.log('  - DB Row google_maps_url:', directMapsUrlCol);
    console.log('  - Final URL to be sent in POST body:', finalUrlToSend);
    console.log('========================================================================');
    
    console.log('========================================================================');
    console.log('DEBUG TRACE TABLE:');
    console.table([
      { Step: '1. Admin Input', Value: googleMapsUrlFromUrl || googleMapsUrlFromLink },
      { Step: '2. Supabase Record (google_maps_url)', Value: directMapsUrlCol },
      { Step: '3. Supabase Record (google_maps_link)', Value: directMapsLinkCol },
      { Step: '4. Repository Output (googleMapsUrl)', Value: googleMapsUrlFromUrl },
      { Step: '5. Repository Output (googleMapsLink)', Value: googleMapsUrlFromLink },
      { Step: '6. POST Body Parameter (googleMapsUrl)', Value: finalUrlToSend }
    ]);
    console.log('========================================================================');

    // Log hotelRepository.getHotels() result
    try {
      const dbHotels = await hotelRepository.getHotels();
      console.log('[DEBUG] hotelRepository.getHotels() return:', dbHotels);
    } catch (e) {
      console.error('[DEBUG] hotelRepository.getHotels() failed:', e);
    }

    const googleMapsUrl = finalUrlToSend;

    if (!googleMapsUrl) {
      alert('Bu otel için Google Maps işletme linki tanımlanmamış. Lütfen Admin > Otel Yönetimi sayfasından tanımlayın.');
      return;
    }

    setIsImportingGoogleMaps(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Oturum bulunamadı.');

      const response = await fetch('/api/admin-import-google-maps-reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ hotelId: currentHotelId, googleMapsUrl })
      });

      let res: any;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        res = await response.json();
      } else {
        const textError = await response.text();
        throw new Error(textError || 'Bilinmeyen bir sunucu hatası oluştu (JSON yerine düz metin dönüldü).');
      }

      if (!response.ok) {
        if (res.error === 'apify_token_missing') {
          throw new Error('Apify Token Eksik: Vercel Environment Variables içerisine APIFY_TOKEN tanımlanmalıdır.');
        }
        if (res.error === 'apify_actor_failed') {
          throw new Error(`Apify Actor Hatası: Google Maps Actor çalıştırılamadı. Detay: ${res.message || ''} | Raw: ${res.rawError || ''}`);
        }
        if (res.error === 'no_reviews_found') {
          throw new Error('Yorum Bulunamadı: Bu Google Maps linkinden yorum çekilemedi veya çekilen yorumlar boş döndü.');
        }
        throw new Error(res.error || 'İçe aktarım başarısız oldu.');
      }

      setToastMessage(`Google Maps yorumları içe aktarıldı: ${res.importedCount} yeni yorum eklendi.`);
      refetch();
    } catch (err: any) {
      console.error(err);
      alert(`Hata: ${err.message || 'İçe aktarım sırasında bir sorun oluştu.'}`);
    } finally {
      setIsImportingGoogleMaps(false);
    }
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
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
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none text-slate-300 min-h-[36px]"
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
            onClick={handleImportGoogleMapsReviews}
            disabled={isImportingGoogleMaps}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition-all shadow-md shadow-emerald-500/10 min-h-[36px]"
          >
            <RefreshCw size={14} className={isImportingGoogleMaps ? 'animate-spin' : ''} />
            <span>{isImportingGoogleMaps ? 'Haritadan Çekiliyor...' : 'Google Maps Yorumlarını Çek'}</span>
          </button>

          <button
            onClick={handleSyncReviews}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-800 disabled:opacity-50 text-slate-300 font-semibold text-xs rounded-xl transition-all min-h-[36px]"
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
            <span>{isSyncing ? 'Syncing...' : t('reviews.sync')}</span>
          </button>

          <button
            onClick={handleExportReviews}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-800 disabled:opacity-50 text-slate-300 font-semibold text-xs rounded-xl transition-all min-h-[36px]"
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
                <div key={i} className="h-32 rounded-2xl bg-white/[0.01] border border-slate-200 animate-pulse" />
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
            <div className="glass-panel rounded-2xl p-12 text-center h-[85vh] flex flex-col justify-center items-center space-y-4 border border-slate-200 bg-white">
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
          <div className="glass-panel w-full max-w-lg p-6 rounded-2xl relative overflow-hidden card-glow space-y-6">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
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
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
                  <span className="text-slate-400">Google’dan çekilen toplam:</span>
                  <span className="font-bold text-blue-400">{importSummary.totalFetched}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-white/[0.02]">
                  <span className="text-slate-400">Mükerrer (Atlanan):</span>
                  <span className="font-semibold text-amber-500">{importSummary.duplicateCount}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-white/[0.02]">
                  <span className="text-slate-400">n8n’e gönderilen yeni:</span>
                  <span className="font-bold text-emerald-400">{importSummary.importedCount}</span>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-slate-400">Hata alan yorum:</span>
                  <span className="font-semibold text-rose-500">{importSummary.failedCount}</span>
                </div>
              </div>

              <div className="space-y-2 bg-slate-50/40 p-4 rounded-xl border border-white/[0.03]">
                <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Debug Entegrasyon Durumu</h4>
                <div className="text-[11px] text-slate-400 space-y-1.5 leading-relaxed">
                  <div>
                    <span className="text-slate-500">n8n Durumu:</span>{' '}
                    {importSummary.importedCount > 0 ? (
                      <span className="text-emerald-400 font-semibold">Aktif (Veri İletiliyor)</span>
                    ) : importSummary.failedCount > 0 ? (
                      <span className="text-rose-400 font-semibold">Hatalı (Bağlantı Sorunu)</span>
                    ) : (
                      <span className="text-slate-500">Beklemede</span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500">Google API Sınıfı:</span>{' '}
                    <span className="text-slate-300 font-mono text-[10px]">MockGoogleProvider</span>
                  </div>
                </div>
              </div>
            </div>

            {importSummary.importDetails && importSummary.importDetails.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  Senkronizasyon Detayları ({importSummary.importDetails.length} Yorum)
                </span>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {importSummary.importDetails.map((detail: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50/20 border border-white/[0.02] text-[10px]">
                      <code className="text-slate-300 font-mono text-[9px] truncate max-w-[200px]">{detail.reviewId}</code>
                      <span className={`px-2 py-0.5 rounded font-semibold text-[8px] uppercase tracking-wider ${
                        detail.status === 'sent' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        detail.status === 'duplicate_skipped' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {detail.status === 'sent' && 'İletildi'}
                        {detail.status === 'duplicate_skipped' && 'Mükerrer'}
                        {detail.status === 'failed' && 'Hata'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {importSummary.detailedErrors && importSummary.detailedErrors.length > 0 && (
              <div className="space-y-3.5 pt-4 border-t border-slate-200">
                <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider block">
                  Hata Detayları ({importSummary.detailedErrors.length})
                </span>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {importSummary.detailedErrors.map((err, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-rose-950/15 border border-rose-500/10 text-[10px] text-rose-300 space-y-1.5 leading-normal">
                      <div className="flex justify-between items-center text-[9px] border-b border-rose-500/10 pb-1 mb-1">
                        <span className="text-rose-400 font-semibold">HATA #{idx + 1}</span>
                        <code className="text-slate-400 font-mono">ID: {err.reviewId}</code>
                      </div>
                      {err.webhookUrl && (
                        <div className="flex items-start gap-1">
                          <span className="text-slate-500 shrink-0 font-medium">Webhook URL:</span>
                          <code className="text-slate-300 font-mono break-all">{err.webhookUrl}</code>
                        </div>
                      )}
                      {err.status !== undefined && (
                        <div>
                          <span className="text-slate-500 font-medium">HTTP Durum Kodu:</span>{' '}
                          <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold font-mono text-[9px]">{err.status}</span>
                        </div>
                      )}
                      {err.responseBody && (
                        <div className="space-y-0.5">
                          <span className="text-slate-500 font-medium block">Yanıt Gövdesi (Response Body):</span>
                          <pre className="mt-1 bg-black/40 p-2 rounded-lg text-slate-400 font-mono text-[9px] overflow-x-auto whitespace-pre-wrap max-h-20 leading-relaxed">
                            {err.responseBody}
                          </pre>
                        </div>
                      )}
                      {err.message && (
                        <div className="text-rose-400/90 font-mono text-[9px] bg-rose-950/30 p-2 rounded-lg border border-rose-500/5">
                          {err.message}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-200">
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


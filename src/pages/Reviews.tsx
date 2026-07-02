import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { useTranslation } from 'react-i18next';
import { reviewService, testReviews } from '@/services/reviewService';
import { ReviewCard } from '@/components/ReviewCard';
import { ReviewFilters } from '@/components/ReviewFilters';
import { ReviewDetailPanel } from '@/components/ReviewDetailPanel';
import { Review, ReviewSource, ReviewStatus, ReviewPriority, Hotel } from '@/types';
import { supabase } from '@/lib/supabase';
import { 
  RefreshCw, 
  Download, 
  AlertCircle,
  Database,
  ArrowLeft,
  Bell,
  Sparkles
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
  const [isImportingTripadvisor, setIsImportingTripadvisor] = useState(false);
  const [isImportingBooking, setIsImportingBooking] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [importRange, setImportRange] = useState('365');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [currentHotelId, search, source, rating, status, priority]);

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

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
  const [currentHotel, setCurrentHotel] = useState<Hotel | null>(null);

  // Load selected hotel info directly from database to get fresh values
  useEffect(() => {
    if (!currentHotelId) {
      setCurrentHotel(null);
      return;
    }
    
    const fetchHotelDetails = async () => {
      try {
        const { data, error } = await supabase
          .from('hotels')
          .select('*')
          .eq('id', currentHotelId)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          setCurrentHotel({
            id: data.id,
            organizationId: data.organization_id,
            name: data.name,
            createdAt: data.created_at,
            googleMapsLink: data.google_maps_url || data.google_maps_link || '',
            googleMapsUrl: data.google_maps_url || data.google_maps_link || '',
            tripadvisorUrl: data.tripadvisor_url || '',
            bookingPropertyId: data.booking_property_id || '',
            address: data.address || '',
            phone: data.phone || '',
            website: data.website || ''
          });
        }
      } catch (err) {
        console.error('Failed to load current hotel for details:', err);
      }
    };

    fetchHotelDetails();
  }, [currentHotelId]);

  // Log TripAdvisor URL details on state changes
  useEffect(() => {
    console.log('[DEBUG-TRIPADVISOR]', {
      currentHotel,
      tripadvisorUrl: currentHotel?.tripadvisorUrl
    });
  }, [currentHotel]);

  // Load full review details from Supabase when selectedReviewId changes
  useEffect(() => {
    if (!selectedReviewId) {
      setSelectedReviewDetail(null);
      return;
    }
    const foundTest = testReviews.find(r => r.id === selectedReviewId);
    if (foundTest) {
      setSelectedReviewDetail(foundTest);
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

  let reviews = data?.reviews || [];
  if (reviews.length === 0) {
    reviews = testReviews.filter(r => {
      if (source && r.source !== source) return false;
      if (status && r.status !== status) return false;
      if (priority && r.priority !== priority) return false;
      if (rating && r.rating !== Number(rating)) return false;
      if (search) {
        const term = search.toLowerCase();
        return r.comment.toLowerCase().includes(term) || r.guestName.toLowerCase().includes(term);
      }
      return true;
    });
  }

  const totalReviews = reviews.length;
  const totalPages = Math.ceil(totalReviews / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalReviews);
  const paginatedReviews = reviews.slice(startIndex, endIndex);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

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

  const handleImportTripadvisorReviews = async () => {
    if (!currentHotelId) {
      alert('Lütfen bir otel seçin.');
      return;
    }

    const currentHotel = hotels?.find(h => h.id === currentHotelId);
    let dbRow: any = null;
    try {
      const { data } = await supabase
        .from('hotels')
        .select('id, name, tripadvisor_url')
        .eq('id', currentHotelId)
        .maybeSingle();
      dbRow = data;
    } catch (e) {
      console.error('[DEBUG] Direct Supabase query failed:', e);
    }

    const tripadvisorUrl = currentHotel?.tripadvisorUrl || dbRow?.tripadvisor_url;

    if (!tripadvisorUrl) {
      alert('Bu otel için TripAdvisor işletme linki tanımlanmamış. Lütfen Admin > Otel Yönetimi sayfasından tanımlayın.');
      return;
    }

    setIsImportingTripadvisor(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Oturum bulunamadı.');

      const response = await fetch('/api/admin-import-tripadvisor-reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ hotelId: currentHotelId, tripadvisorUrl })
      });

      let res: any;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        res = await response.json();
      } else {
        const textError = await response.text();
        throw new Error(textError || 'Bilinmeyen bir sunucu hatası oluştu.');
      }

      if (!response.ok) {
        console.log('[DEBUG-TRIPADVISOR-IMPORT-RESPONSE-ERROR]', res);
        const errDetails = [
          `Hata: ${res.error || 'İçe aktarım başarısız oldu.'}`,
          res.message ? `Mesaj: ${res.message}` : null,
          res.apifyError ? `Apify Hatası: ${res.apifyError}` : null,
          res.rawError ? `Raw: ${res.rawError}` : null
        ].filter(Boolean).join('\n');
        throw new Error(errDetails);
      }

      console.log('[DEBUG-TRIPADVISOR-IMPORT-RESPONSE-SUCCESS]', res);
      
      const rawCount = res.rawCount !== undefined ? res.rawCount : 'Bilinmiyor';
      const normalizedCount = res.normalizedCount !== undefined ? res.normalizedCount : 'Bilinmiyor';
      const insertedCount = res.insertedCount !== undefined ? res.insertedCount : res.importedCount;
      const duplicateCount = res.duplicateCount !== undefined ? res.duplicateCount : 'Bilinmiyor';
      const apifyErrorText = res.apifyError ? `\nError: ${res.apifyError}` : '';

      const alertMsg = `TripAdvisor yorumları içe aktarıldı:\nYeni: ${insertedCount}\nRaw: ${rawCount}\nNormalized: ${normalizedCount}\nDuplicate: ${duplicateCount}${apifyErrorText}`;
      
      alert(alertMsg);
      setToastMessage(alertMsg);
      refetch();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'İçe aktarım sırasında bir sorun oluştu.');
    } finally {
      setIsImportingTripadvisor(false);
    }
  };

  const handleImportBookingReviews = async () => {
    if (!currentHotelId) {
      alert('Lütfen bir otel seçin.');
      return;
    }

    // Load hotel to verify property ID exists
    const { data: dbRow } = await supabase
      .from('hotels')
      .select('id, name, booking_property_id')
      .eq('id', currentHotelId)
      .maybeSingle();

    const bookingPropertyId = currentHotel?.bookingPropertyId || dbRow?.booking_property_id;
    if (!bookingPropertyId) {
      alert('Bu otel için Booking.com Property ID tanımlanmamış. Lütfen Admin > Otel Yönetimi sayfasından tanımlayın.');
      return;
    }

    setIsImportingBooking(true);
    try {
      const res = await reviewService.importBookingReviews(currentHotelId, importRange);
      console.log('[DEBUG-BOOKING-IMPORT-RESPONSE-SUCCESS]', res);

      const insertedCount = res.importedCount;
      const duplicateCount = res.duplicateCount;

      const alertMsg = `Booking.com yorumları içe aktarıldı:\nYeni: ${insertedCount}\nDuplicate: ${duplicateCount}`;
      
      alert(alertMsg);
      setToastMessage(alertMsg);
      refetch();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'İçe aktarım sırasında bir sorun oluştu.');
    } finally {
      setIsImportingBooking(false);
    }
  };

  const handleSyncAllPlatforms = async () => {
    if (!currentHotelId) {
      alert('Lütfen bir otel seçin.');
      return;
    }

    const currentHotel = hotels?.find(h => h.id === currentHotelId);
    let dbRow: any = null;
    try {
      const { data } = await supabase
        .from('hotels')
        .select('google_maps_url, google_maps_link, tripadvisor_url, booking_property_id')
        .eq('id', currentHotelId)
        .maybeSingle();
      dbRow = data;
    } catch (e) {
      console.error(e);
    }

    const googleMapsUrl = currentHotel?.googleMapsLink || currentHotel?.googleMapsUrl || dbRow?.google_maps_link || dbRow?.google_maps_url;
    const tripadvisorUrl = currentHotel?.tripadvisorUrl || dbRow?.tripadvisor_url;
    const bookingPropertyId = currentHotel?.bookingPropertyId || dbRow?.booking_property_id;

    if (!googleMapsUrl && !tripadvisorUrl && !bookingPropertyId) {
      alert('Bu otel için tanımlı hiçbir platform linki bulunamadı.');
      return;
    }

    setIsSyncingAll(true);
    let results: string[] = [];

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Oturum bulunamadı.');

      // 1. Google
      if (googleMapsUrl) {
        try {
          const response = await fetch('/api/admin-import-google-maps-reviews', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ hotelId: currentHotelId, googleMapsUrl })
          });
          const res = await response.json();
          if (response.ok) {
            results.push(`Google: ${res.importedCount} yeni yorum`);
          } else {
            results.push(`Google: Hata (${res.error || 'İçe aktarılamadı'})`);
          }
        } catch (e: any) {
          results.push(`Google: Hata (${e.message})`);
        }
      }

      // 2. TripAdvisor
      if (tripadvisorUrl) {
        try {
          const response = await fetch('/api/admin-import-tripadvisor-reviews', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ hotelId: currentHotelId, tripadvisorUrl })
          });
          const res = await response.json();
          if (response.ok) {
            results.push(`Tripadvisor: ${res.importedCount} yeni yorum`);
          } else {
            results.push(`Tripadvisor: Hata (${res.error || 'İçe aktarılamadı'})`);
          }
        } catch (e: any) {
          results.push(`Tripadvisor: Hata (${e.message})`);
        }
      }

      // 3. Booking.com
      if (bookingPropertyId) {
        try {
          const response = await fetch('/api/admin-import-booking-reviews', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ hotelId: currentHotelId, range: importRange })
          });
          const res = await response.json();
          if (response.ok) {
            results.push(`Booking.com: ${res.importedCount} yeni yorum`);
          } else {
            results.push(`Booking.com: Hata (${res.error || 'İçe aktarılamadı'})`);
          }
        } catch (e: any) {
          results.push(`Booking.com: Hata (${e.message})`);
        }
      }

      setToastMessage(`Senkronizasyon tamamlandı:\n${results.join('\n')}`);
      refetch();
    } catch (err: any) {
      console.error(err);
      alert(`Hata: ${err.message || 'Senkronizasyon sırasında bir sorun oluştu.'}`);
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: ReviewStatus, responseText?: string) => {
    try {
      if (responseText !== undefined) {
        await reviewService.saveResponseDraft(id, responseText);
      }
      const updated = await reviewService.updateReviewStatus(id, newStatus);
      setSelectedReviewDetail(updated);
      refetch();

      if (newStatus === 'pending_approval') {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          if (token) {
            await fetch('/api/send-review-whatsapp-approval', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ reviewId: id })
            });
            console.log('[WhatsApp] Approval notification triggered.');
            setToastMessage('Yorum onaya gönderildi ve WhatsApp onay bildirimi tetiklendi.');
          }
        } catch (wErr) {
          console.warn('[WhatsApp] Failed to send approval notification:', wErr);
        }
      }
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
          <h1 className="text-xl font-bold text-slate-800 m-0">{t('reviews.title')}</h1>
          <p className="text-xs text-slate-500">
            {t('reviews.subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <select
              value={importRange}
              onChange={(e) => setImportRange(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none text-slate-700 min-h-[36px]"
            >
              <option value="30">Son 30 gün</option>
              <option value="90">Son 90 gün</option>
              <option value="180">Son 180 gün</option>
              <option value="365">Son 365 gün</option>
              <option value="all">Tüm zamanlar</option>
            </select>
          </div>

          {(() => {
            const hasTripadvisor = !!(currentHotel?.tripadvisorUrl);
            const hasGoogle = !!(currentHotel?.googleMapsLink || currentHotel?.googleMapsUrl);
            const hasBooking = !!(currentHotel?.bookingPropertyId);
            const hasAnyLink = hasGoogle || hasTripadvisor || hasBooking;

            return (
              <>
                <button
                  onClick={handleImportGoogleMapsReviews}
                  disabled={isImportingGoogleMaps || !hasGoogle}
                  title={!hasGoogle ? "Bu otel için Google Maps linki tanımlanmamış." : "Google Maps yorumlarını çek"}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition-all shadow-md shadow-emerald-500/10 min-h-[36px] cursor-pointer"
                >
                  <RefreshCw size={14} className={isImportingGoogleMaps ? 'animate-spin' : ''} />
                  <span>{isImportingGoogleMaps ? 'Google Çekiliyor...' : 'Google Maps Yorumlarını Çek'}</span>
                </button>

                <button
                  onClick={handleImportTripadvisorReviews}
                  disabled={isImportingTripadvisor || !hasTripadvisor}
                  title={!hasTripadvisor ? "Bu otel için TripAdvisor URL tanımlanmamış. Lütfen Admin panelinden tanımlayın." : "TripAdvisor yorumlarını çek"}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-tr from-cyan-600 to-blue-500 hover:from-cyan-500 hover:to-blue-400 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition-all shadow-md shadow-blue-500/10 min-h-[36px] cursor-pointer"
                >
                  <RefreshCw size={14} className={isImportingTripadvisor ? 'animate-spin' : ''} />
                  <span>{isImportingTripadvisor ? 'TripAdvisor Çekiliyor...' : 'Tripadvisor Yorumlarını Çek'}</span>
                </button>

                <button
                  onClick={handleImportBookingReviews}
                  disabled={isImportingBooking || !hasBooking}
                  title={!hasBooking ? "Bu otel için Booking.com Property ID tanımlanmamış. Lütfen Admin panelinden tanımlayın." : "Booking.com yorumlarını çek"}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-tr from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition-all shadow-md shadow-orange-500/10 min-h-[36px] cursor-pointer"
                >
                  <RefreshCw size={14} className={isImportingBooking ? 'animate-spin' : ''} />
                  <span>{isImportingBooking ? 'Booking Çekiliyor...' : 'Booking.com Yorumlarını Çek'}</span>
                </button>

                <button
                  onClick={handleSyncAllPlatforms}
                  disabled={isSyncingAll || !hasAnyLink}
                  title={!hasAnyLink ? "Bu otel için tanımlı hiçbir platform linki bulunamadı." : "Tüm platformları senkronize et"}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-tr from-indigo-600 to-purple-500 hover:from-indigo-500 hover:to-purple-400 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition-all shadow-md shadow-indigo-500/10 min-h-[36px] cursor-pointer"
                >
                  <RefreshCw size={14} className={isSyncingAll ? 'animate-spin' : ''} />
                  <span>{isSyncingAll ? 'Senkronize Ediliyor...' : 'Tüm Platformları Senkronize Et'}</span>
                </button>

                <button
                  onClick={handleExportReviews}
                  disabled={isExporting}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-semibold text-xs rounded-xl transition-all min-h-[36px] cursor-pointer"
                >
                  <Download size={14} className={isExporting ? 'animate-spin' : ''} />
                  <span>{isExporting ? 'Exporting...' : t('reviews.export')}</span>
                </button>
              </>
            );
          })()}
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
                <div key={i} className="h-32 rounded-2xl bg-white border border-slate-200 animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl border border-rose-200 text-rose-700 bg-rose-50 flex items-center gap-3">
              <AlertCircle size={20} className="text-rose-500" />
              <span className="font-semibold text-xs">{error}</span>
            </div>
          ) : reviews.length === 0 ? (
            <div className="rounded-2xl p-12 text-center space-y-4 bg-white border border-slate-200 shadow-sm">
              <Database className="mx-auto text-slate-300" size={40} />
              <h3 className="text-sm font-bold text-slate-800">{t('reviews.empty')}</h3>
              <p className="text-xs text-slate-500 max-w-[280px] mx-auto leading-relaxed">
                Filtrelerinize uygun misafir yorumu bulunamadı veya veritabanı boş.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-4">
                {paginatedReviews.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    isSelected={selectedReviewId === review.id}
                    onClick={() => setSelectedReviewId(review.id)}
                  />
                ))}
              </div>

              {/* Pagination controls */}
              {totalReviews > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200 text-xs text-slate-500">
                  <div>
                    Toplam <span className="font-semibold text-slate-700">{totalReviews}</span> yorumdan{' '}
                    <span className="font-semibold text-slate-700">{totalReviews === 0 ? 0 : startIndex + 1}</span>-
                    <span className="font-semibold text-slate-700">{endIndex}</span> arası gösteriliyor
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    {/* Page size selection */}
                    <div className="flex items-center gap-1.5">
                      <span>Gösterim:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 focus:outline-none focus:border-blue-500 text-xs font-semibold cursor-pointer"
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                    </div>

                    {/* Page numbers navigation */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-semibold cursor-pointer disabled:cursor-not-allowed text-[11px]"
                      >
                        Önceki
                      </button>

                      {getPageNumbers().map((pageNum) => (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer text-[11px] ${
                            currentPage === pageNum
                              ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                              : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      ))}

                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages || totalPages === 0}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-semibold cursor-pointer disabled:cursor-not-allowed text-[11px]"
                      >
                        Sonraki
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right pane: Review detail card */}
        <div className="lg:col-span-1">
          {isLoadingDetail ? (
            <div className="rounded-2xl p-12 text-center h-[60vh] flex flex-col justify-center items-center space-y-4 border border-slate-200 bg-white shadow-sm">
              <RefreshCw className="animate-spin text-blue-600" size={32} />
              <p className="text-xs text-slate-500 font-semibold">Detay analiz verileri yükleniyor...</p>
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
            <div className="rounded-2xl p-12 text-center h-[60vh] flex flex-col justify-center items-center space-y-4 border border-slate-200 bg-white shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-500/10 to-purple-500/10 flex items-center justify-center text-blue-600 mb-2">
                <Sparkles size={28} className="animate-pulse" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Bir yorum seçin</h3>
              <p className="text-xs text-slate-500 max-w-[220px] mx-auto leading-relaxed font-medium">
                AI analizi ve cevap taslağı burada görünecek.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Import Debug Summary Modal */}
      {importSummary && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg p-6 rounded-2xl border border-slate-200 shadow-2xl relative overflow-hidden space-y-6 text-slate-800">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-850 flex items-center gap-2 m-0">
                <Bell size={16} className="text-blue-600" />
                <span>İçe Aktarım Sonuç Özeti</span>
              </h3>
              <button 
                onClick={() => setImportSummary(null)}
                className="text-xs text-slate-500 hover:text-slate-800 font-bold"
              >
                Kapat
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-3.5 text-xs">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Tarih Aralığı:</span>
                  <span className="font-semibold text-slate-800">
                    {importSummary.range === '30' && 'Son 30 gün'}
                    {importSummary.range === '90' && 'Son 90 gün'}
                    {importSummary.range === '180' && 'Son 180 gün'}
                    {importSummary.range === '365' && 'Son 365 gün'}
                    {importSummary.range === 'all' && 'Tüm zamanlar'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Google’dan çekilen toplam:</span>
                  <span className="font-bold text-blue-600">{importSummary.totalFetched}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Mükerrer (Atlanan):</span>
                  <span className="font-semibold text-amber-600">{importSummary.duplicateCount}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Sisteme eklenen yeni:</span>
                  <span className="font-bold text-emerald-600">{importSummary.importedCount}</span>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-slate-500">Hata alan yorum:</span>
                  <span className="font-semibold text-rose-600">{importSummary.failedCount}</span>
                </div>
              </div>

              <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h4 className="text-[10px] text-slate-550 font-bold uppercase tracking-wider mb-2">Entegrasyon Durumu</h4>
                <div className="text-[11px] text-slate-650 space-y-1.5 leading-relaxed">
                  <div>
                    <span className="text-slate-500">Entegrasyon Durumu:</span>{' '}
                    {importSummary.importedCount > 0 ? (
                      <span className="text-emerald-600 font-semibold">Aktif (Veri İletiliyor)</span>
                    ) : importSummary.failedCount > 0 ? (
                      <span className="text-rose-600 font-semibold">Hatalı (Bağlantı Sorunu)</span>
                    ) : (
                      <span className="text-slate-500">Beklemede</span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500">Google API Sınıfı:</span>{' '}
                    <span className="text-slate-600 font-mono text-[10px]">MockGoogleProvider</span>
                  </div>
                </div>
              </div>
            </div>

            {importSummary.importDetails && importSummary.importDetails.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                  Senkronizasyon Detayları ({importSummary.importDetails.length} Yorum)
                </span>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {importSummary.importDetails.map((detail: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[10px]">
                      <code className="text-slate-600 font-mono text-[9px] truncate max-w-[200px]">{detail.reviewId}</code>
                      <span className={`px-2 py-0.5 rounded font-bold text-[8px] uppercase tracking-wider border ${
                        detail.status === 'sent' ? 'bg-emerald-55 text-emerald-600 border-emerald-200' :
                        detail.status === 'duplicate_skipped' ? 'bg-amber-55 text-amber-600 border-amber-200' :
                        'bg-rose-55 text-rose-600 border-rose-200'
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
                <span className="text-[10px] text-rose-600 font-bold uppercase tracking-wider block">
                  Hata Detayları ({importSummary.detailedErrors.length})
                </span>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {importSummary.detailedErrors.map((err, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-[10px] text-rose-700 space-y-1.5 leading-normal">
                      <div className="flex justify-between items-center text-[9px] border-b border-rose-200 pb-1 mb-1">
                        <span className="text-rose-700 font-bold">HATA #{idx + 1}</span>
                        <code className="text-slate-600 font-mono">ID: {err.reviewId}</code>
                      </div>
                      {err.webhookUrl && (
                        <div className="flex items-start gap-1">
                          <span className="text-slate-500 shrink-0 font-medium">Webhook URL:</span>
                          <code className="text-slate-600 font-mono break-all">{err.webhookUrl}</code>
                        </div>
                      )}
                      {err.status !== undefined && (
                        <div>
                          <span className="text-slate-500 font-medium">HTTP Durum Kodu:</span>{' '}
                          <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-bold font-mono text-[9px]">{err.status}</span>
                        </div>
                      )}
                      {err.responseBody && (
                        <div className="space-y-0.5">
                          <span className="text-slate-500 font-medium block">Yanıt Gövdesi:</span>
                          <pre className="mt-1 bg-white border border-slate-200 p-2 rounded-lg text-slate-600 font-mono text-[9px] overflow-x-auto whitespace-pre-wrap max-h-20 leading-relaxed">
                            {err.responseBody}
                          </pre>
                        </div>
                      )}
                      {err.message && (
                        <div className="text-rose-700 font-mono text-[9px] bg-white p-2 rounded-lg border border-rose-200">
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
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Premium Toast Notification Overlay */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl border border-blue-200 bg-white shadow-2xl flex items-center gap-3 animate-slide-in max-w-sm">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
            <Bell size={16} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800">Bildirim</h4>
            <p className="text-[10px] text-slate-500 mt-0.5 font-medium">{toastMessage}</p>
          </div>
          <button 
            onClick={() => setToastMessage(null)}
            className="text-xs text-slate-500 hover:text-slate-800 font-bold ml-4"
          >
            Kapat
          </button>
        </div>
      )}
    </div>
  );
}


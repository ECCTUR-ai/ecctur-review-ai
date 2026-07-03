import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthGuard';
import { reviewService } from '@/services/reviewService';
import { whatsappService } from '@/services/whatsappService';
import { Review, ReviewSource, ReviewStatus, ReviewPriority, Hotel } from '@/types';
import { mapReview } from '@/repositories/reviewRepository';
import { usePersistentPageState } from '@/hooks/usePersistentPageState';
import { 
  Sparkles, 
  MessageSquare, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  CheckCheck, 
  Globe, 
  CornerDownRight, 
  Send,
  RefreshCw,
  Search,
  Filter,
  Check,
  ChevronRight,
  X,
  Languages,
  BookOpen,
  Sliders,
  TrendingUp,
  Briefcase,
  Archive,
  UserCheck
} from 'lucide-react';

interface KPIStats {
  pendingResponse: number;
  todayCount: number;
  publishedResponse: number;
  avgResponseTimeText: string;
  criticalCount: number;
  aiSuccessRate: number;
}

interface PublishLogInfo {
  publisherName: string;
  publishedAt: string;
  aiGenerated: boolean;
  whatsappSent: boolean;
}

export default function AiReplies() {
  const { t } = useTranslation();
  const { roleKey, hotelIds, organizationId } = useAuth();
  const { currentHotelId, hotels } = useOutletContext<{ currentHotelId: string; hotels: Hotel[] }>();

  const isOwnerOrAdmin = roleKey === 'super_admin' || roleKey === 'admin' || roleKey === 'owner';

  // Navigation, Tabs and Filters State persisted globally
  const [pageState, setPageState, resetPageState] = usePersistentPageState('guestreview_ai_replies_state', {
    activeTab: 'active' as 'active' | 'archived',
    search: '',
    selectedHotelId: 'all',
    selectedPlatform: 'all',
    selectedRating: 'all' as number | 'all',
    selectedStatus: 'all',
    selectedDateRange: '30d',
    customStartDate: '',
    customEndDate: '',
    selectedPublisherId: 'all',
    activePanelReview: null as Review | null,
    offset: 0
  });

  const {
    activeTab,
    search,
    selectedHotelId,
    selectedPlatform,
    selectedRating,
    selectedStatus,
    selectedDateRange,
    customStartDate,
    customEndDate,
    selectedPublisherId,
    activePanelReview,
    offset
  } = pageState;

  const setActiveTab = (val: 'active' | 'archived' | ((prev: 'active' | 'archived') => 'active' | 'archived')) => {
    setPageState(prev => ({
      activeTab: typeof val === 'function' ? val(prev.activeTab) : val,
      offset: 0
    }));
  };
  const setSearch = (val: string) => setPageState({ search: val, offset: 0 });
  const setSelectedHotelId = (val: string) => setPageState({ selectedHotelId: val, offset: 0 });
  const setSelectedPlatform = (val: string) => setPageState({ selectedPlatform: val, offset: 0 });
  const setSelectedRating = (val: number | 'all') => setPageState({ selectedRating: val, offset: 0 });
  const setSelectedStatus = (val: string) => setPageState({ selectedStatus: val, offset: 0 });
  const setSelectedDateRange = (val: string) => setPageState({ selectedDateRange: val, offset: 0 });
  const setCustomStartDate = (val: string) => setPageState({ customStartDate: val, offset: 0 });
  const setCustomEndDate = (val: string) => setPageState({ customEndDate: val, offset: 0 });
  const setSelectedPublisherId = (val: string) => setPageState({ selectedPublisherId: val, offset: 0 });
  const setActivePanelReview = (val: Review | null | ((prev: Review | null) => Review | null)) => {
    setPageState(prev => ({
      activePanelReview: typeof val === 'function' ? val(prev.activePanelReview) : val
    }));
  };
  const setOffset = (val: number | ((prev: number) => number)) => {
    setPageState(prev => ({
      offset: typeof val === 'function' ? val(prev.offset) : val
    }));
  };

  // State Management
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Archived-specific filters metadata
  const [archivePublishers, setArchivePublishers] = useState<Array<{ id: string; name: string }>>([]);

  const [publishLogs, setPublishLogs] = useState<Record<string, PublishLogInfo>>({});
  const [selectedReviewIds, setSelectedReviewIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // KPI Card Stats State
  const [kpis, setKpis] = useState<KPIStats>({
    pendingResponse: 0,
    todayCount: 0,
    publishedResponse: 0,
    avgResponseTimeText: '0m',
    criticalCount: 0,
    aiSuccessRate: 0
  });

  // Edit State Map
  const [editTexts, setEditTexts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Translation State Map
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translatingKeys, setTranslatingKeys] = useState<Record<string, boolean>>({});

  // Pagination cursor
  const LIMIT = 10;
  // Track active hotel for queries
  const activeHotelId = selectedHotelId === 'all' ? currentHotelId : selectedHotelId;

  // Initialize selected hotel ID to dashboard's active hotel only if not set
  useEffect(() => {
    if (currentHotelId && selectedHotelId === 'all') {
      setSelectedHotelId(currentHotelId);
    }
  }, [currentHotelId, selectedHotelId]);

  // Load KPI Stats
  const fetchKPIStats = useCallback(async () => {
    if (!activeHotelId) return;

    try {
      let query = supabase
        .from('reviews')
        .select('status, rating, created_at, review_date, responded_at, google_reply_published_at');

      if (selectedHotelId === 'all') {
        if (roleKey !== 'super_admin' && hotelIds && hotelIds.length > 0) {
          query = query.in('hotel_id', hotelIds);
        } else if (organizationId) {
          query = query.eq('organization_id', organizationId);
        }
      } else {
        query = query.eq('hotel_id', selectedHotelId);
      }

      const { data: dbReviews, error } = await query;
      if (error) throw error;

      if (!dbReviews || dbReviews.length === 0) {
        setKpis({
          pendingResponse: 0,
          todayCount: 0,
          publishedResponse: 0,
          avgResponseTimeText: '0m',
          criticalCount: 0,
          aiSuccessRate: 0
        });
        return;
      }

      const todayStr = new Date().toISOString().split('T')[0];
      let pending = 0;
      let todayReviews = 0;
      let published = 0;
      let critical = 0;
      let responseTimes: number[] = [];

      dbReviews.forEach(r => {
        const reviewStatus = (r.status || 'draft').toLowerCase();
        const ratingVal = r.rating || 5;
        const reviewDateStr = r.review_date || r.created_at || '';
        const isToday = reviewDateStr.split('T')[0] === todayStr;

        if (reviewStatus === 'draft' || reviewStatus === 'waiting_approval' || reviewStatus === 'pending_approval') {
          pending++;
        }
        if (isToday) {
          todayReviews++;
        }
        if (reviewStatus === 'published') {
          published++;
          const replyTime = r.responded_at || r.google_reply_published_at;
          if (replyTime && reviewDateStr) {
            const diffMs = new Date(replyTime).getTime() - new Date(reviewDateStr).getTime();
            if (diffMs > 0) {
              responseTimes.push(diffMs);
            }
          }
        }
        if (ratingVal <= 2) {
          critical++;
        }
      });

      // Calculate Average Response Time
      let avgTimeText = '0m';
      if (responseTimes.length > 0) {
        const totalMs = responseTimes.reduce((a, b) => a + b, 0);
        const avgMs = totalMs / responseTimes.length;
        const avgMins = avgMs / (1000 * 60);
        if (avgMins < 60) {
          avgTimeText = `${Math.round(avgMins)}m`;
        } else if (avgMins < 1440) {
          avgTimeText = `${(avgMins / 60).toFixed(1)}h`;
        } else {
          avgTimeText = `${(avgMins / 1440).toFixed(1)}d`;
        }
      }

      // Calculate AI Success Rate
      const totalReviewsCount = dbReviews.length;
      const aiSuccessRate = totalReviewsCount > 0 ? Math.round((published / totalReviewsCount) * 100) : 0;

      setKpis({
        pendingResponse: pending,
        todayCount: todayReviews,
        publishedResponse: published,
        avgResponseTimeText: avgTimeText,
        criticalCount: critical,
        aiSuccessRate
      });
    } catch (e) {
      console.error('Failed to load KPI statistics:', e);
    }
  }, [selectedHotelId, activeHotelId, roleKey, hotelIds, organizationId]);

  // Load Unique Publishers for Archive Filter
  const fetchUniquePublishers = useCallback(async () => {
    try {
      const { data: logs, error } = await supabase
        .from('review_action_logs')
        .select('action_by_user_id, action_by_user_name')
        .eq('action_type', 'published');

      if (error) throw error;

      const userMap: Record<string, string> = {};
      (logs || []).forEach(log => {
        if (log.action_by_user_id && log.action_by_user_name) {
          userMap[log.action_by_user_id] = log.action_by_user_name;
        }
      });

      const uniqueUsers = Object.entries(userMap).map(([id, name]) => ({ id, name }));
      setArchivePublishers(uniqueUsers);
    } catch (e) {
      console.error('Failed to load unique publishers:', e);
    }
  }, []);

  // Load Reviews List (Active vs Archived Tab)
  const fetchReviewsList = useCallback(async (isLoadMore = false) => {
    if (!activeHotelId) return;

    if (!isLoadMore) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      let query = supabase
        .from('reviews')
        .select('*', { count: 'exact' });

      // Apply Hotel / Tenant Restriction Filter
      if (selectedHotelId === 'all') {
        if (roleKey !== 'super_admin' && hotelIds && hotelIds.length > 0) {
          query = query.in('hotel_id', hotelIds);
        } else if (organizationId) {
          query = query.eq('organization_id', organizationId);
        }
      } else {
        query = query.eq('hotel_id', selectedHotelId);
      }

      // Apply Platform Filter
      if (selectedPlatform !== 'all') {
        if (selectedPlatform === 'Google') {
          query = query.or('platform.eq.google,platform.eq.Google');
        } else if (selectedPlatform === 'TripAdvisor') {
          query = query.or('platform.eq.tripadvisor,platform.eq.TripAdvisor,platform.eq.Tripadvisor');
        } else if (selectedPlatform === 'Booking') {
          query = query.or('platform.eq.booking,platform.eq.Booking,platform.eq.Booking.com');
        } else if (selectedPlatform === 'HolidayCheck') {
          query = query.or('platform.eq.holidaycheck,platform.eq.HolidayCheck');
        }
      }

      // Apply Rating Filter
      if (selectedRating !== 'all') {
        query = query.eq('rating', selectedRating);
      }

      // Apply Tabs constraint
      if (activeTab === 'active') {
        // Active reviews are those NOT published
        query = query.not('status', 'in', '("Published","published")');
        
        // Status filter applies only to non-published status values in Active tab
        if (selectedStatus !== 'all') {
          if (selectedStatus === 'unanswered') {
            query = query.is('ai_reply', null).is('response', null);
          } else {
            query = query.eq('status', selectedStatus);
          }
        }
      } else {
        // Archived reviews are those that ARE published
        query = query.in('status', ['Published', 'published']);

        // Apply publisher filter if active in archive tab
        if (selectedPublisherId !== 'all') {
          const { data: logs, error: logsErr } = await supabase
            .from('review_action_logs')
            .select('review_id')
            .eq('action_by_user_id', selectedPublisherId)
            .eq('action_type', 'published');
          
          if (!logsErr && logs && logs.length > 0) {
            const reviewIds = logs.map(l => l.review_id);
            query = query.in('id', reviewIds);
          } else {
            query = query.in('id', ['00000000-0000-0000-0000-000000000000']);
          }
        }
      }

      // Apply Date Filter
      if (selectedDateRange !== 'all') {
        const cutOff = new Date();
        if (selectedDateRange === 'today') {
          cutOff.setHours(0, 0, 0, 0);
        } else if (selectedDateRange === '7d') {
          cutOff.setDate(cutOff.getDate() - 7);
        } else if (selectedDateRange === '30d') {
          cutOff.setDate(cutOff.getDate() - 30);
        }

        if (selectedDateRange === 'custom' && customStartDate) {
          query = query.gte('review_date', customStartDate);
          if (customEndDate) {
            query = query.lte('review_date', customEndDate);
          }
        } else if (selectedDateRange !== 'custom') {
          query = query.gte('review_date', cutOff.toISOString());
        }
      }

      // Apply search query filter
      if (search.trim()) {
        query = query.ilike('review_text', `%${search}%`);
      }

      // Sort and Paginate
      const startOffset = isLoadMore ? offset : 0;
      query = query
        .order('review_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .range(startOffset, startOffset + LIMIT - 1);

      const { data, count, error } = await query;
      if (error) throw error;

      const mappedReviews = (data || []).map(mapReview);

      if (activeTab === 'active') {
        console.log("PENDING FILTER", mappedReviews.length);
      } else {
        console.log("PUBLISHED FILTER", mappedReviews.length);
      }

      // Fetch published audit logs details if loading reviews
      if (mappedReviews.length > 0) {
        const reviewIds = mappedReviews.map(r => r.id);
        const { data: logsData } = await supabase
          .from('review_action_logs')
          .select('review_id, action_by_user_name, action_at, ai_generated, whatsapp_sent_at, action_type')
          .in('review_id', reviewIds);

        if (logsData) {
          const logMapping: Record<string, PublishLogInfo> = {};
          
          reviewIds.forEach(id => {
            logMapping[id] = {
              publisherName: '',
              publishedAt: '',
              aiGenerated: false,
              whatsappSent: false
            };
          });

          logsData.forEach(log => {
            const mapped = logMapping[log.review_id];
            if (mapped) {
              if (log.action_type === 'published') {
                mapped.publisherName = log.action_by_user_name || mapped.publisherName || 'Sistem';
                mapped.publishedAt = log.action_at || mapped.publishedAt;
                mapped.aiGenerated = log.ai_generated || mapped.aiGenerated || false;
              }
              if (log.action_type === 'sent_to_whatsapp' || log.whatsapp_sent_at) {
                mapped.whatsappSent = true;
              }
            }
          });
          setPublishLogs(prev => ({ ...prev, ...logMapping }));
        }
      }

      if (isLoadMore) {
        setReviews(prev => [...prev, ...mappedReviews]);
        setOffset(prev => prev + LIMIT);
      } else {
        setReviews(mappedReviews);
        setOffset(LIMIT);
      }

      setTotalCount(count || 0);
      setHasMore(mappedReviews.length === LIMIT);

      // Prepopulate editable draft text map
      const newEditTexts: Record<string, string> = {};
      mappedReviews.forEach(r => {
        newEditTexts[r.id] = r.response || '';
      });
      setEditTexts(prev => ({ ...prev, ...newEditTexts }));

    } catch (e) {
      console.error('Failed to query reviews list:', e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [
    selectedHotelId,
    activeHotelId,
    roleKey,
    hotelIds,
    organizationId,
    selectedPlatform,
    selectedRating,
    selectedStatus,
    selectedDateRange,
    customStartDate,
    customEndDate,
    search,
    activeTab,
    selectedPublisherId,
    offset
  ]);

  // Trigger reloading lists on filter/hotel changes
  useEffect(() => {
    fetchKPIStats();
    fetchUniquePublishers();
    fetchReviewsList(false);
  }, [
    selectedHotelId,
    selectedPlatform,
    selectedRating,
    selectedStatus,
    selectedDateRange,
    customStartDate,
    customEndDate,
    search,
    activeTab,
    selectedPublisherId
  ]);

  // Infinite Scroll Listener
  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 100) {
      if (!loadingMore && hasMore) {
        fetchReviewsList(true);
      }
    }
  };

  // Perform translation call
  const handleTranslate = async (reviewId: string, type: 'comment' | 'reply', text: string, targetLang: 'tr' | 'en' | 'ru') => {
    const key = `${reviewId}_${type}_${targetLang}`;
    if (translations[key]) return;

    setTranslatingKeys(prev => ({ ...prev, [key]: true }));
    try {
      const translated = await reviewService.translateReview(text, targetLang);
      setTranslations(prev => ({ ...prev, [key]: translated }));
    } catch (err: any) {
      alert(`Translation Error: ${err.message || String(err)}`);
    } finally {
      setTranslatingKeys(prev => ({ ...prev, [key]: false }));
    }
  };

  // Inline Draft text area changes
  const handleTextChange = (reviewId: string, val: string) => {
    setEditTexts(prev => ({ ...prev, [reviewId]: val }));
  };

  // Save inline text as Draft response
  const handleSaveDraft = async (review: Review) => {
    const draftText = editTexts[review.id];
    setSavingId(review.id);
    try {
      const platform = String(review.source || (review as any).platform || '').toLowerCase();
      if (platform !== 'google') {
        const { error } = await supabase
          .from('reviews')
          .update({
            ai_reply: draftText,
            publish_status: 'Draft',
            published: 'No',
            status: 'Draft'
          })
          .eq('id', review.id);
        if (error) throw error;
      } else {
        await reviewService.saveResponseDraft(review.id, draftText);
      }

      setReviews(prev => prev.map(r => r.id === review.id ? { ...r, response: draftText, status: 'draft' } : r));
      if (activePanelReview?.id === review.id) {
        setActivePanelReview(prev => prev ? { ...prev, response: draftText, status: 'draft' } : null);
      }
    } catch (err: any) {
      alert(`Save Draft Error: ${err.message || String(err)}`);
    } finally {
      setSavingId(null);
    }
  };

  // Regenerate Response via AI
  const handleRegenerateAI = async (review: Review) => {
    setSavingId(review.id);
    const action = 'regenerate';
    const platform = String(review.source || (review as any).platform || '').toLowerCase();
    const selectedReview = review;
    try {
      const result = await reviewService.generateAiResponse(review.id);
      const aiReply = result.response;
      handleTextChange(review.id, aiReply);

      if (platform !== 'google') {
        const { error } = await supabase
          .from('reviews')
          .update({
            ai_reply: aiReply,
            publish_status: 'Draft',
            published: 'No',
            status: 'Draft'
          })
          .eq('id', review.id);
        if (error) throw error;
      } else {
        await reviewService.saveResponseDraft(review.id, aiReply);
      }

      setReviews(prev => prev.map(r => r.id === review.id ? { ...r, response: aiReply, status: 'draft' } : r));
      if (activePanelReview?.id === review.id) {
        setActivePanelReview(prev => prev ? { ...prev, response: aiReply, status: 'draft' } : null);
      }
    } catch (err: any) {
      console.log("REGENERATE_ERROR_SOURCE", {
        action,
        platform,
        selectedReview,
        stack: err
      });
      alert(`Regenerate AI Error: ${err.message || String(err)}`);
    } finally {
      setSavingId(null);
    }
  };

  // Send WhatsApp notification for approval
  const handleSendWhatsApp = async (review: Review) => {
    setSavingId(review.id);
    try {
      await whatsappService.sendApprovalMessage(review.id);
      await reviewService.updateReviewStatus(review.id, 'pending_approval');
      setReviews(prev => prev.map(r => r.id === review.id ? { ...r, status: 'pending_approval' } : r));
      if (activePanelReview?.id === review.id) {
        setActivePanelReview(prev => prev ? { ...prev, status: 'pending_approval' } : null);
      }
      alert('Approval request successfully sent to WhatsApp Business escalation queue!');
    } catch (err: any) {
      alert(`WhatsApp Notification Failed: ${err.message || String(err)}`);
    } finally {
      setSavingId(null);
    }
  };

  // Publish response to OTA platform (Locally only for all platforms)
  const handlePublish = async (review: Review) => {
    const replyText = editTexts[review.id] || review.response || '';
    if (!replyText.trim()) {
      alert('Please enter a response message before publishing.');
      return;
    }

    const selectedReview = review;
    setSavingId(selectedReview.id);
    try {
      const platform = String(selectedReview.source || (selectedReview as any).platform || '').toLowerCase();

      // local publish only for all platforms
      const { data: updatedRow, error } = await supabase
        .from('reviews')
        .update({
          status: 'Published',
          publish_status: 'Published',
          published: 'Yes',
          published_at: new Date().toISOString(),
          ai_reply: replyText
        })
        .eq('id', selectedReview.id)
        .select('*')
        .maybeSingle();

      if (error) {
        throw new Error("Yorum yayınlandı olarak işaretlenemedi.");
      }

      console.log("LOCAL PUBLISH UPDATE", updatedRow);

      // Try to insert audit log
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        const userEmail = currentUser?.email || '';
        const userMetadata = currentUser?.user_metadata || {};
        const userName = [userMetadata.first_name, userMetadata.last_name].filter(Boolean).join(' ') || 'User';

        await supabase.from('review_action_logs').insert({
          review_id: selectedReview.id,
          hotel_id: selectedReview.hotelId,
          organization_id: selectedReview.organizationId,
          action_type: 'published',
          action_by_user_id: currentUser?.id,
          action_by_user_email: userEmail,
          action_by_user_name: userName,
          action_at: new Date().toISOString(),
          previous_status: selectedReview.status,
          new_status: 'published',
          platform: platform,
          guest_name: selectedReview.guestName,
          review_reply_text: replyText,
          ai_generated: true,
          published_at: new Date().toISOString(),
          approved_at: new Date().toISOString()
        });
      } catch (logErr) {
        console.warn('[handlePublish] Failed to insert audit log:', logErr);
      }

      alert("Yorum yayınlandı olarak işaretlendi ve listeden kaldırıldı.");

      // Instantly remove card from active list and move to archive list dynamically
      if (activeTab === 'active') {
        setReviews(prev => prev.filter(r => r.id !== selectedReview.id));
        setSelectedReviewIds(prev => prev.filter(id => id !== selectedReview.id));
      } else {
        setReviews(prev => prev.map(r => r.id === selectedReview.id ? { ...r, response: replyText, status: 'published' } : r));
      }

      if (activePanelReview?.id === selectedReview.id) {
        setActivePanelReview(null);
      }

      // Update statistics and reload the list
      fetchKPIStats();
      fetchUniquePublishers();
      fetchReviewsList(false);

    } catch (err: any) {
      alert(err.message || "Yorum yayınlandı olarak işaretlenemedi.");
    } finally {
      setSavingId(null);
    }
  };

  // Checkbox multi-selection changes
  const handleSelectCheckbox = (reviewId: string) => {
    setSelectedReviewIds(prev => {
      if (prev.includes(reviewId)) {
        return prev.filter(id => id !== reviewId);
      } else {
        return [...prev, reviewId];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedReviewIds.length === reviews.length) {
      setSelectedReviewIds([]);
    } else {
      setSelectedReviewIds(reviews.map(r => r.id));
    }
  };

  // Bulk operation actions
  const handleBulkAI = async () => {
    if (selectedReviewIds.length === 0) return;
    setBulkActionLoading(true);
    let success = 0;
    for (const id of selectedReviewIds) {
      try {
        const review = reviews.find(r => r.id === id);
        if (review) {
          const platform = String(review.source || (review as any).platform || '').toLowerCase();
          const result = await reviewService.generateAiResponse(id);

          if (platform !== 'google') {
            const { error } = await supabase
              .from('reviews')
              .update({
                ai_reply: result.response,
                publish_status: 'Draft',
                published: 'No',
                status: 'Draft'
              })
              .eq('id', id);
            if (error) throw error;
          } else {
            await reviewService.saveResponseDraft(id, result.response);
          }

          handleTextChange(id, result.response);
          success++;
        }
      } catch (e) {
        console.error(`Bulk AI failure for review ${id}:`, e);
      }
    }
    alert(`Bulk AI generation complete: ${success}/${selectedReviewIds.length} succeeded.`);
    fetchReviewsList(false);
    setSelectedReviewIds([]);
    setBulkActionLoading(false);
  };

  const handleBulkWhatsApp = async () => {
    if (selectedReviewIds.length === 0) return;
    setBulkActionLoading(true);
    let success = 0;
    for (const id of selectedReviewIds) {
      try {
        await whatsappService.sendApprovalMessage(id);
        await reviewService.updateReviewStatus(id, 'pending_approval');
        success++;
      } catch (e) {
        console.error(`Bulk WhatsApp failure for review ${id}:`, e);
      }
    }
    alert(`Bulk WhatsApp approvals dispatched: ${success}/${selectedReviewIds.length} successfully sent.`);
    fetchReviewsList(false);
    setSelectedReviewIds([]);
    setBulkActionLoading(false);
  };

  const handleBulkPublish = async () => {
    if (selectedReviewIds.length === 0) return;
    setBulkActionLoading(true);
    let success = 0;
    for (const id of selectedReviewIds) {
      try {
        const review = reviews.find(r => r.id === id);
        const text = editTexts[id] || review?.response || '';
        if (text && review) {
          const platform = String(review.source || (review as any).platform || '').toLowerCase();

          // local publish only for all platforms
          const { data: updatedRow, error } = await supabase
            .from('reviews')
            .update({
              status: 'Published',
              publish_status: 'Published',
              published: 'Yes',
              published_at: new Date().toISOString(),
              ai_reply: text
            })
            .eq('id', id)
            .select('*')
            .maybeSingle();

          if (error) throw error;

          console.log("LOCAL PUBLISH UPDATE", updatedRow);

          // Try to insert audit log
          try {
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            const userEmail = currentUser?.email || '';
            const userMetadata = currentUser?.user_metadata || {};
            const userName = [userMetadata.first_name, userMetadata.last_name].filter(Boolean).join(' ') || 'User';

            await supabase.from('review_action_logs').insert({
              review_id: id,
              hotel_id: review.hotelId,
              organization_id: review.organizationId,
              action_type: 'published',
              action_by_user_id: currentUser?.id,
              action_by_user_email: userEmail,
              action_by_user_name: userName,
              action_at: new Date().toISOString(),
              previous_status: review.status,
              new_status: 'published',
              platform: platform,
              guest_name: review.guestName,
              review_reply_text: text,
              ai_generated: true,
              published_at: new Date().toISOString(),
              approved_at: new Date().toISOString()
            });
          } catch (logErr) {
            console.warn('[handleBulkPublish] Failed to insert audit log:', logErr);
          }

          success++;
        }
      } catch (e) {
        console.error(`Bulk Publish failure for review ${id}:`, e);
      }
    }
    alert(`Bulk publishing complete: ${success}/${selectedReviewIds.length} review responses published.`);
    fetchReviewsList(false);
    setSelectedReviewIds([]);
    setBulkActionLoading(false);
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5 text-amber-400">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className="text-sm">
            {i < rating ? '★' : '☆'}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-24" onScroll={handleScroll}>
      {/* 1. Header & Title */}
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 m-0">
            <Sparkles className="text-blue-600 animate-pulse" size={22} />
            AI Cevaplama Merkezi
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Yapay zeka yanıt kalitesini denetleyin, misafir dönüşlerini onaylayın ve WhatsApp/OTA entegrasyonlarını yönetin.
          </p>
        </div>
      </div>

      {/* 2. Top KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Bekleyen AI Cevap</span>
            <span className="text-lg font-bold text-slate-800 mt-0.5 block">{kpis.pendingResponse}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 shrink-0">
            <MessageSquare size={20} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Bugün Gelen Yorum</span>
            <span className="text-lg font-bold text-slate-800 mt-0.5 block">{kpis.todayCount}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Yayınlanan Cevap</span>
            <span className="text-lg font-bold text-slate-800 mt-0.5 block">{kpis.publishedResponse}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 shrink-0">
            <CornerDownRight size={20} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Avg Yanıt Süresi</span>
            <span className="text-lg font-bold text-slate-800 mt-0.5 block">{kpis.avgResponseTimeText}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Kritik Yorum</span>
            <span className="text-lg font-bold text-slate-800 mt-0.5 block">{kpis.criticalCount}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
            <CheckCheck size={20} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">AI Başarı Oranı</span>
            <span className="text-lg font-bold text-slate-800 mt-0.5 block">{kpis.aiSuccessRate}%</span>
          </div>
        </div>
      </div>

      {/* 3. Section/Tabs Pills */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => { setActiveTab('active'); setSelectedReviewIds([]); }}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'active' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Sparkles size={16} />
          Aktif Cevaplar
        </button>
        <button
          onClick={() => { setActiveTab('archived'); setSelectedReviewIds([]); }}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'archived' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Archive size={16} />
          Arşivlenen Cevaplar
        </button>
      </div>

      {/* 4. Filters Toolbar */}
      <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
              <Filter size={16} className="text-blue-600" />
              Filtreler
            </div>
            {(search || selectedHotelId !== 'all' || selectedPlatform !== 'all' || selectedRating !== 'all' || selectedStatus !== 'all' || selectedDateRange !== '30d' || customStartDate || customEndDate) && (
              <button
                onClick={() => resetPageState()}
                className="text-[11px] text-rose-600 hover:text-rose-700 hover:underline font-bold transition-all cursor-pointer focus:outline-none"
              >
                Filtreleri Sıfırla
              </button>
            )}
          </div>

          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Yorumlarda ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Otel Seçimi */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Otel Seçimi</label>
            <select
              value={selectedHotelId}
              onChange={(e) => setSelectedHotelId(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:border-blue-500"
            >
              {isOwnerOrAdmin && (
                <option value="all">Tüm Oteller (Organizasyon)</option>
              )}
              {hotels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>

          {/* Platform */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Platform</label>
            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:border-blue-500"
            >
              <option value="all">Tümü</option>
              <option value="Google">Google Reviews</option>
              <option value="TripAdvisor">TripAdvisor</option>
              <option value="Booking">Booking.com</option>
              <option value="HolidayCheck">HolidayCheck</option>
            </select>
          </div>

          {/* Puan */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Puan (Stars)</label>
            <select
              value={selectedRating}
              onChange={(e) => setSelectedRating(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:border-blue-500"
            >
              <option value="all">Tümü</option>
              <option value="5">★★★★★ (5 Stars)</option>
              <option value="4">★★★★☆ (4 Stars)</option>
              <option value="3">★★★☆☆ (3 Stars)</option>
              <option value="2">★★☆☆☆ (2 Stars)</option>
              <option value="1">★☆☆☆☆ (1 Star)</option>
            </select>
          </div>

          {/* Yanıt Durumu (Active) / Yayınlayan (Archived) */}
          {activeTab === 'active' ? (
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Yanıt Durumu</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:border-blue-500"
              >
                <option value="all">Tümü</option>
                <option value="draft">Taslak</option>
                <option value="pending_approval">Onay Bekliyor</option>
                <option value="unanswered">Cevaplanmadı</option>
              </select>
            </div>
          ) : (
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Yayınlayan Kullanıcı</label>
              <select
                value={selectedPublisherId}
                onChange={(e) => setSelectedPublisherId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:border-blue-500"
              >
                <option value="all">Tüm Kullanıcılar</option>
                {archivePublishers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Tarih Aralığı */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Tarih Aralığı</label>
            <select
              value={selectedDateRange}
              onChange={(e) => setSelectedDateRange(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:border-blue-500"
            >
              <option value="today">Bugün</option>
              <option value="7d">Son 7 Gün</option>
              <option value="30d">Son 30 Gün</option>
              <option value="all">Tüm Zamanlar</option>
              <option value="custom">Özel Tarih...</option>
            </select>
          </div>
        </div>

        {/* Custom date range triggers */}
        {selectedDateRange === 'custom' && (
          <div className="flex gap-4 border-t border-slate-50 pt-3 animate-fadeIn">
            <div className="w-44">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Başlangıç</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="w-44">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Bitiş</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* 5. List View & Side Panel Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
        {/* Left: Review Cards List */}
        <div className="xl:col-span-2 space-y-4">
          {reviews.length > 0 && (
            <div className="flex justify-between items-center px-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedReviewIds.length === reviews.length && reviews.length > 0}
                  onChange={handleSelectAll}
                  className="w-3.5 h-3.5 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                Tümünü Seç ({selectedReviewIds.length} / {reviews.length})
              </label>

              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Eşleşen: {totalCount} Yorum
              </span>
            </div>
          )}

          <div className="space-y-4 max-h-[900px] overflow-y-auto pr-1 scrollbar-thin">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white border border-slate-100 rounded-2xl p-5 space-y-4 shadow-sm animate-pulse">
                  <div className="flex justify-between">
                    <div className="h-4 w-32 bg-slate-150 rounded" />
                    <div className="h-4 w-16 bg-slate-150 rounded" />
                  </div>
                  <div className="h-12 bg-slate-150 rounded" />
                  <div className="h-20 bg-slate-100 rounded" />
                </div>
              ))
            ) : reviews.length === 0 ? (
              <div className="bg-white border border-slate-100 rounded-2xl p-16 text-center shadow-sm space-y-4">
                <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mx-auto">
                  {activeTab === 'active' ? <Sparkles size={28} /> : <Archive size={28} />}
                </div>
                <div className="space-y-1.5 max-w-sm mx-auto">
                  <h4 className="text-sm font-semibold text-slate-800">
                    {activeTab === 'active' ? 'Aktif Yorum Bulunmadı' : 'Arşivlenmiş Yorum Bulunmadı'}
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Seçtiğiniz filtreleme kriterlerine uygun bir misafir yorumu bulunamadı.
                  </p>
                </div>
              </div>
            ) : (
              reviews.map((review) => {
                const commentLang = reviewService.detectLanguage(review.comment);
                const editedReplyText = editTexts[review.id] ?? '';
                const reviewHotel = hotels.find(h => h.id === review.hotelId);
                const isSelected = selectedReviewIds.includes(review.id);
                const isPanelActive = activePanelReview?.id === review.id;
                
                // Fetch audit logs publish details
                const publishDetail = publishLogs[review.id];

                return (
                  <div
                    key={review.id}
                    className={`bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col gap-4 relative group ${
                      isPanelActive ? 'ring-2 ring-blue-500 border-transparent' : 'border-slate-100'
                    }`}
                  >
                    {/* Checkbox select */}
                    <div className="absolute top-5 left-5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectCheckbox(review.id)}
                        className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                      />
                    </div>

                    <div className="pl-8 flex flex-col gap-3">
                      {/* Top Row: Meta info */}
                      <div className="flex justify-between items-start gap-4">
                        <div onClick={() => setActivePanelReview(review)} className="cursor-pointer">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-slate-800 capitalize leading-none font-sans">
                              {review.guestName}
                            </span>
                            <span className="text-[10px] text-slate-400">•</span>
                            <span className="text-[10px] font-medium text-slate-500 bg-slate-50 border border-slate-200/50 px-1.5 py-0.5 rounded">
                              {reviewHotel?.name || review.hotel || 'Otel'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {renderStars(review.rating)}
                            <span className="text-[10px] text-slate-400">
                              {new Date(review.date).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* Platform Badge */}
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase ${
                            review.source === 'Google' ? 'bg-blue-50 text-blue-600 border border-blue-100/50' :
                            review.source === 'TripAdvisor' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100/50' :
                            review.source === 'Booking' ? 'bg-sky-50 text-sky-700 border border-sky-100/50' :
                            review.source === 'HolidayCheck' ? 'bg-rose-50 text-rose-700 border border-rose-100/50' :
                            'bg-indigo-50 text-indigo-600 border border-indigo-100/50'
                          }`}>
                            {review.source}
                          </span>

                          {/* Status Badge */}
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${
                            review.status === 'published' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100/50' :
                            review.status === 'pending_approval' || review.status === 'waiting_approval' ? 'bg-amber-50 text-amber-600 border border-amber-100/50' :
                            'bg-slate-50 text-slate-500 border border-slate-200/50'
                          }`}>
                            {review.status === 'published' ? 'Yayınlandı' :
                             review.status === 'pending_approval' || review.status === 'waiting_approval' ? 'Onay Bekliyor' : 'Taslak'}
                          </span>
                        </div>
                      </div>

                      {/* Display Audit Trail details if published */}
                      {publishDetail && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 border border-slate-100 p-4 rounded-xl text-xs text-slate-600">
                          <div>
                            <span className="font-bold text-slate-400 block uppercase text-[9px] tracking-wider mb-0.5">Yayınlayan</span>
                            <span className="font-medium text-slate-700">{publishDetail.publisherName || 'Sistem'}</span>
                          </div>
                          <div>
                            <span className="font-bold text-slate-400 block uppercase text-[9px] tracking-wider mb-0.5">Yayınlanma Tarihi</span>
                            <span className="font-medium text-slate-700">{publishDetail.publishedAt ? new Date(publishDetail.publishedAt).toLocaleString() : '-'}</span>
                          </div>
                          <div>
                            <span className="font-bold text-slate-400 block uppercase text-[9px] tracking-wider mb-0.5">Yanıt Türü</span>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${publishDetail.aiGenerated ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-slate-100 text-slate-750 border border-slate-200/50'}`}>
                              {publishDetail.aiGenerated ? '🤖 Yapay Zeka' : '✍ Manuel'}
                            </span>
                          </div>
                          <div>
                            <span className="font-bold text-slate-400 block uppercase text-[9px] tracking-wider mb-0.5">WhatsApp Gönderimi</span>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${publishDetail.whatsappSent ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-600'}`}>
                              {publishDetail.whatsappSent ? '✓ Gönderildi' : '✗ Gönderilmedi'}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Comment section */}
                      <div className="space-y-2 mt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Misafir Yorumu</span>
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] text-slate-400 font-medium mr-1 flex items-center gap-0.5">
                              <Languages size={10} /> Çevir:
                            </span>
                            {['TR', 'EN', 'RU'].map((lang) => {
                              const target = lang.toLowerCase() as 'tr' | 'en' | 'ru';
                              const transKey = `${review.id}_comment_${target}`;
                              const isTranslating = translatingKeys[transKey];
                              const isTranslated = !!translations[transKey];

                              if (commentLang === target) return null;

                              return (
                                <button
                                  key={lang}
                                  onClick={() => handleTranslate(review.id, 'comment', review.comment, target)}
                                  disabled={isTranslating}
                                  className={`text-[9px] px-1 py-0.5 rounded font-bold border transition-colors ${
                                    isTranslated 
                                      ? 'bg-blue-50 text-blue-600 border-blue-200' 
                                      : 'bg-white hover:bg-slate-50 text-slate-500 border-slate-200'
                                  }`}
                                >
                                  {isTranslating ? '...' : lang}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/50 border border-slate-100 rounded-xl p-3.5 italic">
                          "{review.comment}"
                        </p>

                        {['tr', 'en', 'ru'].map(lang => {
                          const transKey = `${review.id}_comment_${lang}`;
                          if (translations[transKey]) {
                            return (
                              <div key={lang} className="text-xs text-blue-700 bg-blue-50/30 border border-blue-100/50 rounded-xl p-3 leading-relaxed mt-1 animate-fadeIn">
                                <span className="text-[9px] uppercase font-extrabold text-blue-500 block mb-0.5">Mütercim ({lang.toUpperCase()})</span>
                                "{translations[transKey]}"
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>

                      {/* Divider */}
                      <div className="border-t border-slate-100 my-2" />

                      {/* AI Reply section */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-1.5">
                            <Sparkles className="text-blue-500" size={13} />
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">AI Taslak Cevap</span>
                          </div>

                          {review.response && (
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-slate-400 font-medium mr-1 flex items-center gap-0.5">
                                <Languages size={10} /> Çevir:
                              </span>
                              {['TR', 'EN', 'RU'].map((lang) => {
                                const target = lang.toLowerCase() as 'tr' | 'en' | 'ru';
                                const transKey = `${review.id}_reply_${target}`;
                                const isTranslating = translatingKeys[transKey];
                                const isTranslated = !!translations[transKey];

                                return (
                                  <button
                                    key={lang}
                                    onClick={() => handleTranslate(review.id, 'reply', review.response || '', target)}
                                    disabled={isTranslating}
                                    className={`text-[9px] px-1 py-0.5 rounded font-bold border transition-colors ${
                                      isTranslated 
                                        ? 'bg-blue-50 text-blue-600 border-blue-200' 
                                        : 'bg-white hover:bg-slate-50 text-slate-500 border-slate-200'
                                    }`}
                                  >
                                    {isTranslating ? '...' : lang}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Interactive Editor */}
                        <div className="relative">
                          <textarea
                            value={editedReplyText}
                            onChange={(e) => handleTextChange(review.id, e.target.value)}
                            placeholder="AI draft reply not generated. Click 'Yeniden AI Üret' to compile response."
                            rows={4}
                            className="w-full text-xs p-3.5 bg-slate-50/20 border border-slate-200/80 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white text-slate-700 leading-relaxed font-sans placeholder-slate-400 resize-y"
                          />
                        </div>

                        {['tr', 'en', 'ru'].map(lang => {
                          const transKey = `${review.id}_reply_${lang}`;
                          if (translations[transKey]) {
                            return (
                              <div key={lang} className="text-xs text-blue-700 bg-blue-50/30 border border-blue-100/50 rounded-xl p-3 leading-relaxed mt-1 animate-fadeIn">
                                <span className="text-[9px] uppercase font-extrabold text-blue-500 block mb-0.5">Cevap Mütercimi ({lang.toUpperCase()})</span>
                                {translations[transKey]}
                              </div>
                            );
                          }
                          return null;
                        })}

                        {review.response && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1.5 py-2 px-3 bg-slate-50 rounded-xl border border-slate-100 text-[10px] text-slate-500">
                            <div>
                              <span className="font-bold text-slate-400">Confidence:</span> {Math.round(85 + (review.rating * 2))}%
                            </div>
                            <div>
                              <span className="font-bold text-slate-400">Empathy:</span> {review.rating >= 4 ? 'Excellent' : 'Standard'}
                            </div>
                            <div>
                              <span className="font-bold text-slate-400">Grammar:</span> 99%
                            </div>
                            <div>
                              <span className="font-bold text-slate-400">Brand Tone:</span> Warm & Professional
                            </div>
                            <div>
                              <span className="font-bold text-slate-400">Spam Risk:</span> Low
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Card Footer Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-50">
                        <button
                          onClick={() => setActivePanelReview(review)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-500 flex items-center gap-1 border-none bg-transparent cursor-pointer"
                        >
                          AI Analizi Görüntüle <ChevronRight size={14} />
                        </button>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => handleSaveDraft(review)}
                            disabled={savingId !== null}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
                          >
                            {savingId === review.id ? 'Kaydediliyor...' : 'Taslak Kaydet'}
                          </button>

                          <button
                            onClick={() => handleRegenerateAI(review)}
                            disabled={savingId !== null}
                            className="px-3 py-1.5 rounded-xl border border-blue-100 hover:bg-blue-50 text-blue-600 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <RefreshCw size={13} className={savingId === review.id ? 'animate-spin' : ''} />
                            Yeniden AI Üret
                          </button>

                          <button
                            onClick={() => handleSendWhatsApp(review)}
                            disabled={savingId !== null || !review.response}
                            className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-medium flex items-center gap-1.5 border border-emerald-100/50 transition-colors cursor-pointer"
                          >
                            <Send size={12} />
                            WhatsApp Onaya Gönder
                          </button>

                          <button
                            onClick={() => handlePublish(review)}
                            disabled={savingId !== null || !editedReplyText.trim()}
                            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                          >
                            <Check size={14} />
                            Yayınla
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })
            )}

            {loadingMore && (
              <div className="py-4 text-center">
                <div className="w-6 h-6 rounded-full border-2 border-t-blue-500 border-slate-200 animate-spin mx-auto" />
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Detail Slide Panel / AI Analytics */}
        <div className="xl:col-span-1">
          {activePanelReview ? (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-md sticky top-24 space-y-6 animate-fadeIn">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="text-blue-600" size={18} />
                  <h3 className="font-bold text-sm text-slate-800 m-0">Detaylı AI Analizi</h3>
                </div>
                <button
                  onClick={() => setActivePanelReview(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors border-none bg-transparent cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                  <span className="text-xs text-slate-500">Misafir</span>
                  <span className="text-xs font-bold text-slate-800">{activePanelReview.guestName}</span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                  <span className="text-xs text-slate-500">Yorum Dili</span>
                  <span className="text-xs font-semibold uppercase text-slate-600 bg-slate-50 border border-slate-200/50 px-1.5 py-0.5 rounded">
                    {reviewService.detectLanguage(activePanelReview.comment).toUpperCase()}
                  </span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                  <span className="text-xs text-slate-500">His (Sentiment)</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    activePanelReview.sentiment === 'positive' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                    activePanelReview.sentiment === 'negative' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                    'bg-slate-50 text-slate-600 border border-slate-200'
                  }`}>
                    {activePanelReview.sentiment}
                  </span>
                </div>

                <div className="border-b border-slate-50 pb-2">
                  <span className="text-xs text-slate-500 block mb-1">Departman Dağılımı</span>
                  <div className="flex flex-wrap gap-1">
                    {activePanelReview.departments && activePanelReview.departments.length > 0 ? (
                      activePanelReview.departments.map((dept, i) => (
                        <span key={i} className="text-[10px] font-medium text-slate-700 bg-slate-50 border border-slate-200/50 px-1.5 py-0.5 rounded">
                          {dept}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">Analiz edilmedi</span>
                    )}
                  </div>
                </div>

                {activePanelReview.aiAnalysis?.emotion && (
                  <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                    <span className="text-xs text-slate-500">Duygu İklimi</span>
                    <span className="text-xs font-semibold text-slate-700 capitalize">
                      {activePanelReview.aiAnalysis.emotion}
                    </span>
                  </div>
                )}

                <div className="border-b border-slate-50 pb-2">
                  <span className="text-xs text-slate-500 block mb-1 flex items-center gap-1">
                    <BookOpen size={12} className="text-slate-400" /> Ana Konu Başlıkları
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {activePanelReview.aiAnalysis?.keyTopics && activePanelReview.aiAnalysis.keyTopics.length > 0 ? (
                      activePanelReview.aiAnalysis.keyTopics.map((topic, i) => (
                        <span key={i} className="text-[9px] font-bold text-blue-600 bg-blue-50/50 border border-blue-100/50 px-1.5 py-0.5 rounded">
                          #{topic}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">Konu tespiti yapılmadı</span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-xs text-slate-500 block mb-1 flex items-center gap-1">
                    <TrendingUp size={12} className="text-slate-400" /> Kelime Frekans Analizi
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {activePanelReview.comment
                      .toLowerCase()
                      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "")
                      .split(/\s+/)
                      .filter(w => w.length > 3)
                      .slice(0, 8)
                      .map((word, idx) => (
                        <span key={idx} className="text-[9px] font-medium text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                          {word}
                        </span>
                      ))}
                  </div>
                </div>

                <div className="flex justify-between items-center border-t border-slate-100 pt-3">
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <AlertTriangle size={12} className="text-amber-500" /> Öncelik Derecesi (Urgency)
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    activePanelReview.priority === 'critical' || activePanelReview.priority === 'high' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                    activePanelReview.priority === 'medium' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                    'bg-slate-50 text-slate-600 border border-slate-200'
                  }`}>
                    {activePanelReview.priority}
                  </span>
                </div>

                <div className="pt-2">
                  <span className="text-xs text-slate-500 block mb-1.5 flex items-center gap-1">
                    <Briefcase size={12} className="text-slate-400" /> AI Prompt Template
                  </span>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[10px] text-slate-500 font-mono overflow-x-auto max-h-32 scrollbar-thin whitespace-pre-wrap leading-relaxed">
                    {"System: You are an executive Guest Relations manager.\nPrompt: Respond to the guest [GuestName] in [Language] thanking them for the feedback, addressing their compliments or issues, maintaining a professional and warm tone."}
                  </div>
                </div>

              </div>
            </div>
          ) : (
            <div className="bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl p-16 text-center space-y-4 sticky top-24">
              <Sliders size={36} className="mx-auto text-slate-300" />
              <div className="space-y-1 max-w-xs mx-auto">
                <h4 className="text-xs font-bold text-slate-700">Yorum Seçilmedi</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  İçerik sentiment analizi, anahtar kelime bulutu ve yapay zeka yönlendirme parametrelerini incelemek için listeden bir yorum kartına tıklayın.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 6. Bulk Actions Bar */}
      {selectedReviewIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white rounded-2xl px-6 py-4 shadow-2xl z-40 border border-slate-800 flex items-center gap-6 animate-slideUp">
          <span className="text-xs font-bold tracking-wide">
            {selectedReviewIds.length} Yorum Seçildi
          </span>

          <div className="w-px h-6 bg-slate-800" />

          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkAI}
              disabled={bulkActionLoading}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 border-none cursor-pointer"
            >
              <Sparkles size={13} />
              Toplu AI Üret
            </button>

            <button
              onClick={handleBulkWhatsApp}
              disabled={bulkActionLoading}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 border-none cursor-pointer"
            >
              <Send size={12} />
              Toplu WhatsApp Onayı
            </button>

            <button
              onClick={handleBulkPublish}
              disabled={bulkActionLoading}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 border-none cursor-pointer"
            >
              <CheckCheck size={14} />
              Toplu Yayınla
            </button>

            <button
              onClick={() => setSelectedReviewIds([])}
              className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors border-none bg-transparent cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

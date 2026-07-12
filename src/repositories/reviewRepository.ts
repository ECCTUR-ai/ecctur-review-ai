// src/repositories/reviewRepository.ts
import { supabase } from '@/lib/supabase';
import { Review, ReviewSource, Sentiment, ReviewStatus, ReviewPriority } from '@/types';
import { normalizeReviewStatus } from '@/utils/statusHelper';

function safeParseJson(val: any): any {
  if (!val) return null;
  if (typeof val === 'object') return val;
  try {
    let clean = String(val).trim();
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    }
    return JSON.parse(clean);
  } catch (e) {
    console.warn("Failed to parse JSON string in repository:", e);
    return null;
  }
}

export function mapReview(item: any): Review {
  if (!item) {
    return {
      id: '',
      guestName: '',
      rating: 0,
      comment: '',
      date: '',
      source: 'Google',
      status: 'pending',
      priority: 'low',
      response: '',
      respondedAt: '',
      sentiment: 'neutral',
      departments: [],
      hotel: '',
      managerNotes: '',
      internalNotes: '',
    };
  }

  const parsedReviewAnalysis = safeParseJson(item.review_analysis);
  const parsedAiAnalysis = safeParseJson(item.ai_analysis);

  const lowerPlatform = (item.platform || '').toLowerCase().trim();
  let raw_rating: number | null = null;
  let raw_scale: number | null = null;
  let normalized_rating = Number(item.rating || 0);
  let display_rating = `${normalized_rating} ★`;

  if (lowerPlatform === 'otelpuan' || lowerPlatform === 'otel puan') {
    raw_scale = 10;
    const meta = item.metadata || {};
    if (meta.originalRating !== undefined && meta.originalRating !== null) {
      raw_rating = Number(meta.originalRating);
    } else if (meta.normalizedFloatRating !== undefined && meta.normalizedFloatRating !== null) {
      raw_rating = Number(meta.normalizedFloatRating) * 2;
    } else {
      raw_rating = normalized_rating * 2;
    }
    if (meta.normalizedFloatRating !== undefined && meta.normalizedFloatRating !== null) {
      normalized_rating = Number(meta.normalizedFloatRating);
    } else {
      normalized_rating = raw_rating / 2;
    }
    display_rating = `${raw_rating} / 10`;
  } else if (lowerPlatform === 'booking' || lowerPlatform === 'booking.com') {
    raw_scale = 10;
    const meta = item.metadata || {};
    if (meta.originalRating !== undefined && meta.originalRating !== null) {
      raw_rating = Number(meta.originalRating);
    } else {
      raw_rating = normalized_rating * 2;
    }
    display_rating = `${raw_rating} / 10`;
  } else {
    raw_scale = 5;
    raw_rating = normalized_rating;
    display_rating = `${normalized_rating} ★`;
  }

  return {
    id: item.id,
    guestName: item.guest_name || item.guestName || '',
    rating: normalized_rating,
    raw_rating,
    raw_scale,
    normalized_rating,
    display_rating,
    comment: item.review_text || item.comment || '',
    date: item.review_date || item.date || item.created_at || '',
    review_date: item.review_date || null,
    travel_date: item.travel_date || null,
    created_at: item.created_at || undefined,
    metadata: item.metadata || null,
    owner_response_text: item.owner_response_text || null,
    owner_response_date: item.owner_response_date || null,
    source: (lowerPlatform === 'booking' ? 'Booking' :
             lowerPlatform === 'tripadvisor' ? 'TripAdvisor' :
             (lowerPlatform === 'google' || lowerPlatform === 'google-maps' || lowerPlatform === 'google_maps' || lowerPlatform === 'google maps') ? 'Google' :
             lowerPlatform === 'holidaycheck' ? 'HolidayCheck' :
             lowerPlatform === 'hotels.com' ? 'Hotels.com' :
             lowerPlatform === 'expedia' ? 'Expedia' :
             lowerPlatform === 'airbnb' ? 'Airbnb' :
             lowerPlatform === 'yelp' ? 'Yelp' :
             lowerPlatform === 'otelpuan' ? 'otelpuan' :
             item.platform || item.source || 'Google') as ReviewSource,
    status: normalizeReviewStatus(item.status) as ReviewStatus,
    priority: (item.priority || 'low').toLowerCase() as ReviewPriority,
    response: item.ai_reply || item.response || '',
    respondedAt: item.responded_at || item.respondedAt || item.updated_at || '',
    sentiment: (item.sentiment || 'neutral').toLowerCase() as Sentiment,
    departments: item.departments || [],
    hotel: item.hotel_name || item.hotel || 'Seçili Otel',
    managerNotes: item.notes || item.manager_notes || item.managerNotes || '',
    internalNotes: item.internal_notes || item.internalNotes || '',
    hotelId: item.hotel_id || item.hotelId,
    organizationId: item.organization_id || item.organizationId,
    platformReviewId: item.platform_review_id || item.platformReviewId || null,
    google_reply_status: item.google_reply_status || null,
    google_reply_published_at: item.google_reply_published_at || null,
    google_reply_error: item.google_reply_error || null,
    department_analysis: safeParseJson(item.department_analysis),
    quality_analysis: safeParseJson(item.quality_analysis),
    priority_analysis: safeParseJson(item.priority_analysis),
    aiAnalysis: parsedAiAnalysis || parsedReviewAnalysis ? {
      sentiment: (item.sentiment || parsedAiAnalysis?.sentiment || parsedReviewAnalysis?.sentiment || 'neutral').toLowerCase() as Sentiment,
      emotion: parsedAiAnalysis?.emotion || parsedReviewAnalysis?.emotion || '',
      keyTopics: parsedAiAnalysis?.key_topics || parsedReviewAnalysis?.key_topics || parsedAiAnalysis?.keyTopics || (parsedReviewAnalysis?.topic ? String(parsedReviewAnalysis.topic).split(',').map((t: string) => t.trim()) : []),
      qualityScore: parsedAiAnalysis?.quality_score || parsedReviewAnalysis?.quality_score || parsedAiAnalysis?.qualityScore || 0,
      sentimentScore: parsedAiAnalysis?.sentiment_score || parsedReviewAnalysis?.sentiment_score || parsedAiAnalysis?.sentimentScore || 0
    } : undefined,
    ai_operation_analysis: safeParseJson(item.ai_operation_analysis),
    ai_operation_analysis_version: item.ai_operation_analysis_version || null,
    ai_operation_analysis_updated_at: item.ai_operation_analysis_updated_at || null,
    ai_operation_analysis_model: item.ai_operation_analysis_model || null,
    ai_operation_analysis_confidence: item.ai_operation_analysis_confidence || null
  };
}

export const reviewRepository = {
  async getReviews(params?: {
    hotelId?: string;
    source?: ReviewSource;
    sentiment?: Sentiment;
    status?: ReviewStatus;
    priority?: ReviewPriority;
    search?: string;
    rating?: number;
    limit?: number;
    offset?: number;
    sortBy?: 'newest' | 'oldest';
    fetchAll?: boolean;
  }): Promise<{ reviews: Review[]; total: number }> {
    if (!params || !params.hotelId) {
      console.warn('[reviewRepository] Warning: getReviews called without hotelId parameter. Enforcing tenant isolation.');
      return { reviews: [], total: 0 };
    }

    const buildBaseQuery = () => {
      let query = supabase
        .from('reviews')
        .select('*', { count: 'exact' })
        .eq('hotel_id', params.hotelId);

      if (params.source) {
        const srcLower = params.source.toLowerCase();
        if (srcLower === 'booking') {
          query = query.or('platform.eq.booking,platform.eq.Booking');
        } else if (srcLower === 'tripadvisor') {
          query = query.or('platform.eq.tripadvisor,platform.eq.TripAdvisor,platform.eq.Tripadvisor');
        } else if (srcLower === 'google') {
          query = query.or('platform.eq.google,platform.eq.Google,platform.eq.google-maps,platform.eq.google_maps,platform.eq.google maps');
        } else if (srcLower === 'holidaycheck') {
          query = query.or('platform.eq.holidaycheck,platform.eq.HolidayCheck');
        } else if (srcLower === 'hotels.com' || srcLower === 'hotelscom') {
          query = query.or('platform.eq.hotels.com,platform.eq.hotelscom');
        } else if (srcLower === 'otelpuan' || srcLower === 'otel puan') {
          query = query.or('platform.eq.otelpuan,platform.eq.Otelpuan,platform.eq.otel_puan,platform.eq.OTELPUAN');
        } else {
          query = query.eq('platform', params.source);
        }
      }
      if (params.sentiment) {
        query = query.eq('sentiment', params.sentiment);
      }
      if (params.status) {
        const statusVal = normalizeReviewStatus(params.status);
        if (statusVal === 'approved') {
          query = query.or('status.eq.approved,status.eq.Approved,status.eq.published,status.eq.Published,status.eq.cevaplandi');
        } else if (statusVal === 'draft') {
          query = query.or('status.eq.draft,status.eq.Draft');
        } else if (statusVal === 'archived') {
          query = query.or('status.eq.archived,status.eq.Archived');
        } else if (statusVal === 'manual_replied') {
          query = query.or('status.eq.manual_replied,status.eq.manual-replied,status.eq.Manual_Replied');
        } else if (statusVal === 'pending') {
          query = query.or('status.eq.pending,status.eq.Pending,status.eq.pending_approval,status.eq.waiting_approval');
        } else {
          query = query.eq('status', params.status);
        }
      }
      if (params.priority) {
        query = query.eq('priority', params.priority);
      }
      if (params.rating) {
        query = query.eq('rating', params.rating);
      }
      if (params.search) {
        query = query.ilike('guest_name', `%${params.search}%`);
      }
      return query;
    };

    const isAsc = params.sortBy === 'oldest';

    if (params.fetchAll) {
      let allReviews: Review[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      let totalCount = 0;

      while (hasMore) {
        let query = buildBaseQuery();
        query = query.range(page * pageSize, (page + 1) * pageSize - 1);
        const sortedQuery = query
          .order('review_date', { ascending: isAsc, nullsFirst: false })
          .order('created_at', { ascending: isAsc });

        const response = await sortedQuery;
        if (response.error) throw response.error;

        totalCount = response.count || 0;
        const reviewsPage = (response.data || []).map(mapReview);
        if (reviewsPage.length > 0) {
          allReviews = [...allReviews, ...reviewsPage];
          hasMore = reviewsPage.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }
      return { reviews: allReviews, total: totalCount };
    } else {
      let query = buildBaseQuery();
      const limit = params.limit || 20;
      const offset = params.offset || 0;
      query = query.range(offset, offset + limit - 1);

      const sortedQuery = query
        .order('review_date', { ascending: isAsc, nullsFirst: false })
        .order('created_at', { ascending: isAsc });

      const response = await sortedQuery;
      if (response.error) throw response.error;

      const reviews = (response.data || []).map(mapReview);
      return { reviews, total: response.count || 0 };
    }
  },

  async getReviewById(id: string): Promise<Review> {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return mapReview(data);
  },

  async submitResponse(id: string, responseText: string): Promise<Review> {
    console.log(`[Repository submitResponse] reviewId: ${id}`);
    const updateData: any = {
      ai_reply: responseText,
      status: 'approved',
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('reviews')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;
    return await reviewRepository.getReviewById(id);
  },

  async saveResponseDraft(id: string, responseText: string): Promise<Review> {
    console.log(`[Repository saveResponseDraft] reviewId: ${id}`);
    const updateData: any = {
      ai_reply: responseText,
      status: 'draft',
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('reviews')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;
    return await reviewRepository.getReviewById(id);
  },

  async updateReviewNotes(id: string, managerNotes: string, internalNotes: string): Promise<Review> {
    console.log(`[Repository updateReviewNotes] reviewId: ${id}`);
    const updateData: any = {
      notes: managerNotes,
      manager_notes: managerNotes,
      internal_notes: internalNotes,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('reviews')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;
    return await reviewRepository.getReviewById(id);
  },

  async updateReviewStatus(id: string, status: ReviewStatus): Promise<Review> {
    console.log(`[Repository updateReviewStatus] reviewId: ${id}, status: ${status}`);
    const normalized = normalizeReviewStatus(status);
    const { error } = await supabase
      .from('reviews')
      .update({ status: normalized, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    return await reviewRepository.getReviewById(id);
  }
};

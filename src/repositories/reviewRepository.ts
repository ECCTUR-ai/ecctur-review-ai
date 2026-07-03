// src/repositories/reviewRepository.ts
import { supabase } from '@/lib/supabase';
import { Review, ReviewSource, Sentiment, ReviewStatus, ReviewPriority } from '@/types';

export function mapReview(item: any): Review {
  if (!item) {
    return {
      id: '',
      guestName: '',
      rating: 0,
      comment: '',
      date: '',
      source: 'Google',
      status: 'draft',
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
  return {
    id: item.id,
    guestName: item.guest_name || item.guestName || '',
    rating: item.rating,
    comment: item.review_text || item.comment || '',
    date: item.review_date || item.date || item.created_at || '',
    source: (item.platform?.toLowerCase() === 'booking' ? 'Booking' :
             item.platform?.toLowerCase() === 'tripadvisor' ? 'TripAdvisor' :
             item.platform?.toLowerCase() === 'google' ? 'Google' :
             item.platform || item.source || 'Google') as ReviewSource,
    status: (item.status || 'draft').toLowerCase() as ReviewStatus,
    priority: (item.priority || 'low').toLowerCase() as ReviewPriority,
    response: item.ai_reply || item.response || '',
    respondedAt: item.responded_at || item.respondedAt || item.updated_at || '',
    sentiment: (item.sentiment || 'neutral').toLowerCase() as Sentiment,
    departments: item.departments || [],
    hotel: item.hotel_name || item.hotel || 'Demo Hotel',
    managerNotes: item.notes || item.manager_notes || item.managerNotes || '',
    internalNotes: item.internal_notes || item.internalNotes || '',
    hotelId: item.hotel_id || item.hotelId,
    organizationId: item.organization_id || item.organizationId,
    platformReviewId: item.platform_review_id || item.platformReviewId || null,
    google_reply_status: item.google_reply_status || null,
    google_reply_published_at: item.google_reply_published_at || null,
    google_reply_error: item.google_reply_error || null,
    aiAnalysis: item.ai_analysis || item.review_analysis ? {
      sentiment: (item.sentiment || item.ai_analysis?.sentiment || item.review_analysis?.sentiment || 'neutral').toLowerCase() as Sentiment,
      emotion: item.ai_analysis?.emotion || item.review_analysis?.emotion || '',
      keyTopics: item.ai_analysis?.key_topics || item.review_analysis?.key_topics || item.ai_analysis?.keyTopics || [],
      qualityScore: item.ai_analysis?.quality_score || item.review_analysis?.quality_score || item.ai_analysis?.qualityScore || 0,
      sentimentScore: item.ai_analysis?.sentiment_score || item.review_analysis?.sentiment_score || item.ai_analysis?.sentimentScore || 0
    } : undefined
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
  }): Promise<{ reviews: Review[]; total: number }> {
    const runQuery = async (useHotelFilter: boolean) => {
      let query = supabase
        .from('reviews')
        .select('*', { count: 'exact' });

      if (params) {
        if (useHotelFilter && params.hotelId) {
          query = query.eq('hotel_id', params.hotelId);
        }
        if (params.source) {
          if (params.source.toLowerCase() === 'booking') {
            query = query.or('platform.eq.booking,platform.eq.Booking');
          } else if (params.source.toLowerCase() === 'tripadvisor') {
            query = query.or('platform.eq.tripadvisor,platform.eq.TripAdvisor,platform.eq.Tripadvisor');
          } else if (params.source.toLowerCase() === 'google') {
            query = query.or('platform.eq.google,platform.eq.Google');
          } else {
            query = query.eq('platform', params.source);
          }
        }
        if (params.sentiment) {
          query = query.eq('sentiment', params.sentiment);
        }
        if (params.status) {
          // Keep database casing compatibility (e.g. 'Draft' vs 'draft')
          const statusVal = params.status.charAt(0).toUpperCase() + params.status.slice(1);
          query = query.or(`status.eq.${params.status},status.eq.${statusVal}`);
        }
        if (params.priority) {
          query = query.eq('priority', params.priority);
        }
        if (params.rating) {
          query = query.eq('rating', params.rating);
        }
        if (params.search) {
          query = query.ilike('review_text', `%${params.search}%`);
        }

        const limit = params.limit || 20;
        const offset = params.offset || 0;
        query = query.range(offset, offset + limit - 1);
      }

      query = query.order('created_at', { ascending: false });
      return await query;
    };

    let response = await runQuery(true);
    if (response.error && (response.error.code === '42703' || response.error.message.includes('hotel_id'))) {
      // Fallback: hotel_id column doesn't exist yet in DB
      response = await runQuery(false);
    }

    if (response.error) throw response.error;
    const reviews = (response.data || []).map(mapReview);
    return { reviews, total: response.count || 0 };
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
    const { data: checkData, error: checkError } = await supabase
      .from('reviews')
      .select('id')
      .eq('id', id);
    console.log(`[Repository submitResponse] Check result:`, checkData, `Error:`, checkError);

    const updateData: any = {
      ai_reply: responseText,
      status: 'Published',
      publish_status: 'Published',
      published: 'Yes',
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('reviews')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.warn(`[Repository submitResponse] Update failed, retrying fallback...`, error);
      const fallbackData = {
        ai_reply: responseText,
        status: 'published'
      };
      const { error: fbError } = await supabase
        .from('reviews')
        .update(fallbackData)
        .eq('id', id);
      if (fbError) throw fbError;
    }

    return await reviewRepository.getReviewById(id);
  },

  async saveResponseDraft(id: string, responseText: string): Promise<Review> {
    console.log(`[Repository saveResponseDraft] reviewId: ${id}`);
    const { data: checkData, error: checkError } = await supabase
      .from('reviews')
      .select('id')
      .eq('id', id);
    console.log(`[Repository saveResponseDraft] Check result:`, checkData, `Error:`, checkError);

    const updateData: any = {
      ai_reply: responseText,
      status: 'Draft',
      publish_status: 'Not Published',
      published: 'No',
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('reviews')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.warn(`[Repository saveResponseDraft] Update failed, retrying fallback...`, error);
      const fallbackData = {
        ai_reply: responseText,
        status: 'draft'
      };
      const { error: fbError } = await supabase
        .from('reviews')
        .update(fallbackData)
        .eq('id', id);
      if (fbError) throw fbError;
    }

    return await reviewRepository.getReviewById(id);
  },

  async updateReviewNotes(id: string, managerNotes: string, internalNotes: string): Promise<Review> {
    console.log(`[Repository updateReviewNotes] reviewId: ${id}`);
    const { data: checkData, error: checkError } = await supabase
      .from('reviews')
      .select('id')
      .eq('id', id);
    console.log(`[Repository updateReviewNotes] Check result:`, checkData, `Error:`, checkError);

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

    if (error) {
      console.warn(`[Repository updateReviewNotes] Update failed, retrying fallback...`, error);
      const fallbackData = {
        notes: managerNotes
      };
      const { error: fbError } = await supabase
        .from('reviews')
        .update(fallbackData)
        .eq('id', id);
      if (fbError) throw fbError;
    }

    return await reviewRepository.getReviewById(id);
  },

  async updateReviewStatus(id: string, status: ReviewStatus): Promise<Review> {
    console.log(`[Repository updateReviewStatus] reviewId: ${id}, status: ${status}`);
    const { data: checkData, error: checkError } = await supabase
      .from('reviews')
      .select('id')
      .eq('id', id);
    console.log(`[Repository updateReviewStatus] Check result:`, checkData, `Error:`, checkError);

    const statusVal = status.charAt(0).toUpperCase() + status.slice(1);
    let mappedStatus = statusVal;
    if (status === 'pending_approval') mappedStatus = 'Pending Approval';
    if (status === 'waiting_approval') mappedStatus = 'Waiting Approval';
    if (status === 'draft') mappedStatus = 'Draft';

    const { error } = await supabase
      .from('reviews')
      .update({ status: mappedStatus, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.warn(`[Repository updateReviewStatus] Update failed, retrying fallback...`, error);
      const { error: fbError } = await supabase
        .from('reviews')
        .update({ status })
        .eq('id', id);
      if (fbError) throw fbError;
    }

    return await reviewRepository.getReviewById(id);
  }
};

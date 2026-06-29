// src/repositories/reviewRepository.ts
import { supabase } from '@/lib/supabase';
import { Review, ReviewSource, Sentiment, ReviewStatus, ReviewPriority } from '@/types';

export function mapReview(item: any): Review {
  return {
    id: item.id,
    guestName: item.guest_name || item.guestName || '',
    rating: item.rating,
    comment: item.review_text || item.comment || '',
    date: item.review_date || item.date || item.created_at || '',
    source: (item.platform || item.source || 'Google') as ReviewSource,
    status: (item.status || 'draft').toLowerCase() as ReviewStatus,
    priority: (item.priority || 'low').toLowerCase() as ReviewPriority,
    response: item.ai_reply || item.response || '',
    respondedAt: item.responded_at || item.respondedAt || item.updated_at || '',
    sentiment: (item.sentiment || 'neutral').toLowerCase() as Sentiment,
    departments: item.departments || [],
    hotel: item.hotel_name || item.hotel || 'ECCTUR Demo Hotel',
    managerNotes: item.notes || item.manager_notes || item.managerNotes || '',
    internalNotes: item.internal_notes || item.internalNotes || '',
    hotelId: item.hotel_id || item.hotelId,
    organizationId: item.organization_id || item.organizationId,
    platformReviewId: item.platform_review_id || item.platformReviewId || null,
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
          query = query.eq('platform', params.source);
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
      .single();

    if (error) throw error;
    return mapReview(data);
  },

  async submitResponse(id: string, responseText: string): Promise<Review> {
    // Check if column ai_reply or response is used in table
    const updateData: any = {
      ai_reply: responseText,
      response: responseText,
      status: 'Published',
      publish_status: 'Published',
      published: 'Yes',
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('reviews')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      // Fallback if specific columns are missing
      const fallbackData = {
        ai_reply: responseText,
        status: 'published'
      };
      const { data: fbData, error: fbError } = await supabase
        .from('reviews')
        .update(fallbackData)
        .eq('id', id)
        .select()
        .single();
      if (fbError) throw fbError;
      return mapReview(fbData);
    }

    return mapReview(data);
  },

  async saveResponseDraft(id: string, responseText: string): Promise<Review> {
    const updateData: any = {
      ai_reply: responseText,
      response: responseText,
      status: 'Draft',
      publish_status: 'Not Published',
      published: 'No',
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('reviews')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      const fallbackData = {
        ai_reply: responseText,
        status: 'draft'
      };
      const { data: fbData, error: fbError } = await supabase
        .from('reviews')
        .update(fallbackData)
        .eq('id', id)
        .select()
        .single();
      if (fbError) throw fbError;
      return mapReview(fbData);
    }

    return mapReview(data);
  },

  async updateReviewNotes(id: string, managerNotes: string, internalNotes: string): Promise<Review> {
    const updateData: any = {
      notes: managerNotes,
      manager_notes: managerNotes,
      internal_notes: internalNotes,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('reviews')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      const fallbackData = {
        notes: managerNotes
      };
      const { data: fbData, error: fbError } = await supabase
        .from('reviews')
        .update(fallbackData)
        .eq('id', id)
        .select()
        .single();
      if (fbError) throw fbError;
      return mapReview(fbData);
    }

    return mapReview(data);
  },

  async updateReviewStatus(id: string, status: ReviewStatus): Promise<Review> {
    const statusVal = status.charAt(0).toUpperCase() + status.slice(1);
    const { data, error } = await supabase
      .from('reviews')
      .update({ status: statusVal, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      const { data: fbData, error: fbError } = await supabase
        .from('reviews')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
      if (fbError) throw fbError;
      return mapReview(fbData);
    }

    return mapReview(data);
  }
};

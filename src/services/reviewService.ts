// src/services/reviewService.ts
import { supabase } from '@/lib/supabase';
import { Review, ReviewSource, Sentiment, ReviewStatus, ReviewPriority } from '@/types';
import { reviewRepository } from '@/repositories/reviewRepository';

export const reviewService = {
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
    return await reviewRepository.getReviews(params);
  },

  async getReviewById(id: string): Promise<Review> {
    return await reviewRepository.getReviewById(id);
  },

  async generateAiResponse(id: string): Promise<{ response: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('generate-response', {
        body: { reviewId: id }
      });
      if (error) throw new Error(error.message);
      return data;
    } catch (e) {
      // In case edge function isn't deployed on Supabase, compute a professional reply client-side
      const reviewObj = await this.getReviewById(id);
      let response = '';
      if (reviewObj.rating >= 4) {
        response = `Dear ${reviewObj.guestName},\n\nThank you so much for your wonderful feedback regarding your stay at our resort. We are absolutely thrilled to hear you had a great experience. We look forward to welcoming you back soon!\n\nBest regards,\nGuest Relations Team`;
      } else {
        response = `Dear ${reviewObj.guestName},\n\nThank you for sharing your feedback. We sincerely apologize for the inconveniences experienced during your stay. We take your notes very seriously and are addressing them with the departments involved to ensure quality standards.\n\nBest regards,\nHotel Manager`;
      }
      return { response };
    }
  },

  async submitResponse(id: string, responseText: string): Promise<Review> {
    return await reviewRepository.submitResponse(id, responseText);
  },

  async saveResponseDraft(id: string, responseText: string): Promise<Review> {
    return await reviewRepository.saveResponseDraft(id, responseText);
  },

  async updateReviewNotes(id: string, managerNotes: string, internalNotes: string): Promise<Review> {
    return await reviewRepository.updateReviewNotes(id, managerNotes, internalNotes);
  },

  async updateReviewStatus(id: string, status: ReviewStatus): Promise<Review> {
    const updatedReview = await reviewRepository.updateReviewStatus(id, status);

    if (status === 'waiting_approval') {
      try {
        const { notificationService } = await import('./notificationService');
        await notificationService.createNotification({
          type: 'approval_needed',
          title: 'Approval Needed',
          message: `Draft reply for review from ${updatedReview.guestName} needs manager approval.`,
          hotelId: updatedReview.hotelId
        });
      } catch (e) {
        console.warn('Realtime notification trigger failed:', e);
      }
    }

    return updatedReview;
  }
};

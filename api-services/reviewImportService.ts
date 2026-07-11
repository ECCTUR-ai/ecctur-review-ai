import { fetchGoogleReviews } from './providers/googleProvider.js';
import { fetchTripadvisorReviews } from './providers/tripadvisorProvider.js';
import { fetchBookingReviews } from './providers/bookingProvider.js';
import { fetchHolidaycheckReviews } from './providers/holidaycheckProvider.js';
import { fetchHotelscomReviews } from './providers/hotelscomProvider.js';
import { otelpuanScraperService } from '../src/services/otelpuanScraperService.js';

export interface NormalizedReview {
  platform: string;
  guestName: string;
  rating: number;
  reviewText: string;
  reviewDate?: string | null;
  externalId?: string;
  raw?: any;
  reviewTitle?: string;
  travelerType?: string;
  numberOfNights?: number;
  likedText?: string;
  dislikedText?: string;
  sourceUrl?: string;
  metadata?: any;
}

export const reviewImportService = {
  async importReviews(platform: string, url: string, limit?: number): Promise<NormalizedReview[]> {
    const normalizedPlatform = (platform || '').toLowerCase();
    
    if (normalizedPlatform === 'google') {
      return await fetchGoogleReviews(url, limit);
    } else if (normalizedPlatform === 'tripadvisor') {
      return await fetchTripadvisorReviews(url, limit);
    } else if (normalizedPlatform === 'booking') {
      return await fetchBookingReviews(url, limit);
    } else if (normalizedPlatform === 'holidaycheck') {
      return await fetchHolidaycheckReviews(url, limit);
    } else if (normalizedPlatform === 'hotels.com' || normalizedPlatform === 'hotelscom') {
      return await fetchHotelscomReviews(url, limit);
    } else if (normalizedPlatform === 'otelpuan') {
      const res = await otelpuanScraperService.scrapeReviews({ hotelUrl: url, maxReviews: limit });
      return res.reviews.map(r => ({
        platform: 'otelpuan',
        guestName: r.reviewerName || 'Misafir',
        rating: r.rating,
        reviewText: r.reviewText,
        reviewDate: r.reviewDate || r.stayDate || new Date().toISOString(),
        externalId: r.externalReviewId,
        reviewTitle: r.reviewTitle || '',
        sourceUrl: r.sourceUrl,
        metadata: r.metadata
      }));
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }
  }
};

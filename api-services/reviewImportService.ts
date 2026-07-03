import { fetchGoogleReviews } from './providers/googleProvider.js';
import { fetchTripadvisorReviews } from './providers/tripadvisorProvider.js';
import { fetchBookingReviews } from './providers/bookingProvider.js';
import { fetchHolidaycheckReviews } from './providers/holidaycheckProvider.js';

export interface NormalizedReview {
  platform: string;
  guestName: string;
  rating: number;
  reviewText: string;
  reviewDate: string;
  externalId?: string;
  raw?: any;
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
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }
  }
};

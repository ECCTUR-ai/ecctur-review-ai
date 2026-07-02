import { fetchGoogleReviews } from './providers/googleProvider.js';
import { fetchTripadvisorReviews } from './providers/tripadvisorProvider.js';

export interface NormalizedReview {
  platform: string;
  guestName: string;
  rating: number;
  reviewText: string;
  reviewDate: string;
  externalId?: string;
}

export const reviewImportService = {
  async importReviews(platform: string, url: string): Promise<NormalizedReview[]> {
    const normalizedPlatform = (platform || '').toLowerCase();
    
    if (normalizedPlatform === 'google') {
      return await fetchGoogleReviews(url);
    } else if (normalizedPlatform === 'tripadvisor') {
      return await fetchTripadvisorReviews(url);
    } else if (normalizedPlatform === 'booking') {
      console.log(`[Booking Provider] Placeholder active for URL: ${url}`);
      return [];
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }
  }
};

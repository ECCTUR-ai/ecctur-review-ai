import { scrapeGoogleMapsReviews } from '../googleScraperService.js';
import { NormalizedReview } from '../reviewImportService.js';

export async function fetchGoogleReviews(url: string): Promise<NormalizedReview[]> {
  const scraped = await scrapeGoogleMapsReviews(url);
  return scraped.map(r => ({
    platform: 'Google',
    guestName: r.guestName,
    rating: r.rating,
    reviewText: r.reviewText,
    reviewDate: r.relativeDate,
    externalId: `${r.guestName}_${r.rating}_${r.reviewText.substring(0, 50)}`
  }));
}

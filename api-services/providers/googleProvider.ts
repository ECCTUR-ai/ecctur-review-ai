import { scrapeGoogleMapsReviews } from '../googleScraperService.js';
import { NormalizedReview } from '../reviewImportService.js';
import { normalizeGoogleReview } from '../utils/reviewNormalizer.js';

export async function fetchGoogleReviews(url: string, limit?: number): Promise<NormalizedReview[]> {
  const scraped = await scrapeGoogleMapsReviews(url, limit);
  return scraped.map((r, idx) => {
    const normalizedReview = normalizeGoogleReview(r, url, idx);

    if (idx < 3) {
      console.log("[NORMALIZED GOOGLE REVIEW]", normalizedReview);
    }

    return normalizedReview;
  });
}

import { NormalizedReview } from '../reviewImportService.js';
import { normalizeBookingReview } from '../utils/reviewNormalizer.js';

export async function fetchBookingReviews(url: string, limit?: number): Promise<NormalizedReview[]> {
  const targetUrl = (url || '').trim();
  if (!targetUrl) {
    throw new Error('no_reviews_found');
  }

  const apifyToken = process.env.APIFY_TOKEN;
  // If no Apify token, run in mock mode gracefully
  if (!apifyToken) {
    console.log('[Booking Provider] Running in Mock Mode (missing APIFY_TOKEN)');
    return [
      {
        platform: 'Booking',
        guestName: 'Ayşe Demir',
        rating: 5,
        reviewText: 'Otel personeli çok cana yakındı. Kahvaltı çeşidi oldukça zengindi. Sadece otopark alanı biraz dardı fakat görevliler yardımcı oldu.',
        reviewDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        externalId: `booking-mock-${targetUrl.split('/').pop()}-301`
      },
      {
        platform: 'Booking',
        guestName: 'John Doe',
        rating: 4,
        reviewText: 'The location is central and close to public transit. However, the walls are very thin and I could hear street noise all night.',
        reviewDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        externalId: `booking-mock-${targetUrl.split('/').pop()}-302`
      },
      {
        platform: 'Booking',
        guestName: 'Marie Laurent',
        rating: 5,
        reviewText: 'Tout était parfait. Le lit était extrêmement confortable, le petit déjeuner délicieux et la vue sur la mer magnifique.',
        reviewDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
        externalId: `booking-mock-${targetUrl.split('/').pop()}-303`
      }
    ];
  }

  const rawActorId = process.env.APIFY_BOOKING_ACTOR_ID || 'voyager/booking-reviews-scraper';
  const encodedActorId = encodeURIComponent(rawActorId);
  const apifyUrl = `https://api.apify.com/v2/acts/${encodedActorId}/run-sync-get-dataset-items?token=${apifyToken}`;

  const payload = {
    startUrls: [
      { url: targetUrl }
    ],
    maxReviewsPerHotel: limit || 200,
    maxItems: limit || 200,
    maxReviews: limit || 200
  };

  console.log("BOOKING URL:", targetUrl);
  console.log("ACTOR PAYLOAD:", JSON.stringify(payload, null, 2));
  console.log(`[Booking Provider] Running actor: ${rawActorId}`);

  let response;
  try {
    response = await fetch(apifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch (err: any) {
    console.error('[Booking Provider] Fetch execution failed:', err);
    throw new Error(`Apify connection/execution failed: ${err.message || String(err)}`);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'No error response body');
    console.error(`[Booking Provider] HTTP ${response.status} Error:`, errorText);
    throw new Error(`Apify Actor failed with status ${response.status}: ${errorText}`);
  }

  let items: any;
  try {
    items = await response.json();
  } catch (err: any) {
    console.error('[Booking Provider] JSON parsing failed:', err);
    throw new Error(`Failed to parse Apify Actor response JSON: ${err.message || String(err)}`);
  }

  if (!Array.isArray(items)) {
    console.error('[Booking Provider] Expected array, got:', items);
    throw new Error('no_reviews_found');
  }

  console.log(`Booking RAW Reviews: ${items.length}`);

  if (items.length === 0) {
    return [];
  }

  // Log first 5 raw items for debugging
  items.slice(0, 5).forEach((item: any, idx: number) => {
    console.log(`[BOOKING RAW DEBUG #${idx + 1}]`);
    console.log(`  - id:`, item.id || item.reviewId);
    console.log(`  - reviewer:`, item.reviewer || item.reviewerName || item.author);
    console.log(`  - review:`, item.review || item.reviewText);
    console.log(`  - reviewText:`, item.reviewText);
    console.log(`  - text:`, item.text);
    console.log(`  - comment:`, item.comment);
    console.log(`  - pros:`, item.pros || item.liked);
    console.log(`  - cons:`, item.cons || item.disliked);
    console.log(`  - title:`, item.title || item.reviewTitle);
    console.log(`  - score:`, item.score || item.rating);
    console.log(`  - rating:`, item.rating);
    console.log(`  - reviewDate:`, item.reviewDate || item.date);
    console.log(`  - keys:`, Object.keys(item));
  });

  const normalized = items.map((item: any, idx: number) => {
    const normalizedReview = normalizeBookingReview(item, targetUrl, idx);

    if (idx < 3) {
      console.log("[NORMALIZED BOOKING REVIEW]", normalizedReview);
    }

    return normalizedReview;
  });

  const total = normalized.length;
  const withText = normalized.filter(n => n.reviewText && n.reviewText !== 'No comment review.').length;
  const scoreOnly = total - withText;
  console.log(`Booking Import Summary:`);
  console.log(`  - Toplam: ${total}`);
  console.log(`  - Metinli: ${withText}`);
  console.log(`  - Sadece puan: ${scoreOnly}`);

  console.log(`Booking Parsed Reviews: ${normalized.length}`);
  return normalized;
}

// For compatibility
export const bookingProvider = {
  fetchReviews: async (propertyId: string) => {
    return [];
  }
};

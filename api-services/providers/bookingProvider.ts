import { NormalizedReview } from '../reviewImportService.js';

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

  const rawActorId = process.env.APIFY_BOOKING_ACTOR_ID || 'danci/booking-reviews-scraper';
  const encodedActorId = encodeURIComponent(rawActorId);
  const apifyUrl = `https://api.apify.com/v2/acts/${encodedActorId}/run-sync-get-dataset-items?token=${apifyToken}`;

  const payload = {
    startUrls: [
      { url: targetUrl }
    ],
    maxItems: limit || 200,
    language: "en-us"
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
    throw new Error('apify_actor_failed');
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'No error response body');
    console.error(`[Booking Provider] HTTP ${response.status} Error:`, errorText);
    throw new Error('apify_actor_failed');
  }

  let items: any;
  try {
    items = await response.json();
  } catch (err: any) {
    console.error('[Booking Provider] JSON parsing failed:', err);
    throw new Error('apify_actor_failed');
  }

  if (!Array.isArray(items)) {
    console.error('[Booking Provider] Expected array, got:', items);
    throw new Error('no_reviews_found');
  }

  console.log(`Booking RAW Reviews: ${items.length}`);

  if (items.length === 0) {
    return [];
  }

  const normalized = items.map((item: any) => {
    const guestName = 
      item.reviewerName || 
      item.userName || 
      item.username || 
      item.author || 
      item.authorName || 
      'Booking Guest';

    // Booking.com uses 10-point scale. Map to 5-point scale:
    let score = item.rating || item.score || item.average_score || item.reviewRating || 10;
    if (typeof score === 'string') {
      score = parseFloat(score);
    }
    const rating = Math.max(1, Math.min(5, Math.round(score / 2)));

    const reviewText = 
      item.pros || item.cons
        ? `${item.pros || ''} ${item.cons || ''}`.trim()
        : item.text || item.reviewText || item.comment || '';

    const reviewDate = 
      item.publishAt || 
      item.publishedAt || 
      item.createTime || 
      item.date || 
      item.created || 
      new Date().toISOString();

    const externalId = 
      item.id || 
      item.reviewId || 
      `${guestName}_${rating}_${reviewText.substring(0, 50)}`;

    return {
      platform: 'Booking',
      guestName: String(guestName).trim(),
      rating: Number(rating),
      reviewText: String(reviewText).trim() || 'No comment review.',
      reviewDate: String(reviewDate).trim(),
      externalId: String(externalId).trim()
    };
  });

  console.log(`Booking Parsed Reviews: ${normalized.length}`);
  return normalized;
}

// For compatibility
export const bookingProvider = {
  fetchReviews: async (propertyId: string) => {
    return [];
  }
};

import { NormalizedReview } from '../reviewImportService.js';

export async function fetchTripadvisorReviews(url: string): Promise<NormalizedReview[]> {
  const targetUrl = (url || '').trim();
  if (!targetUrl) {
    throw new Error('no_reviews_found');
  }

  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    throw new Error('apify_token_missing');
  }

  const rawActorId = process.env.APIFY_TRIPADVISOR_ACTOR_ID || 'maxcopell/tripadvisor';
  const encodedActorId = encodeURIComponent(rawActorId);
  const apifyUrl = `https://api.apify.com/v2/acts/${encodedActorId}/run-sync-get-dataset-items?token=${apifyToken}`;

  const payload = {
    startUrls: [
      { url: targetUrl }
    ],
    maxReviews: 50
  };

  console.log(`[Tripadvisor Provider] Running actor: ${rawActorId} (encoded: ${encodedActorId})`);
  console.log('[Tripadvisor Provider] Sending payload (token hidden):', JSON.stringify(payload, null, 2));

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
    console.error('[Tripadvisor Provider] Fetch execution failed:', err);
    throw new Error('apify_actor_failed');
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'No error response body');
    console.error(`[Tripadvisor Provider] HTTP ${response.status} Error:`, errorText);
    const errorObj = new Error('apify_actor_failed') as any;
    errorObj.rawError = errorText;
    errorObj.status = response.status;
    throw errorObj;
  }

  let items: any;
  try {
    items = await response.json();
  } catch (err: any) {
    console.error('[Tripadvisor Provider] JSON parsing failed:', err);
    throw new Error('apify_actor_failed');
  }

  if (!Array.isArray(items)) {
    console.error('[Tripadvisor Provider] Expected array, got:', items);
    throw new Error('no_reviews_found');
  }

  if (items.length === 0) {
    throw new Error('no_reviews_found');
  }

  // Normalize TripAdvisor items
  return items.map((item: any) => {
    const guestName = item.title || item.user?.username || item.authorName || 'Tripadvisor Guest';
    const rating = item.rating || item.ratingRange || 5;
    const reviewText = item.text || item.comment || '';
    const reviewDate = item.publishedDate || item.date || 'recently';

    return {
      platform: 'Tripadvisor',
      guestName: String(guestName).trim(),
      rating: Number(rating),
      reviewText: String(reviewText).trim(),
      reviewDate: String(reviewDate).trim(),
      externalId: item.id || `${guestName}_${rating}_${reviewText.substring(0, 50)}`
    };
  });
}

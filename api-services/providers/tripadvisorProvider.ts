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

  const rawActorId = process.env.APIFY_TRIPADVISOR_ACTOR_ID || 'maxcopell/tripadvisor-reviews';
  const encodedActorId = encodeURIComponent(rawActorId);
  const apifyUrl = `https://api.apify.com/v2/acts/${encodedActorId}/run-sync-get-dataset-items?token=${apifyToken}`;

  const payload = {
    startUrls: [
      { url: targetUrl }
    ],
    maxItemsPerQuery: 200,
    reviewRatings: ["ALL_REVIEW_RATINGS"],
    reviewsLanguages: ["ALL_REVIEW_LANGUAGES"],
    scrapeReviewerInfo: true,
    disableMachineTranslations: false
  };

  console.log("TRIPADVISOR URL:", targetUrl);
  console.log("ACTOR PAYLOAD:", JSON.stringify(payload, null, 2));
  console.log(`[Tripadvisor Provider] Running actor: ${rawActorId} (encoded: ${encodedActorId})`);

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
    console.error('[Tripadvisor Provider] Apify Run Failed:');
    console.error('  - actorId:', rawActorId);
    console.log('  - payload:', JSON.stringify(payload, null, 2));
    console.error('  - run status:', response.status);
    console.error('  - fail reason:', response.statusText);
    console.error('  - error message:', errorText);

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

  // 1. Apify'dan dönen ham dataset item sayısını logla
  console.log('[TRIPADVISOR RAW ITEMS COUNT]', items.length);

  // 2. İlk 3 raw item'ı token/sensitive bilgi olmadan logla
  const samples = items.slice(0, 3).map((item: any) => {
    const copy = { ...item };
    delete copy.token;
    delete copy.apifyToken;
    delete copy.cookie;
    delete copy.cookies;
    return copy;
  });
  console.log('[TRIPADVISOR RAW SAMPLE]', JSON.stringify(samples, null, 2));

  if (items.length === 0) {
    throw new Error('no_reviews_found');
  }

  // 3. Normalize TripAdvisor items with robust key mapping
  const normalized = items.map((item: any) => {
    const guestName = 
      item.reviewerName || 
      item.userName || 
      item.username || 
      item.author || 
      item.authorName || 
      item.user?.username || 
      item.user?.name || 
      item.reviewer?.name || 
      item.title || 
      'Tripadvisor Guest';

    let rawRating = item.rating || item.reviewRating || item.ratingRange || item.ratingScore || item.stars || 5;
    if (typeof rawRating === 'string') {
      rawRating = parseFloat(rawRating);
    }
    if (rawRating > 5) {
      rawRating = rawRating / 10;
    }
    const rating = Math.max(1, Math.min(5, Math.round(rawRating)));

    const reviewText = 
      item.text || 
      item.reviewText || 
      item.textReview || 
      item.comment || 
      item.commentReview || 
      item.description || 
      '';

    const reviewDate = 
      item.publishedDate || 
      item.date || 
      item.datePublished || 
      item.publishDate || 
      item.created || 
      'recently';

    const externalId = 
      item.id || 
      item.reviewId || 
      item.url || 
      `${guestName}_${rating}_${reviewText.substring(0, 50)}`;

    return {
      platform: 'Tripadvisor',
      guestName: String(guestName).trim(),
      rating: Number(rating),
      reviewText: String(reviewText).trim(),
      reviewDate: String(reviewDate).trim(),
      externalId: String(externalId).trim()
    };
  });

  // 4. Normalize edilen sonuç sayısını logla
  console.log('[TRIPADVISOR NORMALIZED COUNT]', normalized.length);

  return normalized;
}

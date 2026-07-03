import { NormalizedReview } from '../reviewImportService.js';

export async function fetchHolidaycheckReviews(url: string, limit?: number): Promise<NormalizedReview[]> {
  const targetUrl = (url || '').trim();
  if (!targetUrl) {
    throw new Error('no_reviews_found');
  }

  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    throw new Error('apify_token_missing');
  }

  const rawActorId = process.env.APIFY_HOLIDAYCHECK_ACTOR_ID || 'lexis-solutions/holidaycheck-de-reviews-scraper';
  const encodedActorId = encodeURIComponent(rawActorId);
  const apifyUrl = `https://api.apify.com/v2/acts/${encodedActorId}/run-sync-get-dataset-items?token=${apifyToken}`;

  // Easy to modify input schema payload
  const payload = {
    startUrls: [
      { url: targetUrl }
    ],
    maxReviews: limit || 50,
    maxItems: limit || 50
  };

  console.log("[HolidayCheck Import] started");
  console.log("HOLIDAYCHECK URL:", targetUrl);
  console.log("ACTOR PAYLOAD:", JSON.stringify(payload, null, 2));

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
    console.error('[HolidayCheck Import] Fetch execution failed:', err);
    throw new Error('apify_actor_failed');
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'No error response body');
    console.error(`[HolidayCheck Import] HTTP ${response.status} Error:`, errorText);
    const errorObj = new Error('apify_actor_failed') as any;
    errorObj.rawError = errorText;
    errorObj.status = response.status;
    throw errorObj;
  }

  let items: any;
  try {
    items = await response.json();
  } catch (err: any) {
    console.error('[HolidayCheck Import] JSON parsing failed:', err);
    throw new Error('apify_actor_failed');
  }

  if (!Array.isArray(items)) {
    console.error('[HolidayCheck Import] Expected array, got:', items);
    throw new Error('no_reviews_found');
  }

  console.log(`[HolidayCheck Import] fetched count: ${items.length}`);

  if (items.length === 0) {
    return [];
  }

  // Normalize HolidayCheck items with robust key mapping
  const normalized = items.map((item: any) => {
    const guestName = 
      item.author || 
      item.authorName || 
      item.userName || 
      item.reviewerName || 
      item.name || 
      'HolidayCheck Guest';

    // HolidayCheck rating is usually out of 6. Normalize 1-6 scale to 1-5 scale:
    let score = item.rating || item.score || item.overallRating || item.totalRating || item.stars || 6;
    if (typeof score === 'string') {
      score = parseFloat(score);
    }
    
    // Scale 6-point to 5-point scale:
    let rating = 5;
    if (score <= 6 && score > 0) {
      rating = Math.max(1, Math.min(5, Math.round((score / 6) * 5)));
    } else {
      rating = Math.max(1, Math.min(5, Math.round(score)));
    }

    const text = item.reviewText || item.text || item.description || item.comment || item.content || '';
    const title = item.title || item.reviewTitle || item.headline || '';
    
    let reviewText = text;
    if (title && title.trim()) {
      reviewText = `${title.trim()}\n\n${text.trim()}`;
    }

    const reviewDate = 
      item.date || 
      item.reviewDate || 
      item.publishedDate || 
      item.createdAt || 
      new Date().toISOString();

    const externalId = 
      item.id || 
      item.reviewId || 
      `${guestName}_${rating}_${reviewDate}`;

    return {
      platform: 'holidaycheck',
      guestName: String(guestName).trim(),
      rating: Number(rating),
      reviewText: String(reviewText).trim(),
      reviewDate: String(reviewDate).trim(),
      externalId: String(externalId).trim(),
      raw: item
    };
  });

  return normalized;
}

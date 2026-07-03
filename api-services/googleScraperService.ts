export interface ScrapedReview {
  guestName: string;
  rating: number;
  reviewText: string;
  relativeDate: string;
  reviewId?: string | null;
}

export async function scrapeGoogleMapsReviews(googleMapsUrl: string, limit?: number): Promise<ScrapedReview[]> {
  const targetUrl = (googleMapsUrl || '').trim();
  if (!targetUrl) {
    throw new Error('no_reviews_found');
  }

  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    throw new Error('apify_token_missing');
  }

  const rawActorId = process.env.APIFY_GOOGLE_MAPS_ACTOR_ID || 'apify/google-maps-scraper';
  const encodedActorId = encodeURIComponent(rawActorId);
  const url = `https://api.apify.com/v2/acts/${encodedActorId}/run-sync-get-dataset-items?token=${apifyToken}`;

  // Normalize URL by stripping browser query clutter while preserving cid parameters
  let cleanUrl = targetUrl;
  if (cleanUrl.includes('google.com/maps') && !cleanUrl.includes('?cid=')) {
    if (cleanUrl.includes('?')) {
      cleanUrl = cleanUrl.split('?')[0];
    }
  } else if (cleanUrl.includes('maps.app.goo.gl') || cleanUrl.includes('goo.gl/maps')) {
    if (cleanUrl.includes('?')) {
      cleanUrl = cleanUrl.split('?')[0];
    }
  }

  const payload = {
    startUrls: [
      { url: cleanUrl }
    ],
    maxReviews: limit || 1000,
    language: 'tr',
    reviewsSort: 'newest'
  };

  console.log('========================================================================');
  console.log('[DEBUG-APIFY-PAYLOAD] Preparing Apify request:');
  console.log('  - Target URL parameter passed to scraper:', targetUrl);
  console.log('  - Normalized cleanUrl:', cleanUrl);
  console.log('  - Payload startUrls:', JSON.stringify(payload.startUrls));
  console.log('========================================================================');

  console.log(`[Apify Scraper] Running actor: ${rawActorId} (encoded: ${encodedActorId})`);
  console.log('[Apify Scraper] Sending payload (token hidden):', JSON.stringify(payload, null, 2));

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch (err: any) {
    console.error('[Apify Scraper] Fetch execution failed:', err);
    throw new Error('apify_actor_failed');
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'No error response body');
    console.error(`[Apify Scraper] HTTP ${response.status} Error:`, errorText);
    const errorObj = new Error('apify_actor_failed') as any;
    errorObj.rawError = errorText;
    errorObj.status = response.status;
    throw errorObj;
  }

  let items: any;
  try {
    items = await response.json();
  } catch (err: any) {
    console.error('[Apify Scraper] JSON parsing failed:', err);
    throw new Error('apify_actor_failed');
  }

  if (!Array.isArray(items)) {
    console.error('[Apify Scraper] Expected array from dataset, got:', items);
    throw new Error('no_reviews_found');
  }

  console.log(`Google RAW Reviews: ${items.length}`);

  if (items.length === 0) {
    throw new Error('no_reviews_found');
  }

  // Normalize items to ScrapedReview format
  const parsed = items.map((item: any) => {
    const guestName = item.name || item.authorName || 'Anonymous Guest';
    const rating = item.starsScore || item.stars || 5;
    const reviewText = item.text || item.textTranslated || '';

    // Log specified fields for debugging
    console.log('[GOOGLE RAW FIELD TRACE]', {
      reviewId: item.reviewId || item.id || null,
      reviewDate: item.reviewDate || item.date || item.datePublished || null,
      publishAt: item.publishAt || null,
      publishedAt: item.publishedAt || null,
      publishedAtDate: item.publishedAtDate || null,
      createTime: item.createTime || null,
      relativeTimeDate: item.relativeTimeDate || null,
      relativeTime: item.relativeTime || null
    });
    
    // Rule 2: Chronologically check fields for date
    const rawDate = 
      item.publishAt || 
      item.publishedAt || 
      item.publishedAtDate || 
      item.createTime || 
      item.relativeTimeDate || 
      item.relativeTime || 
      'recently';
      
    const reviewId = item.reviewId || item.id || null;

    return {
      guestName: String(guestName).trim(),
      rating: Number(rating),
      reviewText: String(reviewText).trim(),
      relativeDate: String(rawDate).trim(),
      reviewId: reviewId ? String(reviewId).trim() : null
    };
  });

  console.log(`Google Parsed Reviews: ${parsed.length}`);
  return parsed;
}

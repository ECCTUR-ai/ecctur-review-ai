export interface ScrapedReview {
  guestName: string;
  rating: number;
  reviewText: string;
  relativeDate: string;
}

export async function scrapeGoogleMapsReviews(googleMapsUrl: string): Promise<ScrapedReview[]> {
  const targetUrl = (googleMapsUrl || '').trim();
  if (!targetUrl) {
    throw new Error('no_reviews_found');
  }

  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    throw new Error('apify_token_missing');
  }

  const actorId = process.env.APIFY_GOOGLE_MAPS_ACTOR_ID || 'apify/google-maps-scraper';
  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${apifyToken}`;

  console.log(`[Apify Scraper] Running actor: ${actorId} for URL: ${targetUrl}`);

  const payload = {
    startUrls: [{ url: targetUrl }],
    maxReviews: 20,
    language: 'tr',
    personalDataAuthorization: 'GDPR_COMPLIANT'
  };

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

  if (items.length === 0) {
    throw new Error('no_reviews_found');
  }

  // Normalize items to ScrapedReview format
  return items.map((item: any) => {
    const guestName = item.name || item.authorName || 'Anonymous Guest';
    const rating = item.starsScore || item.stars || 5;
    const reviewText = item.text || item.textTranslated || '';
    const relativeDate = item.relativeTime || item.publishAt || 'recently';

    return {
      guestName: String(guestName).trim(),
      rating: Number(rating),
      reviewText: String(reviewText).trim(),
      relativeDate: String(relativeDate).trim()
    };
  });
}

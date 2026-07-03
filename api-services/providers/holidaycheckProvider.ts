import { NormalizedReview } from '../reviewImportService.js';

export async function fetchHolidaycheckReviews(url: string, limit?: number): Promise<NormalizedReview[]> {
  const targetUrl = (url || '').trim();
  if (!targetUrl) {
    throw new Error('no_reviews_found');
  }

  console.log("[HolidayCheck Apify Token Exists]", Boolean(process.env.APIFY_TOKEN));
  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    throw new Error('apify_token_missing');
  }

  const rawActorId = process.env.APIFY_HOLIDAYCHECK_ACTOR_ID || 'lexis-solutions/holidaycheck-de-reviews-scraper';
  const encodedActorId = encodeURIComponent(rawActorId);
  const apifyUrl = `https://api.apify.com/v2/acts/${encodedActorId}/run-sync-get-dataset-items?token=${apifyToken}`;

  const payloads = [
    {
      startUrls: [{ url: targetUrl }],
      maxItems: limit || 50
    },
    {
      urls: [{ url: targetUrl }],
      maxItems: limit || 50
    },
    {
      url: targetUrl,
      maxItems: limit || 50
    }
  ];

  let items: any[] = [];
  let lastError: any = null;

  for (let i = 0; i < payloads.length; i++) {
    const input = payloads[i];
    console.log("[HolidayCheck Apify Actor]", rawActorId);
    console.log("[HolidayCheck Apify Input]", input);

    try {
      const response = await fetch(apifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(input)
      });

      const responseText = await response.text().catch(() => '');
      if (!response.ok) {
        let apifyErrMessage = '';
        try {
          const parsed = JSON.parse(responseText);
          apifyErrMessage = parsed.error?.message || parsed.message || '';
        } catch (_) {}

        lastError = {
          status: response.status,
          responseText,
          apifyErrMessage
        };
        console.warn(`[HolidayCheck Import] Option ${i + 1} failed with status ${response.status}:`, responseText);
        continue;
      }

      let parsedItems: any;
      try {
        parsedItems = JSON.parse(responseText);
      } catch (err: any) {
        console.warn(`[HolidayCheck Import] Option ${i + 1} JSON parsing failed:`, err);
        lastError = err;
        continue;
      }

      if (Array.isArray(parsedItems)) {
        items = parsedItems;
        console.log(`[HolidayCheck Option ${i + 1} Success] Fetched ${items.length} items`);
        if (items.length > 0) {
          break;
        } else {
          console.log(`[HolidayCheck Option ${i + 1}] Returned 0 items. Trying next fallback...`);
        }
      } else {
        console.error('[HolidayCheck Import] Expected array response, got:', parsedItems);
        lastError = new Error('response_not_array');
      }
    } catch (err: any) {
      console.warn(`[HolidayCheck Import] Option ${i + 1} request error:`, err);
      lastError = err;
    }
  }

  console.log("[HolidayCheck Dataset Items Count]", items.length);

  if (items.length === 0 && lastError) {
    const status = lastError.status || 'unknown_status';
    const responseText = lastError.responseText || String(lastError);
    const apifyMsg = lastError.apifyErrMessage || '';

    let detailedMsg = `apify_actor_failed: ${status} ${responseText}`;
    const lowerText = (responseText + ' ' + apifyMsg).toLowerCase();
    
    if (status === 401 || status === 403 || lowerText.includes('invalid-token') || lowerText.includes('invalid token') || lowerText.includes('unauthorized')) {
      detailedMsg = "Apify token geçersiz veya yetkisiz.";
    } else if (status === 404 || lowerText.includes('not found') || lowerText.includes('not-found') || lowerText.includes('cannot find')) {
      detailedMsg = "HolidayCheck Apify actor erişimi yok veya çalıştırılamadı.";
    } else if (status === 400 || lowerText.includes('validation') || lowerText.includes('input') || lowerText.includes('invalid field') || lowerText.includes('schema')) {
      detailedMsg = "HolidayCheck actor input formatı uyumsuz.";
    }

    throw new Error(detailedMsg);
  }

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

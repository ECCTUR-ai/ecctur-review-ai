import { NormalizedReview } from '../reviewImportService.js';

const HOTELS_COM_ACTOR_ID = 'dtrungtin/hotels-scraper';

export async function fetchHotelscomReviews(url: string, limit?: number): Promise<NormalizedReview[]> {
  const targetUrl = (url || '').trim();
  if (!targetUrl) {
    throw new Error('no_reviews_found');
  }

  console.log("[Hotels.com Apify Token Exists]", Boolean(process.env.APIFY_TOKEN));
  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    throw new Error('APIFY_TOKEN tanımlı değil. Hotels.com yorumları çekilemedi.');
  }

  const encodedActorId = encodeURIComponent(HOTELS_COM_ACTOR_ID);
  const apifyUrl = `https://api.apify.com/v2/acts/${encodedActorId}/run-sync-get-dataset-items?token=${apifyToken}`;

  const payloads = [
    {
      startUrls: [{ url: targetUrl }],
      maxItems: limit || 100
    },
    {
      urls: [{ url: targetUrl }],
      maxItems: limit || 100
    },
    {
      url: targetUrl,
      maxItems: limit || 100
    }
  ];

  let items: any[] = [];
  let lastError: any = null;

  for (let i = 0; i < payloads.length; i++) {
    const input = payloads[i];
    console.log("[Hotels.com Apify Actor]", HOTELS_COM_ACTOR_ID);
    console.log("[Hotels.com Apify Input]", input);

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
        console.warn(`[Hotels.com Import] Option ${i + 1} failed with status ${response.status}:`, responseText);
        continue;
      }

      let parsedItems: any;
      try {
        parsedItems = JSON.parse(responseText);
      } catch (err: any) {
        console.warn(`[Hotels.com Import] Option ${i + 1} JSON parsing failed:`, err);
        lastError = err;
        continue;
      }

      if (Array.isArray(parsedItems)) {
        items = parsedItems;
        console.log(`[Hotels.com Option ${i + 1} Success] Fetched ${items.length} items`);
        if (items.length > 0) {
          break;
        } else {
          console.log(`[Hotels.com Option ${i + 1}] Returned 0 items. Trying next fallback...`);
        }
      } else {
        console.error('[Hotels.com Import] Expected array response, got:', parsedItems);
        lastError = new Error('response_not_array');
      }
    } catch (err: any) {
      console.warn(`[Hotels.com Import] Option ${i + 1} request error:`, err);
      lastError = err;
    }
  }

  console.log("[Hotels.com Dataset Items Count]", items.length);

  if (items.length === 0 && lastError) {
    const status = lastError.status || 'unknown_status';
    const responseText = lastError.responseText || String(lastError);
    const apifyMsg = lastError.apifyErrMessage || '';

    let detailedMsg = `apify_actor_failed: ${status} ${responseText}`;
    const lowerText = (responseText + ' ' + apifyMsg).toLowerCase();
    
    if (status === 401 || status === 403 || lowerText.includes('invalid-token') || lowerText.includes('invalid token') || lowerText.includes('unauthorized')) {
      detailedMsg = "Apify token geçersiz veya yetkisiz.";
    } else if (status === 404 || lowerText.includes('not found') || lowerText.includes('not-found') || lowerText.includes('cannot find')) {
      detailedMsg = "Hotels.com Apify actor erişimi yok veya çalıştırılamadı.";
    } else if (status === 400 || lowerText.includes('validation') || lowerText.includes('input') || lowerText.includes('invalid field') || lowerText.includes('schema')) {
      detailedMsg = "Hotels.com actor input formatı uyumsuz.";
    }

    throw new Error(detailedMsg);
  }

  if (items.length === 0) {
    return [];
  }

  // Normalize dataset items
  const normalized = items.map((item: any) => {
    const guestName = 
      item.authorName || 
      item.author || 
      item.reviewerName || 
      item.userName || 
      item.name || 
      'Hotels.com Guest';

    let score = item.rating || item.score || item.overallRating || item.reviewRating || 10;
    if (typeof score === 'string') {
      score = parseFloat(score);
    }

    let rating = 5;
    if (score > 5 && score <= 10) {
      rating = Math.max(1, Math.min(5, Math.round(score / 2)));
    } else {
      rating = Math.max(1, Math.min(5, Math.round(score)));
    }

    const text = item.reviewText || item.text || item.description || item.comment || item.content || '';
    const title = item.title || item.headline || item.reviewTitle || '';
    
    let reviewText = text;
    if (title && title.trim()) {
      reviewText = `${title.trim()}\n\n${text.trim()}`;
    }

    const reviewDate = 
      item.reviewDate || 
      item.date || 
      item.publishedDate || 
      item.createdAt || 
      new Date().toISOString();

    const externalId = 
      item.id || 
      item.reviewId || 
      `${guestName}_${rating}_${reviewDate}`;

    const sourceUrl =
      item.url ||
      item.sourceUrl ||
      item.hotelscomUrl ||
      targetUrl;

    return {
      platform: 'hotels.com',
      guestName: String(guestName).trim(),
      rating: Number(rating),
      reviewText: String(reviewText).trim(),
      reviewDate: String(reviewDate).trim(),
      externalId: String(externalId).trim(),
      sourceUrl: String(sourceUrl).trim(),
      raw: item
    };
  });

  return normalized;
}

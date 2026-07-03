import { NormalizedReview } from '../reviewImportService.js';
import { normalizeHotelsComReview } from '../utils/reviewNormalizer.js';

const HOTELS_COM_ACTOR_ID = 'memo23/hotels-scraper';

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
      startUrls: [targetUrl],
      maxItems: limit || 100
    },
    {
      startUrls: [{ url: targetUrl }],
      maxItems: limit || 100
    },
    {
      urls: [targetUrl],
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
  const normalized = items.map((item: any, idx: number) => {
    return normalizeHotelsComReview(item, targetUrl, idx);
  });

  return normalized;
}

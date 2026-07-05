export interface NormalizedReview {
  platform: string;
  guestName: string;
  rating: number;
  reviewText: string;
  reviewDate: string;
  externalId?: string;
  raw?: any;
  sourceUrl?: string;
  metadata?: any;
}

function parseGoogleRelativeDate(text: string): string | null {
  if (!text) return null;
  const str = text.trim().toLowerCase();
  const now = new Date();

  if (
    str.includes('hour') || 
    str.includes('saat') || 
    str.includes('minute') || 
    str.includes('dakika') || 
    str.includes('second') || 
    str.includes('saniye') ||
    str === 'now' ||
    str === 'şimdi'
  ) {
    return now.toISOString();
  }

  if (str === 'yesterday' || str === 'dün') {
    now.setDate(now.getDate() - 1);
    return now.toISOString();
  }

  const trNumbers: { [key: string]: number } = {
    'bir': 1, 'iki': 2, 'üç': 3, 'dört': 4, 'beş': 5, 'altı': 6, 'yedi': 7, 'sekiz': 8, 'dokuz': 9, 'on': 10
  };
  const enNumbers: { [key: string]: number } = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
  };

  let val = 1;
  const match = str.match(/(\d+)/);
  if (match) {
    val = parseInt(match[1], 10);
  } else {
    const words = str.split(/\s+/);
    for (const w of words) {
      if (trNumbers[w] !== undefined) {
        val = trNumbers[w];
        break;
      }
      if (enNumbers[w] !== undefined) {
        val = enNumbers[w];
        break;
      }
    }
  }

  if (str.includes('gün') || str.includes('day')) {
    now.setDate(now.getDate() - val);
    return now.toISOString();
  }
  if (str.includes('hafta') || str.includes('week')) {
    now.setDate(now.getDate() - val * 7);
    return now.toISOString();
  }
  if (str.includes('ay') || str.includes('month')) {
    now.setMonth(now.getMonth() - val);
    return now.toISOString();
  }
  if (str.includes('yıl') || str.includes('year')) {
    now.setFullYear(now.getFullYear() - val);
    return now.toISOString();
  }

  return null;
}

export async function fetchAggregatorReviews(url: string, limit?: number): Promise<NormalizedReview[]> {
  const apifyToken = typeof process !== 'undefined' ? process.env.APIFY_TOKEN : '';
  if (!apifyToken) {
    throw new Error('apify_token_missing');
  }

  const actorId = (typeof process !== 'undefined' ? process.env.APIFY_HOTEL_REVIEW_AGGREGATOR_ACTOR_ID : '') || 'tri_angle/hotel-review-aggregator';
  const encodedActorId = encodeURIComponent(actorId);
  const endpoint = `https://api.apify.com/v2/acts/${encodedActorId}/run-sync-get-dataset-items?token=${apifyToken}`;

  const payload = {
    startUrls: [
      { url }
    ],
    reviewProviders: ["google-maps"],
    maxReviews: limit || 100,
    scrapeOwnerResponses: true,
    scrapeReviewPictures: false
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apify aggregator failed: ${text}`);
  }

  const items = await res.json();
  if (!Array.isArray(items)) {
    throw new Error('Invalid response from Apify aggregator');
  }

  return items.map((item, idx) => {
    const guestName = item.authorName || 'Anonymous Guest';
    const rating = Number(item.reviewRating || 5);
    const reviewText = item.reviewText !== undefined && item.reviewText !== null ? String(item.reviewText) : '';
    const platform = item.provider || 'Google';
    
    let reviewDate: string | null = null;
    if (item.reviewDate) {
      if (!isNaN(Date.parse(item.reviewDate))) {
        reviewDate = new Date(item.reviewDate).toISOString();
      } else {
        reviewDate = parseGoogleRelativeDate(item.reviewDate);
      }
    }

    // Owner response extraction
    const ownerResponse = 
      item.ownerResponse ||
      item.businessResponse ||
      item.responseText ||
      item.owner_response ||
      item.replyText ||
      item.managementResponse ||
      null;

    const ownerResponseDate = 
      item.ownerResponseDate ||
      item.businessResponseDate ||
      item.responseDate ||
      item.replyDate ||
      null;

    const hasOwnerResponse = !!ownerResponse;

    const metadata = {
      address: item.placeAddress || null,
      hotel_name: item.placeName || null,
      google_relative_date: item.reviewDate || null,
      display_date: item.reviewDate || null,
      ownerResponse,
      ownerResponseDate,
      hasOwnerResponse,
      source: "hotel-review-aggregator",
      originalProvider: platform,
      originalData: item,
      
      // Extra fields
      reviewUrl: item.reviewUrl || null,
      reviewId: item.reviewId || null,
      language: item.language || null,
      reviewerImage: item.reviewerImage || null,
      reviewerAvatar: item.reviewerAvatar || null,
      photos: item.photos || null,
      helpfulCount: item.helpfulCount || null
    };

    const externalId = item.reviewId || item.id || `aggregator-mock-${guestName}-${rating}-${reviewDate || 'nodate'}-${idx}`;

    return {
      platform,
      guestName,
      rating,
      reviewText,
      reviewDate: reviewDate || '',
      externalId,
      sourceUrl: item.reviewUrl || url,
      metadata,
      raw: item
    };
  });
}

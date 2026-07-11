import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { reviewImportService } from '../api-services/reviewImportService.js';
import { bookingProvider } from '../api-services/providers/bookingProvider.js';
import { fetchAggregatorReviews } from '../src/services/providers/hotelReviewAggregatorProvider.js';
import { analyzeReviewText } from './utils/operationsAnalysis.js';
import { otelpuanScraperService } from '../src/services/otelpuanScraperService.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

// Post review helper to n8n webhook if configured
async function postToN8N(review: any) {
  let webhookUrl = process.env.N8N_WEBHOOK_URL || 'https://cemilsezgin.app.n8n.cloud/webhook/ecctur-review';
  if (webhookUrl.includes('/webhook-test/')) {
    webhookUrl = webhookUrl.replace('/webhook-test/', '/webhook/');
  }
  if (webhookUrl.includes('n8n.cloud') && !webhookUrl.includes('/webhook/ecctur-review')) {
    webhookUrl = 'https://cemilsezgin.app.n8n.cloud/webhook/ecctur-review';
  }
  console.log('[n8n Poster] Posting review to:', webhookUrl);
  
  let res: Response;
  try {
    res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(review)
    });
  } catch (err: any) {
    throw new Error(JSON.stringify({
      type: 'N8N_WEBHOOK_NETWORK_ERROR',
      webhookUrl,
      status: 0,
      responseBody: err.message || String(err),
      message: err.message || String(err),
      reviewId: review.id || review.platform_review_id
    }));
  }

  if (res.status !== 200) {
    let bodyText = '';
    try {
      bodyText = await res.text();
    } catch (_) {}
    throw new Error(JSON.stringify({
      type: 'N8N_WEBHOOK_HTTP_ERROR',
      webhookUrl,
      status: res.status,
      responseBody: bodyText,
      message: `n8n webhook returned status ${res.status}: ${bodyText}`,
      reviewId: review.id || review.platform_review_id
    }));
  }
  
  console.log('[n8n Poster] Response status:', res.status);
}

function mapGoogleReview(raw: any, hotelId: string, orgId: string) {
  const platformReviewId = raw.reviewId || raw.platform_review_id || (raw.name ? raw.name.split('/').pop() : null);
  if (!platformReviewId) return null;

  const reviewerDisplayName = raw.reviewer?.displayName || raw.reviewerDisplayName || raw.guestName || raw.guest_name || 'Google User';

  let starRating = 5;
  if (raw.starRating) {
    const ratingStr = String(raw.starRating).toUpperCase();
    if (ratingStr === 'FIVE') starRating = 5;
    else if (ratingStr === 'FOUR') starRating = 4;
    else if (ratingStr === 'THREE') starRating = 3;
    else if (ratingStr === 'TWO') starRating = 2;
    else if (ratingStr === 'ONE') starRating = 1;
    else {
      const parsed = parseInt(ratingStr, 10);
      if (!isNaN(parsed)) starRating = parsed;
    }
  } else if (raw.rating !== undefined) {
    starRating = Number(raw.rating) || 5;
  }

  const commentText = raw.comment || raw.commentText || raw.reviewText || raw.review_text || '';
  const createUpdateTime = raw.createTime || raw.updateTime || raw.reviewDate || raw.review_date || raw.createdAt || raw.created_at || new Date().toISOString();
  const reply = raw.reviewReply?.comment || raw.reply || null;

  let googleLocationId = raw.locationId || raw.googleLocationId || null;
  if (!googleLocationId && raw.name) {
    const match = raw.name.match(/locations\/([^\/]+)/);
    if (match) googleLocationId = match[1];
  }

  return {
    platform_review_id: platformReviewId,
    reviewer_display_name: reviewerDisplayName,
    star_rating: starRating,
    comment_text: commentText,
    create_update_time: createUpdateTime,
    reply: reply,
    google_location_id: googleLocationId,
    hotel_id: hotelId,
    organization_id: orgId
  };
}

async function checkIsDuplicate(
  hotelId: string,
  platform: string,
  platformReviewId: string | null,
  guestName: string,
  rating: number,
  reviewText: string,
  reviewDate?: string | null
): Promise<boolean> {
  if (platformReviewId) {
    const { data: existing, error } = await supabaseAdmin
      .from('reviews')
      .select('id')
      .ilike('platform', platform)
      .eq('platform_review_id', platformReviewId)
      .limit(1);
    if (!error && existing && existing.length > 0) {
      return true;
    }
  }

  let query = supabaseAdmin
    .from('reviews')
    .select('id')
    .eq('hotel_id', hotelId)
    .ilike('platform', platform)
    .eq('guest_name', guestName)
    .eq('rating', rating);

  if (reviewText) {
    query = query.eq('review_text', reviewText);
  } else {
    query = query.or('review_text.is.null,review_text.eq.');
  }

  if (reviewDate) {
    query = query.eq('review_date', reviewDate);
  }

  const { data: existingSec, error: errorSec } = await query.limit(1);
  if (!errorSec && existingSec && existingSec.length > 0) {
    return true;
  }

  return false;
}

async function handleGoogleDuplicate(
  hotelId: string,
  platformReviewId: string | null,
  guestName: string,
  rating: number,
  reviewText: string,
  incomingReviewDate: string | null,
  incomingMetadata: any
) {
  try {
    let existingReview: any = null;
    
    if (platformReviewId) {
      const { data } = await supabaseAdmin
        .from('reviews')
        .select('*')
        .eq('platform', 'Google')
        .eq('platform_review_id', platformReviewId)
        .limit(1);
      if (data && data.length > 0) {
        existingReview = data[0];
      }
    }
    
    if (!existingReview) {
      const { data } = await supabaseAdmin
        .from('reviews')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('platform', 'Google')
        .eq('guest_name', guestName)
        .eq('rating', rating)
        .eq('review_text', reviewText)
        .limit(1);
      if (data && data.length > 0) {
        existingReview = data[0];
      }
    }

    if (!existingReview) return;

    const existingReviewDate = existingReview.review_date;
    const relativeDateText = incomingMetadata?.display_date || incomingMetadata?.google_relative_date;

    if (!existingReviewDate && (incomingReviewDate || relativeDateText)) {
      let dateToSet = incomingReviewDate;
      
      if (dateToSet && (dateToSet.includes('önce') || dateToSet.includes('ago') || isNaN(Date.parse(dateToSet)))) {
        dateToSet = parseRelativeDate(dateToSet);
      }
      
      if (!dateToSet && relativeDateText) {
        dateToSet = parseRelativeDate(relativeDateText);
      }

      if (dateToSet) {
        const currentMetadata = existingReview.metadata || {};
        const updatedMetadata = {
          ...currentMetadata,
          google_relative_date: relativeDateText || currentMetadata.google_relative_date || null,
          display_date: relativeDateText || currentMetadata.display_date || null
        };

        console.log(`[Google Duplicate Repair] Updating review ${existingReview.id}:`, {
          review_date: dateToSet,
          metadata: updatedMetadata
        });

        const { error: updateErr } = await supabaseAdmin
          .from('reviews')
          .update({
            review_date: dateToSet,
            metadata: updatedMetadata
          })
          .eq('id', existingReview.id);

        if (updateErr) {
          console.error(`[Google Duplicate Repair] Failed to update review ${existingReview.id}:`, updateErr);
        }
      }
    }
  } catch (err) {
    console.error('[Google Duplicate Repair] Unexpected error:', err);
  }
}


function parseRelativeDate(relative: string): string {
  if (relative && !isNaN(Date.parse(relative))) {
    return new Date(relative).toISOString();
  }
  const now = new Date();
  const lower = (relative || '').toLowerCase();
  
  const match = lower.match(/(\d+)\s+(minute|hour|day|week|month|year)/);
  if (match) {
    const val = parseInt(match[1], 10);
    const unit = match[2];
    if (unit.startsWith('minute')) now.setMinutes(now.getMinutes() - val);
    else if (unit.startsWith('hour')) now.setHours(now.getHours() - val);
    else if (unit.startsWith('day')) now.setDate(now.getDate() - val);
    else if (unit.startsWith('week')) now.setDate(now.getDate() - val * 7);
    else if (unit.startsWith('month')) now.setMonth(now.getMonth() - val);
    else if (unit.startsWith('year')) now.setFullYear(now.getFullYear() - val);
    return now.toISOString();
  }
  
  if (lower.includes('yesterday')) {
    now.setDate(now.getDate() - 1);
    return now.toISOString();
  }
  if (lower.includes('today') || lower.includes('now') || lower.includes('recently')) {
    return now.toISOString();
  }

  const trMatch = lower.match(/(\d+)\s+(dakika|saat|gün|hafta|ay|yıl)/);
  if (trMatch) {
    const val = parseInt(trMatch[1], 10);
    const unit = trMatch[2];
    if (unit.startsWith('dakika')) now.setMinutes(now.getMinutes() - val);
    else if (unit.startsWith('saat')) now.setHours(now.getHours() - val);
    else if (unit.startsWith('gün')) now.setDate(now.getDate() - val);
    else if (unit.startsWith('hafta')) now.setDate(now.getDate() - val * 7);
    else if (unit.startsWith('ay')) now.setMonth(now.getMonth() - val);
    else if (unit.startsWith('yıl')) now.setFullYear(now.getFullYear() - val);
    return now.toISOString();
  }
  if (lower.includes('dün')) {
    now.setDate(now.getDate() - 1);
    return now.toISOString();
  }

  return now.toISOString();
}

function detectLanguage(text: string): 'tr' | 'en' | 'de' | 'ru' {
  const commentLower = (text || '').toLowerCase();
  
  // A. Kiril karakter kontrolü (Rusça için en kesin belirteç)
  const cyrillicRegex = /[\u0400-\u04FF]/;
  if (cyrillicRegex.test(text || '')) {
    return 'ru';
  }

  // B. Türkçe karakter kontrolü (ş, ı, ğ, ç, ö, ü)
  const turkishSpecialRegex = /[şığç]/;
  if (turkishSpecialRegex.test(commentLower)) {
    return 'tr';
  }

  // C. Almanca karakter kontrolü (ä, ß)
  const germanSpecialRegex = /[äß]/;
  if (germanSpecialRegex.test(commentLower)) {
    return 'de';
  }

  // D. Kelime bazlı puanlama
  const trWords = ["çok", "iyi", "otel", "personel", "harika", "oda", "temiz", "güzel", "yemek", "konum", "memnun", "tavsiye", "değil", "ama", "ancak", "servis", "memnuniyet", "banyo", "konfor", "havuz", "spa", "rezervasyon"];
  const deWords = ["sehr", "gut", "hotel", "zimmer", "freundlich", "sauber", "schön", "essen", "lage", "zufrieden", "empfehlen", "nicht", "aber", "service", "frühstück", "bad", "komfort", "pool", "wellness", "buchung", "und", "der", "die", "das", "ist", "in", "mit"];
  const ruWords = ["очень", "хорошо", "отель", "номер", "персонал", "чисто", "красиво", "еда", "расположение", "доволен", "рекомендую", "не", "но", "сервис", "бассейн", "бронирование"];
  const enWords = ["very", "good", "hotel", "room", "friendly", "clean", "nice", "food", "location", "happy", "recommend", "not", "but", "service", "breakfast", "pool", "spa", "staff", "booking", "and", "the", "with", "was", "for", "stay"];

  let trScore = 0;
  let deScore = 0;
  let ruScore = 0;
  let enScore = 0;

  trWords.forEach(w => {
    const regex = new RegExp(`\\b${w}\\b`, 'g');
    const matches = commentLower.match(regex);
    if (matches) trScore += matches.length;
  });

  deWords.forEach(w => {
    const regex = new RegExp(`\\b${w}\\b`, 'g');
    const matches = commentLower.match(regex);
    if (matches) deScore += matches.length;
  });

  ruWords.forEach(w => {
    const regex = new RegExp(`\\b${w}\\b`, 'g');
    const matches = commentLower.match(regex);
    if (matches) ruScore += matches.length;
  });

  enWords.forEach(w => {
    const regex = new RegExp(`\\b${w}\\b`, 'g');
    const matches = commentLower.match(regex);
    if (matches) enScore += matches.length;
  });

  if (trScore === 0 && deScore === 0 && ruScore === 0 && enScore === 0) {
    if (/[öü]/i.test(commentLower)) {
      if (/\b(und|ist|in|die|der|das)\b/i.test(commentLower)) {
        return 'de';
      }
      return 'tr';
    }
  }

  const maxScore = Math.max(trScore, deScore, ruScore, enScore);
  if (maxScore > 0) {
    if (maxScore === trScore) return 'tr';
    if (maxScore === deScore) return 'de';
    if (maxScore === ruScore) return 'ru';
    return 'en';
  }

  return 'en';
}

function logPlatformError(platform: string, action: string, req: any, status: number, responseText: string, elapsedMs: number, error: any) {
  console.error(`[Platform Sync Error] Platform: ${platform} | Action: ${action}`);
  console.error(`- Request Body: ${JSON.stringify(req.body || {})}`);
  console.error(`- Response Status: ${status}`);
  console.error(`- Response Text: ${responseText}`);
  console.error(`- Elapsed Time: ${elapsedMs}ms`);
  console.error(`- Stack Trace:`, error?.stack || error);
}

async function translateText(text: string, targetLang: string): Promise<string> {
  const sourceLang = detectLanguage(text);
  if (sourceLang === targetLang) {
    console.log(`[Translate API] Source language equals target language (${sourceLang} === ${targetLang}). Returning original text directly.`);
    return text;
  }

  const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
  const langNames: Record<string, string> = {
    tr: 'Turkish',
    en: 'English',
    ru: 'Russian'
  };
  const targetLangName = langNames[targetLang] || 'Turkish';

  if (apiKey) {
    try {
      console.log(`[Translate API] Translating via OpenAI to ${targetLangName}...`);
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `Translate the following review faithfully and completely into ${targetLangName}. Do not summarize, do not rewrite, do not omit details. Preserve Liked/Disliked structure.`
            },
            {
              role: 'user',
              content: text
            }
          ],
          temperature: 0.3
        })
      });

      if (response.ok) {
        const data = await response.json();
        let translated = data.choices?.[0]?.message?.content?.trim();
        if (translated) {
          if (targetLang === 'tr') {
            translated = translated
              .replace(/Liked:/gi, 'Beğenilen:')
              .replace(/Disliked:/gi, 'Beğenilmeyen:');
          }
          return translated;
        }
      } else {
        const errText = await response.text();
        console.warn('[Translate API] OpenAI translation failed, falling back to MyMemory:', errText);
      }
    } catch (e) {
      console.warn('[Translate API] OpenAI exception, falling back to MyMemory:', e);
    }
  }

  // Helper to split text into chunks below character limit
  function chunkText(str: string, maxLen: number = 400): string[] {
    if (str.length <= maxLen) return [str];
    const sentences = str.split(/(?<=[.!?])\s+/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if ((currentChunk + ' ' + sentence).trim().length <= maxLen) {
        currentChunk = (currentChunk + ' ' + sentence).trim();
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        if (sentence.length > maxLen) {
          const words = sentence.split(/\s+/);
          let tempChunk = '';
          for (const word of words) {
            if ((tempChunk + ' ' + word).trim().length <= maxLen) {
              tempChunk = (tempChunk + ' ' + word).trim();
            } else {
              if (tempChunk) chunks.push(tempChunk);
              tempChunk = word;
            }
          }
          currentChunk = tempChunk;
        } else {
          currentChunk = sentence;
        }
      }
    }
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    return chunks;
  }

  // Fallback to MyMemory translation API with chunking support
  try {
    console.log(`[Translate API] Translating via MyMemory chunks from ${sourceLang} to ${targetLang}...`);
    const chunks = chunkText(text, 400);
    let successCount = 0;

    const translatedChunks = await Promise.all(
      chunks.map(async (chunk) => {
        try {
          const encodedText = encodeURIComponent(chunk);
          const url = `https://api.mymemory.translated.net/get?q=${encodedText}&langpair=${sourceLang}|${targetLang}`;
          const response = await fetch(url);
          if (response.ok) {
            const data = await response.json();
            const translated = data.matches?.[0]?.translation || data.responseData?.translatedText;
            if (translated && !translated.includes('MYMEMORY WARNING')) {
              successCount++;
              return translated;
            }
          }
        } catch (e) {
          console.warn('[Translate API] Chunk translation failed, returning original:', e);
        }
        return chunk; // Fallback to original chunk if translation failed
      })
    );

    if (successCount === 0) {
      return 'Çeviri yapılamadı.';
    }

    return translatedChunks.join(' ');
  } catch (err) {
    console.error('[Translate API] MyMemory translation error:', err);
  }

  return 'Çeviri yapılamadı.';
}

interface CategorySummary {
  category: string;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  totalCount: number;
  negativeRatio: number;
  positiveRatio: number;
  topPositiveKeywords: string[];
  topNegativeKeywords: string[];
  samplePositiveReviews: string[];
  sampleNegativeReviews: string[];
  confidenceScore: number;
  subtopicsMatched: string[];
}

function buildCategorySummaries(reviews: Array<{ comment: string; rating: number; sentiment: string }>): CategorySummary[] {
  const taxonomy: Record<string, { name: string; keywords: Record<string, string[]> }> = {
    ROOM: {
      name: 'Oda',
      keywords: {
        klima: ['klima', 'ac', 'soğutma', 'ısıtma', 'air conditioning', 'ventilation', 'havalandırma'],
        'ses yalıtımı': ['ses yalıtımı', 'gürültü', 'gürültülü', 'yalıtım', 'noise', 'sound', 'sesler'],
        yatak: ['yatak', 'bed', 'pillow', 'yastık', 'çarşaf', 'sheets', 'comfort', 'konfor'],
        banyo: ['banyo', 'duş', 'shower', 'bathroom', 'wc', 'tuvalet'],
        balkon: ['balkon', 'balcony'],
        manzara: ['manzara', 'view']
      }
    },
    CLEANLINESS: {
      name: 'Temizlik',
      keywords: {
        'oda temizliği': ['oda temiz', 'oda temizliği', 'çarşaf temiz', 'housekeeping', 'cleanliness'],
        'banyo temizliği': ['banyo temiz', 'duş temiz', 'banyo kirli'],
        havlu: ['havlu', 'çarşaf', 'towel', 'linen'],
        'ortak alan': ['ortak alan', 'lobi temiz', 'genel temizlik', 'hijyen', 'kirli', 'pis', 'dirty', 'dust', 'toz']
      }
    },
    FOOD: {
      name: 'Yiyecek & İçecek',
      keywords: {
        kahvaltı: ['kahvaltı', 'breakfast'],
        'açık büfe': ['açık büfe', 'buffet'],
        'akşam yemeği': ['akşam yemeği', 'yemekler', 'dinner', 'restaurant', 'restoran'],
        lezzet: ['lezzet', 'delicious', 'tat', 'tadı', 'lezzetli', 'lezzetsiz'],
        çeşitlilik: ['çeşit', 'variety', 'alternatif'],
        'servis hızı': ['servis hızı', 'garson', 'mutfak', 'yavaş servis', 'waiter']
      }
    },
    STAFF: {
      name: 'Personel',
      keywords: {
        'güler yüz': ['güler yüz', 'friendly', 'smiling'],
        yardımseverlik: ['yardımsever', 'helpful', 'ilgi'],
        ilgilesizlik: ['ilgilenmedi', 'ilgisiz', 'unfriendly', 'rude', 'umursamaz'],
        'çözüm hızı': ['çözüm', 'hızlı yardımcı', 'solve', 'destek']
      }
    },
    RECEPTION: {
      name: 'Resepsiyon',
      keywords: {
        'check-in': ['check-in', 'check in', 'giriş', 'checkin'],
        bekleme: ['bekleme', 'sıra', 'waiting', 'queue', 'bekledik'],
        karşılama: ['karşılama', 'welcome', 'ikram'],
        'check-out': ['check-out', 'check out', 'çıkış', 'checkout']
      }
    },
    LOCATION: {
      name: 'Konum',
      keywords: {
        konum: ['konum', 'location', 'yer'],
        ulaşım: ['ulaşım', 'taksi', 'otobüs', 'yakın', 'mesafe'],
        manzara: ['manzara', 'view'],
        plaj: ['plaj', 'beach', 'deniz', 'sea'],
        merkez: ['merkez', 'çarşı', 'center', 'downtown']
      }
    },
    WIFI: {
      name: 'Wi-Fi',
      keywords: {
        hız: ['hız', 'yavaş', 'slow', 'fast', 'speed'],
        kopma: ['kopma', 'bağlanmıyor', 'kesiliyor', 'kopuyor', 'disconnect'],
        kapsama: ['çekmiyor', 'oda wifi', 'signal', 'sinyal']
      }
    },
    SPA: {
      name: 'Spa',
      keywords: {
        hamam: ['hamam', 'turkish bath'],
        sauna: ['sauna'],
        masaj: ['masaj', 'massage', 'terapist'],
        temizlik: ['spa temizlik', 'hijyen']
      }
    },
    POOL: {
      name: 'Havuz',
      keywords: {
        havuz: ['havuz', 'pool', 'kaydırak'],
        şezlong: ['şezlong', 'şemsiye', 'sunbed'],
        temizlik: ['havuz temiz', 'klor']
      }
    },
    PRICE: {
      name: 'Fiyat',
      keywords: {
        fiyat: ['fiyat', 'pahalı', 'expensive', 'cheap', 'ucuz', 'odeme', 'ödeme', 'price'],
        değer: ['değer', 'worth', 'fiyat performans', 'price quality'],
        'ekstra ücret': ['ekstra ücret', 'ücretli', 'paralı', 'charge']
      }
    },
    SERVICE: {
      name: 'Hizmet',
      keywords: {
        'genel hizmet': ['hizmet', 'servis', 'service'],
        iletişim: ['iletişim', 'telefon', 'call', 'communication'],
        sipariş: ['sipariş', 'order'],
        hız: ['hız', 'yavaş', 'bekledik', 'speed']
      }
    }
  };

  const summaries: CategorySummary[] = Object.keys(taxonomy).map(catKey => {
    return {
      category: catKey,
      positiveCount: 0,
      negativeCount: 0,
      neutralCount: 0,
      totalCount: 0,
      negativeRatio: 0,
      positiveRatio: 0,
      topPositiveKeywords: [],
      topNegativeKeywords: [],
      samplePositiveReviews: [],
      sampleNegativeReviews: [],
      confidenceScore: 0,
      subtopicsMatched: []
    };
  });

  reviews.forEach(r => {
    const text = (r.comment || '').toLowerCase();
    const isPos = r.rating >= 4 || r.sentiment === 'positive';
    const isNeg = r.rating <= 2 || r.sentiment === 'negative';
    const isNeu = !isPos && !isNeg;

    Object.entries(taxonomy).forEach(([catKey, catData]) => {
      const summary = summaries.find(s => s.category === catKey)!;
      let matchedAny = false;
      const matchedSubtopics: string[] = [];

      Object.entries(catData.keywords).forEach(([subtopic, keywords]) => {
        const matches = keywords.some(kw => text.includes(kw));
        if (matches) {
          matchedAny = true;
          if (!matchedSubtopics.includes(subtopic)) {
            matchedSubtopics.push(subtopic);
          }
          if (isPos) {
            if (summary.topPositiveKeywords.length < 5 && !summary.topPositiveKeywords.includes(subtopic)) {
              summary.topPositiveKeywords.push(subtopic);
            }
          } else if (isNeg) {
            if (summary.topNegativeKeywords.length < 5 && !summary.topNegativeKeywords.includes(subtopic)) {
              summary.topNegativeKeywords.push(subtopic);
            }
          }
        }
      });

      if (matchedAny) {
        summary.totalCount++;
        if (isPos) {
          summary.positiveCount++;
          if (summary.samplePositiveReviews.length < 2 && r.comment && r.comment.length > 10) {
            summary.samplePositiveReviews.push(r.comment.slice(0, 150));
          }
        } else if (isNeg) {
          summary.negativeCount++;
          if (summary.sampleNegativeReviews.length < 2 && r.comment && r.comment.length > 10) {
            summary.sampleNegativeReviews.push(r.comment.slice(0, 150));
          }
        } else {
          summary.neutralCount++;
        }

        matchedSubtopics.forEach(sub => {
          if (!summary.subtopicsMatched.includes(sub)) {
            summary.subtopicsMatched.push(sub);
          }
        });
      }
    });
  });

  return summaries
    .map(s => {
      if (s.totalCount > 0) {
        s.positiveRatio = Number((s.positiveCount / s.totalCount).toFixed(2));
        s.negativeRatio = Number((s.negativeCount / s.totalCount).toFixed(2));
        s.confidenceScore = Number(Math.min(1.0, s.totalCount / 10).toFixed(2));
      }
      return s;
    })
    .filter(s => s.totalCount > 0);
}

function compileLocalInsights(reviews: Array<{ comment: string; rating: number; sentiment: string }>) {
  const summaries = buildCategorySummaries(reviews);

  // 1. 5 Issues
  const sortedNegatives = [...summaries]
    .filter(s => s.negativeCount > 0)
    .sort((a, b) => {
      if (b.negativeCount !== a.negativeCount) return b.negativeCount - a.negativeCount;
      return b.negativeRatio - a.negativeRatio;
    });

  const categoryNames: Record<string, string> = {
    ROOM: 'Oda',
    CLEANLINESS: 'Temizlik',
    FOOD: 'Yiyecek & İçecek',
    STAFF: 'Personel',
    RECEPTION: 'Resepsiyon',
    LOCATION: 'Konum',
    WIFI: 'Wi-Fi',
    SPA: 'Spa',
    POOL: 'Havuz',
    PRICE: 'Fiyat',
    SERVICE: 'Hizmet',
    OTHER: 'Diğer'
  };

  const issueTitles: Record<string, string> = {
    ROOM: 'Klima ve Ses Yalıtımı Yetersizlikleri',
    CLEANLINESS: 'Oda ve Banyo Hijyen Şikayetleri',
    FOOD: 'Kahvaltı Çeşitliliği ve Servis Hızı',
    STAFF: 'Personel Yoğunluğu ve İletişim Aksaklıkları',
    RECEPTION: 'Check-in Giriş Sırası ve Bekleme Süresi',
    LOCATION: 'Çevre Ulaşım ve Sokak Gürültüsü',
    WIFI: 'Wi-Fi Bağlantı Hızı ve Kopma Sorunları',
    SPA: 'Spa Alanı Hijyeni ve Havalandırma',
    POOL: 'Havuz Hijyeni ve Şezlong Yetersizliği',
    PRICE: 'Ekstra Hizmetlerin Fiyat Yüksekliği',
    SERVICE: 'Sipariş ve Oda Servisi Gecikmeleri',
    OTHER: 'Tesis Operasyonel Hizmet Aksaklıkları'
  };

  const issueSummaries: Record<string, string> = {
    ROOM: 'Odalardaki klima soğutma/ısıtma performansı ve pencerelerden gelen dış gürültü şikayetleri misafir konforunu olumsuz etkilemektedir.',
    CLEANLINESS: 'Odalarda banyo hijyeni, genel tozlanma ve havlu değişimlerindeki gecikmeler misafirler tarafından olumsuz puanlanmıştır.',
    FOOD: 'Açık büfe yiyecek çeşitliliğinin az olması ve restoran siparişlerinin masaya geç ulaşması şikayet konusu olmuştur.',
    STAFF: 'Yoğun dönemlerde çalışanların ilgisizliği ve hizmet taleplerine dönüş hızlarındaki yavaşlık memnuniyetsizlik yaratmaktadır.',
    RECEPTION: 'Giriş (check-in) saatlerindeki resepsiyon önü birikmeleri ve bekleme süreleri misafir karşılama deneyimini zedelemektedir.',
    LOCATION: 'Tesis çevresindeki ses yalıtım yetersizlikleri ve toplu ulaşıma/merkeze olan mesafe şikayet edilmiştir.',
    WIFI: 'Odalar içindeki internet bağlantı kopmaları ve düşük ağ hızı misafirlerin iş ve dijital kullanımlarını kısıtlamaktadır.',
    SPA: 'Spa hamam sıcaklık ayarları ile dinlenme alanlarındaki dezenfeksiyon standartları iyileştirme beklemektedir.',
    POOL: 'Havuz suyunun klor dengesi, havuz çevresi temizliği ve şezlong kapasitesinin kısıtlı olması eleştirilmektedir.',
    PRICE: 'Oda fiyatlarına oranla ekstra sunulan hizmet ve ürünlerin fiyat dengesi misafirler tarafından yüksek bulunmuştur.',
    SERVICE: 'Oda servisi hızındaki gecikmeler ve genel sipariş teslimat süreçlerindeki kopukluklar memnuniyetsizlik yaratmıştır.',
    OTHER: 'Tesis genelindeki diğer operasyonel hizmetlerde aksamalar ve yavaşlıklar bildirilmiştir.'
  };

  const highlightTitles: Record<string, string> = {
    ROOM: 'Oda Donanımı ve Yatak Konforu',
    CLEANLINESS: 'Oda ve Genel Alan Hijyen Kalitesi',
    FOOD: 'Restoran Lezzet Standartları',
    STAFF: 'Personel Güler Yüzü ve İlgi',
    RECEPTION: 'Hızlı ve Sorunsuz Check-in Süreci',
    LOCATION: 'Konum Avantajı ve Turistik Ulaşım',
    WIFI: 'Ücretsiz Yüksek Hızlı İnternet Erişimi',
    SPA: 'Kaliteli Masaj ve Profesyonel Spa Deneyimi',
    POOL: 'Geniş Havuz ve Plaj İmkânları',
    PRICE: 'Fiyat Performans Memnuniyeti',
    SERVICE: 'Genel Hizmet Standartları',
    OTHER: 'Huzurlu Tesis Peyzajı ve Düzeni'
  };

  const highlightSummaries: Record<string, string> = {
    ROOM: 'Geniş ve manzaralı odalar, yatak kalitesi ve banyo düzeni misafirlerimizin en çok takdir ettiği özellikler arasındadır.',
    CLEANLINESS: 'Odalarda ve tüm ortak alanlarda sergilenen üst düzey temizlik standartları misafirlerin kendilerini güvende hissetmelerini sağlamaktadır.',
    FOOD: 'Açık büfe akşam yemeklerindeki lezzet kalitesi ve sunum zenginliği misafirlerden pozitif yorumlar almaktadır.',
    STAFF: 'Çalışanlarımızın güler yüzlü, proaktif ve samimi yaklaşımları misafirlerimizin konaklama deneyimini doğrudan taçlandırmaktadır.',
    RECEPTION: 'Resepsiyondaki hızlı karşılama süreci ve ikram eşliğinde yapılan check-in işlemleri olumlu izlenim oluşturmuştur.',
    LOCATION: 'Otelin plaja yakınlığı, merkezi noktalara ve turistik alanlara olan elverişli mesafesi büyük bir memnuniyet sebebidir.',
    WIFI: 'Misafirlerimiz tesis genelinde sunulan kablosuz internetin bağlantı kalitesini ve hızını memnuniyetle belirtmiştir.',
    SPA: 'Profesyonel terapistler tarafından sunulan masaj hizmetleri ve spa alanındaki sakinlik misafirlerimizin beğenisini toplamıştır.',
    POOL: 'Havuzun büyüklüğü, çocuk kaydırakları ve plaj kullanım imkânları konaklamaya keyif katmaktadır.',
    PRICE: 'Ödenen konaklama ücretinin sunulan tesis olanakları ve hizmet standartları karşısındaki dengesi misafirlerimizce takdir edilmiştir.',
    SERVICE: 'Otel içi genel hizmetlerin sunum kalitesi ve iletişim hızı misafirlerimizden olumlu not almıştır.',
    OTHER: 'Peyzaj düzenlemesi, bahçe bakımı ve ortak alanlardaki konforlu dinlenme köşeleri huzurlu bir ortam sunmaktadır.'
  };

  const issues = sortedNegatives.slice(0, 5).map(s => {
    const title = issueTitles[s.category] || 'Operasyonel İyileştirme Fırsatı';
    const summary = issueSummaries[s.category] || 'Tesis hizmetlerinde iyileştirilmesi gereken alanlar tespit edilmiştir.';
    return {
      title,
      summary,
      description: summary,
      category: s.category,
      subtopics: s.subtopicsMatched,
      count: s.totalCount,
      sentimentRatio: s.negativeRatio,
      confidence: s.confidenceScore
    };
  });

  // 2. 5 Highlights
  const sortedPositives = [...summaries]
    .filter(s => s.positiveCount > 0)
    .sort((a, b) => {
      if (b.positiveCount !== a.positiveCount) return b.positiveCount - a.positiveCount;
      return b.positiveRatio - a.positiveRatio;
    });

  const highlightsList: any[] = [];
  
  sortedPositives.forEach(s => {
    if (highlightsList.length >= 5) return;
    
    const catName = categoryNames[s.category] || s.category;
    const isConflict = issues.some(issue => issue.category === s.category);
    
    let title = highlightTitles[s.category] || 'Tesis Memnuniyeti';
    let summary = '';
    
    if (isConflict) {
      const topNegSub = s.topNegativeKeywords.slice(0, 2).join(' ve ');
      summary = `${catName} kategorisinde genel memnuniyet yüksek; ancak ${topNegSub || 'bazı alt'} başlıklarında tekrar eden şikayetler var.`;
    } else {
      summary = highlightSummaries[s.category] || 'Misafirlerin beğenisini toplayan genel tesis imkanları.';
    }

    highlightsList.push({
      title,
      summary,
      description: summary,
      category: s.category,
      subtopics: s.subtopicsMatched,
      count: s.totalCount,
      sentimentRatio: s.positiveRatio,
      confidence: s.confidenceScore
    });
  });

  const highlights = highlightsList;

  // 3. Actions (Exactly 10 items)
  const actionTemplates: Record<string, { title: string; summary: string }> = {
    ROOM: {
      title: 'Klima soğutma yetersizliği ve ses yalıtımı revizyonu',
      summary: 'Oda klima filtre temizlikleri hızlandırılmalı, kapı altı fitilleri yenilenerek ses yalıtımı güçlendirilmelidir.'
    },
    CLEANLINESS: {
      title: 'Kat hizmetleri banyo hijyen denetimi',
      summary: 'Odalarda ve banyolarda detaylı temizlik kontrol listesi (checklist) güncellenmeli ve denetim sıklığı artırılmalıdır.'
    },
    FOOD: {
      title: 'Kahvaltıda sıcak çeşitliliği ve servis hızı artırılması',
      summary: 'Açık büfe menüsüne sıcak alternatifler eklenmeli ve yoğun kahvaltı saatlerinde mutfak-servis koordinasyonu güçlendirilmelidir.'
    },
    STAFF: {
      title: 'Personel iletişim ve güler yüz eğitimleri',
      summary: 'Tüm departmanlara yönelik müşteri ilişkileri, empati ve yoğun dönem kriz yönetimi eğitimleri planlanmalıdır.'
    },
    RECEPTION: {
      title: 'Check-in sırasında bekleme süresi iyileştirmesi',
      summary: 'Giriş yoğunluğunu azaltmak amacıyla pik saatlerde resepsiyon desk kadrosuna takviye yapılmalı ve online giriş seçenekleri sunulmalıdır.'
    },
    LOCATION: {
      title: 'Çevre gürültüsü engelleme fitil kontrolleri',
      summary: 'Gürültü şikayetlerini azaltmak için odaların pencere izolasyon fitilleri elden geçirilmeli, misafirlere ulaşım rehberi sunulmalıdır.'
    },
    WIFI: {
      title: 'Wi-Fi bağlantı kopmaları ve hız tespiti',
      summary: 'Odalardaki kablosuz ağ erişim noktalarının (AP) sinyal gücü ölçülmeli ve network bant genişliği artırılmalıdır.'
    },
    SPA: {
      title: 'Spa dinlenme alanları ve hamam dezenfeksiyonu',
      summary: 'Spa departmanındaki sauna ve hamam alanlarında temizlik periyodu sıklaştırılmalı ve ısı dereceleri optimize edilmelidir.'
    },
    POOL: {
      title: 'Havuz temizlik klor ölçümü ve şezlong takviyesi',
      summary: 'Havuz suyu ölçümleri gün içine yayılarak kontrol altında tutulmalı, yoğun dönemler için şezlong sayısı artırılmalıdır.'
    },
    PRICE: {
      title: 'Ekstra hizmet ücretlendirmelerinde şeffaflık',
      summary: 'Ekstra ürün ve hizmet ücret politikaları misafirlere önceden bildirilmeli ve fiyat-değer dengesi revize edilmelidir.'
    },
    SERVICE: {
      title: 'Oda servisi ve mutfak sipariş hızlandırılması',
      summary: 'Oda servis siparişlerinin masaya ulaşım süreleri analiz edilmeli ve departmanlar arası operasyonel gecikmeler gecikmeden giderilmelidir.'
    },
    OTHER: {
      title: 'Genel tesis bakım ve onarım planı',
      summary: 'Tesis genelinde bildirilen tüm aksaklıkların çözülmesi amacıyla periyodik bakım takvimi uygulanmalıdır.'
    }
  };

  const actions: any[] = [];
  
  // Use negative categories first
  sortedNegatives.forEach(s => {
    if (actions.length >= 10) return;
    const template = actionTemplates[s.category];
    if (template) {
      actions.push({
        title: template.title,
        summary: template.summary,
        description: template.summary,
        category: s.category,
        subtopics: s.subtopicsMatched,
        count: s.totalCount,
        sentimentRatio: s.negativeRatio,
        confidence: s.confidenceScore
      });
    }
  });

  // Use positive categories next
  sortedPositives.forEach(s => {
    if (actions.length >= 10) return;
    const template = actionTemplates[s.category];
    if (template && !actions.some(a => a.category === s.category)) {
      actions.push({
        title: template.title,
        summary: template.summary,
        description: template.summary,
        category: s.category,
        subtopics: s.subtopicsMatched,
        count: s.totalCount,
        sentimentRatio: s.positiveRatio,
        confidence: s.confidenceScore
      });
    }
  });

  // Fillers if still less than 10
  const defaultActions = [
    { title: 'Oda konfor standartlarının korunması', summary: 'Tekstil ve yatak takımları periyodik olarak kontrol edilerek yıpranmış ürünler değiştirilmelidir.', category: 'ROOM' },
    { title: 'Tesis bahçe peyzaj ve aydınlatma bakımları', summary: 'Genel alan peyzajı ve ortak yolların aydınlatma sistemleri teknik ekiplerce kontrol edilmelidir.', category: 'OTHER' },
    { title: 'Hızlı ve kolay check-out prosedürleri', summary: 'Misafirlerin otelden çıkış yaparken beklemesini önlemek için ekspres check-out sistemleri devreye alınmalıdır.', category: 'RECEPTION' }
  ];

  for (const act of defaultActions) {
    if (actions.length >= 10) break;
    actions.push({
      ...act,
      description: act.summary,
      subtopics: [],
      count: 0,
      sentimentRatio: 1.0,
      confidence: 1.0
    });
  }

  return { issues, highlights, actions };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = req.query.action || req.body?.action || 'import';

  if (action === 'health') {
    return res.status(200).json({ success: true, runtime: "ok" });
  }

  // Authorization check
  let user: any = null;
  if (action !== 'cleanup-sinnada-duplicates') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authUser) {
      return res.status(401).json({ success: false, error: 'Invalid authentication token' });
    }
    user = authUser;
  }

  // Route to experimental Otelpuan test scraper (Admin-only authenticated access)
  const isOtelpuanTest = req.url?.includes('/otelpuan/test') || action === 'otelpuan-test';
  if (isOtelpuanTest) {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
    }
    const { data: userRolesData } = await supabaseAdmin.from('user_roles').select('*, roles(name)').eq('profile_id', user.id);
    let userRole = userRolesData?.[0]?.roles?.name;
    if (user.email === 'admin@ecctur.ai' || user.email === 'cemil.sezgin@ecctur.com') {
      userRole = 'Super Admin';
    }
    const roleNameLower = (userRole || 'staff').toLowerCase();
    if (roleNameLower !== 'admin' && roleNameLower !== 'super admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin access required for test endpoint.' });
    }

    const { hotelUrl, maxReviews } = req.body || {};
    if (!hotelUrl) {
      return res.status(400).json({ success: false, error: 'Missing hotelUrl parameter in request body' });
    }
    try {
      const result = await otelpuanScraperService.scrapeReviews({
        hotelUrl,
        maxReviews: maxReviews ? Number(maxReviews) : 50
      });
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message || String(err) });
    }
  }

  // -------------------------------------------------------------
  // Action: review-action
  // -------------------------------------------------------------
  if (action === 'review-action') {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { reviewId, actionType, responseText, aiGenerated } = req.body;
    if (!reviewId || !actionType) {
      return res.status(400).json({ success: false, error: 'Missing reviewId or actionType parameter' });
    }

    try {
      // 1. Fetch the review
      const { data: review, error: revErr } = await supabaseAdmin
        .from('reviews')
        .select('*')
        .eq('id', reviewId)
        .maybeSingle();

      if (revErr || !review) {
        return res.status(404).json({ success: false, error: 'Review not found' });
      }

      // 2. Tenant isolation check
      const { data: userRolesData } = await supabaseAdmin.from('user_roles').select('*, roles(name)').eq('profile_id', user.id);
      let userRole = userRolesData?.[0]?.roles?.name;
      if (user.email === 'admin@ecctur.ai' || user.email === 'cemil.sezgin@ecctur.com') {
        userRole = 'Super Admin';
      }
      const roleKey = (userRole || 'staff').toLowerCase();

      // Check organization membership & hotel assignment
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (roleKey !== 'super_admin' && roleKey !== 'admin' && roleKey !== 'owner') {
        const { data: userHotels } = await supabaseAdmin
          .from('user_hotels')
          .select('hotel_id')
          .eq('profile_id', user.id)
          .eq('hotel_id', review.hotel_id);

        if (!userHotels || userHotels.length === 0) {
          return res.status(403).json({ success: false, error: 'Forbidden: You do not have access to this hotel\'s reviews.' });
        }
      }

      const userName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'User';

      // 3. Perform database updates on public.reviews
      let updateData: any = { updated_at: new Date().toISOString() };
      let prevStatus = review.status;
      let newStatus = review.status;

      if (actionType === 'approved') {
        newStatus = 'Approved';
        updateData.status = 'Approved';
      } else if (actionType === 'published') {
        newStatus = 'Published';
        updateData.status = 'Published';
        updateData.publish_status = 'Published';
        updateData.published = 'Yes';
        if (responseText) {
          updateData.ai_reply = responseText;
        }
      } else if (actionType === 'sent_to_whatsapp') {
        newStatus = 'Pending Approval';
        updateData.status = 'Pending Approval';
      } else if (actionType === 'regenerated') {
        newStatus = 'Draft';
        updateData.status = 'Draft';
        if (responseText) {
          updateData.ai_reply = responseText;
        }
      } else if (actionType === 'edited') {
        newStatus = 'Draft';
        updateData.status = 'Draft';
        if (responseText) {
          updateData.ai_reply = responseText;
        }
      }

      const { data: updatedReview, error: updateErr } = await supabaseAdmin
        .from('reviews')
        .update(updateData)
        .eq('id', reviewId)
        .select('*')
        .maybeSingle();

      if (updateErr || !updatedReview) {
        throw new Error(updateErr?.message || 'Failed to update review record');
      }

      // 4. Create review_action_logs audit log
      const { error: logErr } = await supabaseAdmin.from('review_action_logs').insert({
        review_id: reviewId,
        hotel_id: review.hotel_id,
        organization_id: review.organization_id,
        action_type: actionType,
        action_by_user_id: user.id,
        action_by_user_email: user.email,
        action_by_user_name: userName,
        action_at: new Date().toISOString(),
        previous_status: prevStatus,
        new_status: newStatus,
        platform: review.platform,
        guest_name: review.guest_name,
        review_reply_text: responseText || review.ai_reply || review.response || null,
        ai_generated: !!aiGenerated || actionType === 'regenerated',
        whatsapp_sent_at: actionType === 'sent_to_whatsapp' ? new Date().toISOString() : null,
        published_at: actionType === 'published' ? new Date().toISOString() : null,
        approved_at: actionType === 'approved' ? new Date().toISOString() : null,
        ip_address: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || null,
        user_agent: req.headers['user-agent'] || null
      });

      if (logErr) {
        console.error('[review-action] Failed to create action log:', logErr);
      }

      return res.status(200).json({ success: true, review: updatedReview });
    } catch (err: any) {
      console.error('[API review-action] Failure:', err);
      return res.status(500).json({ success: false, error: err.message || String(err) });
    }
  }

  // -------------------------------------------------------------
  // Action: translate-review
  // -------------------------------------------------------------
  if (action === 'translate-review') {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { text, targetLanguage } = req.body;
    if (!text || !targetLanguage) {
      return res.status(400).json({ success: false, error: 'Missing text or targetLanguage parameter in request body.' });
    }

    try {
      const translatedText = await translateText(text, targetLanguage);
      return res.status(200).json({ success: true, translatedText });
    } catch (err: any) {
      console.error('[API translate-review] Failure:', err);
      return res.status(500).json({ success: false, error: 'Translation failed', details: err.message || String(err) });
    }
  }

  // -------------------------------------------------------------
  // Action: analyze-review
  // -------------------------------------------------------------
  if (action === 'analyze-review') {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { reviewId } = req.body;
    if (!reviewId) {
      return res.status(400).json({ success: false, error: 'Missing reviewId parameter in request body.' });
    }

    try {
      // 1. Fetch the review
      const { data: review, error: revErr } = await supabaseAdmin
        .from('reviews')
        .select('*')
        .eq('id', reviewId)
        .maybeSingle();

      if (revErr || !review) {
        return res.status(404).json({ success: false, error: 'Review not found' });
      }

      const reviewText = review.review_text || review.comment_text || '';
      const rating = review.rating || 5;

      const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '';

      // 2. Perform operations analysis V2
      const analysis = await analyzeReviewText(reviewText, rating, apiKey);

      // 3. Save to database
      const updateData = {
        ai_operation_analysis: analysis,
        ai_operation_analysis_version: '2.0',
        ai_operation_analysis_updated_at: new Date().toISOString(),
        ai_operation_analysis_model: process.env.AI_OPERATIONS_MODEL || 'gpt-4o',
        ai_operation_analysis_confidence: analysis.confidence,
        updated_at: new Date().toISOString()
      };

      const { data: updatedReview, error: updateErr } = await supabaseAdmin
        .from('reviews')
        .update(updateData)
        .eq('id', reviewId)
        .select('*')
        .single();

      if (updateErr) {
        throw updateErr;
      }

      return res.status(200).json({ success: true, review: updatedReview });
    } catch (err: any) {
      console.error('[API analyze-review] Failure:', err);
      return res.status(500).json({ success: false, error: 'Analysis failed', details: err.message || String(err) });
    }
  }

  // -------------------------------------------------------------
  // Action: generate-insights (AI Business Insights Compiler)
  // -------------------------------------------------------------
  if (action === 'generate-insights') {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { reviews = [] } = req.body;
    
    // Minimum reviews threshold check
    if (reviews.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'insufficient_data',
        message: 'Analiz için yeterli veri yok. En az 10 yorum gereklidir.'
      });
    }

    const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
    const summaries = buildCategorySummaries(reviews);

    if (apiKey && summaries.length > 0) {
      try {
        console.log(`[Insights API] Generating business insights via OpenAI for ${reviews.length} reviews using structured summaries...`);

        const prompt = `
You are a hospitality Business Intelligence expert. Analyze the following categorySummary JSON data compiled from guest reviews:
${JSON.stringify(summaries)}

Your task is to generate:
1. Top 5 operational issues/complaints ("issues")
2. Top 5 positive highlights/praises ("highlights")
3. Exactly 10 strategic, prioritized action recommendations ("actions")

CRITICAL RULES:
1. MUTUALLY EXCLUSIVE CATEGORIES: Do NOT repeat the same category in both "issues" and "highlights" lists.
If a category has high positive counts but also has negative issues (mixed feedback), you must NOT list it as a positive highlight. Instead, if you do mention it in highlights, use the following description/summary format:
"[CategoryName] kategorisinde genel memnuniyet yüksek; ancak [Subtopic1] ve [Subtopic2] alt başlıklarında tekrar eden şikayetler var." (e.g., "Oda kategorisinde genel memnuniyet yüksek; ancak klima ve ses yalıtımı alt başlıklarında tekrar eden şikayetler var.")
2. SPECIFIC & ACTIONABLE TITLES: Write specific, actionable titles in Turkish. Avoid generic titles.
Kötü örnek: "Hizmet standartları ve iletişim"
İyi örnek: "Check-in sırasında bekleme süresi", "Kahvaltıda çeşit azlığı", "Klima soğutma yetersizliği"
3. All titles and summaries must be in Turkish.
4. Each object in "issues", "highlights", and "actions" must contain exactly these fields:
- "title": Specific and actionable title.
- "summary": A detailed BI description.
- "category": The matched main category key (e.g. ROOM, CLEANLINESS, FOOD, STAFF, RECEPTION, LOCATION, WIFI, SPA, POOL, PRICE, SERVICE, OTHER).
- "subtopics": Array of matched subtopics strings.
- "count": Number of reviews in this category.
- "sentimentRatio": The ratio of positive reviews for highlights, or negative reviews for issues (number between 0 and 1).
- "confidence": A confidence score based on data volume (number between 0 and 1).

Respond ONLY with a JSON object in this format (no markdown, no code block backticks, no extra text):
{
  "issues": [
    { "title": "Check-in Bekleme Süresi", "summary": "Giriş saatlerindeki resepsiyon bekleme süreleri misafir memnuniyetini olumsuz etkilemektedir.", "category": "RECEPTION", "subtopics": ["check-in", "bekleme"], "count": 12, "sentimentRatio": 0.75, "confidence": 0.9 }
  ],
  "highlights": [
    { "title": "Personel Güler Yüzü", "summary": "Çalışanların güler yüzlü yaklaşımı misafir memnuniyetini artırmaktadır.", "category": "STAFF", "subtopics": ["güler yüz"], "count": 25, "sentimentRatio": 0.88, "confidence": 1.0 }
  ],
  "actions": [
    { "title": "Klima soğutma yetersizliği giderilmesi", "summary": "Klima bakımlarının hızlandırılması planlanmalıdır.", "category": "ROOM", "subtopics": ["klima"], "count": 8, "sentimentRatio": 0.62, "confidence": 0.8 }
  ]
}
`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: 'You are an AI Business Intelligence hospitality expert. You strictly return JSON without backticks.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.3
          })
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content?.trim();
          if (content) {
            const cleaned = content.replace(/^```json/, '').replace(/```$/, '').trim();
            const parsed = JSON.parse(cleaned);
            if (parsed.issues && parsed.highlights && parsed.actions) {
              const mapFields = (item: any) => ({
                title: item.title || '',
                summary: item.summary || item.description || '',
                description: item.summary || item.description || '',
                category: item.category || 'OTHER',
                subtopics: item.subtopics || [],
                count: typeof item.count === 'number' ? item.count : 0,
                sentimentRatio: typeof item.sentimentRatio === 'number' ? item.sentimentRatio : 0,
                confidence: typeof item.confidence === 'number' ? item.confidence : 0
              });
              parsed.issues = (parsed.issues || []).map(mapFields);
              parsed.highlights = (parsed.highlights || []).map(mapFields);
              parsed.actions = (parsed.actions || []).map(mapFields);
              return res.status(200).json({ success: true, insights: parsed });
            }
          }
        } else {
          const errText = await response.text();
          console.warn('[Insights API] OpenAI failed, falling back to local compiler:', errText);
        }
      } catch (e) {
        console.warn('[Insights API] OpenAI exception, falling back to local compiler:', e);
      }
    }

    try {
      console.log(`[Insights API] Compiling local rules-based insights for ${reviews.length} reviews...`);
      const insights = compileLocalInsights(reviews);
      return res.status(200).json({ success: true, insights });
    } catch (err: any) {
      console.error('[API generate-insights] Local compile failure:', err);
      return res.status(500).json({ success: false, error: 'Insights compilation failed' });
    }
  }

  // -------------------------------------------------------------
  // Action: import (Google Profile Business API reviews)
  // -------------------------------------------------------------
  if (action === 'import') {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { hotelId, range = '365' } = req.body;
    let { googleReviews = [] } = req.body;

    if (!hotelId) {
      return res.status(400).json({ success: false, error: 'Missing hotelId parameter' });
    }

    try {
      const { data: userRolesData } = await supabaseAdmin.from('user_roles').select('*, roles(name)').eq('profile_id', user.id);
      let userRole = userRolesData?.[0]?.roles?.name;
      if (user.email === 'admin@ecctur.ai' || user.email === 'cemil.sezgin@ecctur.com') {
        userRole = 'Super Admin';
      }
      const roleNameLower = (userRole || 'staff').toLowerCase();

      if (roleNameLower !== 'super admin' && roleNameLower !== 'admin') {
        const { data: userHotels } = await supabaseAdmin.from('user_hotels').select('*').eq('profile_id', user.id).eq('hotel_id', hotelId);
        if (!userHotels || userHotels.length === 0) {
          return res.status(403).json({ success: false, error: 'Forbidden: You do not have clearance for this hotel.' });
        }
      }

      const { data: sampleRows } = await supabaseAdmin.from('hotels').select('id, organization_id, name, created_at, google_location_id, google_place_id, google_maps_url, google_maps_link').limit(1);
      const actualHotelCols = sampleRows && sampleRows.length > 0 ? Object.keys(sampleRows[0]) : ['id', 'organization_id', 'name', 'created_at', 'google_location_id', 'google_maps_url', 'google_maps_link'];
      const { data: sampleSettings } = await supabaseAdmin.from('integration_settings').select('*').limit(1);
      const actualSettingsCols = sampleSettings && sampleSettings.length > 0 ? Object.keys(sampleSettings[0]) : ['id', 'name', 'status', 'updated_at'];

      let googleLocationId: string | null = null;
      let googleMapsUrl: string | null = null;

      let hotelSelectFields = 'organization_id, name';
      if (actualHotelCols.includes('google_location_id')) hotelSelectFields += ', google_location_id';
      if (actualHotelCols.includes('google_place_id')) hotelSelectFields += ', google_place_id';
      if (actualHotelCols.includes('google_maps_url')) hotelSelectFields += ', google_maps_url';
      if (actualHotelCols.includes('google_maps_link')) hotelSelectFields += ', google_maps_link';

      const { data: hotelData, error: hotelErr } = await supabaseAdmin.from('hotels').select(hotelSelectFields).eq('id', hotelId).maybeSingle();
      if (hotelErr || !hotelData) {
        throw new Error(`Hotel lookup failed: ${hotelErr?.message || 'Hotel not found'}`);
      }

      const hotel = hotelData as any;
      const orgId = hotel.organization_id;

      if (hotel.google_location_id) googleLocationId = hotel.google_location_id;
      else if (hotel.google_place_id) googleLocationId = hotel.google_place_id;

      if (hotel.google_maps_url) googleMapsUrl = hotel.google_maps_url;
      else if (hotel.google_maps_link) googleMapsUrl = hotel.google_maps_link;

      if (!googleLocationId) {
        let settingsQuery = supabaseAdmin.from('integration_settings').select('*');
        if (actualSettingsCols.includes('hotel_id')) settingsQuery = settingsQuery.eq('hotel_id', hotelId);
        else if (actualSettingsCols.includes('organization_id')) settingsQuery = settingsQuery.eq('organization_id', orgId);
        else settingsQuery = settingsQuery.eq('id', 'google_business');

        const { data: settingsData } = await settingsQuery;
        const gSetting = settingsData?.find((s: any) => s.id === 'google_business' || s.provider === 'google');
        if (gSetting && actualSettingsCols.includes('config') && gSetting.config) {
          const configObj = typeof gSetting.config === 'string' ? JSON.parse(gSetting.config) : gSetting.config;
          if (configObj && configObj.google_location_id) {
            googleLocationId = configObj.google_location_id;
          }
        }
      }

      const useMockEnv = process.env.USE_MOCK_GOOGLE_PROVIDER;
      const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
      let isMock = isProduction ? false : (useMockEnv === 'true' ? true : useMockEnv === 'false' ? false : !googleLocationId);

      if (!googleLocationId) {
        if (isMock && googleMapsUrl) {
          console.log('[Import] Using hotels.google_maps_url fallback for mock/demo mode:', googleMapsUrl);
        } else {
          return res.status(400).json({
            success: false,
            error: 'Hotel has no Google Business mapping configured'
          });
        }
      }

      if (!isMock && googleReviews.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Google Business Profile API integration is not completed.'
        });
      }

      if (isMock && googleReviews.length === 0) {
        googleReviews = [
          {
            name: `accounts/12345/locations/67890/reviews/mock-${hotelId}-201`,
            reviewId: `mock-${hotelId}-201`,
            reviewer: { displayName: 'Hakan Çelik' },
            starRating: 'FIVE',
            comment: 'Konumu harikaydı, odalar çok temiz ve personel son derece ilgiliydi. Memnun kaldık.',
            createTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            name: `accounts/12345/locations/67890/reviews/mock-${hotelId}-202`,
            reviewId: `mock-${hotelId}-202`,
            reviewer: { displayName: 'Merve Aslan' },
            starRating: 'THREE',
            comment: 'Kahvaltısı güzeldi fakat odadaki banyo havalandırması iyi çalışmıyordu.',
            createTime: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            name: `accounts/12345/locations/67890/reviews/mock-${hotelId}-203`,
            reviewer: { displayName: 'David Beckham' },
            starRating: 'FIVE',
            comment: '',
            createTime: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString()
          }
        ];
      }

      const mappedReviews: any[] = [];
      const mappingValue = googleLocationId || googleMapsUrl;

      for (let raw of googleReviews) {
        const mapped = mapGoogleReview(raw, hotelId, orgId);
        if (mapped) {
          if (!mapped.google_location_id && mappingValue) {
            const match = String(mappingValue).match(/place\/([^\/]+)/);
            mapped.google_location_id = match ? match[1] : mappingValue;
          }
          mappedReviews.push(mapped);
        }
      }

      let cutoffDate: Date | null = null;
      if (range !== 'all') {
        const days = parseInt(range, 10) || 365;
        cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
      }

      const filteredReviews = mappedReviews.filter(r => {
        if (!cutoffDate) return true;
        return new Date(r.create_update_time) >= cutoffDate;
      });

      let successCount = 0;
      let duplicateCount = 0;
      let failedCount = 0;
      const detailedErrors: any[] = [];
      const importDetails: any[] = [];

      for (let r of filteredReviews) {
        try {
          const isDuplicate = await checkIsDuplicate(
            hotelId,
            'Google',
            r.platform_review_id,
            r.reviewer_display_name,
            r.star_rating,
            r.comment_text
          );
          if (isDuplicate) {
            duplicateCount++;
            await handleGoogleDuplicate(
              hotelId,
              r.platform_review_id,
              r.reviewer_display_name,
              r.star_rating,
              r.comment_text,
              r.create_update_time,
              {
                google_relative_date: r.create_update_time,
                display_date: r.create_update_time
              }
            );
            importDetails.push({ reviewId: r.platform_review_id, status: 'duplicate_skipped' });
            continue;
          }

          const reviewRecord = {
            platform_review_id: r.platform_review_id,
            guest_name: r.reviewer_display_name,
            rating: r.star_rating,
            review_text: r.comment_text,
            platform: 'Google',
            sentiment: r.star_rating >= 4 ? 'positive' : r.star_rating === 3 ? 'neutral' : 'negative',
            status: 'draft',
            created_at: r.create_update_time,
            hotel_id: hotelId,
            organization_id: orgId,
            ai_reply: r.reply || null
          };

          const { error: insErr } = await supabaseAdmin.from('reviews').insert(reviewRecord);
          if (insErr) throw insErr;

          await postToN8N({
            platform_review_id: r.platform_review_id,
            reviewer_display_name: r.reviewer_display_name,
            star_rating: r.star_rating,
            comment_text: r.comment_text,
            create_update_time: r.create_update_time,
            reply: r.reply || null,
            google_location_id: r.google_location_id || null,
            hotel_id: hotelId,
            organization_id: orgId
          });

          successCount++;
          importDetails.push({ reviewId: r.platform_review_id, status: 'sent' });
        } catch (err: any) {
          failedCount++;
          detailedErrors.push({ reviewId: r.platform_review_id, message: err.message || String(err) });
          importDetails.push({ reviewId: r.platform_review_id, status: 'failed', error: err.message || String(err) });
        }
      }

      return res.status(200).json({
        success: true,
        importedCount: successCount,
        duplicateCount,
        failedCount,
        totalFetched: filteredReviews.length,
        detailedErrors,
        importDetails
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // -------------------------------------------------------------
  // Action: import-booking
  // -------------------------------------------------------------
  if (action === 'import-booking') {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { hotelId, range = '365', mode = 'daily_sync' } = req.body;
    if (!hotelId) {
      return res.status(400).json({ success: false, error: 'Missing hotelId parameter' });
    }

    try {
      const { data: userRolesData } = await supabaseAdmin.from('user_roles').select('*, roles(name)').eq('profile_id', user.id);
      let userRole = userRolesData?.[0]?.roles?.name;
      if (user.email === 'admin@ecctur.ai' || user.email === 'cemil.sezgin@ecctur.com') {
        userRole = 'Super Admin';
      }
      const roleNameLower = (userRole || 'staff').toLowerCase();

      // Tenant isolation check
      if (roleNameLower !== 'super admin' && roleNameLower !== 'admin' && roleNameLower !== 'owner') {
        const { data: userHotels } = await supabaseAdmin.from('user_hotels').select('*').eq('profile_id', user.id).eq('hotel_id', hotelId);
        if (!userHotels || userHotels.length === 0) {
          return res.status(403).json({ success: false, error: 'Forbidden: You do not have clearance for this hotel.' });
        }
      }

      const { data: hotelData, error: hotelErr } = await supabaseAdmin
        .from('hotels')
        .select('organization_id, name, booking_url')
        .eq('id', hotelId)
        .maybeSingle();

      if (hotelErr || !hotelData) throw new Error(hotelErr?.message || 'Hotel not found');

      const orgId = hotelData.organization_id;
      const bookingUrl = hotelData.booking_url;
      const hotelName = hotelData.name;

      if (!bookingUrl) {
        return res.status(400).json({ success: false, error: 'Hotel has no Booking.com URL configured' });
      }

      // Determine import limit
      let limit = 100;
      if (mode === 'initial_import') limit = 200;
      else if (mode === 'daily_sync') limit = 50;
      else if (mode === 'backfill_import') limit = 200;

      // Scrape Booking.com reviews via our provider
      const { fetchBookingReviews } = await import('../api-services/providers/bookingProvider.js');
      const bookingReviews = await fetchBookingReviews(bookingUrl, limit);

      console.log("[BOOKING SCRAPED FIRST ITEM]", bookingReviews[0]);

      // Console log raw items fields for debugging
      bookingReviews.slice(0, 3).forEach((r: any, idx: number) => {
        const item = r.raw || {};
        console.log(`[API Booking Debug Item #${idx + 1}]`);
        console.log(`  - Keys:`, Object.keys(item));
        console.log(`  - reviewText:`, item.reviewText);
        console.log(`  - text:`, item.text);
        console.log(`  - comment:`, item.comment);
        console.log(`  - positive:`, item.positive);
        console.log(`  - negative:`, item.negative);
        console.log(`  - review:`, item.review);
        console.log(`  - content:`, item.content);
        console.log(`  - userReview:`, item.userReview);
        console.log(`  - localizedReview:`, item.localizedReview);
        console.log(`  - title:`, item.title);
      });

      let successCount = 0;
      let updatedCount = 0;
      let duplicateCount = 0;
      let failedCount = 0;
      const detailedErrors: any[] = [];
      const importDetails: any[] = [];

      for (let r of bookingReviews) {
        try {
          // Find existing review for Booking platform to see if it qualifies as duplicate or update candidate
          let existingBookingReview: any = null;
          if (r.externalId) {
            const { data: existing, error } = await supabaseAdmin
              .from('reviews')
              .select('id, review_text, review_date, metadata, travel_date, owner_response_text, owner_response_date')
              .ilike('platform', 'booking')
              .eq('platform_review_id', r.externalId)
              .limit(1)
              .maybeSingle();
            if (!error && existing) {
              existingBookingReview = existing;
            }
          }

          if (!existingBookingReview) {
            const { data: existingSec, error: errorSec } = await supabaseAdmin
              .from('reviews')
              .select('id, review_text, review_date, metadata, travel_date, owner_response_text, owner_response_date')
              .eq('hotel_id', hotelId)
              .ilike('platform', 'booking')
              .eq('guest_name', r.guestName)
              .eq('rating', r.rating)
              .eq('review_text', r.reviewText)
              .limit(1)
              .maybeSingle();
            if (!errorSec && existingSec) {
              existingBookingReview = existingSec;
            }
          }

          if (existingBookingReview) {
            const currentText = (existingBookingReview.review_text || '').trim();
            const newText = (r.reviewText || '').trim();

            const placeholders = [
              "",
              "no comment review.",
              "no comment review",
              "no comment",
              "no review text",
              "no review",
              "yorum yok",
              "boş yorum",
              "bos yorum"
            ];

            const isPlaceholderText = (text: string | null | undefined): boolean => {
              if (!text) return true;
              const clean = text.trim().toLowerCase();
              return placeholders.includes(clean);
            };

            const canUpdatePlaceholder = isPlaceholderText(currentText);
            const hasNewRealText = newText && !isPlaceholderText(newText);

            // Log duplicate check details
            const existingReview = existingBookingReview;
            const review = r;
            console.log("BOOKING DUPLICATE CHECK", {
              existingText: existingReview?.review_text,
              incomingText: review.reviewText,
              canUpdatePlaceholder,
              hasNewRealText
            });

            if (canUpdatePlaceholder && hasNewRealText) {
              const updatePayload: any = {
                review_text: newText,
                review_date: review.reviewDate || existingReview.review_date || null,
                rating: r.rating,
                guest_name: r.guestName || 'Booking Guest',
                sentiment: r.rating >= 4 ? 'positive' : r.rating === 3 ? 'neutral' : 'negative',
                updated_at: new Date().toISOString(),
                metadata: review.metadata || existingReview.metadata || null,
                travel_date: review.travelDate || existingReview.travel_date || null,
                owner_response_text: review.ownerResponseText || existingReview.owner_response_text || null,
                owner_response_date: review.ownerResponseDate || existingReview.owner_response_date || null
              };

              console.log("[BOOKING FINAL UPDATE PAYLOAD]", updatePayload);

              let { error: updErr } = await supabaseAdmin
                .from('reviews')
                .update(updatePayload)
                .eq('id', existingBookingReview.id);

              if (updErr) {
                if (updErr.code === '42703' || updErr.message?.includes('updated_at')) {
                  delete updatePayload.updated_at;
                  const { error: retryErr } = await supabaseAdmin
                    .from('reviews')
                    .update(updatePayload)
                    .eq('id', existingBookingReview.id);
                  if (retryErr) throw retryErr;
                } else {
                  throw updErr;
                }
              }

              updatedCount++;
              importDetails.push({ reviewId: r.externalId, status: 'updated' });
              continue;
            } else {
              const needsDateBackfill = !existingReview.review_date && review.reviewDate;
              const needsMetadataBackfill = (!existingReview.metadata || Object.keys(existingReview.metadata).length === 0) && review.metadata;

              if (needsDateBackfill || needsMetadataBackfill) {
                const updatePayload: any = {
                  review_date: review.reviewDate || existingReview.review_date || null,
                  metadata: review.metadata || existingReview.metadata || null,
                  travel_date: review.travelDate || existingReview.travel_date || null,
                  owner_response_text: review.ownerResponseText || existingReview.owner_response_text || null,
                  owner_response_date: review.ownerResponseDate || existingReview.owner_response_date || null,
                  updated_at: new Date().toISOString()
                };

                console.log("[BOOKING FINAL UPDATE PAYLOAD]", updatePayload);

                let { error: updErr } = await supabaseAdmin
                  .from('reviews')
                  .update(updatePayload)
                  .eq('id', existingBookingReview.id);

                if (updErr) {
                  if (updErr.code === '42703' || updErr.message?.includes('updated_at')) {
                    delete updatePayload.updated_at;
                    const { error: retryErr } = await supabaseAdmin
                      .from('reviews')
                      .update(updatePayload)
                      .eq('id', existingBookingReview.id);
                    if (retryErr) throw retryErr;
                  } else {
                    throw updErr;
                  }
                }
              }

              duplicateCount++;
              importDetails.push({ reviewId: r.externalId, status: 'duplicate_skipped' });
              continue;
            }
          }

          console.log("[BOOKING INSERT]", r);
          console.log("[BOOKING INSERT PAYLOAD]", {
            review_date: r.reviewDate,
            metadata: r.metadata
          });

          const reviewRecord = {
            platform_review_id: r.externalId || null,
            guest_name: r.guestName || 'Booking Guest',
            rating: r.rating,
            review_text: r.reviewText || 'No comment review.',
            platform: 'Booking',
            sentiment: r.rating >= 4 ? 'positive' : r.rating === 3 ? 'neutral' : 'negative',
            status: 'draft',
            published: 'No',
            created_at: new Date().toISOString(),
            review_date: r.reviewDate || null,
            travel_date: r.travelDate || null,
            owner_response_text: r.ownerResponseText || null,
            owner_response_date: r.ownerResponseDate || null,
            hotel_id: hotelId,
            hotel_name: hotelName,
            organization_id: orgId,
            metadata: r.metadata || null
          };

          console.log("[BOOKING FINAL INSERT PAYLOAD]", reviewRecord);

          const { error: insErr } = await supabaseAdmin.from('reviews').insert(reviewRecord);
          if (insErr) throw insErr;

          await postToN8N({
            platform_review_id: r.externalId,
            reviewer_display_name: r.guestName,
            star_rating: r.rating,
            comment_text: r.reviewText,
            create_update_time: r.reviewDate || null,
            reply: null,
            platform: 'Booking',
            hotel_id: hotelId,
            organization_id: orgId
          });

          successCount++;
          importDetails.push({ reviewId: r.externalId, status: 'sent' });
        } catch (err: any) {
          failedCount++;
          detailedErrors.push({ reviewId: r.externalId, message: err.message || String(err) });
          importDetails.push({ reviewId: r.externalId, status: 'failed', error: err.message || String(err) });
        }
      }

      // Count total after import
      const { count: totalAfterImport } = await supabaseAdmin
        .from('reviews')
        .select('*', { count: 'exact', head: true })
        .eq('hotel_id', hotelId);

      return res.status(200).json({
        success: true,
        platform: 'booking',
        requestedMode: mode,
        effectiveMode: mode,
        fetchedCount: bookingReviews.length,
        insertedCount: successCount,
        updatedCount: updatedCount,
        duplicateCount,
        failedCount,
        totalAfterImport: totalAfterImport || 0
      });
    } catch (err: any) {
      console.error('[API import-booking] Failure:', err);
      return res.status(500).json({ success: false, error: err.message || String(err) });
    }
  }

  // -------------------------------------------------------------
  // Action: import-google-maps
  // -------------------------------------------------------------
  if (action === 'import-google-maps') {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { hotelId, googleMapsUrl, mode = 'initial_import' } = req.body;
    if (!hotelId || !googleMapsUrl) {
      return res.status(400).json({ success: false, error: 'Missing hotelId or googleMapsUrl parameter' });
    }

    try {
      const { data: userRolesData } = await supabaseAdmin.from('user_roles').select('*, roles(name)').eq('profile_id', user.id);
      let userRole = userRolesData?.[0]?.roles?.name;
      if (user.email === 'admin@ecctur.ai' || user.email === 'cemil.sezgin@ecctur.com') {
        userRole = 'Super Admin';
      }
      const roleNameLower = (userRole || 'staff').toLowerCase();

      // Rule 4: backfill_import is only for Owner (allowing Super Admin as system admin)
      const isOwner = roleNameLower === 'owner' || roleNameLower === 'super admin';
      if (mode === 'backfill_import' && !isOwner) {
        return res.status(403).json({ success: false, error: 'Forbidden: Only Owner role can trigger backfill import.' });
      }

      const { data: hotelData, error: hotelError } = await supabaseAdmin.from('hotels').select('organization_id, name').eq('id', hotelId).maybeSingle();
      if (hotelError || !hotelData) return res.status(404).json({ success: false, error: 'Hotel not found' });

      const orgId = hotelData.organization_id;
      const hotelName = hotelData.name;

      // Rules 1 & 2: check existing count to determine effective mode
      const { count: existingCount, error: countErr } = await supabaseAdmin
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('hotel_id', hotelId)
        .eq('platform', 'Google');

      if (countErr) throw countErr;

      let effectiveMode = mode;
      if (effectiveMode === 'initial_import' && existingCount !== null && existingCount > 0) {
        effectiveMode = 'daily_sync';
      }

      // Rule 3: daily_sync limit is 50, otherwise 200
      const limit = effectiveMode === 'initial_import' || effectiveMode === 'backfill_import' ? 200 : 50;
      const scrapedReviews = await reviewImportService.importReviews('Google', googleMapsUrl, limit);

      console.log("[GOOGLE SCRAPED FIRST ITEM]", scrapedReviews[0]);

      let importedCount = 0;
      let duplicateCount = 0;
      let failedCount = 0;

      for (const r of scrapedReviews) {
        try {
          if (!r.reviewDate && effectiveMode === 'daily_sync') {
            r.reviewDate = new Date().toISOString();
            r.metadata = r.metadata || {};
            r.metadata.display_date = "Yeni";
            r.metadata.google_relative_date = "Yeni";
          }

          // Rule 5: Strengthen duplicate control
          const isDuplicate = await checkIsDuplicate(
            hotelId,
            'Google',
            r.externalId || null,
            r.guestName,
            r.rating,
            r.reviewText
          );

          if (isDuplicate) {
            duplicateCount++;
            await handleGoogleDuplicate(
              hotelId,
              r.externalId || null,
              r.guestName,
              r.rating,
              r.reviewText,
              r.reviewDate,
              r.metadata
            );
            continue;
          }

          const sentiment = r.rating >= 4 ? 'positive' : r.rating === 3 ? 'neutral' : 'negative';

          console.log("[GOOGLE INSERT]", r);
          console.log("[GOOGLE INSERT PAYLOAD]", {
            review_date: r.reviewDate,
            metadata: r.metadata
          });

          const { error: insertErr } = await supabaseAdmin.from('reviews').insert({
            hotel_id: hotelId,
            hotel_name: hotelName,
            organization_id: orgId,
            guest_name: r.guestName,
            rating: r.rating,
            review_text: r.reviewText,
            platform: 'Google',
            platform_review_id: r.externalId || null,
            sentiment,
            status: 'draft',
            published: 'No',
            created_at: new Date().toISOString(),
            review_date: r.reviewDate || null,
            travel_date: r.travelDate || null,
            owner_response_text: r.ownerResponseText || null,
            owner_response_date: r.ownerResponseDate || null,
            metadata: r.metadata || null
          });

          if (insertErr) {
            console.error('[Google Import] Database insert error:', insertErr);
            failedCount++;
          } else {
            importedCount++;
          }
        } catch (loopErr) {
          console.error('[Google Import] Loop exception:', loopErr);
          failedCount++;
        }
      }

      console.log(`Google Inserted Reviews: ${importedCount}`);
      console.log(`Google Duplicate Reviews: ${duplicateCount}`);

      const { count: totalAfterImport } = await supabaseAdmin
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('hotel_id', hotelId)
        .eq('platform', 'Google');

      // Rule 6: Clear import result summary
      return res.status(200).json({
        success: true,
        platform: 'Google',
        requestedMode: mode,
        effectiveMode,
        fetchedCount: scrapedReviews.length,
        insertedCount: importedCount,
        duplicateCount,
        failedCount,
        totalAfterImport: totalAfterImport || 0
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message || String(err) });
    }
  }

  // -------------------------------------------------------------
  // Action: import-hotel-review-aggregator
  // -------------------------------------------------------------
  if (action === 'import-hotel-review-aggregator') {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { hotelId, googleMapsUrl, mode = 'initial_import' } = req.body;
    if (!hotelId) {
      return res.status(400).json({ success: false, error: 'Missing hotelId parameter' });
    }

    const startTime = Date.now();
    try {
      // Self-healing: Correct any legacy platform names to 'Google'
      try {
        await supabaseAdmin
          .from('reviews')
          .update({ platform: 'Google' })
          .in('platform', ['google-maps', 'google_maps', 'google maps']);
      } catch (fixErr) {
        console.error('[Platform Fix] Error correcting legacy platform names:', fixErr);
      }

      const { data: hotelData, error: hotelError } = await supabaseAdmin
        .from('hotels')
        .select('organization_id, name, google_maps_url, google_maps_link, google_place_id')
        .eq('id', hotelId)
        .maybeSingle();

      if (hotelError || !hotelData) {
        return res.status(404).json({ success: false, error: 'Hotel not found' });
      }

      const orgId = hotelData.organization_id;
      const hotelName = hotelData.name;

      const finalUrl = googleMapsUrl || hotelData.google_maps_url || hotelData.google_maps_link;
      const finalPlaceId = hotelData.google_place_id;

      if (!finalUrl && !finalPlaceId) {
        return res.status(400).json({
          success: false,
          error: "No Google Maps URL or Place ID configured for this hotel."
        });
      }

      let targetScrapeUrl = '';
      if (finalUrl) {
        targetScrapeUrl = finalUrl;
      } else if (finalPlaceId) {
        targetScrapeUrl = `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${finalPlaceId}`;
      }

      // 1. Fetch existing sync states for Google and Booking
      const { data: existingStates, error: stateFetchErr } = await supabaseAdmin
        .from('review_sync_states')
        .select('*')
        .eq('hotel_id', hotelId);

      if (stateFetchErr) console.warn('[Aggregator] Failed to fetch sync states:', stateFetchErr);

      const googleState = (existingStates || []).find(s => s.platform === 'Google');
      const bookingState = (existingStates || []).find(s => s.platform === 'Booking');

      let googleSyncMode = 'incremental_sync';
      let googleBufferDate: Date | null = null;
      if (req.body.syncMode === 'manual_full_resync' || req.query.syncMode === 'manual_full_resync') {
        googleSyncMode = 'manual_full_resync';
      } else {
        const hasSuccessfulGoogleSync = googleState && googleState.last_successful_sync_at;
        if (!hasSuccessfulGoogleSync) {
          googleSyncMode = 'initial_full_sync';
        } else {
          googleSyncMode = 'incremental_sync';
          const baseDateStr = googleState.last_review_date || googleState.last_successful_sync_at;
          if (baseDateStr) {
            googleBufferDate = new Date(new Date(baseDateStr).getTime() - (2 * 24 * 60 * 60 * 1000));
          }
        }
      }

      let bookingSyncMode = 'incremental_sync';
      let bookingBufferDate: Date | null = null;
      if (req.body.syncMode === 'manual_full_resync' || req.query.syncMode === 'manual_full_resync') {
        bookingSyncMode = 'manual_full_resync';
      } else {
        const hasSuccessfulBookingSync = bookingState && bookingState.last_successful_sync_at;
        if (!hasSuccessfulBookingSync) {
          bookingSyncMode = 'initial_full_sync';
        } else {
          bookingSyncMode = 'incremental_sync';
          const baseDateStr = bookingState.last_review_date || bookingState.last_successful_sync_at;
          if (baseDateStr) {
            bookingBufferDate = new Date(new Date(baseDateStr).getTime() - (2 * 24 * 60 * 60 * 1000));
          }
        }
      }

      // Check if both are incremental_sync.
      // If yes, apply date filter with buffer:
      let scrapeFromDate: string | undefined = undefined;
      let estimatedCostSavingMessage = '';
      if (googleSyncMode === 'incremental_sync' && bookingSyncMode === 'incremental_sync') {
        let baseDate: Date | null = null;
        if (googleBufferDate && bookingBufferDate) {
          baseDate = googleBufferDate.getTime() < bookingBufferDate.getTime() ? googleBufferDate : bookingBufferDate;
        } else {
          baseDate = googleBufferDate || bookingBufferDate;
        }

        if (baseDate) {
          scrapeFromDate = baseDate.toISOString().split('T')[0]; // YYYY-MM-DD
          estimatedCostSavingMessage = `Tam tarama yerine son ${Math.ceil((Date.now() - baseDate.getTime()) / (24 * 60 * 60 * 1000))} günden veri çekildi.`;
        }
      }

      const limit = (googleSyncMode === 'initial_full_sync' || bookingSyncMode === 'initial_full_sync' || googleSyncMode === 'manual_full_resync' || bookingSyncMode === 'manual_full_resync') ? 1000 : 100;

      console.log('[Aggregator] selected hotelId:', hotelId);
      console.log('[Aggregator] found hotel.id:', hotelId);
      console.log('[Aggregator] found hotel.name:', hotelName);
      console.log('[Aggregator] syncMode (Google):', googleSyncMode, 'syncMode (Booking):', bookingSyncMode, 'scrapeFromDate:', scrapeFromDate);
      console.log('[Aggregator] Running tri_angle/hotel-review-aggregator for', hotelName);
      
      const scrapedReviews = await fetchAggregatorReviews(targetScrapeUrl, limit, scrapeFromDate);
      
      console.log('[Aggregator] Apify normalized item count:', scrapedReviews.length);
      console.log('[Aggregator] First 3 items to insert:', scrapedReviews.slice(0, 3));

      let importedCount = 0;
      let duplicateCount = 0;
      let failedCount = 0;
      let skippedCount = 0;
      let answeredCount = 0;
      let unansweredCount = 0;
      const detailedErrors: any[] = [];
      const skippedProvidersList: any[] = [];

      const platformSummary: Record<string, { normalized: number; imported: number; duplicates: number; skipped: number }> = {
        "Google": { normalized: 0, imported: 0, duplicates: 0, skipped: 0 },
        "Booking.com": { normalized: 0, imported: 0, duplicates: 0, skipped: 0 },
        "TripAdvisor": { normalized: 0, imported: 0, duplicates: 0, skipped: 0 },
        "Expedia": { normalized: 0, imported: 0, duplicates: 0, skipped: 0 },
        "Hotels.com": { normalized: 0, imported: 0, duplicates: 0, skipped: 0 },
        "Airbnb": { normalized: 0, imported: 0, duplicates: 0, skipped: 0 },
        "Yelp": { normalized: 0, imported: 0, duplicates: 0, skipped: 0 }
      };

      const getSummaryKey = (p: string) => {
        if (p === 'Booking') return 'Booking.com';
        if (platformSummary[p] !== undefined) return p;
        return null;
      };

      for (const r of scrapedReviews) {
        try {
          if (!r.reviewDate && (googleSyncMode === 'incremental_sync' || bookingSyncMode === 'incremental_sync')) {
            r.reviewDate = new Date().toISOString();
            r.metadata = r.metadata || {};
            r.metadata.display_date = "Yeni";
            r.metadata.google_relative_date = "Yeni";
          }

          // Count answered/unanswered based on hasOwnerResponse
          const hasResponse = r.metadata?.hasOwnerResponse === true;
          if (hasResponse) {
            answeredCount++;
          } else {
            unansweredCount++;
          }

          // Normalize platform name to standard forms
          let platformVal = r.platform || 'Google';
          const pLower = platformVal.toLowerCase().trim();
          if (pLower.includes('google')) {
            platformVal = 'Google';
          } else if (pLower.includes('booking')) {
            platformVal = 'Booking';
          } else if (pLower.includes('tripadvisor') || pLower.includes('trip advisor')) {
            platformVal = 'TripAdvisor';
          } else if (pLower.includes('expedia')) {
            platformVal = 'Expedia';
          } else if (pLower.includes('hotels.com') || pLower.includes('hotelscom') || pLower.includes('hotels com')) {
            platformVal = 'Hotels.com';
          } else if (pLower.includes('airbnb')) {
            platformVal = 'Airbnb';
          } else if (pLower.includes('yelp')) {
            platformVal = 'Yelp';
          } else {
            console.warn(`[Aggregator] Unrecognized/unsupported provider: ${platformVal}`);
            continue;
          }

          const sumKey = getSummaryKey(platformVal);
          if (sumKey) {
            platformSummary[sumKey].normalized++;
          }

          // Sadeleştirme kuralı: Sadece Google ve Booking.com Aggregator üzerinden alınır
          const isAggregatorTarget = platformVal === 'Google' || platformVal === 'Booking';
          if (!isAggregatorTarget) {
            skippedCount++;
            if (sumKey) {
              platformSummary[sumKey].skipped++;
            }
            skippedProvidersList.push({
              provider: r.metadata?.originalProvider || r.platform,
              detected: platformVal,
              reviewId: r.externalId || null
            });
            continue;
          }

          const isDuplicate = await checkIsDuplicate(
            hotelId,
            platformVal,
            r.externalId || null,
            r.guestName,
            r.rating,
            r.reviewText || '',
            r.reviewDate || null
          );
          
          if (isDuplicate) {
            duplicateCount++;
            if (sumKey) {
              platformSummary[sumKey].duplicates++;
            }
            continue;
          }

          const sentiment = r.rating >= 4 ? 'positive' : r.rating === 3 ? 'neutral' : 'negative';

          // Insert review
          const { error: insertErr } = await supabaseAdmin.from('reviews').insert({
            hotel_id: hotelId,
            hotel_name: hotelName,
            organization_id: orgId,
            guest_name: r.guestName,
            rating: r.rating,
            review_text: r.reviewText,
            platform: platformVal,
            platform_review_id: r.externalId || null,
            sentiment,
            status: 'draft',
            published: 'No',
            created_at: new Date().toISOString(),
            review_date: r.reviewDate || null,
            travel_date: null,
            owner_response_text: r.metadata?.ownerResponse || null,
            owner_response_date: r.metadata?.ownerResponseDate || null,
            metadata: r.metadata || null
          });

          if (insertErr) {
            console.error('[Aggregator Import] Database insert error:', insertErr);
            failedCount++;
            detailedErrors.push({ externalId: r.externalId || null, message: insertErr.message });
            if (sumKey) {
              platformSummary[sumKey].skipped++;
            }
          } else {
            importedCount++;
            if (sumKey) {
              platformSummary[sumKey].imported++;
            }

            // Requirement 16: trigger existing AI reply pipeline (postToN8N)
            try {
              await postToN8N({
                platform_review_id: r.externalId || null,
                reviewer_display_name: r.guestName,
                star_rating: r.rating,
                comment_text: r.reviewText,
                create_update_time: r.reviewDate || new Date().toISOString(),
                reply: null,
                google_location_id: r.metadata?.google_location_id || null,
                hotel_id: hotelId,
                organization_id: orgId
              });
            } catch (n8nErr) {
              console.error('[Aggregator Import] postToN8N failed:', n8nErr);
            }
          }
        } catch (loopErr: any) {
          console.error('[Aggregator Import] Loop exception:', loopErr);
          failedCount++;
          detailedErrors.push({ message: loopErr.message || String(loopErr) });
        }
      }

      // Calculation of responseRate
      const totalNormalized = scrapedReviews.length;
      const responseRate = totalNormalized > 0 ? (answeredCount / totalNormalized) * 100 : 0;

      // Sample data for debug
      const insertedSample = scrapedReviews.slice(0, 3);

      // Determine latest review dates and update sync states
      const googleReviews = scrapedReviews.filter(r => r.platform === 'Google');
      let googleLatestDate = googleState?.last_review_date || null;
      if (googleReviews.length > 0) {
        const dates = googleReviews.map(r => r.reviewDate).filter(Boolean).sort((a,b) => new Date(b).getTime() - new Date(a).getTime());
        if (dates.length > 0) googleLatestDate = dates[0];
      }

      const googleImported = platformSummary["Google"].imported;
      const googleDuplicates = platformSummary["Google"].duplicates;
      const googleSkipped = platformSummary["Google"].skipped;
      const googleErrorsCount = detailedErrors.filter(e => e.platform === 'Google').length;

      try {
        await supabaseAdmin.from('review_sync_states').upsert({
          hotel_id: hotelId,
          platform: 'Google',
          last_sync_at: new Date().toISOString(),
          last_successful_sync_at: new Date().toISOString(),
          last_review_date: googleLatestDate,
          last_review_count: googleReviews.length,
          last_imported_count: googleImported,
          last_duplicate_count: googleDuplicates,
          last_error_count: googleErrorsCount,
          sync_mode: googleSyncMode,
          status: googleErrorsCount > 0 && googleImported === 0 ? 'error' : 'active',
          error_message: googleErrorsCount > 0 ? 'Aggregator failed for some Google reviews' : null,
          metadata: { scrapeFromDate, hasMorePotentialReviews: hasMore, warningMessage: hasMore ? 'Daha fazla yeni yorum olabilir.' : null }
        });
      } catch (dbErr) {
        console.error('[Aggregator Import] Failed to update Google sync state:', dbErr);
      }

      const bookingReviews = scrapedReviews.filter(r => r.platform === 'Booking');
      let bookingLatestDate = bookingState?.last_review_date || null;
      if (bookingReviews.length > 0) {
        const dates = bookingReviews.map(r => r.reviewDate).filter(Boolean).sort((a,b) => new Date(b).getTime() - new Date(a).getTime());
        if (dates.length > 0) bookingLatestDate = dates[0];
      }

      const bookingImported = platformSummary["Booking.com"].imported;
      const bookingDuplicates = platformSummary["Booking.com"].duplicates;
      const bookingSkipped = platformSummary["Booking.com"].skipped;
      const bookingErrorsCount = detailedErrors.filter(e => e.platform === 'Booking').length;

      try {
        await supabaseAdmin.from('review_sync_states').upsert({
          hotel_id: hotelId,
          platform: 'Booking',
          last_sync_at: new Date().toISOString(),
          last_successful_sync_at: new Date().toISOString(),
          last_review_date: bookingLatestDate,
          last_review_count: bookingReviews.length,
          last_imported_count: bookingImported,
          last_duplicate_count: bookingDuplicates,
          last_error_count: bookingErrorsCount,
          sync_mode: bookingSyncMode,
          status: bookingErrorsCount > 0 && bookingImported === 0 ? 'error' : 'active',
          error_message: bookingErrorsCount > 0 ? 'Aggregator failed for some Booking reviews' : null,
          metadata: { scrapeFromDate, hasMorePotentialReviews: hasMore, warningMessage: hasMore ? 'Daha fazla yeni yorum olabilir.' : null }
        });
      } catch (dbErr) {
        console.error('[Aggregator Import] Failed to update Booking sync state:', dbErr);
      }

      // Enriched Response Payload
      const hasMore = scrapedReviews.length >= limit;

      // Enriched Response Payload
      const responsePayload = {
        success: true,
        hotelName,
        hotelId,
        provider: "hotel-review-aggregator",
        normalized: totalNormalized,
        imported: importedCount,
        duplicates: duplicateCount,
        skipped: skippedCount,
        platformSummary,
        errors: detailedErrors,
        answeredReviews: answeredCount,
        unansweredReviews: unansweredCount,
        responseRate,
        syncMode: googleSyncMode, // Google mode as primary
        syncStartDate: scrapeFromDate || 'Tüm geçmiş',
        estimatedCostSavingMessage,
        hasMorePotentialReviews: hasMore,
        warningMessage: hasMore ? 'Daha fazla yeni yorum olabilir.' : null,
        googleSyncDetails: {
          syncMode: googleSyncMode,
          syncStartDate: scrapeFromDate || 'Tüm geçmiş',
          imported: googleImported,
          duplicates: googleDuplicates,
          skipped: googleSkipped,
          errors: googleErrorsCount,
          lastReviewDate: googleLatestDate,
          nextRecommendedSyncAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          hasMorePotentialReviews: hasMore,
          warningMessage: hasMore ? 'Daha fazla yeni yorum olabilir.' : null
        },
        bookingSyncDetails: {
          syncMode: bookingSyncMode,
          syncStartDate: scrapeFromDate || 'Tüm geçmiş',
          imported: bookingImported,
          duplicates: bookingDuplicates,
          skipped: bookingSkipped,
          errors: bookingErrorsCount,
          lastReviewDate: bookingLatestDate,
          nextRecommendedSyncAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          hasMorePotentialReviews: hasMore,
          warningMessage: hasMore ? 'Daha fazla yeni yorum olabilir.' : null
        },
        debug: {
          apifyItems: scrapedReviews.length,
          normalizedItems: totalNormalized,
          selectedHotelId: hotelId,
          insertedSample: insertedSample,
          duplicateSample: duplicateCount,
          errorSample: detailedErrors.slice(0, 3),
          skippedProviders: skippedProvidersList
        }
      };

      console.log('\n=== Aggregator Platform Detection Debug Table ===');
      console.log(
        String('Original Provider').padEnd(20) + ' | ' +
        String('Detected Platform').padEnd(20) + ' | ' +
        String('Review ID').padEnd(25) + ' | ' +
        String('Review URL').padEnd(50) + ' | ' +
        String('Place URL')
      );
      console.log('-'.repeat(140));
      for (const r of scrapedReviews) {
        const origProv = r.metadata?.originalProvider || 'N/A';
        const detPlat = r.platform || 'N/A';
        const rId = r.externalId || 'N/A';
        const rUrl = r.metadata?.reviewUrl || 'N/A';
        const pUrl = r.metadata?.placeUrl || 'N/A';
        console.log(
          String(origProv).padEnd(20) + ' | ' +
          String(detPlat).padEnd(20) + ' | ' +
          String(rId).padEnd(25) + ' | ' +
          String(rUrl).substring(0, 50).padEnd(50) + ' | ' +
          String(pUrl).substring(0, 50)
        );
      }
      console.log('=================================================\n');

      console.log('[Aggregator] insert success count:', importedCount);
      console.log('[Aggregator] duplicate count:', duplicateCount);
      console.log('[Aggregator] insert errors:', detailedErrors);
      console.log('[Aggregator] import response object:', responsePayload);

      return res.status(200).json(responsePayload);
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      console.error('[API import-hotel-review-aggregator] Failure:', err);
      let parsedError = null;
      try {
        parsedError = JSON.parse(err.message);
      } catch (_) {}

      const responseText = parsedError ? JSON.stringify(parsedError) : (err.message || String(err));
      logPlatformError('Aggregator (Google & Booking.com)', 'import-hotel-review-aggregator', req, 500, responseText, elapsed, err);

      if (parsedError) {
        return res.status(500).json({
          success: false,
          error: parsedError.message || "Apify Aggregator Service returned a non-JSON or error response.",
          stack: err.stack || String(err),
          action: 'import-hotel-review-aggregator',
          elapsedMs: elapsed,
          ...parsedError
        });
      }

      return res.status(500).json({
        success: false,
        error: err.message || String(err),
        stack: err.stack || String(err),
        action: 'import-hotel-review-aggregator',
        elapsedMs: elapsed
      });
    }
  }



  // -------------------------------------------------------------
  // Action: import-tripadvisor
  // -------------------------------------------------------------
  if (action === 'import-tripadvisor') {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { hotelId, tripadvisorUrl, mode = 'initial_import' } = req.body;
    if (!hotelId || !tripadvisorUrl) {
      return res.status(400).json({ success: false, error: 'Missing hotelId or tripadvisorUrl parameter' });
    }

    const startTime = Date.now();
    try {
      const { data: userRolesData } = await supabaseAdmin.from('user_roles').select('*, roles(name)').eq('profile_id', user.id);
      let userRole = userRolesData?.[0]?.roles?.name;
      if (user.email === 'admin@ecctur.ai' || user.email === 'cemil.sezgin@ecctur.com') {
        userRole = 'Super Admin';
      }
      const roleNameLower = (userRole || 'staff').toLowerCase();

      // Rule 4: backfill_import is only for Owner (allowing Super Admin as system admin)
      const isOwner = roleNameLower === 'owner' || roleNameLower === 'super admin';
      if (mode === 'backfill_import' && !isOwner) {
        return res.status(403).json({ success: false, error: 'Forbidden: Only Owner role can trigger backfill import.' });
      }

      const { data: hotelData, error: hotelError } = await supabaseAdmin.from('hotels').select('organization_id, name').eq('id', hotelId).maybeSingle();
      if (hotelError || !hotelData) return res.status(404).json({ success: false, error: 'Hotel not found' });

      const orgId = hotelData.organization_id;
      const hotelName = hotelData.name;

      // 1. Fetch TripAdvisor sync state
      const { data: taState } = await supabaseAdmin
        .from('review_sync_states')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('platform', 'TripAdvisor')
        .maybeSingle();

      let syncMode = req.body.syncMode || req.query.syncMode || 'incremental_sync';
      if (syncMode !== 'manual_full_resync') {
        const hasSuccessfulTASync = taState && taState.last_successful_sync_at;
        if (!hasSuccessfulTASync) {
          syncMode = 'initial_full_sync';
        }
      }

      // If incremental sync and date filter is unsupported, set limit to a smaller value (like 20)
      const limit = syncMode === 'incremental_sync' ? 20 : 200;
      const scrapedReviews = await reviewImportService.importReviews('Tripadvisor', tripadvisorUrl, limit);

      console.log("[TRIPADVISOR SCRAPED FIRST ITEM]", scrapedReviews[0]);

      let importedCount = 0;
      let duplicateCount = 0;
      let failedCount = 0;

      for (const r of scrapedReviews) {
        try {
          // Rule 5: Strengthen duplicate control
          const isDuplicate = await checkIsDuplicate(
            hotelId,
            'Tripadvisor',
            r.externalId || null,
            r.guestName,
            r.rating,
            r.reviewText
          );

          if (isDuplicate) {
            duplicateCount++;
            continue;
          }

          const sentiment = r.rating >= 4 ? 'positive' : r.rating === 3 ? 'neutral' : 'negative';

          console.log("[TRIPADVISOR INSERT]", r);
          console.log("[TRIPADVISOR INSERT PAYLOAD]", {
            review_date: r.reviewDate,
            metadata: r.metadata
          });

          const { error: insertErr } = await supabaseAdmin.from('reviews').insert({
            hotel_id: hotelId,
            hotel_name: hotelName,
            organization_id: orgId,
            guest_name: r.guestName,
            rating: r.rating,
            review_text: r.reviewText,
            platform: 'Tripadvisor',
            platform_review_id: r.externalId || null,
            sentiment,
            status: 'draft',
            published: 'No',
            created_at: new Date().toISOString(),
            review_date: r.reviewDate || null,
            travel_date: r.travelDate || null,
            owner_response_text: r.ownerResponseText || null,
            owner_response_date: r.ownerResponseDate || null,
            metadata: r.metadata || null
          });

          if (insertErr) {
            console.error('[Tripadvisor Import] Database insert error:', insertErr);
            failedCount++;
          } else {
            importedCount++;
          }
        } catch (loopErr) {
          console.error('[Tripadvisor Import] Loop exception:', loopErr);
          failedCount++;
        }
      }

      console.log(`TripAdvisor Inserted Reviews: ${importedCount}`);
      console.log(`TripAdvisor Duplicate Reviews: ${duplicateCount}`);

      const { count: totalAfterImport } = await supabaseAdmin
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('hotel_id', hotelId)
        .eq('platform', 'Tripadvisor');

      const taLatestReviewDate = scrapedReviews.length > 0 
        ? scrapedReviews.map(r => r.reviewDate).filter(Boolean).sort((a,b) => new Date(b).getTime() - new Date(a).getTime())[0] || null
        : null;

      try {
        await supabaseAdmin.from('review_sync_states').upsert({
          hotel_id: hotelId,
          platform: 'TripAdvisor',
          last_sync_at: new Date().toISOString(),
          last_successful_sync_at: new Date().toISOString(),
          last_review_date: taLatestReviewDate || taState?.last_review_date || null,
          last_review_count: scrapedReviews.length,
          last_imported_count: importedCount,
          last_duplicate_count: duplicateCount,
          last_error_count: failedCount,
          sync_mode: syncMode,
          status: failedCount > 0 && importedCount === 0 ? 'error' : 'active',
          error_message: failedCount > 0 ? 'Some TripAdvisor reviews failed to import' : null,
          metadata: { dateFilterUnsupported: true }
        });
      } catch (dbErr) {
        console.error('[Tripadvisor Import] Failed to update sync state:', dbErr);
      }

      return res.status(200).json({
        success: true,
        platform: 'TripAdvisor',
        requestedMode: mode,
        syncMode,
        syncStartDate: 'Tarih filtresi desteklenmiyor',
        imported: importedCount,
        duplicates: duplicateCount,
        skipped: 0,
        errors: failedCount,
        lastReviewDate: taLatestReviewDate || taState?.last_review_date || null,
        nextRecommendedSyncAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        estimatedCostSavingMessage: syncMode === 'incremental_sync' ? 'Kısmi tarama yapıldı, son 20 yorum kontrol edilerek API maliyeti düşürüldü.' : '',
        fetchedCount: scrapedReviews.length,
        insertedCount: importedCount,
        duplicateCount,
        failedCount,
        totalAfterImport: totalAfterImport || 0
      });
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      console.error('[API import-tripadvisor] Failure:', err);
      logPlatformError('TripAdvisor', 'import-tripadvisor', req, 500, err.message || String(err), elapsed, err);
      return res.status(500).json({
        success: false,
        error: err.message || String(err),
        stack: err.stack || String(err),
        action: 'import-tripadvisor',
        elapsedMs: elapsed
      });
    }
  }

  // -------------------------------------------------------------
  // Action: import-holidaycheck
  // -------------------------------------------------------------
  if (action === 'import-holidaycheck') {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    let { hotelId, hotelName, holidaycheckUrl, mode = 'initial_import' } = req.body;
    if (!hotelId) {
      return res.status(400).json({ success: false, error: 'Missing hotelId parameter' });
    }

    const startTime = Date.now();
    try {
      const { data: userRolesData } = await supabaseAdmin.from('user_roles').select('*, roles(name)').eq('profile_id', user.id);
      let userRole = userRolesData?.[0]?.roles?.name;
      if (user.email === 'admin@ecctur.ai' || user.email === 'cemil.sezgin@ecctur.com') {
        userRole = 'Super Admin';
      }
      const roleNameLower = (userRole || 'staff').toLowerCase();

      // Rule 4: backfill_import is only for Owner (allowing Super Admin as system admin)
      const isOwner = roleNameLower === 'owner' || roleNameLower === 'super admin';
      if (mode === 'backfill_import' && !isOwner) {
        return res.status(403).json({ success: false, error: 'Forbidden: Only Owner role can trigger backfill import.' });
      }

      const { data: hotelData, error: hotelError } = await supabaseAdmin.from('hotels').select('organization_id, name, holidaycheck_url').eq('id', hotelId).maybeSingle();
      if (hotelError || !hotelData) return res.status(404).json({ success: false, error: 'Hotel not found' });

      const orgId = hotelData.organization_id;
      if (!hotelName) {
        hotelName = hotelData.name;
      }
      if (!holidaycheckUrl) {
        holidaycheckUrl = hotelData.holidaycheck_url;
      }

      if (!holidaycheckUrl) {
        return res.status(400).json({ success: false, error: 'Bu otel için HolidayCheck linki tanımlanmamış. Lütfen Admin panelinden tanımlayın.' });
      }

      console.log('[HolidayCheck Import Request]', { hotelId, hotelName, holidaycheckUrl });

      // 1. Fetch HolidayCheck sync state
      const { data: hcState } = await supabaseAdmin
        .from('review_sync_states')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('platform', 'HolidayCheck')
        .maybeSingle();

      let syncMode = req.body.syncMode || req.query.syncMode || 'incremental_sync';
      if (syncMode !== 'manual_full_resync') {
        const hasSuccessfulHCSync = hcState && hcState.last_successful_sync_at;
        if (!hasSuccessfulHCSync) {
          syncMode = 'initial_full_sync';
        }
      }

      // If incremental sync and date filter is unsupported, set limit to a smaller value (like 20)
      const limit = syncMode === 'incremental_sync' ? 20 : 200;
      console.log('[HolidayCheck Import] using url', holidaycheckUrl);
      const scrapedReviews = await reviewImportService.importReviews('holidaycheck', holidaycheckUrl, limit);

      let importedCount = 0;
      let duplicateCount = 0;
      let failedCount = 0;

      for (const r of scrapedReviews) {
        try {
          const isDuplicate = await checkIsDuplicate(
            hotelId,
            'holidaycheck',
            r.externalId || null,
            r.guestName,
            r.rating,
            r.reviewText
          );

          if (isDuplicate) {
            duplicateCount++;
            continue;
          }

          const sentiment = r.rating >= 4 ? 'positive' : r.rating === 3 ? 'neutral' : 'negative';

          const { error: insertErr } = await supabaseAdmin.from('reviews').insert({
            hotel_id: hotelId,
            hotel_name: hotelName,
            organization_id: orgId,
            guest_name: r.guestName,
            rating: r.rating,
            review_text: r.reviewText,
            platform: 'holidaycheck',
            platform_review_id: r.externalId || null,
            sentiment,
            status: 'Draft',
            publish_status: 'Draft',
            published: 'No',
            created_at: new Date().toISOString(),
            review_date: r.reviewDate || null,
            travel_date: r.travelDate || null,
            owner_response_text: r.ownerResponseText || null,
            owner_response_date: r.ownerResponseDate || null,
            metadata: r.metadata || null
          });

          if (insertErr) {
            console.error('[HolidayCheck Import] Database insert error:', insertErr);
            failedCount++;
          } else {
            importedCount++;
          }
        } catch (loopErr) {
          console.error('[HolidayCheck Import] Loop exception:', loopErr);
          failedCount++;
        }
      }

      console.log(`[HolidayCheck Import] inserted/duplicate count: ${importedCount}/${duplicateCount}`);

      const { count: totalAfterImport } = await supabaseAdmin
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('hotel_id', hotelId)
        .eq('platform', 'holidaycheck');

      const hcLatestReviewDate = (scrapedReviews || []).length > 0
        ? scrapedReviews.map((r: any) => r.reviewDate).filter(Boolean).sort((a,b) => new Date(b).getTime() - new Date(a).getTime())[0] || null
        : null;

      try {
        await supabaseAdmin.from('review_sync_states').upsert({
          hotel_id: hotelId,
          platform: 'HolidayCheck',
          last_sync_at: new Date().toISOString(),
          last_successful_sync_at: new Date().toISOString(),
          last_review_date: hcLatestReviewDate || hcState?.last_review_date || null,
          last_review_count: (scrapedReviews || []).length,
          last_imported_count: importedCount,
          last_duplicate_count: duplicateCount,
          last_error_count: failedCount,
          sync_mode: syncMode,
          status: failedCount > 0 && importedCount === 0 ? 'error' : 'active',
          error_message: failedCount > 0 ? 'Some HolidayCheck reviews failed to import' : null,
          metadata: { dateFilterUnsupported: true }
        });
      } catch (dbErr) {
        console.error('[HolidayCheck Import] Failed to update sync state:', dbErr);
      }

      return res.status(200).json({
        success: true,
        platform: 'HolidayCheck',
        requestedMode: mode,
        syncMode,
        syncStartDate: 'Tarih filtresi desteklenmiyor',
        imported: importedCount,
        duplicates: duplicateCount,
        skipped: 0,
        errors: failedCount,
        lastReviewDate: hcLatestReviewDate || hcState?.last_review_date || null,
        nextRecommendedSyncAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        estimatedCostSavingMessage: syncMode === 'incremental_sync' ? 'Kısmi tarama yapıldı, son 20 yorum kontrol edilerek API maliyeti düşürüldü.' : '',
        fetchedCount: scrapedReviews.length,
        insertedCount: importedCount,
        duplicateCount,
        failedCount,
        totalAfterImport: totalAfterImport || 0
      });
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      console.error('[HolidayCheck Import] error:', err);
      logPlatformError('HolidayCheck', 'import-holidaycheck', req, 500, err.message || String(err), elapsed, err);
      return res.status(500).json({
        success: false,
        error: err.message || String(err),
        stack: err.stack || String(err),
        action: 'import-holidaycheck',
        elapsedMs: elapsed
      });
    }
  }

  // -------------------------------------------------------------
  // Action: import-otelpuan
  // -------------------------------------------------------------
  if (action === 'import-otelpuan') {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    let { hotelId, hotelName, otelpuanUrl, mode = 'initial_import' } = req.body;
    if (!hotelId) {
      return res.status(400).json({ success: false, error: 'Missing hotelId parameter' });
    }

    const startTime = Date.now();
    try {
      const { data: userRolesData } = await supabaseAdmin.from('user_roles').select('*, roles(name)').eq('profile_id', user.id);
      let userRole = userRolesData?.[0]?.roles?.name;
      if (user.email === 'admin@ecctur.ai' || user.email === 'cemil.sezgin@ecctur.com') {
        userRole = 'Super Admin';
      }
      const roleNameLower = (userRole || 'staff').toLowerCase();

      const isOwner = roleNameLower === 'owner' || roleNameLower === 'super admin';
      if (mode === 'backfill_import' && !isOwner) {
        return res.status(403).json({ success: false, error: 'Forbidden: Only Owner role can trigger backfill import.' });
      }

      const { data: hotelData, error: hotelError } = await supabaseAdmin.from('hotels').select('organization_id, name, otelpuan_url').eq('id', hotelId).maybeSingle();
      if (hotelError || !hotelData) return res.status(404).json({ success: false, error: 'Hotel not found' });

      const orgId = hotelData.organization_id;
      if (!hotelName) {
        hotelName = hotelData.name;
      }
      if (!otelpuanUrl) {
        otelpuanUrl = hotelData.otelpuan_url;
      }

      if (!otelpuanUrl) {
        return res.status(400).json({ success: false, error: 'Bu otel için Otelpuan linki tanımlanmamış. Lütfen Admin panelinden tanımlayın.' });
      }

      console.log('[Otelpuan Import Request]', { hotelId, hotelName, otelpuanUrl });

      const { data: opState } = await supabaseAdmin
        .from('review_sync_states')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('platform', 'Otelpuan')
        .maybeSingle();

      let syncMode = req.body.syncMode || req.query.syncMode || 'incremental_sync';
      if (syncMode !== 'manual_full_resync') {
        const hasSuccessfulSync = opState && opState.last_successful_sync_at;
        if (!hasSuccessfulSync) {
          syncMode = 'initial_full_sync';
        }
      }

      const limit = syncMode === 'incremental_sync' ? 20 : 100;
      console.log('[Otelpuan Import] using url', otelpuanUrl);
      const scrapedReviews = await reviewImportService.importReviews('otelpuan', otelpuanUrl, limit);

      let importedCount = 0;
      let duplicateCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      const skippedReviews: Array<{ externalReviewId: string; reviewerName: string; reason: string }> = [];
      const processedExternalIds = new Set<string>();

      for (const r of scrapedReviews) {
        try {
          const extId = r.externalId || '';
          const text = r.reviewText || '';
          const name = r.guestName || 'Misafir';

          // 1. Validation check (mandatory fields: hotel_id, platform, externalId, reviewText)
          if (!hotelId || !extId || !text.trim()) {
            skippedCount++;
            skippedReviews.push({
              externalReviewId: extId,
              reviewerName: name,
              reason: !extId ? 'invalid_external_id' : 'empty_review_text'
            });
            continue;
          }

          // 2. Duplicate in payload check
          if (processedExternalIds.has(extId)) {
            skippedCount++;
            skippedReviews.push({
              externalReviewId: extId,
              reviewerName: name,
              reason: 'duplicate_in_payload'
            });
            continue;
          }
          processedExternalIds.add(extId);

          // Round rating to integer for database compatibility
          const dbRating = r.rating !== null && r.rating !== undefined ? Math.round(r.rating) : null;

          // 3. Duplicate check in database
          const isDuplicate = await checkIsDuplicate(
            hotelId,
            'otelpuan',
            extId,
            name,
            dbRating || 0,
            text
          );

          if (isDuplicate) {
            duplicateCount++;
            skippedCount++;
            skippedReviews.push({
              externalReviewId: extId,
              reviewerName: name,
              reason: 'duplicate_existing'
            });
            continue;
          }

          const sentiment = dbRating !== null ? (dbRating >= 4 ? 'positive' : dbRating === 3 ? 'neutral' : 'negative') : 'neutral';
          
          const metaPayload = {
            ...(r.metadata || {}),
            normalizedFloatRating: r.rating
          };

          const { error: insertErr } = await supabaseAdmin.from('reviews').insert({
            hotel_id: hotelId,
            hotel_name: hotelName,
            organization_id: orgId,
            guest_name: name,
            rating: dbRating,
            review_text: text,
            platform: 'otelpuan',
            platform_review_id: extId,
            sentiment,
            status: 'Draft',
            publish_status: 'Draft',
            published: 'No',
            created_at: new Date().toISOString(),
            review_date: r.reviewDate || null,
            travel_date: null,
            owner_response_text: null,
            owner_response_date: null,
            metadata: metaPayload
          });

          if (insertErr) {
            console.error('[Otelpuan Import] Database insert error:', insertErr);
            errorCount++;
            skippedCount++;
            skippedReviews.push({
              externalReviewId: extId,
              reviewerName: name,
              reason: 'database_error'
            });
          } else {
            importedCount++;
            
            try {
              const reviewPayload = {
                id: extId,
                platform_review_id: extId,
                guest_name: name,
                rating: dbRating,
                review_text: text,
                platform: 'otelpuan',
                sentiment,
                status: 'Draft',
                review_date: r.reviewDate,
                hotel_id: hotelId,
                organization_id: orgId,
                hotel_name: hotelName
              };
              await postToN8N(reviewPayload);
            } catch (n8nErr) {
              console.warn('[Otelpuan Import] Failed to post to n8n:', n8nErr);
            }
          }
        } catch (loopErr) {
          console.error('[Otelpuan Import] Loop exception:', loopErr);
          errorCount++;
          skippedCount++;
          skippedReviews.push({
            externalReviewId: r.externalId || '',
            reviewerName: r.guestName || 'Misafir',
            reason: 'unknown'
          });
        }
      }

      console.log(`[Otelpuan Import] inserted/duplicate count: ${importedCount}/${duplicateCount}`);

      const { count: totalAfterImport } = await supabaseAdmin
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('hotel_id', hotelId)
        .eq('platform', 'otelpuan');

      const opLatestReviewDate = (scrapedReviews || []).length > 0
        ? scrapedReviews.map((r: any) => r.reviewDate).filter(Boolean).sort((a,b) => new Date(b).getTime() - new Date(a).getTime())[0] || null
        : null;

      try {
        await supabaseAdmin.from('review_sync_states').upsert({
          hotel_id: hotelId,
          platform: 'Otelpuan',
          last_sync_at: new Date().toISOString(),
          last_successful_sync_at: new Date().toISOString(),
          last_review_date: opLatestReviewDate || opState?.last_review_date || null,
          last_review_count: (scrapedReviews || []).length,
          last_imported_count: importedCount,
          last_duplicate_count: duplicateCount,
          last_error_count: errorCount,
          sync_mode: syncMode,
          status: errorCount > 0 && importedCount === 0 ? 'error' : 'active',
          error_message: errorCount > 0 ? 'Some Otelpuan reviews failed to import' : null,
          metadata: { dateFilterUnsupported: true }
        });
      } catch (dbErr) {
        console.error('[Otelpuan Import] Failed to update sync state:', dbErr);
      }

      return res.status(200).json({
        success: true,
        platform: 'Otelpuan',
        requestedMode: mode,
        syncMode,
        syncStartDate: 'Tarih filtresi desteklenmiyor',
        imported: importedCount,
        duplicates: duplicateCount,
        skipped: skippedCount,
        errors: errorCount,
        lastReviewDate: opLatestReviewDate || opState?.last_review_date || null,
        nextRecommendedSyncAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        estimatedCostSavingMessage: syncMode === 'incremental_sync' ? 'Kısmi tarama yapıldı, son 20 yorum kontrol edilerek API maliyeti düşürüldü.' : '',
        fetchedCount: scrapedReviews.length,
        insertedCount: importedCount,
        duplicateCount,
        failedCount: errorCount,
        totalAfterImport: totalAfterImport || 0,
        scraperInputCount: scrapedReviews.length,
        normalizedCount: scrapedReviews.length,
        validCount: processedExternalIds.size,
        updatedCount: 0,
        skippedCount,
        errorCount,
        skippedReviews
      });
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      console.error('[Otelpuan Import] error:', err);
      logPlatformError('Otelpuan', 'import-otelpuan', req, 500, err.message || String(err), elapsed, err);
      return res.status(500).json({
        success: false,
        error: err.message || String(err),
        stack: err.stack || String(err),
        action: 'import-otelpuan',
        elapsedMs: elapsed
      });
    }
  }

  // -------------------------------------------------------------
  // Action: cleanup-sinnada-duplicates
  // -------------------------------------------------------------
  if (action === 'cleanup-sinnada-duplicates') {
    try {
      // 1. Find Sinnada Hotel ID
      const { data: hotels, error: hErr } = await supabaseAdmin
        .from('hotels')
        .select('id, name')
        .ilike('name', '%sinnada%');

      if (hErr || !hotels || hotels.length === 0) {
        return res.status(404).json({ success: false, error: 'Sinnada hotel not found' });
      }

      const sinnadaId = hotels[0].id;

      // 2. Fetch all Otelpuan reviews
      const { data: dbReviews, error: rErr } = await supabaseAdmin
        .from('reviews')
        .select('*')
        .eq('hotel_id', sinnadaId)
        .eq('platform', 'otelpuan');

      if (rErr || !dbReviews) {
        return res.status(500).json({ success: false, error: 'Failed to fetch reviews', details: rErr });
      }

      const normalizeText = (t: string) => (t || '').replace(/\s+/g, ' ').trim().toLowerCase();

      const groupedByText: { [normalizedText: string]: any[] } = {};
      dbReviews.forEach((r: any) => {
        const normText = normalizeText(r.review_text);
        if (!groupedByText[normText]) groupedByText[normText] = [];
        groupedByText[normText].push(r);
      });

      const duplicateGroups: any[] = [];
      Object.keys(groupedByText).forEach(normText => {
        const group = groupedByText[normText];
        if (group.length <= 1) return;

        const sorted = [...group].sort((a, b) => {
          const aHasId = a.platform_review_id && a.platform_review_id.length > 0;
          const bHasId = b.platform_review_id && b.platform_review_id.length > 0;
          if (aHasId && !bHasId) return -1;
          if (!aHasId && bHasId) return 1;

          const aMetaSize = JSON.stringify(a.metadata || {}).length;
          const bMetaSize = JSON.stringify(b.metadata || {}).length;
          if (aMetaSize !== bMetaSize) return bMetaSize - aMetaSize;

          if (a.rating !== b.rating) {
            if (a.rating > 0 && b.rating === 0) return -1;
            if (b.rating > 0 && a.rating === 0) return 1;
          }

          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });

        const keep = sorted[0];
        const toDelete = sorted.slice(1);

        duplicateGroups.push({
          reviewTextPreview: keep.review_text.substring(0, 60),
          reviewerName: keep.guest_name,
          recordIds: group.map(r => r.id),
          externalReviewIds: group.map(r => r.platform_review_id || 'null'),
          createdAtValues: group.map(r => r.created_at),
          keepRecordId: keep.id,
          deleteRecordIds: toDelete.map(r => r.id),
          reason: group.every((r: any) => r.platform_review_id === group[0].platform_review_id)
            ? "Same external_review_id duplicate"
            : "Different external_review_id/hash but same review text"
        });
      });

      const allDeleteIds = duplicateGroups.flatMap(g => g.deleteRecordIds);
      const uniqueCount = dbReviews.length - allDeleteIds.length;

      // DRY RUN CHECK
      const dryRunPassed = (uniqueCount === 13 && allDeleteIds.length === 8);
      
      let deleted = false;
      let deleteError = null;

      // Execute deletion only if dry run matches and execute is true
      if (dryRunPassed && (req.body?.execute === true || req.query?.execute === 'true')) {
        const { error: delErr } = await supabaseAdmin
          .from('reviews')
          .delete()
          .in('id', allDeleteIds);
        
        if (delErr) {
          deleteError = delErr;
        } else {
          deleted = true;
        }
      }

      // Re-fetch to get final count
      const { count: finalCount } = await supabaseAdmin
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('hotel_id', sinnadaId)
        .eq('platform', 'otelpuan');

      return res.status(200).json({
        success: true,
        dryRunPassed,
        initialCount: dbReviews.length,
        uniqueCount,
        duplicateCount: allDeleteIds.length,
        deleted,
        deleteError,
        finalCount: finalCount || 0,
        duplicateGroups,
        deletedRecords: dbReviews.filter((r: any) => allDeleteIds.includes(r.id))
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message || String(err) });
    }
  }

  // -------------------------------------------------------------
  // Action: import-hotelscom
  // -------------------------------------------------------------
  if (action === 'import-hotelscom') {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    let { hotelId, hotelName, hotelscomUrl, limit, mode = 'initial_import' } = req.body;
    if (!hotelId) {
      return res.status(400).json({ success: false, error: 'Missing hotelId parameter' });
    }

    const startTime = Date.now();
    try {
      const { data: userRolesData } = await supabaseAdmin.from('user_roles').select('*, roles(name)').eq('profile_id', user.id);
      let userRole = userRolesData?.[0]?.roles?.name;
      if (user.email === 'admin@ecctur.ai' || user.email === 'cemil.sezgin@ecctur.com') {
        userRole = 'Super Admin';
      }
      const roleNameLower = (userRole || 'staff').toLowerCase();

      // Rule 4: backfill_import is only for Owner (allowing Super Admin as system admin)
      const isOwner = roleNameLower === 'owner' || roleNameLower === 'super admin';
      if (mode === 'backfill_import' && !isOwner) {
        return res.status(403).json({ success: false, error: 'Forbidden: Only Owner role can trigger backfill import.' });
      }

      const { data: hotelData, error: hotelError } = await supabaseAdmin.from('hotels').select('organization_id, name, hotelscom_url').eq('id', hotelId).maybeSingle();
      if (hotelError || !hotelData) return res.status(404).json({ success: false, error: 'Hotel not found' });

      const orgId = hotelData.organization_id;
      if (!hotelName) {
        hotelName = hotelData.name;
      }
      if (!hotelscomUrl) {
        hotelscomUrl = hotelData.hotelscom_url;
      }

      if (!hotelscomUrl) {
        return res.status(400).json({ success: false, error: 'Bu otel için Hotels.com linki tanımlanmamış. Lütfen Admin panelinden tanımlayın.' });
      }

      console.log('[Hotels.com Import Request]', { hotelId, hotelName, hotelscomUrl });

      // 1. Fetch Hotels.com sync state
      const { data: hotelsState } = await supabaseAdmin
        .from('review_sync_states')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('platform', 'Hotels.com')
        .maybeSingle();

      let syncMode = req.body.syncMode || req.query.syncMode || 'incremental_sync';
      if (syncMode !== 'manual_full_resync') {
        const hasSuccessfulHotelsSync = hotelsState && hotelsState.last_successful_sync_at;
        if (!hasSuccessfulHotelsSync) {
          syncMode = 'initial_full_sync';
        }
      }

      // If incremental sync and date filter is unsupported, set limit to a smaller value (like 20)
      const limitVal = limit || (syncMode === 'incremental_sync' ? 20 : 100);
      const scrapedReviews = await reviewImportService.importReviews('hotels.com', hotelscomUrl, limitVal);

      let importedCount = 0;
      let duplicateCount = 0;
      let failedCount = 0;

      console.log("[Hotels Import Insert]", {
        hotelId,
        hotelName,
        platform: 'hotels.com',
        reviewCount: scrapedReviews.length
      });

      for (const r of scrapedReviews) {
        try {
          const isDuplicate = await checkIsDuplicate(
            hotelId,
            'hotels.com',
            r.externalId || null,
            r.guestName,
            r.rating,
            r.reviewText
          );

          if (isDuplicate) {
            duplicateCount++;
            continue;
          }

          const sentiment = r.rating >= 4 ? 'positive' : r.rating === 3 ? 'neutral' : 'negative';

          const { error: insertErr } = await supabaseAdmin.from('reviews').insert({
            hotel_id: hotelId,
            hotel_name: hotelName,
            organization_id: orgId,
            guest_name: r.guestName,
            rating: r.rating,
            review_text: r.reviewText,
            platform: 'hotels.com',
            platform_review_id: r.externalId || null,
            sentiment,
            status: 'Draft',
            publish_status: 'Draft',
            published: 'No',
            created_at: new Date().toISOString(),
            review_date: r.reviewDate || null,
            travel_date: r.travelDate || null,
            owner_response_text: r.ownerResponseText || null,
            owner_response_date: r.ownerResponseDate || null,
            metadata: r.metadata || null
          });

          if (insertErr) {
            console.error('[Hotels.com Import] Database insert error:', insertErr);
            failedCount++;
          } else {
            importedCount++;
          }
        } catch (loopErr) {
          console.error('[Hotels.com Import] Loop exception:', loopErr);
          failedCount++;
        }
      }

      console.log(`[Hotels.com Import] inserted/duplicate count: ${importedCount}/${duplicateCount}`);

      const { count: totalAfterImport } = await supabaseAdmin
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('hotel_id', hotelId)
        .eq('platform', 'hotels.com');

      const hotelsLatestReviewDate = (scrapedReviews || []).length > 0
        ? scrapedReviews.map((r: any) => r.reviewDate).filter(Boolean).sort((a,b) => new Date(b).getTime() - new Date(a).getTime())[0] || null
        : null;

      try {
        await supabaseAdmin.from('review_sync_states').upsert({
          hotel_id: hotelId,
          platform: 'Hotels.com',
          last_sync_at: new Date().toISOString(),
          last_successful_sync_at: new Date().toISOString(),
          last_review_date: hotelsLatestReviewDate || hotelsState?.last_review_date || null,
          last_review_count: (scrapedReviews || []).length,
          last_imported_count: importedCount,
          last_duplicate_count: duplicateCount,
          last_error_count: failedCount,
          sync_mode: syncMode,
          status: failedCount > 0 && importedCount === 0 ? 'error' : 'active',
          error_message: failedCount > 0 ? 'Some Hotels.com reviews failed to import' : null,
          metadata: { dateFilterUnsupported: true }
        });
      } catch (dbErr) {
        console.error('[Hotels.com Import] Failed to update sync state:', dbErr);
      }

      return res.status(200).json({
        success: true,
        platform: 'Hotels.com',
        requestedMode: mode,
        syncMode,
        syncStartDate: 'Tarih filtresi desteklenmiyor',
        imported: importedCount,
        duplicates: duplicateCount,
        skipped: 0,
        errors: failedCount,
        lastReviewDate: hotelsLatestReviewDate || hotelsState?.last_review_date || null,
        nextRecommendedSyncAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        estimatedCostSavingMessage: syncMode === 'incremental_sync' ? 'Kısmi tarama yapıldı, son 20 yorum kontrol edilerek API maliyeti düşürüldü.' : '',
        fetchedCount: scrapedReviews.length,
        insertedCount: importedCount,
        duplicateCount,
        failedCount,
        totalAfterImport: totalAfterImport || 0
      });
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      console.error('[Hotels.com Import] error:', err);
      logPlatformError('Hotels.com', 'import-hotelscom', req, 500, err.message || String(err), elapsed, err);
      return res.status(500).json({
        success: false,
        error: err.message || String(err),
        stack: err.stack || String(err),
        action: 'import-hotelscom',
        elapsedMs: elapsed
      });
    }
  }

  // -------------------------------------------------------------
  // Action: publish-google-reply
  // -------------------------------------------------------------
  if (action === 'publish-google-reply') {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { reviewId, replyText } = req.body;
    if (!reviewId) {
      return res.status(400).json({ success: false, error: 'Missing reviewId parameter' });
    }

    try {
      // 1. Fetch review to identify hotel
      const { data: review, error: rErr } = await supabaseAdmin
        .from('reviews')
        .select('*')
        .eq('id', reviewId)
        .maybeSingle();

      if (rErr || !review) {
        return res.status(404).json({ success: false, error: 'Yorum bulunamadı.' });
      }

      console.log('========================================================================');
      console.log('[DEBUG-PUBLISH-ENDPOINT] Received publish-google-reply request:');
      console.log('  - reviewId:', reviewId);
      console.log('  - replyText parameter length:', replyText ? String(replyText).length : 'undefined/null');
      console.log('  - review.ai_reply field length:', review?.ai_reply ? String(review.ai_reply).length : 'undefined/null');
      console.log('  - review.response field length:', review?.response ? String(review.response).length : 'undefined/null');
      console.log('========================================================================');

      const hotelId = review.hotel_id;

      // 2. Authorization and clearance check
      const { data: userRolesData } = await supabaseAdmin.from('user_roles').select('*, roles(name)').eq('profile_id', user.id);
      let userRole = userRolesData?.[0]?.roles?.name;
      if (user.email === 'admin@ecctur.ai' || user.email === 'cemil.sezgin@ecctur.com') {
        userRole = 'Super Admin';
      }
      const roleNameLower = (userRole || 'staff').toLowerCase();

      if (roleNameLower !== 'super admin' && roleNameLower !== 'admin') {
        const { data: userHotels } = await supabaseAdmin.from('user_hotels').select('*').eq('profile_id', user.id).eq('hotel_id', hotelId);
        if (!userHotels || userHotels.length === 0) {
          return res.status(403).json({ success: false, error: 'Forbidden: You do not have clearance for this hotel.' });
        }
      }

      // 3. Call publish service
      const { publishGoogleReply } = await import('../api-services/googleReplyService.js');
      const publishRes = await publishGoogleReply(reviewId, replyText);

      // 4. Fetch the updated review to return it
      const { data: updatedReview } = await supabaseAdmin
        .from('reviews')
        .select('*')
        .eq('id', reviewId)
        .maybeSingle();

      // Retrieve user profile name for log
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      const userName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'User';

      // 5. Create audit log
      const { error: logErr } = await supabaseAdmin.from('review_action_logs').insert({
        review_id: reviewId,
        hotel_id: review.hotel_id,
        organization_id: review.organization_id,
        action_type: 'published',
        action_by_user_id: user.id,
        action_by_user_email: user.email,
        action_by_user_name: userName,
        action_at: new Date().toISOString(),
        previous_status: review.status,
        new_status: 'Published',
        platform: review.platform,
        guest_name: review.guest_name,
        review_reply_text: replyText || review.ai_reply || review.response || null,
        ai_generated: true, // Google replies from this flow are AI compiled
        published_at: new Date().toISOString(),
        ip_address: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || null,
        user_agent: req.headers['user-agent'] || null
      });

      if (logErr) {
        console.error('[publish-google-reply] Failed to create action log:', logErr);
      }

      return res.status(200).json({
        success: true,
        mock: publishRes.mock,
        message: publishRes.message,
        review: updatedReview
      });
    } catch (err: any) {
      console.error('[API publish-google-reply] Failure:', err);
      return res.status(500).json({ success: false, error: err.message || 'Yayınlama başarısız oldu' });
    }
  }

  // -------------------------------------------------------------
  // Action: backfill-google-dates
  // -------------------------------------------------------------
  if (action === 'backfill-google-dates') {
    try {
      const { data: reviewsToRepair, error: fetchErr } = await supabaseAdmin
        .from('reviews')
        .select('id, created_at, metadata, platform')
        .in('platform', ['Google', 'Google Reviews'])
        .is('review_date', null);

      if (fetchErr) throw fetchErr;

      let repairedCount = 0;
      for (const review of (reviewsToRepair || [])) {
        if (review.created_at) {
          const currentMetadata = review.metadata || {};
          const updatedMetadata = {
            ...currentMetadata,
            display_date: 'Yaklaşık tarih',
            google_relative_date: 'Yaklaşık tarih'
          };

          const { error: updateErr } = await supabaseAdmin
            .from('reviews')
            .update({
              review_date: review.created_at,
              metadata: updatedMetadata
            })
            .eq('id', review.id);

          if (!updateErr) {
            repairedCount++;
          } else {
            console.error(`[Backfill] Failed to update review ${review.id}:`, updateErr);
          }
        }
      }

      return res.status(200).json({
        success: true,
        repairedCount,
        totalChecked: reviewsToRepair?.length || 0
      });
    } catch (err: any) {
      console.error('[API backfill-google-dates] Failure:', err);
      return res.status(500).json({ success: false, error: err.message || 'Backfill failed' });
    }
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}

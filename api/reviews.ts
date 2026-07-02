import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { reviewImportService } from '../api-services/reviewImportService.js';
import { bookingProvider } from '../api-services/providers/bookingProvider.js';

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

function parseRelativeDate(relative: string): string {
  const now = new Date();
  const lower = relative.toLowerCase();
  
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

async function translateText(text: string, targetLang: string): Promise<string> {
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
              content: `You are a professional hotel feedback translator. Translate the given guest review comment into ${targetLangName}. Keep the tone and original meaning exactly same. Only return the translated text without any explanation, markdown, or intro.`
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
        const translated = data.choices?.[0]?.message?.content?.trim();
        if (translated) return translated;
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

  const sourceLang = detectLanguage(text);
  if (sourceLang === targetLang) {
    return text;
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

function compileLocalInsights(reviews: Array<{ comment: string; rating: number; sentiment: string }>) {
  const categories = [
    { id: 'reception', name: 'Resepsiyon ve Giriş', keywords: ['resepsiyon', 'reception', 'check-in', 'check in', 'lobby', 'lobi', 'karşılama', 'giriş', 'bekleme', 'front desk'] },
    { id: 'housekeeping', name: 'Temizlik ve Düzen', keywords: ['temiz', 'kirli', 'havlu', 'çarşaf', 'oda temizliği', 'clean', 'dirty', 'towel', 'sheet', 'dust', 'hijyen'] },
    { id: 'wifi', name: 'Wi-Fi ve Bağlantı', keywords: ['wifi', 'wi-fi', 'internet', 'bağlantı', 'yavaş', 'çekmiyor', 'connection'] },
    { id: 'room', name: 'Oda Konforu ve Klima', keywords: ['oda', 'yatak', 'banyo', 'klima', 'soğuk', 'sıcak', 'ses', 'gürültü', 'noise', 'ac', 'tv'] },
    { id: 'food', name: 'Restoran ve Kahvaltı', keywords: ['yemek', 'kahvaltı', 'restoran', 'lezzet', 'açık büfe', 'garson', 'mutfak', 'food', 'breakfast', 'dinner', 'buffet'] },
    { id: 'spa', name: 'Havuz ve Spa', keywords: ['spa', 'havuz', 'masaj', 'hamam', 'sauna', 'pool', 'massage', 'wellness'] },
    { id: 'location', name: 'Konum ve Çevre', keywords: ['konum', 'merkez', 'yakın', 'manzara', 'plaj', 'deniz', 'location', 'view'] },
    { id: 'staff', name: 'Hizmet Standartları', keywords: ['personel', 'çalışan', 'ilgi', 'güler yüz', 'yardımsever', 'ekip', 'recep', 'garson', 'staff', 'friendly'] }
  ];

  const negativeCounts: Record<string, number> = {};
  const positiveCounts: Record<string, number> = {};
  categories.forEach(c => {
    negativeCounts[c.id] = 0;
    positiveCounts[c.id] = 0;
  });

  reviews.forEach(r => {
    const text = (r.comment || '').toLowerCase();
    const isNeg = r.rating <= 3 || r.sentiment === 'negative';
    const isPos = r.rating >= 4 || r.sentiment === 'positive';

    categories.forEach(c => {
      if (c.keywords.some(k => text.includes(k))) {
        if (isNeg) negativeCounts[c.id]++;
        if (isPos) positiveCounts[c.id]++;
      }
    });
  });

  const sortedNegatives = Object.entries(negativeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  const sortedPositives = Object.entries(positiveCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  const issueTemplates: Record<string, { title: string; description: string }> = {
    reception: {
      title: 'Resepsiyon Yoğunluğu ve Karşılama',
      description: 'Misafirler pik saatlerde giriş ve karşılama süreçlerindeki bekleme sürelerinden şikayetçi olup operasyonel yavaşlık bildirmektedir.'
    },
    housekeeping: {
      title: 'Kat Hizmetleri ve Oda Hijyeni',
      description: 'Odalarda banyo temizliği, tozlanma ve havlu değişimlerindeki gecikmeler misafirlerin konaklama konforunu olumsuz etkilemektedir.'
    },
    wifi: {
      title: 'Wi-Fi Altyapı Hızı ve Bağlantı',
      description: 'Odalar ve genel alanlardaki kablosuz ağın yavaşlığı ve sık sık kopması iş seyahati ve dijital kullanım yapan misafirlerde memnuniyetsizlik yaratmaktadır.'
    },
    room: {
      title: 'Oda Donanımı ve Ses Yalıtımı',
      description: 'Klima soğutma yetersizliği ve yan odalardan gelen gürültüler misafirlerin gece dinlenme kalitesini düşürmektedir.'
    },
    food: {
      title: 'Açık Büfe Çeşitliliği ve Hizmet',
      description: 'Özellikle uzun süreli konaklayan misafirlerde açık büfe kahvaltı çeşitliliğinin azlığı ve restorandaki servis hızı eleştirilmektedir.'
    },
    spa: {
      title: 'Havuz Temizliği ve Spa Bakımı',
      description: 'Havuz sıcaklık ayarları, şezlong yetersizliği ve spa alanlarındaki hijyen standartları iyileştirme bekleyen alanlar arasında yer almaktadır.'
    },
    location: {
      title: 'Gürültü ve Dış Çevre Faktörleri',
      description: 'Tesis çevresindeki ses yalıtım yetersizliği ve ulaşım gürültüleri misafirlerin oda dinlenme konforunu zedelemektedir.'
    },
    staff: {
      title: 'Hizmet Standartları ve İletişim',
      description: 'Yoğun dönemlerde personelin ilgisi ve sipariş süreçlerindeki aksaklıklar misafirlerin hizmet deneyimi algısını düşürmektedir.'
    }
  };

  const highlightTemplates: Record<string, { title: string; description: string }> = {
    staff: {
      title: 'Personel İlgisi ve Misafirperverlik',
      description: 'Misafirlerimiz tüm departmanlardaki çalışanların güler yüzlü, samimi ve proaktif yardımlarını memnuniyetle dile getirmektedir.'
    },
    location: {
      title: 'Konum Avantajı ve Manzara',
      description: 'Otelin merkezi yerleşimi, plaja ve turistik noktalara olan elverişli mesafesi tatil konforunu artıran en önemli unsurlardan biri olmuştur.'
    },
    food: {
      title: 'Yemek Kalitesi ve Sunum Zenginliği',
      description: 'Açık büfe akşam yemeklerindeki lezzet zenginliği ve sunum kalitesi misafirlerden son derece pozitif yorumlar almaktadır.'
    },
    room: {
      title: 'Oda Konforu ve Manzara',
      description: 'Misafirler odaların genişliğini, yatakların konforunu ve oda balkonlarından sunulan manzarayı beğeniyle vurgulamaktadır.'
    },
    reception: {
      title: 'Hızlı ve Sorunsuz Giriş İşlemleri',
      description: 'Resepsiyondaki hızlı check-in prosedürü ve ikramlı karşılama, misafirlerin otele girişteki olumlu izlenimini pekiştirmektedir.'
    },
    spa: {
      title: 'Spa Deneyimi ve Havuz Konforu',
      description: 'Misafirlerimiz masaj terapistlerinin kalitesini, spa alanlarındaki sakinliği ve havuz konforunu sıklıkla övmektedir.'
    },
    housekeeping: {
      title: 'Genel Temizlik ve Oda Hijyeni',
      description: 'Odalarda ve ortak alanlarda sergilenen üst düzey temizlik standartları misafirlerin kendilerini güvende hissetmelerini sağlamaktadır.'
    },
    location_view: {
      title: 'Tesis Peyzajı ve Bahçe Bakımı',
      description: 'Ortak alanların peyzaj kalitesi, yemyeşil bahçeler ve yürüme yolları misafirlerin huzurlu zaman geçirmesine olanak tanımaktadır.'
    }
  };

  const issues = sortedNegatives.slice(0, 5).map(id => {
    const template = issueTemplates[id] || { title: 'Tesis Operasyonu', description: 'Operasyonel detaylar ve genel iyileştirme yapılması önerilen alanlar.' };
    return {
      title: template.title,
      description: template.description,
      category: id
    };
  });

  const highlights = sortedPositives.slice(0, 5).map(id => {
    const template = highlightTemplates[id] || { title: 'Tesis Konforu', description: 'Genel tesis konsepti ve misafirlerin beğendiği detaylar.' };
    return {
      title: template.title,
      description: template.description,
      category: id
    };
  });

  const allActionTemplates: Record<string, { title: string; description: string }> = {
    reception: {
      title: 'Resepsiyon Kadro ve Giriş Yönetimi',
      description: 'Pik giriş saatlerinde resepsiyon kadrosunu desteklemek için esnek vardiya planı uygulanmalı ve bekleme süreleri minimize edilmelidir.'
    },
    housekeeping: {
      title: 'Kat Hizmetleri Hijyen Standartları',
      description: 'Kat hizmetleri departmanında banyo ve genel oda temizliği kontrol listeleri (checklist) revize edilerek denetim sıklığı artırılmalıdır.'
    },
    wifi: {
      title: 'Wi-Fi ve Network Altyapı Denetimi',
      description: 'Odalar ve genel alanlardaki kablosuz erişim noktalarının (AP) sinyal güçleri ve internet bant genişliği teknik olarak test edilp optimize edilmelidir.'
    },
    room: {
      title: 'Oda Donanımları ve Klima Bakımı',
      description: 'Klimaların periyodik filtre temizliği ile ses yalıtım fitillerinin bakımları hızlandırılarak misafir uyku konforu korunmalıdır.'
    },
    food: {
      title: 'Yiyecek & İçecek Operasyonel Revizyonu',
      description: 'Açık büfede sıcak alternatif çeşitliliği artırılmalı ve yoğun kahvaltı saatlerinde restoran servis koordinasyonu yeniden planlanmalıdır.'
    },
    spa: {
      title: 'Spa ve Havuz Hijyen Kontrolü',
      description: 'Havuz sıcaklık ve klor değerleri daha sık ölçülmeli, spa dinlenme alanlarında genel dezenfeksiyon takvimi sıklaştırılmalıdır.'
    },
    location: {
      title: 'Dış Çevre Gürültü İzolasyonu',
      description: 'Dış sokak gürültüsünü engellemek için oda pencerelerinin fitil kontrolleri yapılmalı ve gerekli izolasyon önlemleri alınmalıdır.'
    },
    staff: {
      title: 'Personel Hizmet ve İletişim Eğitimi',
      description: 'Hizmet sunum kalitesini yükseltmek amacıyla tüm servis personeline yönelik iletişim ve problem çözme eğitimleri düzenlenmelidir.'
    }
  };

  const highlightActionTemplates: Record<string, { title: string; description: string }> = {
    staff: {
      title: 'Personel Motivasyon Programı',
      description: 'Misafirlerimizin memnuniyetle bahsettiği çalışanların başarılarını ödüllendiren motivasyon ve prim programları sürdürülmelidir.'
    },
    location: {
      title: 'Konum Odaklı Tanıtım Stratejileri',
      description: 'Tesisin plaja ve turistik alanlara yakınlığı gibi güçlü konum avantajları pazarlama ve sosyal medya kanallarında daha fazla öne çıkarılmalıdır.'
    },
    food: {
      title: 'Açık Büfe Sunum Standartları',
      description: 'Misafirlerden tam not alan akşam yemekleri zenginliği ve sunum kalitesi korunmalı, mevsimlik lezzetler eklenerek zenginleştirilmelidir.'
    },
    room: {
      title: 'Oda Kalite Standartları Korunması',
      description: 'Odalardaki yatak konforu ve peyzaj bütünlüğü korunmalı, yatak takımları ve tekstil ürünleri periyodik olarak yenilenmelidir.'
    },
    reception: {
      title: 'Karşılama İkramları ve Hızlı Check-in',
      description: 'Otele girişte sunulan karşılama ikramları çeşitlendirilmeli ve hızlı giriş süreçlerindeki dijital kolaylıklar artırılmalıdır.'
    },
    spa: {
      title: 'Spa Tanıtım ve Masaj Kampanyaları',
      description: 'Misafirlerin beğenisini toplayan profesyonel masaj terapisi hizmetleri giriş esnasında broşür ve özel indirim paketleriyle teşvik edilmelidir.'
    },
    housekeeping: {
      title: 'Hijyen ve Temizlik Eğitimleri',
      description: 'Misafirlerimizin takdir ettiği temiz odalar standardının devamlılığı için kat hizmetleri eğitimleri periyodik olarak sürdürülmelidir.'
    },
    general: {
      title: 'Genel Tesis Bakım ve Onarım Planı',
      description: 'Ortak alanlardaki peyzaj, bahçe yolları ve aydınlatma armatürlerinin periyodik teknik kontrolleri aksatılmadan sürdürülmelidir.'
    }
  };

  const actions: Array<{ title: string; description: string; category: string }> = [];

  // 1. Add actions based on negative feedback categories first (sorted by priority)
  sortedNegatives.forEach(id => {
    const template = allActionTemplates[id];
    if (template && actions.length < 10) {
      actions.push({
        title: template.title,
        description: template.description,
        category: id
      });
    }
  });

  // 2. Add actions based on positive feedback categories (sorted by priority) to fill up to 10
  sortedPositives.forEach(id => {
    const template = highlightActionTemplates[id];
    if (template && actions.length < 10) {
      const exists = actions.some(a => a.title === template.title);
      if (!exists) {
        actions.push({
          title: template.title,
          description: template.description,
          category: id
        });
      }
    }
  });

  // 3. Fallbacks if we still don't have 10
  const fallbacks = [
    { title: 'Tesis Genel Teknik Bakımı', description: 'Ortak alan aydınlatmaları, kapı kilit sistemleri ve asansörlerin periyodik bakımları zamanında yapılmalıdır.', category: 'room' },
    { title: 'Otopark ve Karşılama Düzeni', description: 'Otel girişinde vale ve otopark yönlendirme süreçleri optimize edilerek ilk izlenim iyileştirilmelidir.', category: 'reception' },
    { title: 'Güvenlik Protokolleri Denetimi', description: 'Ortak alanlardaki güvenlik kameraları ve cankurtaran hizmetlerinin kontrolü periyodik olarak sürdürülmelidir.', category: 'general' }
  ];

  for (const fallback of fallbacks) {
    if (actions.length < 10) {
      actions.push(fallback);
    }
  }

  return { issues, highlights, actions };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = req.query.action || 'import';

  // Authorization check
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ success: false, error: 'Invalid authentication token' });
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
  // Action: generate-insights (AI Business Insights Compiler)
  // -------------------------------------------------------------
  if (action === 'generate-insights') {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { reviews = [] } = req.body;
    const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;

    if (apiKey && reviews.length > 0) {
      try {
        console.log(`[Insights API] Generating business insights via OpenAI for ${reviews.length} reviews...`);
        
        const reviewsSample = reviews.slice(0, 100).map((r: any) => ({
          comment: r.comment || '',
          rating: r.rating || 5,
          sentiment: r.sentiment || 'neutral'
        }));

        const prompt = `
You are a hospitality Business Intelligence expert. Analyze the following guest reviews for a hotel.
Identify the top 5 operational issues/complaints and top 5 positive highlights/praises, and provide exactly 10 strategic, prioritized action recommendations.

Combine similar reviews into single topics (e.g., check-in, queue, lobi waiting should be merged into "Check-in Yoğunluğu").
Write the descriptions using professional Business Intelligence insights phrasing. Make it sound like advice to a hotel board, not just a complaint list.
For example, instead of "Kahvaltı kötü", write "Açık büfe kahvaltıdaki sıcak ürün çeşitliliğinin az olması, özellikle uzun konaklayan misafirlerde memnuniyet kaybına neden oluyor."

Respond ONLY with a JSON object in this format (no markdown, no code block backticks, no extra text):
{
  "issues": [
    { "title": "Check-in Süreçleri", "description": "Öğleden sonraki giriş saatlerinde resepsiyonda yaşanan yoğunluklar misafir karşılama deneyimini zedelemektedir.", "category": "reception" },
    ... (exactly 5 items, category must be one of: reception, housekeeping, wifi, room, food, spa, location, staff)
  ],
  "highlights": [
    { "title": "Çalışan Tutumu ve İlgi", "description": "Resepsiyon ve restoran ekiplerinin güler yüzlü ve proaktif hizmet anlayışı misafir memnuniyetine büyük katkı sunmaktadır.", "category": "staff" },
    ... (exactly 5 items, category must be one of: reception, housekeeping, wifi, room, food, spa, location, staff)
  ],
  "actions": [
    { "title": "Klima Sistemleri Revizyonu", "description": "Sıcak yaz aylarında artan şikayetlerin önüne geçmek amacıyla oda klimalarının filtre temizliği ve kompresör bakımları hızlandırılmalıdır.", "category": "room" },
    ... (exactly 10 items, ordered by priority, category must be one of: reception, housekeeping, wifi, room, food, spa, location, staff, general)
  ]
}

Reviews to analyze:
${JSON.stringify(reviewsSample)}
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
      if (!userRole && (user.email === 'admin@ecctur.ai' || user.email === 'cemil.sezgin@ecctur.com')) {
        userRole = 'Super Admin';
      }
      const roleNameLower = (userRole || 'staff').toLowerCase();

      if (roleNameLower !== 'super admin' && roleNameLower !== 'admin') {
        const { data: userHotels } = await supabaseAdmin.from('user_hotels').select('*').eq('profile_id', user.id).eq('hotel_id', hotelId);
        if (!userHotels || userHotels.length === 0) {
          return res.status(403).json({ success: false, error: 'Forbidden: You do not have clearance for this hotel.' });
        }
      }

      const { data: sampleRows } = await supabaseAdmin.from('hotels').select('*').limit(1);
      const actualHotelCols = sampleRows && sampleRows.length > 0 ? Object.keys(sampleRows[0]) : ['id', 'organization_id', 'name', 'created_at'];
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
      let isMock = useMockEnv === 'true' ? true : useMockEnv === 'false' ? false : !googleLocationId;

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
          const { data: existingReview } = await supabaseAdmin.from('reviews').select('id').eq('platform_review_id', r.platform_review_id);
          if (existingReview && existingReview.length > 0) {
            duplicateCount++;
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

    const { hotelId, range = '365' } = req.body;
    if (!hotelId) {
      return res.status(400).json({ success: false, error: 'Missing hotelId parameter' });
    }

    try {
      const { data: userRolesData } = await supabaseAdmin.from('user_roles').select('*, roles(name)').eq('profile_id', user.id);
      let userRole = userRolesData?.[0]?.roles?.name;
      if (!userRole && (user.email === 'admin@ecctur.ai' || user.email === 'cemil.sezgin@ecctur.com')) {
        userRole = 'Super Admin';
      }
      const roleNameLower = (userRole || 'staff').toLowerCase();

      if (roleNameLower !== 'super admin' && roleNameLower !== 'admin') {
        const { data: userHotels } = await supabaseAdmin.from('user_hotels').select('*').eq('profile_id', user.id).eq('hotel_id', hotelId);
        if (!userHotels || userHotels.length === 0) {
          return res.status(403).json({ success: false, error: 'Forbidden: You do not have clearance for this hotel.' });
        }
      }

      const { data: hotelData, error: hotelErr } = await supabaseAdmin.from('hotels').select('organization_id, name, booking_property_id').eq('id', hotelId).maybeSingle();
      if (hotelErr || !hotelData) throw new Error(hotelErr?.message || 'Hotel not found');

      const orgId = hotelData.organization_id;
      const bookingPropertyId = hotelData.booking_property_id;

      if (!bookingPropertyId) {
        return res.status(400).json({ success: false, error: 'Hotel has no Booking.com Property ID configured' });
      }

      const bookingReviews = await bookingProvider.fetchReviews(bookingPropertyId);

      let cutoffDate: Date | null = null;
      if (range !== 'all') {
        const days = parseInt(range, 10) || 365;
        cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
      }

      const filteredReviews = bookingReviews.filter(r => {
        if (!cutoffDate) return true;
        return new Date(r.review_date) >= cutoffDate;
      });

      let successCount = 0;
      let duplicateCount = 0;
      let failedCount = 0;
      const detailedErrors: any[] = [];
      const importDetails: any[] = [];

      for (let r of filteredReviews) {
        try {
          const { data: existingReview } = await supabaseAdmin.from('reviews').select('id').eq('platform_review_id', r.review_id);
          if (existingReview && existingReview.length > 0) {
            duplicateCount++;
            importDetails.push({ reviewId: r.review_id, status: 'duplicate_skipped' });
            continue;
          }

          const reviewRecord = {
            platform_review_id: r.review_id,
            guest_name: r.guest_name,
            rating: Math.round(r.rating) || 10,
            review_text: r.review_text || r.headline || '',
            platform: 'booking',
            sentiment: r.rating >= 8 ? 'positive' : r.rating >= 6 ? 'neutral' : 'negative',
            status: 'Draft',
            published: 'No',
            created_at: r.review_date,
            review_date: r.review_date,
            hotel_id: hotelId,
            organization_id: orgId
          };

          const { error: insErr } = await supabaseAdmin.from('reviews').insert(reviewRecord);
          if (insErr) throw insErr;

          await postToN8N({
            platform_review_id: r.review_id,
            reviewer_display_name: r.guest_name,
            star_rating: r.rating,
            comment_text: r.review_text || r.headline || '',
            create_update_time: r.review_date,
            reply: null,
            platform: 'booking',
            hotel_id: hotelId,
            organization_id: orgId
          });

          successCount++;
          importDetails.push({ reviewId: r.review_id, status: 'sent' });
        } catch (err: any) {
          failedCount++;
          detailedErrors.push({ reviewId: r.review_id, message: err.message || String(err) });
          importDetails.push({ reviewId: r.review_id, status: 'failed', error: err.message || String(err) });
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
  // Action: import-google-maps
  // -------------------------------------------------------------
  if (action === 'import-google-maps') {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { hotelId, googleMapsUrl } = req.body;
    if (!hotelId || !googleMapsUrl) {
      return res.status(400).json({ success: false, error: 'Missing hotelId or googleMapsUrl parameter' });
    }

    try {
      const { data: hotelData, error: hotelError } = await supabaseAdmin.from('hotels').select('organization_id, name').eq('id', hotelId).maybeSingle();
      if (hotelError || !hotelData) return res.status(404).json({ success: false, error: 'Hotel not found' });

      const orgId = hotelData.organization_id;
      const scrapedReviews = await reviewImportService.importReviews('Google', googleMapsUrl);

      let importedCount = 0;
      let duplicateCount = 0;

      for (const r of scrapedReviews) {
        const { data: existingReview } = await supabaseAdmin
          .from('reviews')
          .select('id')
          .eq('hotel_id', hotelId)
          .eq('platform', 'Google')
          .eq('guest_name', r.guestName)
          .eq('review_text', r.reviewText)
          .eq('rating', r.rating)
          .limit(1);

        if (existingReview && existingReview.length > 0) {
          duplicateCount++;
          continue;
        }

        const sentiment = r.rating >= 4 ? 'positive' : r.rating === 3 ? 'neutral' : 'negative';

        await supabaseAdmin.from('reviews').insert({
          hotel_id: hotelId,
          organization_id: orgId,
          guest_name: r.guestName,
          rating: r.rating,
          review_text: r.reviewText,
          platform: 'Google',
          sentiment,
          status: 'draft',
          published: 'No',
          created_at: parseRelativeDate(r.reviewDate)
        });
        importedCount++;
      }

      return res.status(200).json({
        success: true,
        totalFetched: scrapedReviews.length,
        importedCount,
        duplicateCount
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message || String(err) });
    }
  }

  // -------------------------------------------------------------
  // Action: import-tripadvisor
  // -------------------------------------------------------------
  if (action === 'import-tripadvisor') {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { hotelId, tripadvisorUrl } = req.body;
    if (!hotelId || !tripadvisorUrl) {
      return res.status(400).json({ success: false, error: 'Missing hotelId or tripadvisorUrl parameter' });
    }

    try {
      const { data: hotelData, error: hotelError } = await supabaseAdmin.from('hotels').select('organization_id, name').eq('id', hotelId).maybeSingle();
      if (hotelError || !hotelData) return res.status(404).json({ success: false, error: 'Hotel not found' });

      const orgId = hotelData.organization_id;
      const scrapedReviews = await reviewImportService.importReviews('Tripadvisor', tripadvisorUrl);

      let importedCount = 0;
      let duplicateCount = 0;

      for (const r of scrapedReviews) {
        const { data: existingReview } = await supabaseAdmin
          .from('reviews')
          .select('id')
          .eq('hotel_id', hotelId)
          .eq('platform', 'Tripadvisor')
          .eq('guest_name', r.guestName)
          .eq('review_text', r.reviewText)
          .eq('rating', r.rating)
          .limit(1);

        if (existingReview && existingReview.length > 0) {
          duplicateCount++;
          continue;
        }

        const sentiment = r.rating >= 4 ? 'positive' : r.rating === 3 ? 'neutral' : 'negative';

        await supabaseAdmin.from('reviews').insert({
          hotel_id: hotelId,
          organization_id: orgId,
          guest_name: r.guestName,
          rating: r.rating,
          review_text: r.reviewText,
          platform: 'Tripadvisor',
          sentiment,
          status: 'draft',
          published: 'No',
          created_at: parseRelativeDate(r.reviewDate)
        });
        importedCount++;
      }

      return res.status(200).json({
        success: true,
        totalFetched: scrapedReviews.length,
        importedCount,
        duplicateCount
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message || String(err) });
    }
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}

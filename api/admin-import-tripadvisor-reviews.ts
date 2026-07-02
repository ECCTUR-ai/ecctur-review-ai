import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { reviewImportService } from './services/reviewImportService.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ success: false, error: 'Invalid authentication token' });
    }

    const { hotelId, tripadvisorUrl } = req.body;
    console.log('[DEBUG-ENDPOINT-TRIPADVISOR] Received body parameters:');
    console.log('  - req.body.hotelId:', hotelId);
    console.log('  - req.body.tripadvisorUrl:', tripadvisorUrl);

    if (!hotelId || !tripadvisorUrl) {
      return res.status(400).json({ success: false, error: 'Missing hotelId or tripadvisorUrl parameter' });
    }

    const { data: hotelData, error: hotelError } = await supabaseAdmin
      .from('hotels')
      .select('organization_id, name')
      .eq('id', hotelId)
      .single();

    if (hotelError || !hotelData) {
      return res.status(404).json({ success: false, error: 'Hotel not found' });
    }

    const orgId = hotelData.organization_id;

    console.log(`[Tripadvisor Scraper API] Starting import service scrape for hotel: ${hotelData.name} (${hotelId})`);
    const scrapedReviews = await reviewImportService.importReviews('Tripadvisor', tripadvisorUrl);
    console.log(`[Tripadvisor Scraper API] Scraped ${scrapedReviews.length} reviews from import service`);

    let importedCount = 0;
    let duplicateCount = 0;

    for (const r of scrapedReviews) {
      const { data: existingReview, error: lookupError } = await supabaseAdmin
        .from('reviews')
        .select('id')
        .eq('hotel_id', hotelId)
        .eq('platform', 'Tripadvisor')
        .eq('guest_name', r.guestName)
        .eq('review_text', r.reviewText)
        .eq('rating', r.rating)
        .limit(1);

      if (lookupError) {
        console.error('[Tripadvisor Scraper API] Database lookup failure:', lookupError);
        continue;
      }

      if (existingReview && existingReview.length > 0) {
        duplicateCount++;
        continue;
      }

      const sentiment = r.rating >= 4 ? 'positive' : r.rating === 3 ? 'neutral' : 'negative';

      const { error: insertError } = await supabaseAdmin
        .from('reviews')
        .insert({
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

      if (insertError) {
        console.error('[Tripadvisor Scraper API] Insert failure:', insertError);
      } else {
        importedCount++;
      }
    }

    // Log diagnostic counts
    console.log('[TRIPADVISOR DUPLICATE COUNT]', duplicateCount);
    console.log('[TRIPADVISOR INSERTED COUNT]', importedCount);

    return res.status(200).json({
      success: true,
      totalFetched: scrapedReviews.length,
      importedCount,
      duplicateCount,
      rawCount: scrapedReviews.length,
      normalizedCount: scrapedReviews.length,
      insertedCount: importedCount
    });

  } catch (err: any) {
    console.error('[Tripadvisor Scraper API] Handler failure:', err);
    const errMsg = err.message || '';
    
    if (errMsg === 'apify_token_missing') {
      return res.status(400).json({
        success: false,
        error: 'apify_token_missing',
        message: 'Vercel Environment Variables içine APIFY_TOKEN eklenmeli.'
      });
    }

    if (errMsg === 'apify_actor_failed') {
      return res.status(500).json({
        success: false,
        error: 'apify_actor_failed',
        message: 'Apify actor execution failed.',
        rawError: err.rawError || String(err),
        apifyError: err.rawError || String(err)
      });
    }

    if (errMsg === 'no_reviews_found') {
      return res.status(404).json({
        success: false,
        error: 'no_reviews_found',
        message: 'Bu TripAdvisor linkinden yorum bulunamadı.'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'scraper_failed',
      message: errMsg || String(err),
      rawError: err.rawError || String(err),
      apifyError: err.rawError || String(err)
    });
  }
}

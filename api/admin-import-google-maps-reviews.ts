import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { scrapeGoogleMapsReviews } from './services/googleScraperService';

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
  
  // Handlers for common English patterns
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

  // Handlers for common Turkish patterns
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
    // Allow POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    // 1. Authorization check
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ success: false, error: 'Invalid authentication token' });
    }

    const { hotelId, googleMapsUrl } = req.body;
    if (!hotelId || !googleMapsUrl) {
      return res.status(400).json({ success: false, error: 'Missing hotelId or googleMapsUrl parameter' });
    }

    // 2. Load hotel information to assert organization mapping
    const { data: hotelData, error: hotelError } = await supabaseAdmin
      .from('hotels')
      .select('organization_id, name')
      .eq('id', hotelId)
      .single();

    if (hotelError || !hotelData) {
      return res.status(404).json({ success: false, error: 'Hotel not found' });
    }

    const orgId = hotelData.organization_id;

    // 3. Trigger Playwright Scraper
    console.log(`[Google Maps Scraper API] Starting scrape for hotel: ${hotelData.name} (${hotelId})`);
    const scrapedReviews = await scrapeGoogleMapsReviews(googleMapsUrl);
    console.log(`[Google Maps Scraper API] Scraped ${scrapedReviews.length} reviews`);

    let importedCount = 0;
    let duplicateCount = 0;

    // 4. Duplicate checks and insert
    for (const r of scrapedReviews) {
      const { data: existingReview, error: lookupError } = await supabaseAdmin
        .from('reviews')
        .select('id')
        .eq('hotel_id', hotelId)
        .eq('platform', 'Google')
        .eq('guest_name', r.guestName)
        .eq('review_text', r.reviewText)
        .eq('rating', r.rating)
        .limit(1);

      if (lookupError) {
        console.error('[Google Maps Scraper API] Database lookup failure:', lookupError);
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
          platform: 'Google',
          sentiment,
          status: 'draft',
          published: 'No',
          created_at: parseRelativeDate(r.relativeDate)
        });

      if (insertError) {
        console.error('[Google Maps Scraper API] Insert failure:', insertError);
      } else {
        importedCount++;
      }
    }

    return res.status(200).json({
      success: true,
      totalFetched: scrapedReviews.length,
      importedCount,
      duplicateCount
    });

  } catch (err: any) {
    console.error('[Google Maps Scraper API] Handler failure:', err);
    
    const errMsg = err.message || '';
    
    // Check if we are running in Vercel or if Playwright launch failed
    const isPlaywrightLaunchFailure = 
      process.env.VERCEL || 
      errMsg.includes('launch') || 
      errMsg.includes('executable') || 
      errMsg.includes('scraper_failed') || 
      String(err).includes('chromium') || 
      String(err).includes('Playwright');

    if (isPlaywrightLaunchFailure) {
      return res.status(500).json({
        success: false,
        error: 'playwright_not_supported_on_vercel',
        message: 'Playwright is not natively supported on Vercel Serverless Functions due to execution environment limits. Alternatives: playwright-core + @sparticuz/chromium, external workers, or Browserless/Apify.'
      });
    }

    if (['invalid_url', 'captcha_or_blocked', 'no_reviews_found'].includes(errMsg)) {
      return res.status(500).json({ success: false, error: errMsg });
    }

    return res.status(500).json({ success: false, error: 'scraper_failed', details: errMsg });
  }
}

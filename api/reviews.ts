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

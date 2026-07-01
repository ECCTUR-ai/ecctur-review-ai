import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

// Post review helper to n8n webhook if configured (uses production URL when active)
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let hotelIdForLog = 'unknown';
  let orgIdForLog = 'unknown';
  const isMock = !process.env.GOOGLE_CLIENT_ID && !process.env.GOOGLE_BUSINESS_REFRESH_TOKEN;

  // Enforce try/catch around the entire handler (Requirement 3)
  try {
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

    const { hotelId, range = '365' } = req.body;
    let { googleReviews = [] } = req.body;

    if (!hotelId) {
      return res.status(400).json({ success: false, error: 'Missing hotelId parameter' });
    }
    hotelIdForLog = hotelId;

    // Load caller role and hotel permissions
    const { data: userRolesData } = await supabaseAdmin
      .from('user_roles')
      .select('*, roles(name)')
      .eq('profile_id', user.id);

    let userRole = userRolesData?.[0]?.roles?.name;
    if (!userRole && (user.email === 'admin@ecctur.ai' || user.email === 'cemil.sezgin@ecctur.com')) {
      userRole = 'Super Admin';
    }

    const roleNameLower = userRole?.toLowerCase();
    
    // Verify user has access to this hotel
    if (roleNameLower !== 'super admin' && roleNameLower !== 'admin') {
      const { data: userHotels } = await supabaseAdmin
        .from('user_hotels')
        .select('*')
        .eq('profile_id', user.id)
        .eq('hotel_id', hotelId);

      if (!userHotels || userHotels.length === 0) {
        return res.status(403).json({ success: false, error: 'Forbidden: You do not have clearance for this hotel.' });
      }
    }

    // Inspect and print actual table columns for debugging (Requirement 9 / startup debugging)
    const { data: sampleRows } = await supabaseAdmin.from('hotels').select('*').limit(1);
    const actualHotelCols = sampleRows && sampleRows.length > 0 ? Object.keys(sampleRows[0]) : ['id', 'organization_id', 'name', 'created_at'];
    console.log('ACTUAL_HOTELS_COLUMNS:', actualHotelCols);

    const { data: sampleSettings } = await supabaseAdmin.from('integration_settings').select('*').limit(1);
    const actualSettingsCols = sampleSettings && sampleSettings.length > 0 ? Object.keys(sampleSettings[0]) : ['id', 'name', 'status', 'updated_at'];
    console.log('ACTUAL_SETTINGS_COLUMNS:', actualSettingsCols);

    let googleLocationId: string | null = null;
    let googleMapsUrl: string | null = null;

    // Build hotels select fields dynamically based on schema presence
    let hotelSelectFields = 'organization_id, name';
    if (actualHotelCols.includes('google_location_id')) hotelSelectFields += ', google_location_id';
    if (actualHotelCols.includes('google_place_id')) hotelSelectFields += ', google_place_id';
    if (actualHotelCols.includes('google_maps_url')) hotelSelectFields += ', google_maps_url';
    if (actualHotelCols.includes('google_maps_link')) hotelSelectFields += ', google_maps_link';

    // Get organization and mapping values from hotels table (hotels.google_location_id first)
    const { data: hotelData, error: hotelErr } = await supabaseAdmin
      .from('hotels')
      .select(hotelSelectFields)
      .eq('id', hotelId)
      .single();

    if (hotelErr || !hotelData) {
      throw new Error(`Hotel lookup failed: ${hotelErr?.message || 'Hotel not found'}`);
    }

    const orgId = hotelData.organization_id;
    orgIdForLog = orgId;

    // Read Google mapping from hotels table first (Requirement 3)
    if (hotelData.google_location_id) {
      googleLocationId = hotelData.google_location_id;
    } else if (hotelData.google_place_id) {
      googleLocationId = hotelData.google_place_id;
    }

    if (hotelData.google_maps_url) {
      googleMapsUrl = hotelData.google_maps_url;
    } else if ((hotelData as any).google_maps_link) {
      googleMapsUrl = (hotelData as any).google_maps_link;
    }

    // Fallback to integration_settings.config->>'google_location_id' (Requirement 3)
    if (!googleLocationId) {
      let settingsQuery = supabaseAdmin.from('integration_settings').select('*');
      if (actualSettingsCols.includes('hotel_id')) {
        settingsQuery = settingsQuery.eq('hotel_id', hotelId);
      } else if (actualSettingsCols.includes('organization_id')) {
        settingsQuery = settingsQuery.eq('organization_id', orgId);
      } else {
        settingsQuery = settingsQuery.eq('id', 'google_business');
      }

      const { data: settingsData } = await settingsQuery;
      const gSetting = settingsData?.find((s: any) => s.id === 'google_business' || s.provider === 'google');
      if (gSetting && actualSettingsCols.includes('config') && gSetting.config) {
        const configObj = typeof gSetting.config === 'string' ? JSON.parse(gSetting.config) : gSetting.config;
        if (configObj && configObj.google_location_id) {
          googleLocationId = configObj.google_location_id;
        }
      }
    }

    // Evaluate USE_MOCK_GOOGLE_PROVIDER environment flag (Requirement 5 & 6)
    const useMockEnv = process.env.USE_MOCK_GOOGLE_PROVIDER;
    let isMock = false;
    if (useMockEnv === 'true') {
      isMock = true;
    } else if (useMockEnv === 'false') {
      isMock = false;
    } else {
      // Default: use mock provider only when google_location_id does not exist
      isMock = !googleLocationId;
    }

    // Verify mapping configured (Requirement 4 & 7)
    if (!googleLocationId) {
      if (isMock && googleMapsUrl) {
        console.log('[Import] Using hotels.google_maps_url fallback for mock/demo mode:', googleMapsUrl);
      } else {
        return res.status(400).json({
          success: false,
          error: 'Hotel has no Google Business mapping configured',
          details: 'Please configure hotels.google_location_id or integration_settings.config.google_location_id. Fallback google_maps_url is only allowed in mock/demo mode.'
        });
      }
    }

    // If real provider is expected but no googleReviews array payload is provided, return configuration warning
    if (!isMock && googleReviews.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Google Business Profile API integration is not completed.',
        details: 'The real Google provider is active, but no googleReviews payload was provided in the request body, and direct Google API fetch credentials are not configured.'
      });
    }

    // If using mock provider and no input reviews are provided, return mock reviews correctly (Requirement 5 & 7)
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
          comment: '', // Empty comment to test Requirement 5
          createTime: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];
    }

    // Log start of import details (Requirement 4)
    console.log('IMPORT_REVIEWS_START', {
      hotelId,
      organizationId: orgId,
      googleProviderClass: isMock ? 'MockGoogleProvider' : 'RealGoogleProvider',
      webhookUrl: process.env.N8N_WEBHOOK_URL || 'https://cemilsezgin.app.n8n.cloud/webhook/ecctur-review'
    });

    // Log raw Google reviews before sending to n8n (Requirement 1)
    console.log('GOOGLE_RAW_REVIEWS', JSON.stringify(googleReviews, null, 2));

    // Map Google review payloads
    const mappedReviews: any[] = [];
    const mappingValue = googleLocationId || googleMapsUrl;

    for (let raw of googleReviews) {
      const mapped = mapGoogleReview(raw, hotelId, orgId);
      if (mapped) {
        if (!mapped.google_location_id && mappingValue) {
          const match = String(mappingValue).match(/place\/([^\/]+)/);
          if (match) {
            mapped.google_location_id = match[1];
          } else {
            mapped.google_location_id = mappingValue;
          }
        }
        mappedReviews.push(mapped);
      }
    }

    // Compute cutoff date
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
    const importDetails: { reviewId: string; status: 'sent' | 'duplicate_skipped' | 'failed'; error?: string }[] = [];

    for (let r of filteredReviews) {
      try {
        const { data: existingReview } = await supabaseAdmin
          .from('reviews')
          .select('id')
          .eq('platform_review_id', r.platform_review_id);

        if (existingReview && existingReview.length > 0) {
          duplicateCount++;
          console.log(`[Import] Review ${r.platform_review_id} already exists, skipping.`);
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

        const { data: newRev, error: insErr } = await supabaseAdmin
          .from('reviews')
          .insert(reviewRecord)
          .select()
          .single();

        if (insErr) {
          throw new Error(JSON.stringify({
            type: 'SUPABASE_INSERT_ERROR',
            webhookUrl: '',
            status: 500,
            responseBody: insErr.message || String(insErr),
            message: insErr.message || String(insErr),
            reviewId: r.platform_review_id
          }));
        }

        // Post Google-specific fields to n8n (Requirement 2)
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
        console.error(`[Import] Failed to import review ${r.platform_review_id}:`, err);
        
        let parsedErr: any;
        try {
          parsedErr = JSON.parse(err.message);
        } catch (_) {
          parsedErr = {
            type: 'GENERIC_ERROR',
            webhookUrl: '',
            status: 500,
            responseBody: err.message || String(err),
            message: err.message || String(err),
            reviewId: r.platform_review_id
          };
        }

        detailedErrors.push(parsedErr);
        importDetails.push({
          reviewId: r.platform_review_id,
          status: 'failed',
          error: parsedErr.message || String(err)
        });
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
    // Log details on handler level exception (Requirement 4)
    console.error('IMPORT_REVIEWS_ERROR', {
      hotelId: hotelIdForLog,
      organizationId: orgIdForLog,
      googleProviderClass: isMock ? 'MockGoogleProvider' : 'RealGoogleProvider',
      webhookUrl: process.env.N8N_WEBHOOK_URL || 'https://cemilsezgin.app.n8n.cloud/webhook/ecctur-review',
      errorStack: err.stack || String(err)
    });

    // Ensure API always returns JSON (Requirement 5)
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error',
      details: err.stack || String(err)
    });
  }
}

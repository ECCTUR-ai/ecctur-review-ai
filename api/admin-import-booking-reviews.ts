import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { bookingProvider } from '../src/services/providers/bookingProvider';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function postToN8N(review: any) {
  let webhookUrl = process.env.N8N_WEBHOOK_URL || 'https://cemilsezgin.app.n8n.cloud/webhook/ecctur-review';
  if (webhookUrl.includes('/webhook-test/')) {
    webhookUrl = webhookUrl.replace('/webhook-test/', '/webhook/');
  }
  if (webhookUrl.includes('n8n.cloud') && !webhookUrl.includes('/webhook/ecctur-review')) {
    webhookUrl = 'https://cemilsezgin.app.n8n.cloud/webhook/ecctur-review';
  }
  console.log('[Booking n8n Poster] Posting review to:', webhookUrl);

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
      reviewId: review.platform_review_id
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
      reviewId: review.platform_review_id
    }));
  }

  console.log('[Booking n8n Poster] Response status:', res.status);
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

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  let hotelIdForLog = '';
  let orgIdForLog = '';

  try {
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

    // Load hotel to find booking_property_id
    const { data: hotelData, error: hotelErr } = await supabaseAdmin
      .from('hotels')
      .select('organization_id, name, booking_property_id')
      .eq('id', hotelId)
      .single();

    if (hotelErr || !hotelData) {
      throw new Error(`Hotel lookup failed: ${hotelErr?.message || 'Hotel not found'}`);
    }

    const orgId = hotelData.organization_id;
    orgIdForLog = orgId;

    const bookingPropertyId = hotelData.booking_property_id;
    if (!bookingPropertyId) {
      return res.status(400).json({
        success: false,
        error: 'Hotel has no Booking.com Property ID configured',
        details: 'Please configure booking_property_id for this hotel under admin settings.'
      });
    }

    console.log('IMPORT_BOOKING_REVIEWS_START', {
      hotelId,
      organizationId: orgId,
      bookingPropertyId,
      webhookUrl: process.env.N8N_WEBHOOK_URL || 'https://cemilsezgin.app.n8n.cloud/webhook/ecctur-review'
    });

    // Fetch reviews from provider (supports mock mode fallback internally)
    const bookingReviews = await bookingProvider.fetchReviews(bookingPropertyId);
    console.log('BOOKING_RAW_REVIEWS_COUNT:', bookingReviews.length);

    // Compute cutoff date
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
    const importDetails: { reviewId: string; status: 'sent' | 'duplicate_skipped' | 'failed'; error?: string }[] = [];

    for (let r of filteredReviews) {
      try {
        // Check duplicate
        const { data: existingReview } = await supabaseAdmin
          .from('reviews')
          .select('id')
          .eq('platform_review_id', r.review_id);

        if (existingReview && existingReview.length > 0) {
          duplicateCount++;
          console.log(`[Import Booking] Review ${r.review_id} already exists, skipping.`);
          importDetails.push({ reviewId: r.review_id, status: 'duplicate_skipped' });
          continue;
        }

        // Map into schema format (normalized mapping)
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

        const { error: insErr } = await supabaseAdmin
          .from('reviews')
          .insert(reviewRecord);

        if (insErr) {
          throw new Error(JSON.stringify({
            type: 'SUPABASE_INSERT_ERROR',
            webhookUrl: '',
            status: 500,
            responseBody: insErr.message || String(insErr),
            message: insErr.message || String(insErr),
            reviewId: r.review_id
          }));
        }

        // Post to n8n webhook
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
        console.error(`[Import Booking] Failed to import review ${r.review_id}:`, err);
        
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
            reviewId: r.review_id
          };
        }

        detailedErrors.push(parsedErr);
        importDetails.push({
          reviewId: r.review_id,
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
    console.error('IMPORT_BOOKING_REVIEWS_ERROR:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error',
      details: err.stack || String(err)
    });
  }
}

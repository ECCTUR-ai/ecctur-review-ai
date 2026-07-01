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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Authorization check
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid authentication token' });
  }

  const { hotelId, range = '365' } = req.body;
  if (!hotelId) {
    return res.status(400).json({ error: 'Missing hotelId parameter' });
  }

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
      return res.status(403).json({ error: 'Forbidden: You do not have clearance for this hotel.' });
    }
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Authorization check
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid authentication token' });
  }

  const { hotelId, range = '365', googleReviews = [] } = req.body;
  if (!hotelId) {
    return res.status(400).json({ error: 'Missing hotelId parameter' });
  }

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
      return res.status(403).json({ error: 'Forbidden: You do not have clearance for this hotel.' });
    }
  }

  try {
    // Get organization associated with hotel
    const { data: hotelData, error: hotelErr } = await supabaseAdmin
      .from('hotels')
      .select('organization_id, name, google_maps_link')
      .eq('id', hotelId)
      .single();

    if (hotelErr || !hotelData) {
      throw new Error(`Hotel lookup failed: ${hotelErr?.message || 'Hotel not found'}`);
    }

    const orgId = hotelData.organization_id;

    // Log raw google reviews array before sending to n8n (Requirement 1)
    console.log('GOOGLE_RAW_REVIEWS', JSON.stringify(googleReviews, null, 2));

    // Map Google review payloads
    const mappedReviews: any[] = [];
    for (let raw of googleReviews) {
      const mapped = mapGoogleReview(raw, hotelId, orgId);
      if (mapped) {
        if (!mapped.google_location_id && hotelData.google_maps_link) {
          const match = hotelData.google_maps_link.match(/place\/([^\/]+)/);
          if (match) mapped.google_location_id = match[1];
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
    console.error('Reviews import failed:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}

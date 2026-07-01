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

  try {
    // Get organization associated with hotel
    const { data: hotelData, error: hotelErr } = await supabaseAdmin
      .from('hotels')
      .select('organization_id, name')
      .eq('id', hotelId)
      .single();

    if (hotelErr || !hotelData) {
      throw new Error(`Hotel lookup failed: ${hotelErr?.message || 'Hotel not found'}`);
    }

    const orgId = hotelData.organization_id;

    // Google Business simulated review bank with distributed dates
    const rawImportedReviews = [
      {
        platform_review_id: `g-${hotelId}-101`,
        guest_name: 'Kemal Sunal',
        rating: 5,
        review_text: 'Otel personeli çok kibar ve ilgiliydi. Temizlik harikaydı, odalar çok geniş.',
        platform: 'Google',
        sentiment: 'positive',
        status: 'draft',
        review_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days ago (Fits Son 30)
      },
      {
        platform_review_id: `g-${hotelId}-102`,
        guest_name: 'Şener Şen',
        rating: 4,
        review_text: 'Kahvaltı çeşitleri yeterliydi ancak akşam yemeğinde servis biraz yavaş kaldı. Genel olarak memnun kaldık.',
        platform: 'Google',
        sentiment: 'neutral',
        status: 'draft',
        review_date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString() // 45 days ago (Fits Son 90)
      },
      {
        platform_review_id: `g-${hotelId}-103`,
        guest_name: 'Adile Naşit',
        rating: 2,
        review_text: 'Giriş işlemleri çok uzun sürdü, oda hazır değildi. Hizmet kalitesi bu fiyata yakışmıyor.',
        platform: 'Google',
        sentiment: 'negative',
        status: 'draft',
        review_date: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString() // 120 days ago (Fits Son 180)
      },
      {
        platform_review_id: `g-${hotelId}-104`,
        guest_name: 'Halit Akçatepe',
        rating: 5,
        review_text: 'Konumu mükemmel, denize sıfır ve bahçesi çok güzel dizayn edilmiş. Kesinlikle öneririm.',
        platform: 'Google',
        sentiment: 'positive',
        status: 'draft',
        review_date: new Date(Date.now() - 250 * 24 * 60 * 60 * 1000).toISOString() // 250 days ago (Fits Son 365)
      },
      {
        platform_review_id: `g-${hotelId}-105`,
        guest_name: 'Tarık Akan',
        rating: 3,
        review_text: 'Oda servisi başarılıydı ancak havuz hijyeni konusunda bazı şüphelerim var. Geliştirilmeli.',
        platform: 'Google',
        sentiment: 'neutral',
        status: 'draft',
        review_date: new Date(Date.now() - 500 * 24 * 60 * 60 * 1000).toISOString() // 500 days ago (Fits All Time)
      }
    ];

    // Compute cutoff date
    let cutoffDate: Date | null = null;
    if (range !== 'all') {
      const days = parseInt(range, 10) || 365;
      cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
    }

    const filteredReviews = rawImportedReviews.filter(r => {
      if (!cutoffDate) return true;
      return new Date(r.review_date) >= cutoffDate;
    });

    let successCount = 0;
    let duplicateCount = 0;
    let failedCount = 0;
    const detailedErrors: any[] = [];

    for (let r of filteredReviews) {
      try {
        const { data: existingReview } = await supabaseAdmin
          .from('reviews')
          .select('id')
          .eq('platform_review_id', r.platform_review_id);

        if (existingReview && existingReview.length > 0) {
          duplicateCount++;
          console.log(`[Import] Review ${r.platform_review_id} already exists, skipping.`);
          continue;
        }

        const reviewRecord = {
          platform_review_id: r.platform_review_id,
          guest_name: r.guest_name,
          rating: r.rating,
          review_text: r.review_text,
          platform: r.platform,
          sentiment: r.sentiment,
          status: r.status,
          created_at: r.review_date,
          hotel_id: hotelId,
          organization_id: orgId
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

        // Post to n8n (throws structured error if HTTP or network fail)
        await postToN8N({
          ...reviewRecord,
          id: newRev.id,
          hotelName: hotelData.name
        });

        successCount++;

      } catch (err: any) {
        failedCount++;
        console.error(`[Import] Failed to import review ${r.platform_review_id}:`, err);
        
        try {
          const parsed = JSON.parse(err.message);
          detailedErrors.push({
            type: parsed.type || 'GENERIC_ERROR',
            webhookUrl: parsed.webhookUrl || '',
            status: parsed.status !== undefined ? parsed.status : 0,
            responseBody: parsed.responseBody || '',
            message: parsed.message || err.message || String(err),
            reviewId: parsed.reviewId || r.platform_review_id
          });
        } catch (_) {
          detailedErrors.push({
            type: 'GENERIC_ERROR',
            webhookUrl: '',
            status: 500,
            responseBody: err.message || String(err),
            message: err.message || String(err),
            reviewId: r.platform_review_id
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      importedCount: successCount,
      duplicateCount,
      failedCount,
      totalFetched: filteredReviews.length,
      detailedErrors
    });

  } catch (err: any) {
    console.error('Reviews import failed:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}

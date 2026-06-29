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

// Post review helper to n8n webhook if configured
async function postToN8N(review: any) {
  try {
    const webhookUrl = process.env.N8N_WEBHOOK_URL || 'https://n8n.ecctur.ai/webhook/reviews';
    console.log('[n8n Poster] Posting review to:', webhookUrl);
    
    // In vercel environments fetch is built-in
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(review)
    });
    console.log('[n8n Poster] Response status:', res.status);
  } catch (err) {
    console.error('[n8n Poster] Failed to post to n8n:', err);
  }
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

  const { hotelId } = req.body;
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

    // Define 30 days range
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Initial step: Check Google Token status or simulate manual import reviews from last 30 days
    // In future versions, this is where we query:
    // await googleBusinessService.fetchReviews(hotelId, thirtyDaysAgo)
    const rawImportedReviews = [
      {
        platform_review_id: `g-${hotelId}-101`,
        guest_name: 'Kemal Sunal',
        rating: 5,
        review_text: 'Otel personeli çok kibar ve ilgiliydi. Temizlik harikaydı, odalar çok geniş.',
        platform: 'Google',
        sentiment: 'positive',
        status: 'draft',
        review_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days ago
      },
      {
        platform_review_id: `g-${hotelId}-102`,
        guest_name: 'Şener Şen',
        rating: 4,
        review_text: 'Kahvaltı çeşitleri yeterliydi ancak akşam yemeğinde servis biraz yavaş kaldı. Genel olarak memnun kaldık.',
        platform: 'Google',
        sentiment: 'neutral',
        status: 'draft',
        review_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() // 5 days ago
      },
      {
        platform_review_id: `g-${hotelId}-103`,
        guest_name: 'Adile Naşit',
        rating: 2,
        review_text: 'Giriş işlemleri çok uzun sürdü, oda hazır değildi. Hizmet kalitesi bu fiyata yakışmıyor.',
        platform: 'Google',
        sentiment: 'negative',
        status: 'draft',
        review_date: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString() // 12 days ago
      },
      {
        platform_review_id: `g-${hotelId}-104`,
        guest_name: 'Halit Akçatepe',
        rating: 5,
        review_text: 'Konumu mükemmel, denize sıfır ve bahçesi çok güzel dizayn edilmiş. Kesinlikle öneririm.',
        platform: 'Google',
        sentiment: 'positive',
        status: 'draft',
        review_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString() // 15 days ago
      },
      {
        platform_review_id: `g-${hotelId}-105`,
        guest_name: 'Tarık Akan',
        rating: 3,
        review_text: 'Oda servisi başarılıydı ancak havuz hijyeni konusunda bazı şüphelerim var. Geliştirilmeli.',
        platform: 'Google',
        sentiment: 'neutral',
        status: 'draft',
        review_date: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString() // 22 days ago
      }
    ];

    let successCount = 0;
    let duplicateCount = 0;
    let failedCount = 0;

    for (let r of rawImportedReviews) {
      try {
        // 3. Duplicate kontrolü yap: platform_review_id aynıysa tekrar ekleme
        const { data: existingReview } = await supabaseAdmin
          .from('reviews')
          .select('id')
          .eq('platform_review_id', r.platform_review_id);

        if (existingReview && existingReview.length > 0) {
          duplicateCount++;
          console.log(`[Import] Review ${r.platform_review_id} already exists, skipping.`);
          continue;
        }

        // Insert Review to Supabase
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

        if (insErr) throw insErr;

        successCount++;

        // 2. Her yorumu n8n webhook URL’ye POST et
        await postToN8N({
          ...reviewRecord,
          id: newRev.id,
          hotelName: hotelData.name
        });

      } catch (err) {
        failedCount++;
        console.error(`[Import] Failed to import review ${r.platform_review_id}:`, err);
      }
    }

    return res.status(200).json({
      success: true,
      importedCount: successCount,
      duplicateCount,
      failedCount
    });

  } catch (err: any) {
    console.error('Reviews import failed:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}

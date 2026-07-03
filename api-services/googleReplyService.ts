import { createClient } from '@supabase/supabase-js';

// Setup Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

async function refreshGoogleAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to refresh Google access token: ${response.status} ${errText}`);
  }

  const data = await response.json();
  return data.access_token;
}

export async function publishGoogleReply(reviewId: string, replyText?: string): Promise<{ success: boolean; mock: boolean; message?: string }> {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not initialized on server-side.');
  }

  // 1. Fetch review
  const { data: review, error: rError } = await supabaseAdmin
    .from('reviews')
    .select('*')
    .eq('id', reviewId)
    .maybeSingle();

  if (rError || !review) {
    throw new Error(`Review not found: ${rError?.message || 'Empty result'}`);
  }

  // 2. Fetch hotel details
  const { data: hotel, error: hError } = await supabaseAdmin
    .from('hotels')
    .select('*')
    .eq('id', review.hotel_id)
    .maybeSingle();

  if (hError || !hotel) {
    throw new Error(`Hotel not found for review: ${hError?.message || 'Empty result'}`);
  }

  // Prioritized reply text selection: param, ai_reply, response, owner_reply_text
  let finalReplyText = (replyText || '').trim();
  if (!finalReplyText) {
    finalReplyText = (review.ai_reply || review.response || '').trim();
  }
  if (!finalReplyText) {
    finalReplyText = (review.owner_reply_text || '').trim();
  }

  console.log('========================================================================');
  console.log('[DEBUG-PUBLISH-SERVICE] Resolving reply text:');
  console.log('  - reviewId:', reviewId);
  console.log('  - passed replyText param length:', replyText ? String(replyText).length : 'undefined/null');
  console.log('  - review.ai_reply field length:', review.ai_reply ? String(review.ai_reply).length : 'undefined/null');
  console.log('  - review.response field length:', review.response ? String(review.response).length : 'undefined/null');
  console.log('  - resolved finalReplyText length:', finalReplyText.length);
  console.log('========================================================================');

  if (!finalReplyText) {
    throw new Error('Cevap metni boş olamaz.');
  }

  // Pre-save draft to protect edits in case publication fails
  try {
    await supabaseAdmin
      .from('reviews')
      .update({
        ai_reply: finalReplyText,
        updated_at: new Date().toISOString()
      })
      .eq('id', reviewId);
  } catch (draftErr) {
    console.warn('[GoogleReplyService] Warning: pre-saving draft failed:', draftErr);
  }

  // 3. Fetch Google integration settings for access/refresh tokens
  const { data: settingsData } = await supabaseAdmin
    .from('integration_settings')
    .select('*');

  const gSetting = settingsData?.find((s: any) => 
    (s.id === 'google_business' || s.provider === 'google') && 
    (s.hotel_id === review.hotel_id || s.organization_id === hotel.organization_id || s.id === 'google_business')
  );

  let configObj: any = {};
  if (gSetting && gSetting.config) {
    configObj = typeof gSetting.config === 'string' ? JSON.parse(gSetting.config) : gSetting.config;
  }

  const googleAccountId = hotel.google_account_id || configObj?.google_account_id;
  const googleLocationId = hotel.google_location_id || configObj?.google_location_id;
  const externalReviewId = review.platform_review_id;

  const refreshToken = configObj?.refresh_token || configObj?.refreshToken || process.env.GOOGLE_BUSINESS_REFRESH_TOKEN;
  const clientId = configObj?.client_id || configObj?.clientId || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = configObj?.client_secret || configObj?.clientSecret || process.env.GOOGLE_CLIENT_SECRET;
  const accessTokenInConfig = configObj?.access_token || configObj?.accessToken;

  // 4. Mock / Real detection
  const isMockReview = String(externalReviewId).startsWith('mock-');
  const useMockEnv = process.env.USE_MOCK_GOOGLE_PROVIDER;
  const isMockMode = useMockEnv === 'true' ? true : useMockEnv === 'false' ? false : (!googleLocationId || isMockReview);
  if (isMockMode) {
    console.log('--- [GOOGLE BUSINESS PUBLISH MOCK MODE - SERVER] ---');
    console.log(`Review ID: ${reviewId}`);
    console.log(`External Review ID: ${externalReviewId}`);
    console.log(`Google Location ID: ${googleLocationId || 'MockLocationId'}`);
    console.log(`Google Account ID: ${googleAccountId || 'MockAccountId'}`);
    console.log(`Reply Content:\n${finalReplyText}`);
    console.log('----------------------------------------------------');

    await updateReviewDatabaseRecord(reviewId, finalReplyText, 'mock_published', null);

    return {
      success: true,
      mock: true,
      message: 'Google Business Profile reply published successfully in Mock Mode.'
    };
  }

  if (!gSetting && !refreshToken && !accessTokenInConfig) {
    const noConnErr = new Error('Bu otel için Google Business bağlantısı yapılmamış.');
    await updateReviewDatabaseRecord(reviewId, finalReplyText, 'error', noConnErr.message);
    throw noConnErr;
  }

  if (!googleLocationId) {
    const noLocErr = new Error('Google Business location seçilmemiş.');
    await updateReviewDatabaseRecord(reviewId, finalReplyText, 'error', noLocErr.message);
    throw noLocErr;
  }

  if (!googleAccountId || !externalReviewId) {
    const noAccErr = new Error('Google Business location seçilmemiş.');
    await updateReviewDatabaseRecord(reviewId, finalReplyText, 'error', noAccErr.message);
    throw noAccErr;
  }


  let accessToken = accessTokenInConfig;
  let tokenRefreshed = false;

  const tryPublishWithToken = async (token: string): Promise<boolean> => {
    const url = `https://mybusiness.googleapis.com/v4/accounts/${googleAccountId}/locations/${googleLocationId}/reviews/${externalReviewId}/reply`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        comment: finalReplyText
      })
    });

    if (response.status === 401) {
      return false;
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google API reply publication failed with status ${response.status}: ${errText}`);
    }

    return true;
  };

  try {
    let published = false;
    if (accessToken) {
      published = await tryPublishWithToken(accessToken);
    }

    if (!published && refreshToken && clientId && clientSecret) {
      try {
        accessToken = await refreshGoogleAccessToken(clientId, clientSecret, refreshToken);
        tokenRefreshed = true;
        published = await tryPublishWithToken(accessToken);
      } catch (refreshErr) {
        throw new Error('Google Business yetkisi eksik veya süresi dolmuş.');
      }
    }

    if (!published) {
      throw new Error('Google Business yetkisi eksik veya süresi dolmuş.');
    }

    if (tokenRefreshed && gSetting && accessToken) {
      configObj.access_token = accessToken;
      await supabaseAdmin
        .from('integration_settings')
        .update({
          config: configObj,
          updated_at: new Date().toISOString()
        })
        .eq('id', gSetting.id);
    }
  } catch (apiErr: any) {
    let errorMsg = String(apiErr.message || apiErr);
    if (errorMsg.includes('Invalid credentials') || errorMsg.includes('invalid_grant') || errorMsg.includes('401') || errorMsg.includes('Unauthorized') || errorMsg.includes('Google Business yetkisi')) {
      errorMsg = 'Google Business yetkisi eksik veya süresi dolmuş.';
    }
    await updateReviewDatabaseRecord(reviewId, finalReplyText, 'error', errorMsg);
    throw new Error(errorMsg);
  }

  await updateReviewDatabaseRecord(reviewId, finalReplyText, 'published', null);

  return {
    success: true,
    mock: false
  };
}

async function updateReviewDatabaseRecord(reviewId: string, replyText: string, statusText: string, errorText: string | null) {
  const isError = statusText === 'error';
  
  const updateData: any = {
    updated_at: new Date().toISOString(),
    google_reply_status: statusText,
    google_reply_error: errorText
  };

  if (!isError) {
    updateData.status = 'published';
    updateData.published = true; // both Boolean true and 'Yes'/'Published' fallbacks supported
    updateData.published_at = new Date().toISOString();
    updateData.google_reply_published_at = new Date().toISOString();
    updateData.ai_reply = replyText;
    updateData.owner_reply_text = replyText;
    updateData.owner_reply_status = 'published';
    updateData.published_platform = 'google';
  }

  try {
    const { error: updateErr } = await supabaseAdmin!
      .from('reviews')
      .update(updateData)
      .eq('id', reviewId);

    if (updateErr) {
      console.warn('[GoogleReplyService] Database update failed:', updateErr.message);
      throw updateErr;
    }
  } catch (err) {
    console.error('[GoogleReplyService] Exception updating database record:', err);
    throw err;
  }
}

// api/services/whatsappService.ts
import { createClient } from '@supabase/supabase-js';

declare const process: any;

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

export async function sendReviewApprovalMessage(reviewId: string): Promise<{ success: boolean; mock: boolean; message?: string }> {
  const whatsappApiUrl = process.env.WHATSAPP_API_URL || '';
  const whatsappToken = process.env.WHATSAPP_TOKEN || '';
  const whatsappPhone = process.env.WHATSAPP_PHONE_NUMBER || '';
  const baseUrl = process.env.APP_URL || 'https://ecctur-review-ai.vercel.app';

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
    throw new Error(`Review not found for WhatsApp notification: ${rError?.message || 'Empty result'}`);
  }

  // 2. Fetch hotel details
  const { data: hotel, error: hError } = await supabaseAdmin
    .from('hotels')
    .select('*')
    .eq('id', review.hotel_id)
    .maybeSingle();

  if (hError || !hotel) {
    throw new Error(`Hotel not found for WhatsApp notification: ${hError?.message || 'Empty result'}`);
  }

  // 3. Format message text
  const hotelName = hotel.name || 'Bilinmeyen Otel';
  const platform = review.platform || 'Google';
  const guestName = review.guest_name || 'Değerli Misafirimiz';
  const rating = review.rating || 0;
  const comment = review.review_text || '(Yorum metni yok)';
  const aiReply = review.ai_reply || '(Cevap üretilmemiş)';
  
  const approvalLink = `${baseUrl}/reviews?reviewId=${reviewId}&approve=true`;

  const messageText = `🔔 *Yeni Yorum Onay Bekliyor* 🔔\n\n` +
    `🏨 *Otel Adı:* ${hotelName}\n` +
    `🌐 *Platform:* ${platform}\n` +
    `👤 *Misafir Adı:* ${guestName}\n` +
    `⭐ *Puan:* ${rating}/5\n\n` +
    `💬 *Yorum:*\n"${comment}"\n\n` +
    `🤖 *AI Önerilen Cevap:*\n"${aiReply}"\n\n` +
    `🔗 *Onay Linki:* ${approvalLink}`;

  // 4. Send or Mock
  const isConfigured = whatsappApiUrl && whatsappToken && whatsappPhone;

  if (!isConfigured) {
    console.log('--- [WHATSAPP MOCK MODE - SERVER] ---');
    console.log(`To: ${whatsappPhone || 'Unconfigured Phone Number'}`);
    console.log(`API URL: ${whatsappApiUrl || 'Unconfigured API URL'}`);
    console.log(`Message Content:\n${messageText}`);
    console.log('-------------------------------------');
    
    return {
      success: true,
      mock: true,
      message: 'WhatsApp integration is running in Mock Mode (credentials missing).'
    };
  }

  console.log(`[WhatsApp Server Service] Sending message to ${whatsappPhone}...`);
  const response = await fetch(whatsappApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${whatsappToken}`
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: whatsappPhone,
      type: 'text',
      text: {
        body: messageText
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`WhatsApp API request failed with status ${response.status}: ${errText}`);
  }

  return {
    success: true,
    mock: false
  };
}

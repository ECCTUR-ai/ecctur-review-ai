import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { WhatsAppLog } from '@/types';

// Helper to get supabase client safely on server-side or fallback to client-side
const getSupabaseClient = () => {
  // If running on server side with service role key, construct admin client
  const url = (typeof process !== 'undefined' && process.env && (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)) || '';
  const key = (typeof process !== 'undefined' && process.env && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)) || '';
  
  if (url && key) {
    return createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }
  return supabase;
};

export const whatsappService = {
  async getChats(): Promise<WhatsAppLog[]> {
    const { data, error } = await supabase
      .from('whatsapp_chats')
      .select('*, whatsapp_messages(*)');

    if (error) throw new Error(error.message);

    return (data || []).map((item: any) => ({
      id: item.id,
      guestName: item.guest_name,
      phoneNumber: item.phone_number,
      lastMessage: item.last_message,
      timestamp: item.timestamp,
      status: item.status as 'sent' | 'received' | 'failed',
      chatHistory: (item.whatsapp_messages || [])
        .sort((a: any, b: any) => new Date(a.time).getTime() - new Date(b.time).getTime())
        .map((msg: any) => ({
          sender: msg.sender as 'guest' | 'ai' | 'agent',
          text: msg.text,
          time: msg.time,
        })),
    }));
  },

  async getChatById(id: string): Promise<WhatsAppLog> {
    const { data, error } = await supabase
      .from('whatsapp_chats')
      .select('*, whatsapp_messages(*)')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);

    return {
      id: data.id,
      guestName: data.guest_name,
      phoneNumber: data.phone_number,
      lastMessage: data.last_message,
      timestamp: data.timestamp,
      status: data.status as 'sent' | 'received' | 'failed',
      chatHistory: (data.whatsapp_messages || [])
        .sort((a: any, b: any) => new Date(a.time).getTime() - new Date(b.time).getTime())
        .map((msg: any) => ({
          sender: msg.sender as 'guest' | 'ai' | 'agent',
          text: msg.text,
          time: msg.time,
        })),
    };
  },

  async sendMessage(id: string, text: string): Promise<{ success: boolean; message: any }> {
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .insert({
        chat_id: id,
        sender: 'agent',
        text,
        time: new Date().toISOString()
      })
      .select()
      .maybeSingle();

    if (error) throw new Error(error.message);

    await supabase
      .from('whatsapp_chats')
      .update({
        last_message: text,
        timestamp: new Date().toISOString(),
        status: 'sent'
      })
      .eq('id', id);

    return { success: true, message: data };
  },

  async toggleAiAssistant(id: string, enabled: boolean): Promise<{ success: boolean }> {
    const { error } = await supabase
      .from('whatsapp_chats')
      .update({ ai_enabled: enabled })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { success: true };
  },

  async sendReviewApprovalMessage(
    reviewId: string,
    env?: {
      whatsappApiUrl?: string;
      whatsappToken?: string;
      whatsappPhone?: string;
      appUrl?: string;
    }
  ): Promise<{ success: boolean; mock: boolean; message?: string }> {
    // 1. Resolve environment variables safely passed from server-side
    const whatsappApiUrl = env?.whatsappApiUrl || '';
    const whatsappToken = env?.whatsappToken || '';
    const whatsappPhone = env?.whatsappPhone || '';

    // 2. Fetch review and hotel details from Supabase
    const client = getSupabaseClient();
    
    const { data: review, error: rError } = await client
      .from('reviews')
      .select('*')
      .eq('id', reviewId)
      .maybeSingle();

    if (rError || !review) {
      throw new Error(`Review not found for WhatsApp notification: ${rError?.message || 'Empty result'}`);
    }

    const { data: hotel, error: hError } = await client
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
    
    // Approval link: dynamic host url (fallback to demo link)
    const baseUrl = env?.appUrl || 'https://ecctur-review-ai.vercel.app';
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
      console.log('--- [WHATSAPP MOCK MODE] ---');
      console.log(`To: ${whatsappPhone || 'Unconfigured Phone Number'}`);
      console.log(`API URL: ${whatsappApiUrl || 'Unconfigured API URL'}`);
      console.log(`Message Content:\n${messageText}`);
      console.log('-----------------------------');
      
      return {
        success: true,
        mock: true,
        message: 'WhatsApp integration is running in Mock Mode (credentials missing).'
      };
    }

    // Send actual HTTP request
    console.log(`[WhatsApp Service] Sending message to ${whatsappPhone}...`);
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
};

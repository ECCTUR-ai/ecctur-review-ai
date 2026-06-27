import { supabase } from '@/lib/supabase';
import { WhatsAppLog } from '@/types';

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
      .single();

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
      .single();

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
  }
};

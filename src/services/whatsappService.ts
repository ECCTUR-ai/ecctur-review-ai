// src/services/whatsappService.ts
/**
 * Frontend-safe WhatsApp service simulation.
 * This file is bundled by Vite for the client-side.
 * It contains no process.env references, no database dependencies, and no node-only imports.
 */

export interface WhatsAppMessage {
  sender: 'guest' | 'ai' | 'agent';
  text: string;
  time: string;
}

export interface WhatsAppLog {
  id: string;
  guestName: string;
  phoneNumber: string;
  lastMessage: string;
  timestamp: string;
  status: 'sent' | 'received' | 'failed';
  chatHistory: WhatsAppMessage[];
}

const mockChats: WhatsAppLog[] = [
  {
    id: 'chat-1',
    guestName: 'Ahmet Yılmaz',
    phoneNumber: '+90 555 123 4567',
    lastMessage: 'Harika bir otel, teşekkürler!',
    timestamp: new Date().toISOString(),
    status: 'received',
    chatHistory: [
      { sender: 'guest', text: 'Rezervasyon durumumu kontrol edebilir misiniz?', time: '10:00' },
      { sender: 'agent', text: 'Tabii, rezervasyonunuz onaylanmıştır.', time: '10:05' }
    ]
  },
  {
    id: 'chat-2',
    guestName: 'Mehmet Kaya',
    phoneNumber: '+90 532 987 6543',
    lastMessage: 'Oda servisi menüsünü alabilir miyim?',
    timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    status: 'received',
    chatHistory: [
      { sender: 'guest', text: 'Oda servisi menüsünü alabilir miyim?', time: '17:40' }
    ]
  }
];

export const whatsappService = {
  async getChats(): Promise<WhatsAppLog[]> {
    // Return mock chats to keep frontend pages functional without backend dependency
    return mockChats;
  },

  async getChatById(id: string): Promise<WhatsAppLog> {
    const found = mockChats.find(c => c.id === id);
    if (!found) throw new Error('Chat not found');
    return found;
  },

  async sendMessage(id: string, text: string): Promise<{ success: boolean; message: any }> {
    const found = mockChats.find(c => c.id === id);
    const newMsg: WhatsAppMessage = {
      sender: 'agent',
      text,
      time: new Date().toLocaleTimeString().slice(0, 5)
    };
    if (found) {
      found.chatHistory.push(newMsg);
      found.lastMessage = text;
      found.timestamp = new Date().toISOString();
      found.status = 'sent';
    }
    return { success: true, message: newMsg };
  },

  async toggleAiAssistant(id: string, enabled: boolean): Promise<{ success: boolean }> {
    console.log(`[WhatsApp Frontend Service] AI assistant toggled to ${enabled} for chat ${id}`);
    return { success: true };
  }
};

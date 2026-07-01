import React, { useState } from 'react';
import { useFetch } from '@/hooks/useFetch';
import { whatsappService } from '@/services/whatsappService';
import { WhatsAppLog } from '@/types';
import { 
  MessageCircle, 
  Send, 
  Sparkles, 
  ShieldAlert,
  Database,
  Search,
  CheckCheck
} from 'lucide-react';

export default function WhatsApp() {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [typedMessage, setTypedMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const { 
    data: chats, 
    loading: chatsLoading, 
    error: chatsError,
    refetch 
  } = useFetch(() => whatsappService.getChats());

  const selectedChat = chats?.find(c => c.id === selectedChatId);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedMessage.trim() || !selectedChatId) return;

    setIsSending(true);
    try {
      await whatsappService.sendMessage(selectedChatId, typedMessage);
      setTypedMessage('');
      refetch();
    } catch {
      alert('API Offline: WhatsApp simulation message not sent.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-xs text-slate-500">Monitor WhatsApp guest relations, escalation pipelines and automated logs</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[600px]">
        {/* Chat List */}
        <div className="glass-panel rounded-2xl p-4 flex flex-col h-full overflow-hidden">
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider px-2">Active Sessions</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-2">
            {chatsLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-slate-50 border border-slate-200 animate-pulse" />
              ))
            ) : chatsError || !chats || chats.length === 0 ? (
              <div className="text-center py-20 space-y-4 px-4">
                <MessageCircle className="mx-auto text-slate-700" size={32} />
                <h4 className="text-sm font-semibold text-slate-400">No Active WhatsApp Logs</h4>
                <p className="text-xs text-slate-500">
                  Ensure the WhatsApp Business API webhook is correctly configured in your server endpoint properties.
                </p>
              </div>
            ) : (
              chats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => setSelectedChatId(chat.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    selectedChatId === chat.id 
                      ? 'bg-blue-600/5 border-blue-500/20' 
                      : 'bg-white/[0.01] border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-medium text-slate-200">{chat.guestName}</span>
                    <span className="text-[10px] text-slate-500">{chat.timestamp}</span>
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-1">{chat.lastMessage}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Window */}
        <div className="lg:col-span-2 glass-panel rounded-2xl flex flex-col h-full overflow-hidden bg-slate-50/40">
          {selectedChat ? (
            <div className="flex flex-col h-full justify-between">
              {/* Header */}
              <div className="p-4 border-b border-slate-200 bg-white/[0.01] flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-semibold text-slate-200">{selectedChat.guestName}</h4>
                  <p className="text-xs text-slate-500">{selectedChat.phoneNumber}</p>
                </div>
              </div>

              {/* Messages Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {selectedChat.chatHistory.map((msg, i) => {
                  const isGuest = msg.sender === 'guest';
                  return (
                    <div 
                      key={i} 
                      className={`flex ${isGuest ? 'justify-start' : 'justify-end'}`}
                    >
                      <div className={`max-w-md p-3.5 rounded-2xl text-xs space-y-1 ${
                        isGuest 
                          ? 'bg-slate-50 border border-slate-200 text-slate-300 rounded-tl-none' 
                          : msg.sender === 'ai'
                          ? 'bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-tr-none'
                          : 'bg-slate-800 text-slate-200 rounded-tr-none'
                      }`}>
                        <span className="text-[9px] uppercase font-bold tracking-wider block opacity-60">
                          {msg.sender === 'guest' ? 'Guest' : msg.sender === 'ai' ? 'AI Assistant' : 'Hotel Agent'}
                        </span>
                        <p className="leading-relaxed">{msg.text}</p>
                        <span className="text-[9px] block text-right opacity-40">{msg.time}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Input Area */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200 bg-white/[0.01] flex gap-3">
                <input 
                  type="text" 
                  value={typedMessage}
                  onChange={(e) => setTypedMessage(e.target.value)}
                  placeholder="Type a message or select an AI draft template..."
                  className="flex-1 px-4 py-3 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
                />
                <button 
                  type="submit" 
                  disabled={isSending}
                  className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors disabled:opacity-50 shrink-0"
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center items-center text-center p-8 space-y-4">
              <MessageCircle className="text-slate-700" size={48} />
              <h3 className="text-sm font-semibold text-slate-400">Select a Conversation</h3>
              <p className="text-xs text-slate-500 max-w-xs">
                Select a guest chat history log on the sidebar pane to interact, view message logs, or check escalation statuses.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

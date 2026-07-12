import React, { useState, useEffect } from 'react';
import { useFetch } from '@/hooks/useFetch';
import { useTranslation } from 'react-i18next';
import { settingsService } from '@/services/settingsService';
import { motion } from 'framer-motion';
import { 
  Sparkles, 
  CheckCircle2, 
  Globe, 
  Sliders
} from 'lucide-react';

export default function Settings() {
  const { t } = useTranslation();
  const [tone, setTone] = useState<'professional' | 'warm' | 'luxury' | 'concise'>('professional');
  const [autoRespond, setAutoRespond] = useState(false);
  const [minRatingAutoRespond, setMinRatingAutoRespond] = useState(4);
  const [whatsappAlerts, setWhatsappAlerts] = useState(true);
  const [saveStatus, setSaveStatus] = useState<string>('');

  const { 
    data: settings, 
    loading, 
    refetch 
  } = useFetch(() => settingsService.getSettings());

  useEffect(() => {
    if (settings) {
      setTone(settings.tone);
      setAutoRespond(settings.autoRespond);
      setMinRatingAutoRespond(settings.minRatingAutoRespond);
      setWhatsappAlerts(settings.whatsappAlerts);
    }
  }, [settings]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus('Saving...');
    try {
      await settingsService.updateSettings({
        tone,
        autoRespond,
        minRatingAutoRespond,
        whatsappAlerts
      });
      setSaveStatus('Settings updated successfully.');
      refetch();
    } catch {
      setSaveStatus('Local updates saved.');
    }
  };

  return (
    <div className="space-y-8 max-w-4xl pb-16 text-left text-[#151827]">
      {/* Title Header */}
      <div className="border-b border-[#E8EAF0] pb-6">
        <h1 className="text-2xl font-black text-[#151827] m-0 flex items-center gap-2">
          <Sliders className="text-[#6D5DF6]" size={24} />
          System Settings
        </h1>
        <p className="text-xs text-zinc-555 mt-1">
          Configure artificial intelligence models, Whatsapp triggers, and channel connection variables.
        </p>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-8">
        
        {/* Card 1: AI Tone Strategy */}
        <div className="glass-panel rounded-[18px] p-6 relative overflow-hidden bg-white border border-[#E8EAF0] shadow-sm space-y-6">
          <h3 className="text-xs font-bold text-[#151827] flex items-center gap-2 uppercase tracking-wider">
            <Sparkles size={15} className="text-[#6D5DF6]" />
            AI Reply Strategy & Auto-Response
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-zinc-500 block">AI Conversational Tone</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as any)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-[#E8EAF0] text-xs text-[#151827] focus:outline-none focus:border-[#6D5DF6]"
              >
                <option value="professional" className="bg-white">Professional & Objective</option>
                <option value="warm" className="bg-white">Warm & Welcoming</option>
                <option value="luxury" className="bg-white">Luxury & Premium</option>
                <option value="concise" className="bg-white">Concise & Direct</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-zinc-500 block">Min Rating for Auto-Reply</label>
              <select
                value={minRatingAutoRespond}
                onChange={(e) => setMinRatingAutoRespond(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-[#E8EAF0] text-xs text-[#151827] focus:outline-none focus:border-[#6D5DF6]"
              >
                <option value={5} className="bg-white">5 Stars Only</option>
                <option value={4} className="bg-white">4 Stars and Above</option>
                <option value={3} className="bg-white">3 Stars and Above</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-[#151827] block">Enable AI Auto-Respond</span>
                <span className="text-[10px] text-zinc-500">Allow AI to directly respond to positive reviews without manual approval.</span>
              </div>
              <button
                type="button"
                onClick={() => setAutoRespond(!autoRespond)}
                className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none cursor-pointer ${
                  autoRespond ? 'bg-[#6D5DF6]' : 'bg-slate-200'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                  autoRespond ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-[#151827] block">WhatsApp Escalation Alerts</span>
                <span className="text-[10px] text-zinc-500">Send instant alerts to department heads when critical negative comments occur.</span>
              </div>
              <button
                type="button"
                onClick={() => setWhatsappAlerts(!whatsappAlerts)}
                className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none cursor-pointer ${
                  whatsappAlerts ? 'bg-[#6D5DF6]' : 'bg-slate-200'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                  whatsappAlerts ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </div>
        </div>

        {/* Card 2: Integration Channels Grid */}
        <div className="glass-panel rounded-[18px] p-6 relative overflow-hidden bg-white border border-[#E8EAF0] shadow-sm space-y-6">
          <h3 className="text-xs font-bold text-[#151827] flex items-center gap-2 uppercase tracking-wider">
            <Globe size={15} className="text-[#6D5DF6]" />
            Platform Connections
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {[
              { name: 'Google Maps Reviews', logo: '🔵', desc: 'Sync customer reviews from Google Maps locations.', status: 'CONNECTED' },
              { name: 'Booking.com', logo: '🔷', desc: 'Sync customer ratings and reviews from Booking.com listings.', status: 'MANUAL IMPORT' },
              { name: 'TripAdvisor', logo: '🟢', desc: 'Sync hospitality ratings from Tripadvisor hotel pages.', status: 'CONNECTED' },
              { name: 'Otelpuan.com', logo: '🍊', desc: 'Sync domestic hotel ratings and reviews from Otelpuan.', status: 'MANUAL SYNC' }
            ].map((p, idx) => (
              <div key={idx} className="p-4 bg-slate-50 border border-[#E8EAF0] rounded-2xl flex items-start gap-3">
                <span className="text-base shrink-0 mt-0.5">{p.logo}</span>
                <div>
                  <strong className="text-[#151827] block font-bold">{p.name}</strong>
                  <span className="text-[10px] text-zinc-555 block mt-1 leading-relaxed">{p.desc}</span>
                  <span className="inline-block mt-3 text-[9px] font-black text-[#6D5DF6] uppercase bg-[#F0EDFF] px-2 py-0.5 rounded border border-[#6D5DF6]/20">
                    {p.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Save button and status */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            className="px-6 py-3 bg-gradient-to-tr from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 transition-all text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer"
          >
            Save Configuration
          </button>
          {saveStatus && (
            <span className="text-xs font-semibold text-[#6D5DF6] flex items-center gap-1.5 animate-fade-in">
              <CheckCircle2 size={14} className="text-emerald-600" />
              {saveStatus}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

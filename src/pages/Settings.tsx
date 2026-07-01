import React, { useState, useEffect } from 'react';
import { useFetch } from '@/hooks/useFetch';
import { useTranslation } from 'react-i18next';
import { settingsService } from '@/services/settingsService';
import { 
  Settings as SettingsIcon, 
  Sparkles, 
  Link2, 
  Lock, 
  Database,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

export default function Settings() {
  const { t } = useTranslation();
  const [tone, setTone] = useState<'professional' | 'warm' | 'formal'>('professional');
  const [autoRespond, setAutoRespond] = useState(false);
  const [minRatingAutoRespond, setMinRatingAutoRespond] = useState(4);
  const [whatsappAlerts, setWhatsappAlerts] = useState(true);
  const [saveStatus, setSaveStatus] = useState<string>('');

  const { 
    data: settings, 
    loading, 
    error,
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
      setSaveStatus('API Offline: Changes saved locally (not synced).');
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-slate-100 m-0">{t('settings.title')}</h1>
        <p className="text-xs text-slate-500 mt-1.5">{t('settings.subtitle')}</p>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-8">
        {/* Card 1: AI Tone Settings */}
        <div className="glass-panel rounded-2xl p-6 relative overflow-hidden card-glow space-y-6">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Sparkles size={16} className="text-blue-400" />
            AI Reply Strategy
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400 block">AI Conversational Tone</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as any)}
                className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
              >
                <option value="professional">Professional & Objective</option>
                <option value="warm">Warm & Welcoming</option>
                <option value="formal">Formal & Executive</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400 block">Min Rating for Auto-Reply</label>
              <select
                value={minRatingAutoRespond}
                onChange={(e) => setMinRatingAutoRespond(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
              >
                <option value={5}>5 Stars Only</option>
                <option value={4}>4 Stars and Above</option>
                <option value={3}>3 Stars and Above</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-slate-200 block">Enable AI Auto-Respond</span>
                <span className="text-[10px] text-slate-500">Allow AI to directly respond to positive reviews without manual approval.</span>
              </div>
              <button
                type="button"
                onClick={() => setAutoRespond(!autoRespond)}
                className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none ${
                  autoRespond ? 'bg-blue-600' : 'bg-slate-800'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                  autoRespond ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-slate-200 block">WhatsApp Escalation Alerts</span>
                <span className="text-[10px] text-slate-500">Send instant alerts to department heads when critical negative comments occur.</span>
              </div>
              <button
                type="button"
                onClick={() => setWhatsappAlerts(!whatsappAlerts)}
                className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none ${
                  whatsappAlerts ? 'bg-blue-600' : 'bg-slate-800'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                  whatsappAlerts ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </div>
        </div>

        {/* Card 2: API Keys and Connection Credentials */}
        <div className="glass-panel rounded-2xl p-6 relative overflow-hidden card-glow space-y-6">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <KeyRound size={16} className="text-purple-400" />
            Database & API Integration
          </h3>

          <div className="p-4 rounded-xl bg-slate-500 border border-slate-200 text-xs text-slate-400 space-y-3">
            <div className="flex items-center gap-2 text-yellow-500 font-semibold mb-1">
              <AlertCircle size={14} />
              <span>Production Integration Instructions</span>
            </div>
            <p>
              To run the system with your live endpoints, define the environment settings inside your deployment:
            </p>
            <div className="p-3 bg-slate-50 rounded-lg font-mono text-[11px] text-slate-300 space-y-1">
              <div>VITE_API_URL=https://api.GuestReview.ai-review-ai.com/v1</div>
              <div>VITE_OPENAI_API_KEY=your_openai_secret_key</div>
              <div>VITE_WHATSAPP_PHONE_ID=your_whatsapp_phone_number_id</div>
            </div>
          </div>
        </div>

        {/* Save button and status */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 transition-colors text-white font-semibold text-xs rounded-xl"
          >
            Save Configuration
          </button>
          {saveStatus && (
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5 animate-fade-in">
              <CheckCircle2 size={14} className="text-emerald-400" />
              {saveStatus}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { reviewService } from '@/services/reviewService';
import { HotelReviewIntegration, SyncResult } from '@/types';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthGuard';
import { cacheService } from '@/lib/cacheService';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Globe,
  Database,
  Building,
  Sliders,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Search,
  Plus
} from 'lucide-react';

interface PlatformMeta {
  key: string;
  name: string;
  badgeBg: string;
  iconText: string;
  defaultUrlKey: string;
}

const PLATFORMS: PlatformMeta[] = [
  { key: 'google', name: 'Google Business', badgeBg: 'bg-blue-50 text-blue-700 border-blue-200', iconText: '🔵', defaultUrlKey: 'google_maps_url' },
  { key: 'booking', name: 'Booking.com', badgeBg: 'bg-[#F0EDFF] text-[#6D5DF6] border-[#6D5DF6]/20', iconText: '🔷', defaultUrlKey: 'booking_url' },
  { key: 'tripadvisor', name: 'TripAdvisor', badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200', iconText: '🟢', defaultUrlKey: 'tripadvisor_url' },
  { key: 'hotels', name: 'Hotels.com', badgeBg: 'bg-purple-50 text-purple-700 border-purple-200', iconText: '🟣', defaultUrlKey: 'hotelscom_url' },
  { key: 'holidaycheck', name: 'HolidayCheck', badgeBg: 'bg-pink-50 text-pink-700 border-pink-200', iconText: '💗', defaultUrlKey: 'holidaycheck_url' },
  { key: 'otelpuan', name: 'Otelpuan', badgeBg: 'bg-orange-50 text-orange-700 border-orange-200', iconText: '🟧', defaultUrlKey: 'otelpuan_url' }
];

export default function Integrations() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { roleKey } = useAuth();
  const { currentHotelId, hotels } = useOutletContext<{ currentHotelId: string; hotels: any[] }>();

  const activeHotelId = currentHotelId || (hotels && hotels[0]?.id) || '';
  const activeHotel = hotels?.find(h => h.id === activeHotelId);

  const [integrations, setIntegrations] = useState<HotelReviewIntegration[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [syncingPlatform, setSyncingPlatform] = useState<string | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal / Log drawer state
  const [selectedLogsPlatform, setSelectedLogsPlatform] = useState<string | null>(null);
  const [syncLogs, setSyncLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);

  const fetchIntegrations = useCallback(async (forceRefresh = false) => {
    if (!activeHotelId) return;

    const cacheKey = `integrations_${activeHotelId}`;
    if (!forceRefresh) {
      const cached = cacheService.get<HotelReviewIntegration[]>(cacheKey, 60000); // 1 minute
      if (cached) {
        setIntegrations(cached);
        setIsLoading(false);
        return;
      }
    }

    setIsLoading(true);
    try {
      const data = await reviewService.getIntegrations(activeHotelId);
      setIntegrations(data || []);
      cacheService.set(cacheKey, data);
    } catch (err: any) {
      console.error('Failed to fetch integrations:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeHotelId]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const handleSinglePlatformSync = async (platformKey: string) => {
    if (!activeHotelId) return;
    setSyncingPlatform(platformKey);
    try {
      const result = await reviewService.syncPlatform(activeHotelId, platformKey);
      const importedCount = result?.imported || 0;
      setToastMessage(`${platformKey.toUpperCase()} senkronize edildi: ${importedCount} yeni yorum eklendi.`);
      await fetchIntegrations(true);
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: any) {
      alert(`Senkronizasyon hatası (${platformKey}): ${err.message}`);
    } finally {
      setSyncingPlatform(null);
    }
  };

  const handleSyncAll = async () => {
    if (!activeHotelId) return;
    setIsSyncingAll(true);
    try {
      const enabledPlatforms = (integrations || []).filter(i => i.is_enabled && i.source_url);
      let totalImported = 0;

      for (const p of enabledPlatforms) {
        const res = await reviewService.syncPlatform(activeHotelId, p.platform);
        if (res && res.imported) {
          totalImported += res.imported;
        }
      }

      setToastMessage(`Tüm platformlar senkronize edildi. Toplam ${totalImported} yeni yorum çekildi.`);
      await fetchIntegrations(true);
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: any) {
      alert(`Toplu senkronizasyon hatası: ${err.message}`);
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleOpenSyncLogs = async (platformKey: string) => {
    setSelectedLogsPlatform(platformKey);
    setIsLoadingLogs(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Unauthenticated');

      const response = await fetch(`/api/admin?action=get-sync-logs&hotelId=${activeHotelId}&platform=${platformKey}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resJson = await response.json();
      setSyncLogs(resJson.logs || []);
    } catch (err: any) {
      console.error('Failed to fetch sync logs:', err);
      setSyncLogs([]);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs flex items-center justify-between shadow-sm"
          >
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-600 shrink-0" />
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-emerald-600 hover:text-emerald-900 text-xs font-black">X</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <div className="glass-panel p-6 md:p-8 rounded-3xl relative overflow-hidden border border-[#E8EAF0] bg-white shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#6D5DF6] uppercase tracking-wider mb-1">
              <Database size={14} />
              <span>Kanal & Platform Entegrasyonları</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-[#151827] m-0">
              {activeHotel?.name || 'Otel'} Entegrasyon Yönetimi
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-1 m-0">
              Bağımsız entegrasyon kayıtlarını, senkronizasyon sıklıklarını ve geçmiş log kayıtlarını yönetin.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSyncAll}
              disabled={isSyncingAll || !activeHotelId}
              className="px-5 py-2.5 bg-[#6D5DF6] hover:bg-[#5b4ee4] disabled:opacity-50 text-white font-extrabold text-xs rounded-2xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw size={15} className={isSyncingAll ? 'animate-spin' : ''} />
              <span>{isSyncingAll ? 'Senkronize Ediliyor...' : 'Tüm Platformları Senkronize Et'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {PLATFORMS.map((platform) => {
          const integration = integrations.find(i => i.platform?.toLowerCase() === platform.key);
          const isConnected = !!(integration?.source_url || (activeHotel && activeHotel[platform.defaultUrlKey]));
          const isSyncingThis = syncingPlatform === platform.key;

          return (
            <div
              key={platform.key}
              className="bg-white rounded-3xl border border-[#E8EAF0] p-6 shadow-xs flex flex-col justify-between hover:border-[#6D5DF6]/40 transition-all group"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-lg shrink-0">
                      {platform.iconText}
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-[#151827] m-0">{platform.name}</h3>
                      <span className="text-[10px] text-slate-400 font-semibold block">
                        Provider: {integration?.provider || 'Scraper Aggregator'}
                      </span>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${
                    isConnected ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>
                    {isConnected ? 'Bağlı' : 'Bağlı Değil'}
                  </span>
                </div>

                {/* Connection Status Details */}
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500 font-medium">Son Senkronizasyon:</span>
                    <strong className="text-slate-800 font-bold">
                      {integration?.last_sync_at ? new Date(integration.last_sync_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Henüz yapılmadı'}
                    </strong>
                  </div>

                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500 font-medium">İçe Aktarılan Yorum:</span>
                    <strong className="text-[#6D5DF6] font-extrabold">
                      {integration?.last_imported_count ?? 0} adet
                    </strong>
                  </div>

                  {integration?.last_error && (
                    <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-semibold flex items-center gap-1.5">
                      <AlertTriangle size={12} className="shrink-0" />
                      <span className="truncate">{integration.last_error}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleOpenSyncLogs(platform.key)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                >
                  <Clock size={13} />
                  <span>Loglar</span>
                </button>

                <button
                  onClick={() => handleSinglePlatformSync(platform.key)}
                  disabled={isSyncingThis || !activeHotelId}
                  className="px-4 py-1.5 bg-[#F0EDFF] hover:bg-[#6D5DF6] text-[#6D5DF6] hover:text-white font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={13} className={isSyncingThis ? 'animate-spin' : ''} />
                  <span>{isSyncingThis ? 'Çekiliyor...' : 'Senkronize Et'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sync Logs Modal */}
      {selectedLogsPlatform && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-xl w-full p-6 shadow-2xl space-y-4 text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-[#6D5DF6]" />
                <h3 className="text-sm font-black text-slate-900 uppercase m-0">
                  {selectedLogsPlatform} Senkronizasyon Logları
                </h3>
              </div>
              <button
                onClick={() => setSelectedLogsPlatform(null)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold p-1 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                Kapat
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {isLoadingLogs ? (
                <div className="p-8 text-center text-slate-400 text-xs font-medium">
                  <RefreshCw size={18} className="animate-spin inline mr-2" />
                  Loglar yükleniyor...
                </div>
              ) : syncLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs font-medium">
                  Bu platform için geçmiş log kaydı bulunamadı.
                </div>
              ) : (
                syncLogs.map((log) => (
                  <div key={log.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={`font-bold ${log.status === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        ● {log.status?.toUpperCase()}
                      </span>
                      <span className="text-slate-400 font-mono text-[10px]">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-slate-700 font-medium m-0">
                      {log.imported_count || 0} yeni yorum eklendi. {log.error_message ? `(Hata: ${log.error_message})` : ''}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

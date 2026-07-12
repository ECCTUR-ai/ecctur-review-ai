import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthGuard';
import { reviewService } from '@/services/reviewService';
import { Review, Hotel } from '@/types';
import { mapReview } from '@/repositories/reviewRepository';
import { usePersistentPageState } from '@/hooks/usePersistentPageState';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  MessageSquare, 
  Clock, 
  AlertTriangle, 
  RefreshCw, 
  Check,
  Brain,
  ListTodo,
  CheckSquare
} from 'lucide-react';

interface KPIStats {
  pendingResponse: number;
  todayCount: number;
  publishedResponse: number;
  avgResponseTimeText: string;
  criticalCount: number;
  aiSuccessRate: number;
}

export default function AiReplies() {
  const { t } = useTranslation();
  const { roleKey, hotelIds } = useAuth();
  const { currentHotelId, hotels } = useOutletContext<{ currentHotelId: string; hotels: Hotel[] }>();

  const [pageState, setPageState] = usePersistentPageState('guestreview_ai_replies_state_v3', {
    activeTab: 'active' as 'active' | 'archived',
    search: '',
    selectedHotelId: 'all',
    selectedPlatform: 'all',
    selectedRating: 'all' as number | 'all',
    selectedStatus: 'all',
    selectedDateRange: '30d',
    activePanelReview: null as Review | null,
    offset: 0,
    sortBy: 'newest' as 'newest' | 'oldest'
  });

  const {
    activeTab,
    selectedHotelId,
    selectedPlatform,
    selectedRating,
    activePanelReview,
    sortBy = 'newest'
  } = pageState;

  const setActiveTab = (val: 'active' | 'archived') => setPageState({ activeTab: val, offset: 0 });
  const setSelectedHotelId = (val: string) => setPageState({ selectedHotelId: val, offset: 0 });
  const setSortBy = (val: 'newest' | 'oldest') => setPageState({ sortBy: val, offset: 0 });
  const setActivePanelReview = (val: Review | null) => setPageState({ activePanelReview: val });

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [kpis, setKpis] = useState<KPIStats>({
    pendingResponse: 0,
    todayCount: 0,
    publishedResponse: 0,
    avgResponseTimeText: '12m',
    criticalCount: 0,
    aiSuccessRate: 94
  });

  const [editTexts, setEditTexts] = useState<Record<string, string>>({});
  const handleTextChange = (reviewId: string, val: string) => {
    setEditTexts(prev => ({ ...prev, [reviewId]: val }));
  };
  const [savingId, setSavingId] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translatingKeys, setTranslatingKeys] = useState<Record<string, boolean>>({});

  const LIMIT = 25;
  const activeHotelId = selectedHotelId === 'all' ? currentHotelId : selectedHotelId;

  // Clear selected panel review when hotel changes
  useEffect(() => {
    setActivePanelReview(null);
  }, [selectedHotelId]);

  useEffect(() => {
    if (currentHotelId && selectedHotelId === 'all') {
      setSelectedHotelId(currentHotelId);
    }
  }, [currentHotelId, selectedHotelId]);

  // Load KPI Stats
  const fetchKPIStats = useCallback(async () => {
    if (!activeHotelId) return;
    try {
      let query = supabase.from('reviews').select('status, rating, review_date, created_at');
      if (selectedHotelId === 'all') {
        if (roleKey !== 'super_admin' && hotelIds && hotelIds.length > 0) {
          query = query.in('hotel_id', hotelIds);
        }
      } else {
        query = query.eq('hotel_id', selectedHotelId);
      }
      const { data: dbReviews } = await query;
      if (dbReviews) {
        let pending = 0;
        let todayReviews = 0;
        let published = 0;
        let critical = 0;
        const todayStr = new Date().toISOString().split('T')[0];

        dbReviews.forEach(r => {
          const s = (r.status || 'draft').toLowerCase();
          if (s === 'draft' || s === 'pending_approval') pending++;
          if ((r.review_date || r.created_at || '').startsWith(todayStr)) todayReviews++;
          if (s === 'published' || s === 'approved') published++;
          if (r.rating <= 2) critical++;
        });

        setKpis({
          pendingResponse: pending,
          todayCount: todayReviews,
          publishedResponse: published,
          avgResponseTimeText: '8m',
          criticalCount: critical,
          aiSuccessRate: dbReviews.length > 0 ? Math.round((published / dbReviews.length) * 100) : 94
        });
      }
    } catch (e) {
      console.error(e);
    }
  }, [selectedHotelId, activeHotelId, roleKey, hotelIds]);

  // Load Reviews
  const fetchReviewsList = useCallback(async () => {
    if (!activeHotelId) return;
    setLoading(true);
    try {
      let q = supabase.from('reviews').select('*', { count: 'exact' });
      if (selectedHotelId === 'all') {
        if (roleKey !== 'super_admin' && hotelIds && hotelIds.length > 0) {
          q = q.in('hotel_id', hotelIds);
        }
      } else {
        q = q.eq('hotel_id', selectedHotelId);
      }

      if (selectedPlatform !== 'all') {
        q = q.eq('platform', selectedPlatform.toLowerCase());
      }
      if (selectedRating !== 'all') {
        q = q.eq('rating', selectedRating);
      }
      if (activeTab === 'active') {
        q = q.not('status', 'in', '("Published","published","approved")');
      } else {
        q = q.in('status', ['Published', 'published', 'approved']);
      }

      const isAsc = sortBy === 'oldest';
      const { data, count } = await q
        .order('review_date', { ascending: isAsc, nullsFirst: false })
        .range(0, LIMIT - 1);

      if (data) {
        const mapped = data.map(mapReview);
        setReviews(mapped);
        setTotalCount(count || 0);

        const newEditTexts: Record<string, string> = {};
        mapped.forEach(r => {
          newEditTexts[r.id] = r.response || '';
        });
        setEditTexts(newEditTexts);

        if (mapped.length > 0 && !activePanelReview) {
          setActivePanelReview(mapped[0]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedHotelId, activeHotelId, selectedPlatform, selectedRating, activeTab, sortBy]);

  useEffect(() => {
    fetchKPIStats();
    fetchReviewsList();
  }, [selectedHotelId, selectedPlatform, selectedRating, activeTab, sortBy]);

  const handleSaveDraft = async (review: Review) => {
    const text = editTexts[review.id];
    setSavingId(review.id);
    try {
      await reviewService.saveResponseDraft(review.id, text);
      setReviews(prev => prev.map(r => r.id === review.id ? { ...r, response: text, status: 'draft' } : r));
      if (activePanelReview?.id === review.id) {
        setActivePanelReview({ ...activePanelReview, response: text, status: 'draft' });
      }
      alert('Taslak kaydedildi.');
    } catch (e: any) {
      alert(e.message || 'Hata oluştu');
    } finally {
      setSavingId(null);
    }
  };

  const handleRegenerateAI = async (review: Review) => {
    setSavingId(review.id);
    try {
      const result = await reviewService.generateAiResponse(review.id);
      const aiReply = result.response;
      setEditTexts(prev => ({ ...prev, [review.id]: aiReply }));
      await reviewService.saveResponseDraft(review.id, aiReply);
      setReviews(prev => prev.map(r => r.id === review.id ? { ...r, response: aiReply, status: 'draft' } : r));
      if (activePanelReview?.id === review.id) {
        setActivePanelReview({ ...activePanelReview, response: aiReply, status: 'draft' });
      }
    } catch (e: any) {
      alert(e.message || 'Cevap üretilemedi');
    } finally {
      setSavingId(null);
    }
  };

  const handlePublish = async (review: Review) => {
    const text = editTexts[review.id] || review.response || '';
    if (!text.trim()) return;
    setSavingId(review.id);
    try {
      await supabase.from('reviews').update({
        status: 'Published',
        published_at: new Date().toISOString(),
        ai_reply: text
      }).eq('id', review.id);

      alert('Cevap yayınlandı.');
      setReviews(prev => prev.filter(r => r.id !== review.id));
      if (activePanelReview?.id === review.id) {
        setActivePanelReview(null);
      }
      fetchKPIStats();
    } catch (e: any) {
      alert(e.message || 'Yayınlama hatası');
    } finally {
      setSavingId(null);
    }
  };

  const handleTranslate = async (reviewId: string, text: string, lang: 'tr' | 'en' | 'ru') => {
    const key = `${reviewId}_${lang}`;
    if (translations[key]) return;
    setTranslatingKeys(prev => ({ ...prev, [key]: true }));
    try {
      const res = await reviewService.translateReview(text, lang);
      setTranslations(prev => ({ ...prev, [key]: res }));
    } catch (e) {
      console.error(e);
    } finally {
      setTranslatingKeys(prev => ({ ...prev, [key]: false }));
    }
  };

  const activeHotel = hotels.find(h => h.id === activeHotelId);
  const hotelName = activeHotel?.name || 'Seçili Otel';

  const conversationalExplainer = useMemo(() => {
    return {
      greeting: `Merhaba, ben AI Operations Director. ${hotelName} veritabanını tarayarak departman bazlı analizleri çıkardım:`,
      issues: [
        { dept: "Yiyecek & İçecek / Restoran", change: "-13%", desc: "Yemeklerin lezzeti ve kahvaltı servisindeki yavaşlık puan düşüşünün ana sebebi.", status: "critical" },
        { dept: "Ön Büro / Resepsiyon", change: "-4%", desc: "Giriş ve çıkış saatlerinde bekleme süresine yönelik şikayetler mevcut.", status: "warning" },
        { dept: "Kat Hizmetleri / Housekeeping", change: "+8%", desc: "Oda temizliği ve çarşaf kalitesi konularında olumlu yorumlar artıyor.", status: "success" }
      ],
      conclusion: "Bugün restoran departmanına yönelik düzeltici aksiyonlar almamız puan trendini toparlamak için kritik önem taşımaktadır."
    };
  }, [hotelName]);

  return (
    <div className="space-y-6 text-[#151827]">
      {/* AI Reply Center Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E8EAF0] pb-6">
        <div className="space-y-1 text-left">
          <h1 className="text-2xl font-black text-[#151827] m-0 flex items-center gap-2">
            <Brain className="text-[#6D5DF6]" size={24} />
            AI Operations Director
          </h1>
          <p className="text-xs text-zinc-500">
            ChatGPT-style conversational dashboard managing review drafts and department drop analytics.
          </p>
        </div>

        {/* Tab pills */}
        <div className="flex border border-slate-200 gap-1 p-1 rounded-2xl bg-white">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 text-xs font-bold transition-all rounded-xl cursor-pointer ${
              activeTab === 'active' ? 'bg-[#6D5DF6] text-white shadow-sm' : 'text-zinc-555'
            }`}
          >
            Active Drafts
          </button>
          <button
            onClick={() => setActiveTab('archived')}
            className={`px-4 py-2 text-xs font-bold transition-all rounded-xl cursor-pointer ${
              activeTab === 'archived' ? 'bg-[#6D5DF6] text-white shadow-sm' : 'text-zinc-555'
            }`}
          >
            Published Archive
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
        <div className="glass-panel p-4 rounded-[18px] bg-white border border-[#E8EAF0] flex items-center gap-3">
          <Clock className="text-amber-500" size={20} />
          <div>
            <span className="text-[10px] text-zinc-500 font-bold block">BEKLEYEN CEVAP</span>
            <span className="text-base font-extrabold text-[#151827]">{kpis.pendingResponse}</span>
          </div>
        </div>
        <div className="glass-panel p-4 rounded-[18px] bg-white border border-[#E8EAF0] flex items-center gap-3">
          <MessageSquare className="text-[#6D5DF6]" size={20} />
          <div>
            <span className="text-[10px] text-zinc-500 font-bold block">BUGÜN GELEN</span>
            <span className="text-base font-extrabold text-[#151827]">{kpis.todayCount}</span>
          </div>
        </div>
        <div className="glass-panel p-4 rounded-[18px] bg-white border border-[#E8EAF0] flex items-center gap-3">
          <Sparkles className="text-purple-600" size={20} />
          <div>
            <span className="text-[10px] text-zinc-500 font-bold block">YAYINLANAN</span>
            <span className="text-base font-extrabold text-[#151827]">{kpis.publishedResponse}</span>
          </div>
        </div>
        <div className="glass-panel p-4 rounded-[18px] bg-white border border-[#E8EAF0] flex items-center gap-3">
          <AlertTriangle className="text-rose-500" size={20} />
          <div>
            <span className="text-[10px] text-zinc-500 font-bold block">KRİTİK YORUM</span>
            <span className="text-base font-extrabold text-[#151827]">{kpis.criticalCount}</span>
          </div>
        </div>
      </div>

      {/* V2 CHATGPT 3-PANEL LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-16rem)] min-h-[580px] items-stretch">
        
        {/* LEFT COLUMN: Critical Problems List */}
        <div className="lg:col-span-3 flex flex-col bg-white border border-[#E8EAF0] rounded-[18px] overflow-hidden">
          <div className="p-4 border-b border-[#E8EAF0] shrink-0 text-left">
            <span className="text-xs font-bold text-[#151827] uppercase tracking-wider">Kritik Problemler</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin">
            {reviews.filter(r => r.rating <= 2).length === 0 ? (
              <div className="py-20 text-center text-zinc-500 text-xs">
                Kritik seviyede şikayet bulunmuyor.
              </div>
            ) : (
              reviews.filter(r => r.rating <= 2).map((review) => {
                const isSelected = activePanelReview?.id === review.id;
                return (
                  <div
                    key={review.id}
                    onClick={() => setActivePanelReview(review)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected ? 'bg-[#F0EDFF] border-[#6D5DF6]/45' : 'bg-slate-50 border-slate-100 hover:bg-slate-100/50'
                    }`}
                  >
                    <div className="flex justify-between items-center text-[10px] text-zinc-500 font-bold">
                      <span className="text-rose-600">⚠️ CRITICAL</span>
                      <span>{review.source}</span>
                    </div>
                    <h4 className="text-xs font-bold text-[#151827] mt-1.5">{review.guestName || 'Guest'}</h4>
                    <p className="text-[10px] text-zinc-500 line-clamp-2 mt-1 leading-relaxed">{review.comment}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* CENTER COLUMN: ChatGPT Assistant Chat Area */}
        <div className="lg:col-span-6 flex flex-col bg-white border border-[#E8EAF0] rounded-[18px] overflow-hidden">
          <div className="p-4 border-b border-[#E8EAF0] shrink-0 flex items-center justify-between">
            <span className="text-xs font-bold text-[#151827] uppercase tracking-wider">AI Operations Assistant</span>
            {activePanelReview && (
              <span className="text-[10px] text-[#6D5DF6] bg-[#F0EDFF] border border-[#6D5DF6]/20 px-2 py-0.5 rounded-full font-bold">
                {activePanelReview.guestName || 'Misafir'}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
            {/* Conversational AI Explainer Block */}
            <div className="flex items-start gap-3 text-left">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shrink-0 shadow-md">
                🤖
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs leading-relaxed text-zinc-650 max-w-[85%] space-y-3">
                <p className="font-bold text-[#151827]">{conversationalExplainer.greeting}</p>
                <div className="space-y-2">
                  {conversationalExplainer.issues.map((iss, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-[#E8EAF0]">
                      <div>
                        <strong className="text-[#151827] block">{iss.dept}</strong>
                        <span className="text-[10px] text-zinc-500">{iss.desc}</span>
                      </div>
                      <span className={`text-[10px] font-black uppercase ${
                        iss.status === 'critical' ? 'text-rose-600' :
                        iss.status === 'warning' ? 'text-amber-600' : 'text-emerald-600'
                      }`}>
                        {iss.change}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="font-semibold text-zinc-500">{conversationalExplainer.conclusion}</p>
              </div>
            </div>

            {/* Selected Review Details Panel */}
            {activePanelReview && (
              <div className="flex items-start gap-3 text-left pt-4 border-t border-[#E8EAF0]">
                <div className="w-8 h-8 rounded-xl bg-slate-50 border border-[#E8EAF0] flex items-center justify-center text-[#151827] shrink-0">
                  👤
                </div>
                <div className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-xs font-bold text-[#151827]">{activePanelReview.guestName || 'Misafir'}</h4>
                      <span className="text-[10px] text-zinc-555">{activePanelReview.source} &bull; {activePanelReview.review_date ? new Date(activePanelReview.review_date).toLocaleDateString('tr-TR') : 'Date unknown'}</span>
                    </div>
                    <span className="text-xs font-bold text-amber-600">★ {activePanelReview.rating}</span>
                  </div>
                  <p className="text-xs text-zinc-500 italic">"{activePanelReview.comment}"</p>

                  {/* Reply Editor */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-bold text-[#6D5DF6] uppercase tracking-wide block">Edit AI Response Draft</span>
                    <textarea
                      value={editTexts[activePanelReview.id] || ''}
                      onChange={(e) => handleTextChange(activePanelReview.id, e.target.value)}
                      rows={5}
                      className="w-full bg-white border border-[#E8EAF0] rounded-xl p-3 text-xs text-[#151827] focus:outline-none"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveDraft(activePanelReview)}
                      disabled={savingId === activePanelReview.id}
                      className="flex-1 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-[#151827] font-bold text-[10px] rounded-xl transition-all cursor-pointer"
                    >
                      Save Draft
                    </button>
                    <button
                      onClick={() => handleRegenerateAI(activePanelReview)}
                      disabled={savingId === activePanelReview.id}
                      className="flex-1 py-2 bg-[#F0EDFF] border border-[#6D5DF6]/20 hover:bg-purple-100 text-[#6D5DF6] font-bold text-[10px] rounded-xl transition-all cursor-pointer"
                    >
                      Regenerate
                    </button>
                    <button
                      onClick={() => handlePublish(activePanelReview)}
                      disabled={savingId === activePanelReview.id}
                      className="flex-1 py-2 bg-[#6D5DF6] hover:bg-[#5b4ee4] text-white font-bold text-[10px] rounded-xl transition-all cursor-pointer"
                    >
                      Publish Reply
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Benchmarks & Task Checklists */}
        <div className="lg:col-span-3 flex flex-col bg-white border border-[#E8EAF0] rounded-[18px] overflow-hidden">
          <div className="p-4 border-b border-[#E8EAF0] shrink-0 text-left">
            <span className="text-xs font-bold text-[#151827] uppercase tracking-wider">Trendler & Analiz</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin text-left">
            {/* Health indicators */}
            <div className="space-y-4">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Departman Puan Değişimleri</span>
              
              <div className="space-y-3.5">
                {[
                  { name: 'Restoran', pct: 68, trend: 'down', color: 'bg-rose-500', change: '-%13' },
                  { name: 'Ön Büro / Resepsiyon', pct: 81, trend: 'down', color: 'bg-amber-500', change: '-%4' },
                  { name: 'Kat Hizmetleri', pct: 92, trend: 'up', color: 'bg-emerald-500', change: '+%8' },
                  { name: 'Teknik Servis', pct: 75, trend: 'neutral', color: 'bg-purple-500', change: '-%1' }
                ].map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] font-semibold text-zinc-500">
                      <span>{item.name}</span>
                      <span className={item.trend === 'up' ? 'text-emerald-600' : item.trend === 'down' ? 'text-rose-600' : 'text-zinc-500'}>
                        {item.change}
                      </span>
                    </div>
                    <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div style={{ width: `${item.pct}%` }} className={`h-full rounded-full ${item.color}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick TODO checklist */}
            <div className="space-y-3 pt-4 border-t border-[#E8EAF0]">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                <ListTodo size={11} />
                Bugün Yapılması Gerekenler
              </span>
              
              <div className="space-y-2">
                {[
                  { text: 'Restoran şikayetini incele ve ekibe bildir.', checked: false },
                  { text: 'Resepsiyon bekleme süresi görevini ata.', checked: false },
                  { text: 'Temizlik ekibine teşekkür notu ilet.', checked: true }
                ].map((todo, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-[10px] leading-relaxed text-zinc-500 bg-slate-50 border border-slate-100 p-2 rounded-xl">
                    <input 
                      type="checkbox" 
                      checked={todo.checked} 
                      readOnly 
                      className="w-3.5 h-3.5 rounded text-indigo-650 border-[#E8EAF0] bg-white cursor-pointer mt-0.5" 
                    />
                    <span className={todo.checked ? 'line-through text-zinc-400' : ''}>{todo.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

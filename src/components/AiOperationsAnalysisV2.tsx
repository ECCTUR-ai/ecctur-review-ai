import React, { useState } from 'react';
import { Review, OperationsAnalysisV2 } from '@/types';
import { 
  Sparkles, 
  RefreshCw, 
  AlertTriangle, 
  Activity, 
  ArrowRight, 
  CheckCircle2, 
  ListChecks, 
  TrendingUp, 
  ShieldAlert, 
  Sliders, 
  Layers, 
  Clock, 
  CheckSquare, 
  PlayCircle 
} from 'lucide-react';

interface AiOperationsAnalysisV2Props {
  review: Review;
  onAnalyze: (id: string) => Promise<void>;
  onTriggerTaskForm: (action: { department: string; description: string; priority: string }) => void;
  existingTasks: any[]; // Used to determine if task is already created
}

export const getDeptTurkishLabel = (dept: string): string => {
  const map: Record<string, string> = {
    'Front Office': 'Ön Büro',
    'Guest Relations': 'Misafir İlişkileri',
    'Housekeeping': 'Housekeeping',
    'Food & Beverage': 'Yiyecek & İçecek',
    'Kitchen': 'Mutfak',
    'Restaurant': 'Restoran',
    'Bar': 'Bar',
    'Beach Operations': 'Plaj Operasyonları',
    'Pool Operations': 'Havuz Operasyonları',
    'Animation': 'Animasyon',
    'Technical Service': 'Teknik Servis',
    'Maintenance': 'Bakım & Onarım',
    'Security': 'Güvenlik',
    'Spa': 'Spa',
    'Reservation': 'Rezervasyon',
    'Sales': 'Satış',
    'Revenue Management': 'Gelir Yönetimi',
    'Management': 'Yönetim',
    'Transportation': 'Ulaşım',
    'Other': 'Diğer'
  };
  return map[dept] || dept;
};

export function AiOperationsAnalysisV2({
  review,
  onAnalyze,
  onTriggerTaskForm,
  existingTasks = []
}: AiOperationsAnalysisV2Props) {
  const [loading, setLoading] = useState(false);

  // Backward compatibility mapper (V1 to V2)
  const getMappedAnalysis = (): OperationsAnalysisV2 | null => {
    if (review.ai_operation_analysis) {
      return review.ai_operation_analysis;
    }

    if (review.aiAnalysis) {
      // Map old V1 analysis to V2 schema
      const topics = review.aiAnalysis.keyTopics || [];
      const primaryTopic = topics[0] || 'Genel Değerlendirme';
      const sentiment = review.aiAnalysis.sentiment || 'neutral';
      const confidence = review.aiAnalysis.sentimentScore || (review.rating >= 4 ? 94 : 88);

      const resolvedDept = review.departments[0] || 'Guest Relations';

      return {
        version: "2.0",
        executive_summary: `[Legacy V1 Analiz] Misafir ${review.source} üzerinden ${review.rating} puan verdi. Öne çıkan konular: ${topics.join(', ')}.`,
        overall_sentiment: sentiment === 'positive' ? 'positive' : sentiment === 'negative' ? 'negative' : 'neutral',
        emotion: review.aiAnalysis.emotion || 'Belirsiz',
        confidence: confidence,
        main_problem: sentiment === 'negative' ? {
          title: `${primaryTopic} Sorunu`,
          category: primaryTopic,
          department: resolvedDept,
          impact: 100,
          evidence: []
        } : null,
        secondary_problems: [],
        problem_distribution: [{
          title: `${primaryTopic} Sorunu`,
          category: primaryTopic,
          department: resolvedDept,
          impact: 100
        }],
        department_distribution: [{
          department: resolvedDept,
          impact: 100
        }],
        root_cause_chain: [],
        risk_analysis: [
          {
            risk: 'google_rating',
            label: 'Puan Riski',
            level: sentiment === 'negative' ? 'high' : 'low',
            reason: 'Yorum derecelendirmesine göre otomatik oluşturulan risk.'
          }
        ],
        affected_kpis: [
          {
            name: 'Guest Satisfaction',
            impact: sentiment === 'negative' ? 'high' : 'low'
          }
        ],
        recommended_actions: [
          {
            department: resolvedDept,
            action: `${primaryTopic} konusunda misafir bildirimini değerlendirin ve düzeltici işlem başlatın.`,
            priority: review.priority || 'medium',
            expected_impact: 'medium',
            estimated_time: '24 Saat',
            auto_task_eligible: sentiment === 'negative'
          }
        ],
        tags: topics
      };
    }

    return null;
  };

  const analysis = getMappedAnalysis();
  const isLegacy = !review.ai_operation_analysis && !!review.aiAnalysis;

  const handleRefresh = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onAnalyze(review.id);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Check if a task is already created for a specific action
  const isTaskCreated = (actionText: string) => {
    const cleanAction = actionText.trim().toLowerCase();
    return existingTasks.some(t => {
      const desc = (t.description || '').toLowerCase();
      return desc.includes(cleanAction) || desc.includes(cleanAction.substring(0, 30));
    });
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'negative': return 'bg-rose-50 text-rose-700 border-rose-100';
      case 'mixed': return 'bg-amber-50 text-amber-700 border-amber-100';
      default: return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  const getSentimentLabel = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'Pozitif';
      case 'negative': return 'Negatif';
      case 'mixed': return 'Karışık';
      default: return 'Nötr';
    }
  };

  const getRiskBadgeColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-50 text-red-700 border-red-200';
      case 'high': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'medium': return 'bg-yellow-50 text-yellow-800 border-yellow-200';
      default: return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/30 text-center space-y-4">
        <Sparkles size={28} className="text-blue-500 animate-pulse" />
        <div>
          <h4 className="text-xs font-bold text-slate-800">Yapay Zeka Operasyon Analizi Yok</h4>
          <p className="text-[10px] text-slate-500 max-w-xs mt-1">
            Bu yorum için henüz detaylı operasyonel analiz gerçekleştirilmedi. V2 motoruyla hemen analiz oluşturabilirsiniz.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-4.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition-all disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          <span>{loading ? 'Analiz Ediliyor...' : 'Analiz Oluştur (V2)'}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Card */}
      <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-xs font-black text-slate-800 tracking-wider flex items-center gap-1.5">
              <Sparkles size={13} className="text-indigo-600" />
              YAPAY ZEKA OPERASYON ANALİZİ
            </h4>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
              V2.0
            </span>
            {isLegacy && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                Legacy V1
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] font-semibold text-slate-500">
            <span className="flex items-center gap-1">
              Güven Skoru: 
              <span className={`font-bold ${analysis.confidence >= 70 ? 'text-emerald-600' : 'text-amber-600'}`}>
                %{analysis.confidence}
              </span>
            </span>
            <span>&bull;</span>
            <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold capitalize ${getSentimentColor(analysis.overall_sentiment)}`}>
              {getSentimentLabel(analysis.overall_sentiment)}
            </span>
            {review.ai_operation_analysis_updated_at && (
              <>
                <span>&bull;</span>
                <span>Analiz Tarihi: {new Date(review.ai_operation_analysis_updated_at).toLocaleDateString('tr-TR')}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-center shrink-0">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-1 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-[10.5px] font-bold text-slate-700 transition-colors shadow-sm"
          >
            <RefreshCw size={11.5} className={loading ? 'animate-spin text-indigo-600' : 'text-slate-500'} />
            <span>{loading ? 'Yenileniyor...' : isLegacy ? 'V2\'ye Yükselt' : 'Analizi Yenile'}</span>
          </button>
        </div>
      </div>

      {/* Warning banner for low confidence score */}
      {analysis.confidence < 70 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[10.5px] text-amber-800 font-medium flex items-start gap-2.5">
          <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Yönetici Kontrolü Önerilir:</span> Yorumun kısalığı, anlamsal belirsizliği veya çelişkili ifadeler nedeniyle AI güven skoru düşük çıkmıştır. Lütfen verileri manuel olarak gözden geçirin.
          </div>
        </div>
      )}

      {/* 2. Executive Summary */}
      {analysis.executive_summary && (
        <div className="space-y-1.5">
          <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Yönetici Özeti</h5>
          <div className="bg-slate-50/40 border border-slate-200/60 rounded-xl p-3.5 text-xs text-slate-700 leading-relaxed font-medium italic">
            "{analysis.executive_summary}"
          </div>
        </div>
      )}

      {/* 3. Main Problem */}
      {analysis.main_problem && (
        <div className="space-y-1.5">
          <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ana Operasyonel Sorun</h5>
          <div className="bg-rose-50/20 border border-rose-100 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-start gap-3">
              <div>
                <h6 className="text-xs font-bold text-slate-800">{analysis.main_problem.title}</h6>
                <div className="flex items-center gap-2 mt-1 text-[10px] font-semibold text-slate-500">
                  <span className="bg-rose-50 border border-rose-100 text-rose-700 px-2 py-0.5 rounded">
                    {getDeptTurkishLabel(analysis.main_problem.department)}
                  </span>
                  <span>&bull;</span>
                  <span>Kategori: {analysis.main_problem.category}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-base font-black text-rose-600">%{analysis.main_problem.impact}</span>
                <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider">Etki Oranı</span>
              </div>
            </div>

            {analysis.main_problem.evidence && analysis.main_problem.evidence.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-rose-100/40">
                <span className="text-[9px] font-bold text-rose-700 uppercase tracking-wider">Metin İçi Kanıtlar:</span>
                <ul className="list-disc pl-4 space-y-1 text-[10.5px] text-slate-600 italic">
                  {analysis.main_problem.evidence.map((ev, i) => (
                    <li key={i}>"{ev}"</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Problem & Department Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Problem Distribution */}
        {analysis.problem_distribution && analysis.problem_distribution.length > 0 && (
          <div className="space-y-1.5">
            <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Sliders size={11} className="text-indigo-500" />
              Sorun Dağılımı (% Etki)
            </h5>
            <div className="border border-slate-200/80 rounded-xl p-4 bg-white space-y-3.5">
              {analysis.problem_distribution.map((p, idx) => (
                <div key={idx} className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-slate-800 truncate pr-2">{p.title}</span>
                    <span className="text-indigo-600 shrink-0">%{p.impact}</span>
                  </div>
                  <div className="flex items-center justify-between text-[9px] font-semibold text-slate-400">
                    <span>{getDeptTurkishLabel(p.department)}</span>
                    <span>{p.category}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-500 h-full rounded-full transition-all"
                      style={{ width: `${p.impact}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Department Distribution */}
        {analysis.department_distribution && analysis.department_distribution.length > 0 && (
          <div className="space-y-1.5">
            <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Layers size={11} className="text-purple-500" />
              Sorumlu Departman Etkisi
            </h5>
            <div className="border border-slate-200/80 rounded-xl p-4 bg-white space-y-3.5">
              {analysis.department_distribution.map((d, idx) => (
                <div key={idx} className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-slate-800">{getDeptTurkishLabel(d.department)}</span>
                    <span className="text-purple-600">%{d.impact}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-purple-500 h-full rounded-full transition-all"
                      style={{ width: `${d.impact}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 5. Root Cause Chain */}
      {analysis.root_cause_chain && analysis.root_cause_chain.length > 0 && (
        <div className="space-y-1.5">
          <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Activity size={11} className="text-indigo-500" />
            Kök Neden Operasyonel Zinciri
          </h5>
          <div className="border border-slate-200/80 rounded-xl p-4 bg-white">
            <div className="relative border-l border-slate-200 ml-2.5 pl-5.5 space-y-4">
              {analysis.root_cause_chain.map((chain, i) => (
                <div key={i} className="relative">
                  <div className="absolute -left-[29px] top-0.5 w-3.5 h-3.5 rounded-full bg-indigo-50 border-2 border-indigo-500 flex items-center justify-center text-[7px] font-bold text-indigo-600">
                    {chain.step}
                  </div>
                  <div className="text-[11px]">
                    <span className="font-bold text-slate-700 block">{chain.title}</span>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">{chain.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 6. Risk Analysis */}
      {analysis.risk_analysis && analysis.risk_analysis.length > 0 && (
        <div className="space-y-1.5">
          <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <ShieldAlert size={11} className="text-red-500" />
            Risk Değerlendirmesi
          </h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {analysis.risk_analysis.map((r, idx) => (
              <div key={idx} className="border border-slate-200/80 rounded-xl p-3 bg-white flex flex-col justify-between gap-1.5">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-[10.5px] font-bold text-slate-800">{r.label}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border shrink-0 ${getRiskBadgeColor(r.level)}`}>
                    {r.level}
                  </span>
                </div>
                <p className="text-[9.5px] text-slate-500 leading-relaxed font-semibold">
                  {r.reason}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. Affected KPIs */}
      {analysis.affected_kpis && analysis.affected_kpis.length > 0 && (
        <div className="space-y-1.5">
          <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Etkilenen KPI'lar</h5>
          <div className="flex flex-wrap gap-2">
            {analysis.affected_kpis.map((kpi, i) => (
              <span 
                key={i} 
                className="px-2.5 py-1 bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-bold rounded-lg flex items-center gap-1.5"
              >
                <TrendingUp size={10} className="text-slate-400" />
                <span>{kpi.name}</span>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  kpi.impact === 'critical' ? 'bg-red-500' : kpi.impact === 'high' ? 'bg-orange-500' : kpi.impact === 'medium' ? 'bg-yellow-500' : 'bg-emerald-500'
                }`} />
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 8. Recommended Actions */}
      {analysis.recommended_actions && analysis.recommended_actions.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <ListChecks size={11.5} className="text-emerald-600" />
            Önerilen Düzeltici / Önleyici Eylemler
          </h5>
          <div className="space-y-3">
            {analysis.recommended_actions.map((act, i) => {
              const taskCreated = isTaskCreated(act.action);
              return (
                <div key={i} className="border border-slate-200/80 rounded-xl p-3.5 bg-white space-y-3 shadow-sm hover:shadow transition-shadow">
                  <div className="flex flex-wrap justify-between items-start gap-2">
                    <div>
                      <span className="px-1.5 py-0.5 rounded text-[8.5px] font-black tracking-wide bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase">
                        {getDeptTurkishLabel(act.department)}
                      </span>
                      <p className="text-[11px] font-bold text-slate-700 mt-2 leading-relaxed">
                        {act.action}
                      </p>
                    </div>
                    <div className="flex gap-1.5 text-[8.5px] font-bold text-slate-400 shrink-0">
                      <span className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded">
                        Öncelik: <span className="capitalize font-black text-slate-700">{act.priority}</span>
                      </span>
                      <span className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded">
                        Süre: <span className="font-black text-slate-700">{act.estimated_time}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center gap-3 pt-2.5 border-t border-slate-100">
                    <span className="text-[9px] text-slate-400 font-semibold flex items-center gap-1">
                      <Clock size={10} />
                      Beklenen Etki: <span className="font-bold text-slate-600 capitalize">{act.expected_impact}</span>
                    </span>

                    {act.auto_task_eligible && (
                      <button
                        type="button"
                        disabled={taskCreated}
                        onClick={() => onTriggerTaskForm({
                          department: act.department,
                          description: act.action,
                          priority: act.priority
                        })}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[9.5px] font-bold transition-all shadow-sm border ${
                          taskCreated 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white border-transparent'
                        }`}
                      >
                        {taskCreated ? (
                          <>
                            <CheckCircle2 size={11} className="text-emerald-500" />
                            <span>Görev Oluşturuldu</span>
                          </>
                        ) : (
                          <>
                            <CheckSquare size={11} />
                            <span>Görev Oluştur</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 9. Tags */}
      {analysis.tags && analysis.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-200/60">
          {analysis.tags.map((tag, i) => (
            <span key={i} className="text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200/50 px-2 py-0.5 rounded-md">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

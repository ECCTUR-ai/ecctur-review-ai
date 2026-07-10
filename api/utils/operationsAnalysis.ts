import { getHotelOperationsAnalysisPrompt } from './operationsAnalysisPrompt.js';
import { 
  OperationsAnalysisV2Schema, 
  normalizeDistribution, 
  type OperationsAnalysisV2 
} from './operationsAnalysisSchema.js';

export async function analyzeReviewText(
  reviewText: string,
  rating: number,
  apiKey: string
): Promise<OperationsAnalysisV2> {
  const model = process.env.AI_OPERATIONS_MODEL || 'gpt-4o';
  
  if (!apiKey) {
    console.warn('[Operations Analysis] OpenAI API Key is missing. Using local fallback.');
    return getLocalFallback(reviewText, rating);
  }

  const prompt = getHotelOperationsAnalysisPrompt(reviewText, rating);

  try {
    console.log(`[Operations Analysis] Calling OpenAI (${model}) with temperature 0.2...`);
    const data = await callOpenAI(prompt, model, apiKey);
    
    // Validate and normalize
    return validateAndNormalize(data);
  } catch (error: any) {
    console.warn('[Operations Analysis] First attempt failed. Attempting JSON repair...', error.message || error);
    
    try {
      // Retry once with a repair prompt
      const repairPrompt = `You returned an invalid JSON response earlier. Please repair the response to be strict, valid JSON matching the schema below. Do not wrap in markdown or include extra text.
      
      SCHEMA:
      ${JSON.stringify(OperationsAnalysisV2Schema.shape)}

      ORIGINAL ERROR:
      ${error.message || String(error)}

      REVIEW TEXT:
      "${reviewText}"
      
      RATING: ${rating}`;

      const repairedData = await callOpenAI(repairPrompt, model, apiKey);
      return validateAndNormalize(repairedData);
    } catch (retryError: any) {
      console.error('[Operations Analysis] Both attempts failed. Returning safe local fallback.', retryError.message || retryError);
      return getLocalFallback(reviewText, rating);
    }
  }
}

async function callOpenAI(prompt: string, model: string, apiKey: string): Promise<any> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API returned status ${response.status}: ${errorText}`);
  }

  const resJson = await response.json();
  const rawText = resJson.choices?.[0]?.message?.content || '{}';
  
  // Strip any accidental markdown formatting if present
  let cleanText = rawText.trim();
  if (cleanText.startsWith('```')) {
    cleanText = cleanText.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  }

  return JSON.parse(cleanText);
}

function validateAndNormalize(data: any): OperationsAnalysisV2 {
  // Safe parsing with default values to handle minor schema drift
  const parsed = OperationsAnalysisV2Schema.parse(data);

  // Normalize weights
  parsed.problem_distribution = normalizeDistribution(parsed.problem_distribution);
  parsed.department_distribution = normalizeDistribution(parsed.department_distribution);

  return parsed;
}

export function getLocalFallback(reviewText: string, rating: number): OperationsAnalysisV2 {
  // Simple heuristic for fallback departments based on keywords
  const lowerText = (reviewText || '').toLowerCase();
  let fallbackDept = 'Other';
  let category = 'Genel Hizmet';

  if (lowerText.includes('temiz') || lowerText.includes('oda') || lowerText.includes('kirli')) {
    fallbackDept = 'Housekeeping';
    category = 'Oda Temizliği';
  } else if (lowerText.includes('yemek') || lowerText.includes('restoran') || lowerText.includes('kahvaltı') || lowerText.includes('lezzet')) {
    fallbackDept = 'Food & Beverage';
    category = 'Yemek Kalitesi';
  } else if (lowerText.includes('resepsiyon') || lowerText.includes('check-in') || lowerText.includes('bekle')) {
    fallbackDept = 'Front Office';
    category = 'Resepsiyon & Giriş';
  } else if (lowerText.includes('şezlong') || lowerText.includes('plaj') || lowerText.includes('deniz')) {
    fallbackDept = 'Beach Operations';
    category = 'Plaj & Havuz Alanları';
  }

  const overallSentiment = rating >= 4 ? 'positive' : rating === 3 ? 'neutral' : 'negative';

  return {
    version: "2.0",
    executive_summary: "Yorum analizi otomatik olarak gerçekleştirildi (Sistem Fallback). Otel yönetimi tarafından manuel kontrol önerilir.",
    overall_sentiment: overallSentiment,
    emotion: rating >= 4 ? 'Memnun' : 'Nötr/Belirsiz',
    confidence: 45,
    main_problem: rating < 4 ? {
      title: `${category} Değerlendirmesi`,
      category: category,
      department: fallbackDept,
      impact: 100,
      evidence: []
    } : null,
    secondary_problems: [],
    problem_distribution: rating < 4 ? [
      {
        title: `${category} Değerlendirmesi`,
        category: category,
        department: fallbackDept,
        impact: 100
      }
    ] : [],
    department_distribution: [
      {
        department: fallbackDept,
        impact: 100
      }
    ],
    root_cause_chain: [],
    risk_analysis: [
      {
        risk: 'google_rating',
        label: 'Google Puanı Riski',
        level: rating <= 2 ? 'high' : rating === 3 ? 'medium' : 'low',
        reason: 'Misafirin verdiği düşük puan, genel ortalama skorunu etkileyebilir.'
      },
      {
        risk: 'guest_retention',
        label: 'Misafir Kaybı Riski',
        level: rating <= 2 ? 'high' : 'low',
        reason: 'Olumsuz deneyim bildiren misafirlerin geri dönme olasılığı düşüktür.'
      }
    ],
    affected_kpis: [
      {
        name: 'Guest Satisfaction',
        impact: rating <= 2 ? 'critical' : rating === 3 ? 'medium' : 'low'
      }
    ],
    recommended_actions: [
      {
        department: fallbackDept,
        action: 'Misafir ile iletişime geçilerek geri bildirim detaylarının alınması ve gerekli aksiyonların planlanması.',
        priority: rating <= 2 ? 'high' : 'medium',
        expected_impact: 'medium',
        estimated_time: '24 Saat',
        auto_task_eligible: rating <= 3
      }
    ],
    tags: ['Sistem Fallback', category]
  };
}

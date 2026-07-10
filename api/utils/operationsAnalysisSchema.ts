import { z } from 'zod';

export const SentimentSchema = z.enum(['positive', 'neutral', 'negative', 'mixed']);
export const RiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);
export const PrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export const ExpectedImpactSchema = z.enum(['low', 'medium', 'high', 'very_high']);

export const StandardDepartments = [
  'Front Office',
  'Guest Relations',
  'Housekeeping',
  'Food & Beverage',
  'Kitchen',
  'Restaurant',
  'Bar',
  'Beach Operations',
  'Pool Operations',
  'Animation',
  'Technical Service',
  'Maintenance',
  'Security',
  'Spa',
  'Reservation',
  'Sales',
  'Revenue Management',
  'Management',
  'Transportation',
  'Other'
] as const;

export const ProblemSchema = z.object({
  title: z.string().trim().min(1),
  category: z.string().trim().min(1),
  department: z.string().trim().min(1),
  impact: z.number().min(0).max(100),
  evidence: z.array(z.string()).default([])
});

export const OperationsAnalysisV2Schema = z.object({
  version: z.literal("2.0"),
  executive_summary: z.string().trim().min(1),
  overall_sentiment: SentimentSchema,
  emotion: z.string().trim().min(1),
  confidence: z.number().min(0).max(100),
  main_problem: ProblemSchema.nullable(),
  secondary_problems: z.array(ProblemSchema).default([]),
  problem_distribution: z.array(z.object({
    title: z.string().trim().min(1),
    category: z.string().trim().min(1),
    department: z.string().trim().min(1),
    impact: z.number().min(0).max(100)
  })).default([]),
  department_distribution: z.array(z.object({
    department: z.string().trim().min(1),
    impact: z.number().min(0).max(100)
  })).default([]),
  root_cause_chain: z.array(z.object({
    step: z.number(),
    title: z.string().trim().min(1),
    description: z.string().trim().min(1)
  })).default([]),
  risk_analysis: z.array(z.object({
    risk: z.enum([
      'booking_score',
      'google_rating',
      'guest_retention',
      'negative_word_of_mouth',
      'social_media',
      'compensation',
      'legal'
    ]),
    label: z.string().trim().min(1),
    level: RiskLevelSchema,
    reason: z.string().trim().min(1)
  })).default([]),
  affected_kpis: z.array(z.object({
    name: z.string().trim().min(1),
    impact: RiskLevelSchema
  })).default([]),
  recommended_actions: z.array(z.object({
    department: z.string().trim().min(1),
    action: z.string().trim().min(1),
    priority: PrioritySchema,
    expected_impact: ExpectedImpactSchema,
    estimated_time: z.string().trim().min(1),
    auto_task_eligible: z.boolean().default(false)
  })).default([]),
  tags: z.array(z.string()).default([])
});

export type OperationsAnalysisV2 = z.infer<typeof OperationsAnalysisV2Schema>;

// Normalization function
export function normalizeDistribution<T extends { impact: number }>(arr: T[]): T[] {
  if (!arr || arr.length === 0) return [];
  
  // Merge duplicates if any
  const mergedMap = new Map<string, T>();
  arr.forEach(item => {
    const key = (item as any).title || (item as any).department;
    if (mergedMap.has(key)) {
      const existing = mergedMap.get(key)!;
      existing.impact += item.impact;
    } else {
      mergedMap.set(key, { ...item });
    }
  });
  
  const mergedArr = Array.from(mergedMap.values());
  const total = mergedArr.reduce((sum, item) => sum + item.impact, 0);

  if (total === 100) return mergedArr;
  
  if (total === 0) {
    const share = Math.floor(100 / mergedArr.length);
    return mergedArr.map((item, idx) => ({
      ...item,
      impact: idx === mergedArr.length - 1 ? 100 - (share * (mergedArr.length - 1)) : share
    }));
  }
  
  let currentTotal = 0;
  // Sort descending to keep weights logic clean and subtract rounding differences from the highest item
  const sorted = [...mergedArr].sort((a, b) => b.impact - a.impact);
  
  const normalized = sorted.map((item, idx) => {
    if (idx === sorted.length - 1) {
      return {
        ...item,
        impact: Math.max(0, 100 - currentTotal)
      };
    }
    const val = Math.round((item.impact / total) * 100);
    currentTotal += val;
    return {
      ...item,
      impact: val
    };
  });
  
  return normalized;
}

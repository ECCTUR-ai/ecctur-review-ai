// src/services/insightService.ts
import { insightRepository } from '@/repositories/insightRepository';

export interface AIInsight {
  ratingTrend: 'improving' | 'declining' | 'stable';
  mostCommonComplaint: string;
  mostCommonCompliment: string;
  deptHighestIssues: string;
  aiRecommendation: string;
  dailyTrend: number;
  weeklyTrend: number;
}

export const insightService = {
  async generateInsights(hotelId?: string): Promise<AIInsight> {
    const rawData = await insightRepository.getInsightData(hotelId);

    const reviews = (rawData || []).map(r => {
      const dateVal = r.review_date || r.created_at || '';
      return {
        rating: r.rating || 0,
        comment: r.review_text || '',
        sentiment: r.sentiment || 'neutral',
        departments: r.departments || [],
        date: dateVal ? dateVal.split('T')[0] : ''
      };
    });

    if (reviews.length === 0) {
      return {
        ratingTrend: 'stable',
        mostCommonComplaint: 'No data available',
        mostCommonCompliment: 'No data available',
        deptHighestIssues: 'None',
        aiRecommendation: 'Awaiting review ingestion to compile intelligence analytics.',
        dailyTrend: 0,
        weeklyTrend: 0
      };
    }

    // Calculations:
    // 1. Rating Trend
    const sorted = [...reviews].sort((a, b) => b.date.localeCompare(a.date));
    const recent = sorted.slice(0, 10);
    const older = sorted.slice(10, 20);

    const recentAvg = recent.length > 0 ? recent.reduce((sum, r) => sum + r.rating, 0) / recent.length : 0;
    const olderAvg = older.length > 0 ? older.reduce((sum, r) => sum + r.rating, 0) / older.length : 0;

    let ratingTrend: 'improving' | 'declining' | 'stable' = 'stable';
    if (olderAvg > 0) {
      const diff = recentAvg - olderAvg;
      if (diff > 0.15) ratingTrend = 'improving';
      else if (diff < -0.15) ratingTrend = 'declining';
    }

    // 2. Complaint & Compliment Heuristics
    const complaints = ['cleanliness', 'noise', 'service', 'food', 'bathroom', 'reception', 'price', 'check-in', 'staff'];
    const compliments = ['friendly staff', 'delicious food', 'clean rooms', 'great view', 'excellent service', 'location', 'spa', 'pool'];

    const complaintCounts: Record<string, number> = {};
    const complimentCounts: Record<string, number> = {};

    reviews.forEach(r => {
      const comment = r.comment.toLowerCase();
      if (r.rating <= 3) {
        complaints.forEach(c => {
          if (comment.includes(c)) {
            complaintCounts[c] = (complaintCounts[c] || 0) + 1;
          }
        });
      } else {
        compliments.forEach(c => {
          if (comment.includes(c)) {
            complimentCounts[c] = (complimentCounts[c] || 0) + 1;
          }
        });
      }
    });

    const mostCommonComplaint = Object.entries(complaintCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Noise levels';
    const mostCommonCompliment = Object.entries(complimentCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Staff helpfulness';

    // 3. Department with highest issues
    const deptIssues: Record<string, number> = {};
    reviews.forEach(r => {
      if (r.sentiment === 'negative' && Array.isArray(r.departments)) {
        r.departments.forEach((dept: string) => {
          deptIssues[dept] = (deptIssues[dept] || 0) + 1;
        });
      }
    });
    const deptHighestIssues = Object.entries(deptIssues).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Housekeeping';

    // 4. Daily / Weekly Trend
    const today = new Date().toISOString().split('T')[0];
    const past7d = new Date();
    past7d.setDate(past7d.getDate() - 7);
    const past7dStr = past7d.toISOString().split('T')[0];

    const todayReviews = reviews.filter(r => r.date === today);
    const past7dReviews = reviews.filter(r => r.date >= past7dStr);

    const dailyTrend = todayReviews.length > 0 
      ? Number((todayReviews.reduce((sum, r) => sum + r.rating, 0) / todayReviews.length - recentAvg).toFixed(2))
      : 0;

    const weeklyTrend = past7dReviews.length > 0
      ? Number((past7dReviews.reduce((sum, r) => sum + r.rating, 0) / past7dReviews.length - recentAvg).toFixed(2))
      : 0;

    // 5. Dynamic recommendation formulation
    let aiRecommendation = '';
    if (ratingTrend === 'declining') {
      aiRecommendation = `Alert: Guest feedback indicates issues in ${deptHighestIssues}. Urgent attention to resolved ${mostCommonComplaint} issues is advised.`;
    } else {
      aiRecommendation = `Maintain momentum on ${mostCommonCompliment}. Focus incremental improvements on training staff to address minor ${mostCommonComplaint} concerns.`;
    }

    return {
      ratingTrend,
      mostCommonComplaint,
      mostCommonCompliment,
      deptHighestIssues,
      aiRecommendation,
      dailyTrend,
      weeklyTrend
    };
  }
};

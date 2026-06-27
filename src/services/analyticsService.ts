import { supabase } from '@/lib/supabase';
import { AnalyticsTrend, MetricCardData } from '@/types';

export const analyticsService = {
  async getMetrics(hotelId?: string): Promise<MetricCardData[]> {
    let qTotal = supabase.from('reviews').select('*', { count: 'exact', head: true });
    let qAvg = supabase.from('reviews').select('rating');
    let qDraft = supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('status', 'draft');
    let qPublished = supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('status', 'published');
    let qPriority = supabase.from('reviews').select('*', { count: 'exact', head: true }).in('priority', ['high', 'critical']);

    if (hotelId) {
      qTotal = qTotal.eq('hotel_id', hotelId);
      qAvg = qAvg.eq('hotel_id', hotelId);
      qDraft = qDraft.eq('hotel_id', hotelId);
      qPublished = qPublished.eq('hotel_id', hotelId);
      qPriority = qPriority.eq('hotel_id', hotelId);
    }

    const [
      { count: totalCount, error: totalError },
      { data: ratingsData, error: avgError },
      { count: draftCount, error: draftError },
      { count: publishedCount, error: publishedError },
      { count: highPriorityCount, error: priorityError }
    ] = await Promise.all([qTotal, qAvg, qDraft, qPublished, qPriority]);

    if (totalError) throw new Error(totalError.message);
    if (avgError) throw new Error(avgError.message);
    if (draftError) throw new Error(draftError.message);
    if (publishedError) throw new Error(publishedError.message);
    if (priorityError) throw new Error(priorityError.message);

    const total = totalCount || 0;
    const ratings = ratingsData || [];
    const avgRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
      : 0;

    const draft = draftCount || 0;
    const published = publishedCount || 0;
    const highPriority = highPriorityCount || 0;
    const responseRate = total > 0 ? Math.round((published / total) * 100) : 0;

    return [
      { title: 'Total Reviews', value: total, change: 'Lifetime volume', changeType: 'neutral' },
      { title: 'Average Rating', value: `${avgRating.toFixed(2)} / 5.0`, change: 'Based on all reviews', changeType: 'neutral' },
      { title: 'Draft Reviews', value: draft, change: 'Awaiting manager edits', changeType: 'neutral' },
      { title: 'Published Reviews', value: published, change: 'Published to public OTAs', changeType: 'neutral' },
      { title: 'High Priority Reviews', value: highPriority, change: 'Action items required', changeType: 'neutral' },
      { title: 'AI Response Rate', value: `${responseRate}%`, change: 'Auto & approved responses', changeType: 'neutral' }
    ];
  },

  async getTrends(range: '7d' | '30d' | '90d', hotelId?: string): Promise<AnalyticsTrend[]> {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const cutOffDate = new Date();
    cutOffDate.setDate(cutOffDate.getDate() - days);
    const dateStr = cutOffDate.toISOString().split('T')[0];

    let query = supabase
      .from('reviews')
      .select('date, rating, sentiment')
      .gte('date', dateStr);

    if (hotelId) {
      query = query.eq('hotel_id', hotelId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const records = data || [];
    const dailyMap: Record<string, { count: number; sumRating: number; positive: number; neutral: number; negative: number }> = {};

    records.forEach((r) => {
      const date = r.date || 'N/A';
      if (!dailyMap[date]) {
        dailyMap[date] = { count: 0, sumRating: 0, positive: 0, neutral: 0, negative: 0 };
      }
      dailyMap[date].count += 1;
      dailyMap[date].sumRating += r.rating || 0;
      if (r.sentiment === 'positive') dailyMap[date].positive += 1;
      else if (r.sentiment === 'neutral') dailyMap[date].neutral += 1;
      else if (r.sentiment === 'negative') dailyMap[date].negative += 1;
    });

    return Object.entries(dailyMap)
      .map(([date, val]) => ({
        date,
        rating: Number((val.sumRating / val.count).toFixed(2)),
        count: val.count,
        positive: val.positive,
        neutral: val.neutral,
        negative: val.negative
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  async getPlatformShare(hotelId?: string): Promise<{ source: string; count: number; rating: number }[]> {
    let query = supabase
      .from('reviews')
      .select('source, rating');

    if (hotelId) {
      query = query.eq('hotel_id', hotelId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const records = data || [];
    const platformMap: Record<string, { count: number; sumRating: number }> = {};

    records.forEach((r) => {
      const source = r.source || 'Other';
      if (!platformMap[source]) {
        platformMap[source] = { count: 0, sumRating: 0 };
      }
      platformMap[source].count += 1;
      platformMap[source].sumRating += r.rating || 0;
    });

    return Object.entries(platformMap).map(([source, val]) => ({
      source,
      count: val.count,
      rating: Number((val.sumRating / val.count).toFixed(2))
    })).sort((a, b) => b.count - a.count);
  },

  async getAnalytics(range: '7d' | '30d' | '90d', hotelId?: string): Promise<any> {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const cutOffDate = new Date();
    cutOffDate.setDate(cutOffDate.getDate() - days);
    const dateStr = cutOffDate.toISOString().split('T')[0];

    let query = supabase
      .from('reviews')
      .select('date, rating, source, departments, priority, sentiment')
      .gte('date', dateStr);

    if (hotelId) {
      query = query.eq('hotel_id', hotelId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const records = data || [];

    const dailyMap: Record<string, { count: number; sumRating: number }> = {};
    const platformMap: Record<string, number> = {};
    const deptMap: Record<string, number> = {};
    const priorityMap: Record<string, number> = {};
    const sentimentMap: Record<string, number> = {};

    records.forEach((r) => {
      const date = r.date || 'N/A';
      if (!dailyMap[date]) {
        dailyMap[date] = { count: 0, sumRating: 0 };
      }
      dailyMap[date].count += 1;
      dailyMap[date].sumRating += r.rating || 0;

      const platform = r.source || 'Other';
      platformMap[platform] = (platformMap[platform] || 0) + 1;

      if (Array.isArray(r.departments)) {
        r.departments.forEach((dept: string) => {
          deptMap[dept] = (deptMap[dept] || 0) + 1;
        });
      }

      const priority = r.priority || 'low';
      priorityMap[priority] = (priorityMap[priority] || 0) + 1;

      const sentiment = r.sentiment || 'neutral';
      sentimentMap[sentiment] = (sentimentMap[sentiment] || 0) + 1;
    });

    const reviewsPerDay = Object.entries(dailyMap)
      .map(([date, val]) => ({ date, count: val.count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const ratingTrend = Object.entries(dailyMap)
      .map(([date, val]) => ({ date, rating: Number((val.sumRating / val.count).toFixed(2)) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const reviewsByPlatform = Object.entries(platformMap).map(([platform, count]) => ({
      platform,
      count
    }));

    const departmentDistribution = Object.entries(deptMap).map(([department, count]) => ({
      department,
      count
    }));

    const priorityDistribution = Object.entries(priorityMap).map(([priority, count]) => ({
      priority,
      count
    }));

    const sentimentDistribution = Object.entries(sentimentMap).map(([sentiment, count]) => ({
      sentiment,
      count
    }));

    return {
      reviewsPerDay,
      reviewsByPlatform,
      ratingTrend,
      departmentDistribution,
      priorityDistribution,
      sentimentDistribution
    };
  }
};

// src/repositories/analyticsRepository.ts
import { supabase } from '@/lib/supabase';
import { AnalyticsTrend, MetricCardData } from '@/types';

export const analyticsRepository = {
  async getMetrics(hotelId?: string): Promise<MetricCardData[]> {
    const runQueries = async (useHotelFilter: boolean) => {
      let qTotal = supabase.from('reviews').select('*', { count: 'exact', head: true });
      let qAvg = supabase.from('reviews').select('rating');
      // Use ilike for case-insensitive matching in case status is capitalized (e.g. 'Draft')
      let qDraft = supabase.from('reviews').select('*', { count: 'exact', head: true }).ilike('status', 'draft');
      let qPublished = supabase.from('reviews').select('*', { count: 'exact', head: true }).ilike('status', 'published');
      let qPriority = supabase.from('reviews').select('*', { count: 'exact', head: true }).in('priority', ['high', 'critical']);

      if (useHotelFilter && hotelId) {
        qTotal = qTotal.eq('hotel_id', hotelId);
        qAvg = qAvg.eq('hotel_id', hotelId);
        qDraft = qDraft.eq('hotel_id', hotelId);
        qPublished = qPublished.eq('hotel_id', hotelId);
        qPriority = qPriority.eq('hotel_id', hotelId);
      }

      return await Promise.all([qTotal, qAvg, qDraft, qPublished, qPriority]);
    };

    let responses = await runQueries(true);
    const hasHotelIdError = responses.some(res => res.error && (res.error.code === '42703' || res.error.message.includes('hotel_id')));

    if (hasHotelIdError) {
      // Fallback
      responses = await runQueries(false);
    }

    const [rTotal, rAvg, rDraft, rPublished, rPriority] = responses;
    if (rTotal.error) throw rTotal.error;
    if (rAvg.error) throw rAvg.error;
    if (rDraft.error) throw rDraft.error;
    if (rPublished.error) throw rPublished.error;
    if (rPriority.error) throw rPriority.error;

    const total = rTotal.count || 0;
    const ratings = rAvg.data || [];
    const avgRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + (r.rating || 0), 0) / ratings.length
      : 0;

    const draft = rDraft.count || 0;
    const published = rPublished.count || 0;
    const highPriority = rPriority.count || 0;
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

  async getTrends(range: '7d' | '30d' | '90d', hotelId?: string): Promise<any[]> {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const cutOffDate = new Date();
    cutOffDate.setDate(cutOffDate.getDate() - days);
    const dateStr = cutOffDate.toISOString().split('T')[0];

    const runQuery = async (useHotelFilter: boolean) => {
      let query = supabase
        .from('reviews')
        .select('created_at, review_date, rating, sentiment, platform')
        .gte('created_at', dateStr);

      if (useHotelFilter && hotelId) {
        query = query.eq('hotel_id', hotelId);
      }
      return await query;
    };

    let response = await runQuery(true);
    if (response.error && (response.error.code === '42703' || response.error.message.includes('hotel_id'))) {
      // Fallback
      response = await runQuery(false);
    }

    if (response.error) throw response.error;

    const records = response.data || [];
    const dailyMap: Record<string, { date: string; count: number; sumRating: number; positive: number; neutral: number; negative: number; [platform: string]: any }> = {};

    records.forEach((r) => {
      // Format date part from created_at or review_date
      const dateVal = r.review_date || r.created_at || '';
      const date = dateVal ? dateVal.split('T')[0] : 'N/A';
      const platform = r.platform || 'Other';
      
      if (!dailyMap[date]) {
        dailyMap[date] = { date, count: 0, sumRating: 0, positive: 0, neutral: 0, negative: 0 };
      }
      dailyMap[date].count += 1;
      dailyMap[date].sumRating += r.rating || 0;
      dailyMap[date][platform] = (dailyMap[date][platform] || 0) + 1;
      
      const sentiment = (r.sentiment || 'neutral').toLowerCase();
      if (sentiment === 'positive') dailyMap[date].positive += 1;
      else if (sentiment === 'negative') dailyMap[date].negative += 1;
      else dailyMap[date].neutral += 1;
    });

    return Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
  },

  async getPlatformShare(hotelId?: string): Promise<{ source: string; count: number; rating: number }[]> {
    const runQuery = async (useHotelFilter: boolean) => {
      // Map 'source' to 'platform' as 'source' doesn't exist in database
      let query = supabase.from('reviews').select('platform, rating');
      if (useHotelFilter && hotelId) {
        query = query.eq('hotel_id', hotelId);
      }
      return await query;
    };

    let response = await runQuery(true);
    if (response.error && (response.error.code === '42703' || response.error.message.includes('hotel_id'))) {
      // Fallback
      response = await runQuery(false);
    }

    if (response.error) throw response.error;

    const records = response.data || [];
    const platformMap: Record<string, { count: number; sumRating: number }> = {};

    records.forEach((r) => {
      const source = r.platform || 'Other';
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
  }
};

// src/repositories/insightRepository.ts
import { supabase } from '@/lib/supabase';

export const insightRepository = {
  async getInsightData(hotelId?: string): Promise<any[]> {
    const runQueryAll = async (useHotelFilter: boolean) => {
      let allReviews: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from('reviews')
          .select('rating, review_text, created_at, review_date, sentiment, departments')
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (useHotelFilter && hotelId) {
          query = query.eq('hotel_id', hotelId);
        }

        const { data, error } = await query;
        if (error) throw error;

        if (data && data.length > 0) {
          allReviews = [...allReviews, ...data];
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }
      return allReviews;
    };

    try {
      return await runQueryAll(true);
    } catch (err: any) {
      if (err.code === '42703' || err.message?.includes('hotel_id')) {
        // Fallback: retry without hotel_id filter
        return await runQueryAll(false);
      }
      throw err;
    }
  }
};

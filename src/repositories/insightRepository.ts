// src/repositories/insightRepository.ts
import { supabase } from '@/lib/supabase';

export const insightRepository = {
  async getInsightData(hotelId?: string): Promise<any[]> {
    const runQuery = async (useHotelFilter: boolean) => {
      let query = supabase.from('reviews').select('rating, review_text, created_at, review_date, sentiment, departments');
      if (useHotelFilter && hotelId) {
        query = query.eq('hotel_id', hotelId);
      }
      return await query;
    };

    let response = await runQuery(true);
    if (response.error && (response.error.code === '42703' || response.error.message.includes('hotel_id'))) {
      // Fallback: retry without hotel_id filter
      response = await runQuery(false);
    }

    if (response.error) throw response.error;
    return response.data || [];
  }
};

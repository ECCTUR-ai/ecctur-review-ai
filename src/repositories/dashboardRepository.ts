// src/repositories/dashboardRepository.ts
import { supabase } from '@/lib/supabase';

export interface DashboardRawData {
  reviews: any[];
  syncStates: any[];
}

export const dashboardRepository = {
  async getDashboardRawData(hotelId: string, limitDate: Date | null): Promise<DashboardRawData> {
    if (!hotelId) {
      console.warn('[dashboardRepository] getDashboardRawData called without hotelId. Enforcing tenant isolation.');
      return { reviews: [], syncStates: [] };
    }

    // 1. Fetch reviews matching hotel_id
    let reviewsQuery = supabase
      .from('reviews')
      .select('id, platform, rating, review_date, status, review_text, created_at, guest_name, sentiment')
      .eq('hotel_id', hotelId);

    if (limitDate) {
      const isoStr = limitDate.toISOString();
      reviewsQuery = reviewsQuery.or(`review_date.gte.${isoStr},created_at.gte.${isoStr}`);
    }

    // 2. Fetch sync states matching hotel_id
    const syncStatesQuery = supabase
      .from('review_sync_states')
      .select('*')
      .eq('hotel_id', hotelId);

    const [reviewsRes, syncStatesRes] = await Promise.all([reviewsQuery, syncStatesQuery]);

    if (reviewsRes.error) throw reviewsRes.error;
    
    let syncStates: any[] = [];
    if (syncStatesRes.error) {
      console.warn('[dashboardRepository] review_sync_states table error (e.g. schema cache or RLS):', syncStatesRes.error.message);
    } else {
      syncStates = syncStatesRes.data || [];
    }

    return {
      reviews: reviewsRes.data || [],
      syncStates
    };
  }
};

import { supabase } from '@/lib/supabase';
import { Department } from '@/types';

export const departmentService = {
  async getDepartments(hotelId?: string): Promise<Department[]> {
    let query = supabase.from('departments').select('*');
    if (hotelId) {
      query = query.eq('hotel_id', hotelId);
    }
    query = query.order('name', { ascending: true });

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    return (data || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      averageRating: item.average_rating,
      sentimentScore: item.sentiment_score,
      reviewCount: item.review_count,
      pendingCount: item.pending_count,
      headOfDepartment: item.head_of_department,
    }));
  },

  async getDepartmentById(id: string): Promise<Department> {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);

    return {
      id: data.id,
      name: data.name,
      averageRating: data.average_rating,
      sentimentScore: data.sentiment_score,
      reviewCount: data.review_count,
      pendingCount: data.pending_count,
      headOfDepartment: data.head_of_department,
    };
  },

  async updateDepartmentAlerts(id: string, enabled: boolean): Promise<void> {
    const { error } = await supabase
      .from('departments')
      .update({ alerts_enabled: enabled })
      .eq('id', id);

    if (error) throw new Error(error.message);
  }
};

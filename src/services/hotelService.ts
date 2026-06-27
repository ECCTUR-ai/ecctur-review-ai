import { supabase } from '@/lib/supabase';
import { Hotel, Organization } from '@/types';

export const hotelService = {
  async getOrganizations(): Promise<Organization[]> {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('name');

    if (error) throw new Error(error.message);
    return (data || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      createdAt: item.created_at
    }));
  },

  async getHotels(organizationId?: string): Promise<Hotel[]> {
    let query = supabase.from('hotels').select('*').order('name');
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return (data || []).map((item: any) => ({
      id: item.id,
      organizationId: item.organization_id,
      name: item.name,
      createdAt: item.created_at
    }));
  }
};

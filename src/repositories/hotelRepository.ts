// src/repositories/hotelRepository.ts
import { supabase } from '@/lib/supabase';
import { Hotel } from '@/types';

export const hotelRepository = {
  async getHotels(organizationId?: string): Promise<Hotel[]> {
    let query = supabase.from('hotels').select('*').order('name');
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query;
    if (error) {
      // If table doesn't exist yet, return the default hotels as a fallback
      if (error.code === 'PGRST116' || error.message.includes('relation "hotels" does not exist') || error.message.includes('schema cache')) {
        return [
          {
            id: '00c00000-0000-0000-0000-000000000001',
            organizationId: organizationId || '7cc77cc7-7cc7-7cc7-7cc7-7cc77cc77cc7',
            name: 'ECCTUR Demo Hotel',
            createdAt: new Date().toISOString()
          },
          {
            id: '00c00000-0000-0000-0000-000000000002',
            organizationId: organizationId || '7cc77cc7-7cc7-7cc7-7cc7-7cc77cc77cc7',
            name: 'Montana 2543',
            createdAt: new Date().toISOString()
          },
          {
            id: '00c00000-0000-0000-0000-000000000003',
            organizationId: organizationId || '7cc77cc7-7cc7-7cc7-7cc7-7cc77cc77cc7',
            name: 'Fahri Heritage Hotel',
            createdAt: new Date().toISOString()
          }
        ];
      }
      throw error;
    }

    if (!data || data.length === 0) {
      return [
        {
          id: '00c00000-0000-0000-0000-000000000001',
          organizationId: organizationId || '7cc77cc7-7cc7-7cc7-7cc7-7cc77cc77cc7',
          name: 'ECCTUR Demo Hotel',
          createdAt: new Date().toISOString()
        },
        {
          id: '00c00000-0000-0000-0000-000000000002',
          organizationId: organizationId || '7cc77cc7-7cc7-7cc7-7cc7-7cc77cc77cc7',
          name: 'Montana 2543',
          createdAt: new Date().toISOString()
        },
        {
          id: '00c00000-0000-0000-0000-000000000003',
          organizationId: organizationId || '7cc77cc7-7cc7-7cc7-7cc7-7cc77cc77cc7',
          name: 'Fahri Heritage Hotel',
          createdAt: new Date().toISOString()
        }
      ];
    }

    return data.map((item: any) => ({
      id: item.id,
      organizationId: item.organization_id || item.organizationId,
      name: item.name,
      createdAt: item.created_at || item.createdAt
    }));
  }
};

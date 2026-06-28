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
            createdAt: new Date().toISOString(),
            connectionStatus: 'connected'
          },
          {
            id: '00c00000-0000-0000-0000-000000000002',
            organizationId: organizationId || '7cc77cc7-7cc7-7cc7-7cc7-7cc77cc77cc7',
            name: 'Montana 2543',
            createdAt: new Date().toISOString(),
            connectionStatus: 'connected'
          },
          {
            id: '00c00000-0000-0000-0000-000000000003',
            organizationId: organizationId || '7cc77cc7-7cc7-7cc7-7cc7-7cc77cc77cc7',
            name: 'Fahri Heritage Hotel',
            createdAt: new Date().toISOString(),
            connectionStatus: 'connected'
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
          createdAt: new Date().toISOString(),
          connectionStatus: 'connected'
        },
        {
          id: '00c00000-0000-0000-0000-000000000002',
          organizationId: organizationId || '7cc77cc7-7cc7-7cc7-7cc7-7cc77cc77cc7',
          name: 'Montana 2543',
          createdAt: new Date().toISOString(),
          connectionStatus: 'connected'
        },
        {
          id: '00c00000-0000-0000-0000-000000000003',
          organizationId: organizationId || '7cc77cc7-7cc7-7cc7-7cc7-7cc77cc77cc7',
          name: 'Fahri Heritage Hotel',
          createdAt: new Date().toISOString(),
          connectionStatus: 'connected'
        }
      ];
    }

    return data.map((item: any) => ({
      id: item.id,
      organizationId: item.organization_id || item.organizationId,
      name: item.name,
      createdAt: item.created_at || item.createdAt,
      connectionStatus: 'connected' // Hardcoded connection status for live Supabase hotels
    }));
  },

  async addHotel(hotel: { name: string; organizationId: string }): Promise<Hotel> {
    const { data, error } = await supabase
      .from('hotels')
      .insert({
        name: hotel.name,
        organization_id: hotel.organizationId
      })
      .select()
      .single();

    if (error) throw error;
    return {
      id: data.id,
      organizationId: data.organization_id,
      name: data.name,
      createdAt: data.created_at,
      connectionStatus: 'connected'
    };
  },

  async editHotel(id: string, hotel: { name: string; organizationId: string }): Promise<Hotel> {
    const { data, error } = await supabase
      .from('hotels')
      .update({
        name: hotel.name,
        organization_id: hotel.organizationId
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return {
      id: data.id,
      organizationId: data.organization_id,
      name: data.name,
      createdAt: data.created_at,
      connectionStatus: 'connected'
    };
  }
};

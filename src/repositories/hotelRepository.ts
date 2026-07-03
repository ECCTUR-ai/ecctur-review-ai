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
            name: 'Demo Hotel',
            createdAt: new Date().toISOString(),
            connectionStatus: 'connected',
            googleMapsLink: 'https://www.google.com/maps/place/Montana+2543/@40.231908,28.988133,17z/data=!4m8!3m7!1s0x14f51543!8m2!3d40.231908!4d28.988133!9m1!1b1',
            googleMapsUrl: 'https://www.google.com/maps/place/Montana+2543/@40.231908,28.988133,17z/data=!4m8!3m7!1s0x14f51543!8m2!3d40.231908!4d28.988133!9m1!1b1'
          },
          {
            id: '00c00000-0000-0000-0000-000000000002',
            organizationId: organizationId || '7cc77cc7-7cc7-7cc7-7cc7-7cc77cc77cc7',
            name: 'Montana 2543',
            createdAt: new Date().toISOString(),
            connectionStatus: 'connected',
            googleMapsLink: 'https://www.google.com/maps/place/Montana+2543/@40.231908,28.988133,17z/data=!4m8!3m7!1s0x14f51543!8m2!3d40.231908!4d28.988133!9m1!1b1',
            googleMapsUrl: 'https://www.google.com/maps/place/Montana+2543/@40.231908,28.988133,17z/data=!4m8!3m7!1s0x14f51543!8m2!3d40.231908!4d28.988133!9m1!1b1'
          },
          {
            id: '00c00000-0000-0000-0000-000000000003',
            organizationId: organizationId || '7cc77cc7-7cc7-7cc7-7cc7-7cc77cc77cc7',
            name: 'Fahri Heritage Hotel',
            createdAt: new Date().toISOString(),
            connectionStatus: 'connected',
            googleMapsLink: 'https://www.google.com/maps/place/Montana+2543/@40.231908,28.988133,17z/data=!4m8!3m7!1s0x14f51543!8m2!3d40.231908!4d28.988133!9m1!1b1',
            googleMapsUrl: 'https://www.google.com/maps/place/Montana+2543/@40.231908,28.988133,17z/data=!4m8!3m7!1s0x14f51543!8m2!3d40.231908!4d28.988133!9m1!1b1'
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
          name: 'Demo Hotel',
          createdAt: new Date().toISOString(),
          connectionStatus: 'connected',
          googleMapsLink: 'https://www.google.com/maps/place/Montana+2543/@40.231908,28.988133,17z/data=!4m8!3m7!1s0x14f51543!8m2!3d40.231908!4d28.988133!9m1!1b1',
          googleMapsUrl: 'https://www.google.com/maps/place/Montana+2543/@40.231908,28.988133,17z/data=!4m8!3m7!1s0x14f51543!8m2!3d40.231908!4d28.988133!9m1!1b1'
        },
        {
          id: '00c00000-0000-0000-0000-000000000002',
          organizationId: organizationId || '7cc77cc7-7cc7-7cc7-7cc7-7cc77cc77cc7',
          name: 'Montana 2543',
          createdAt: new Date().toISOString(),
          connectionStatus: 'connected',
          googleMapsLink: 'https://www.google.com/maps/place/Montana+2543/@40.231908,28.988133,17z/data=!4m8!3m7!1s0x14f51543!8m2!3d40.231908!4d28.988133!9m1!1b1',
          googleMapsUrl: 'https://www.google.com/maps/place/Montana+2543/@40.231908,28.988133,17z/data=!4m8!3m7!1s0x14f51543!8m2!3d40.231908!4d28.988133!9m1!1b1'
        },
        {
          id: '00c00000-0000-0000-0000-000000000003',
          organizationId: organizationId || '7cc77cc7-7cc7-7cc7-7cc7-7cc77cc77cc7',
          name: 'Fahri Heritage Hotel',
          createdAt: new Date().toISOString(),
          connectionStatus: 'connected',
          googleMapsLink: 'https://www.google.com/maps/place/Montana+2543/@40.231908,28.988133,17z/data=!4m8!3m7!1s0x14f51543!8m2!3d40.231908!4d28.988133!9m1!1b1',
          googleMapsUrl: 'https://www.google.com/maps/place/Montana+2543/@40.231908,28.988133,17z/data=!4m8!3m7!1s0x14f51543!8m2!3d40.231908!4d28.988133!9m1!1b1'
        }
      ];
    }

    return data.map((item: any) => ({
      id: item.id,
      organizationId: item.organization_id || item.organizationId,
      name: item.name,
      createdAt: item.created_at || item.createdAt,
      connectionStatus: 'connected',
      googleMapsLink: item.google_maps_url || item.google_maps_link,
      googleMapsUrl: item.google_maps_url || item.google_maps_link,
      tripadvisorUrl: item.tripadvisor_url || '',
      address: item.address,
      phone: item.phone,
      website: item.website,
      city: item.city,
      country: item.country,
      timezone: item.timezone,
      defaultLanguage: item.default_language,
      googleAccountId: item.google_account_id,
      googleLocationId: item.google_location_id,
      googleBusinessName: item.google_business_name,
      googleBusinessConnected: item.google_business_connected,
      bookingUrl: item.booking_url || ''
    }));
  },

  async addHotel(hotel: { name: string; organizationId: string; googleMapsLink?: string; tripadvisorUrl?: string; bookingUrl?: string }): Promise<Hotel> {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error('Unauthenticated');

    const response = await fetch('/api/admin?action=create-hotel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(hotel)
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to create hotel');
    }

    const h = result.hotel;
    return {
      id: h.id,
      organizationId: h.organization_id || h.organizationId,
      name: h.name,
      createdAt: h.created_at || h.createdAt,
      connectionStatus: 'connected',
      googleMapsLink: h.google_maps_url || h.google_maps_link || '',
      googleMapsUrl: h.google_maps_url || h.google_maps_link || '',
      tripadvisorUrl: h.tripadvisor_url || '',
      bookingUrl: h.booking_url || ''
    };
  },

  async editHotel(id: string, hotel: { name: string; organizationId: string; googleMapsLink?: string; tripadvisorUrl?: string; bookingUrl?: string }): Promise<Hotel> {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error('Unauthenticated');

    const response = await fetch('/api/admin?action=update-hotel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ id, ...hotel })
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to update hotel');
    }

    const h = result.hotel;
    return {
      id: h.id,
      organizationId: h.organization_id || h.organizationId,
      name: h.name,
      createdAt: h.created_at || h.createdAt,
      connectionStatus: 'connected',
      googleMapsLink: h.google_maps_url || h.google_maps_link || '',
      googleMapsUrl: h.google_maps_url || h.google_maps_link || '',
      tripadvisorUrl: h.tripadvisor_url || '',
      bookingUrl: h.booking_url || ''
    };
  }
};

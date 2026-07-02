// src/repositories/notificationRepository.ts
import { supabase } from '@/lib/supabase';
import { AppNotification } from '@/types';

export function mapNotificationRecord(item: any): AppNotification {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    message: item.message,
    isRead: item.is_read || item.isRead || false,
    createdAt: item.created_at || item.createdAt || '',
    hotelId: item.hotel_id || item.hotelId
  };
}

export const notificationRepository = {
  async getNotifications(hotelId?: string): Promise<AppNotification[]> {
    const runQuery = async (useHotelFilter: boolean) => {
      let query = supabase.from('notifications').select('*');
      if (useHotelFilter && hotelId) {
        query = query.eq('hotel_id', hotelId);
      }
      query = query.order('created_at', { ascending: false });
      return await query;
    };

    let response = await runQuery(true);
    if (response.error && (response.error.code === '42703' || response.error.message.includes('hotel_id'))) {
      // Fallback
      response = await runQuery(false);
    }

    if (response.error) throw response.error;
    return (response.data || []).map(mapNotificationRecord);
  },

  async markAsRead(id: string): Promise<AppNotification> {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return mapNotificationRecord(data);
  },

  async markAllAsRead(hotelId?: string): Promise<void> {
    const runUpdate = async (useHotelFilter: boolean) => {
      let query = supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('is_read', false);

      if (useHotelFilter && hotelId) {
        query = query.eq('hotel_id', hotelId);
      }
      return await query;
    };

    const response = await runUpdate(true);
    if (response.error && (response.error.code === '42703' || response.error.message.includes('hotel_id'))) {
      // Fallback
      const fbResponse = await runUpdate(false);
      if (fbResponse.error) throw fbResponse.error;
    } else if (response.error) {
      throw response.error;
    }
  },

  async createNotification(notification: {
    type: AppNotification['type'];
    title: string;
    message: string;
    hotelId?: string;
  }): Promise<AppNotification> {
    const insertObj: any = {
      type: notification.type,
      title: notification.title,
      message: notification.message,
      is_read: false
    };

    const runInsert = async (includeHotelFilter: boolean) => {
      const payload = { ...insertObj };
      if (includeHotelFilter && notification.hotelId) {
        payload.hotel_id = notification.hotelId;
      }
      return await supabase.from('notifications').insert(payload).select().maybeSingle();
    };

    let response = await runInsert(true);
    if (response.error && (response.error.code === '42703' || response.error.message.includes('hotel_id'))) {
      // Fallback
      response = await runInsert(false);
    }

    if (response.error) throw response.error;
    return mapNotificationRecord(response.data);
  }
};

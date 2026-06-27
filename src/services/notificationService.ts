import { supabase } from '@/lib/supabase';
import { AppNotification } from '@/types';

function mapNotificationRecord(item: any): AppNotification {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    message: item.message,
    isRead: item.is_read,
    createdAt: item.created_at,
    hotelId: item.hotel_id
  };
}

export const notificationService = {
  async getNotifications(hotelId?: string): Promise<AppNotification[]> {
    let query = supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (hotelId) {
      query = query.eq('hotel_id', hotelId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []).map(mapNotificationRecord);
  },

  async markAsRead(id: string): Promise<AppNotification> {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return mapNotificationRecord(data);
  },

  async markAllAsRead(hotelId?: string): Promise<void> {
    let query = supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('is_read', false);

    if (hotelId) {
      query = query.eq('hotel_id', hotelId);
    }

    const { error } = await query;
    if (error) throw new Error(error.message);
  },

  async createNotification(notification: {
    type: AppNotification['type'];
    title: string;
    message: string;
    hotelId?: string;
  }): Promise<AppNotification> {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        type: notification.type,
        title: notification.title,
        message: notification.message,
        is_read: false,
        hotel_id: notification.hotelId
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return mapNotificationRecord(data);
  }
};

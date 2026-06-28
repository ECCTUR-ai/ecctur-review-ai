// src/services/notificationService.ts
import { AppNotification } from '@/types';
import { notificationRepository } from '@/repositories/notificationRepository';

export const notificationService = {
  async getNotifications(hotelId?: string): Promise<AppNotification[]> {
    return await notificationRepository.getNotifications(hotelId);
  },

  async markAsRead(id: string): Promise<AppNotification> {
    return await notificationRepository.markAsRead(id);
  },

  async markAllAsRead(hotelId?: string): Promise<void> {
    await notificationRepository.markAllAsRead(hotelId);
  },

  async createNotification(notification: {
    type: AppNotification['type'];
    title: string;
    message: string;
    hotelId?: string;
  }): Promise<AppNotification> {
    return await notificationRepository.createNotification(notification);
  }
};

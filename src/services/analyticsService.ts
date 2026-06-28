// src/services/analyticsService.ts
import { AnalyticsTrend, MetricCardData } from '@/types';
import { analyticsRepository } from '@/repositories/analyticsRepository';

export const analyticsService = {
  async getMetrics(hotelId?: string): Promise<MetricCardData[]> {
    return await analyticsRepository.getMetrics(hotelId);
  },

  async getTrends(range: '7d' | '30d' | '90d', hotelId?: string): Promise<AnalyticsTrend[]> {
    return await analyticsRepository.getTrends(range, hotelId);
  },

  async getPlatformShare(hotelId?: string): Promise<{ source: string; count: number; rating: number }[]> {
    return await analyticsRepository.getPlatformShare(hotelId);
  }
};

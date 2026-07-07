// src/services/dashboardService.ts
import { dashboardRepository } from '@/repositories/dashboardRepository';

export const dashboardService = {
  async getDashboardData(hotelId: string, timeFilter: string): Promise<{ reviews: any[]; syncStates: any[] }> {
    const limitDate = getLimitDate(timeFilter);
    return await dashboardRepository.getDashboardRawData(hotelId, limitDate);
  }
};

function getLimitDate(filter: string): Date | null {
  if (filter === 'all') return null;
  const now = new Date();
  const limitDate = new Date();
  if (filter === 'today') {
    limitDate.setHours(0, 0, 0, 0);
  } else if (filter === '7_days') {
    limitDate.setDate(now.getDate() - 7);
  } else if (filter === '30_days') {
    limitDate.setDate(now.getDate() - 30);
  } else if (filter === '3_months') {
    limitDate.setMonth(now.getMonth() - 3);
  } else if (filter === '6_months') {
    limitDate.setMonth(now.getMonth() - 6);
  } else if (filter === '1_year') {
    limitDate.setFullYear(now.getFullYear() - 1);
  }
  return limitDate;
}

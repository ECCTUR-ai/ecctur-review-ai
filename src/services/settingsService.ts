import { api } from '@/lib/api';
import { AISettings } from '@/types';

export const settingsService = {
  async getSettings(): Promise<AISettings> {
    return api.get<AISettings>('/settings');
  },

  async updateSettings(settings: Partial<AISettings>): Promise<AISettings> {
    return api.put<AISettings>('/settings', settings);
  },

  async connectIntegration(platform: 'google' | 'tripadvisor', code: string): Promise<{ success: boolean }> {
    return api.post<{ success: boolean }>(`/settings/integrations/${platform}/connect`, { code });
  },

  async disconnectIntegration(platform: 'google' | 'tripadvisor'): Promise<{ success: boolean }> {
    return api.post<{ success: boolean }>(`/settings/integrations/${platform}/disconnect`, {});
  }
};

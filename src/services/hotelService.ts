// src/services/hotelService.ts
import { Hotel, Organization } from '@/types';
import { organizationRepository } from '@/repositories/organizationRepository';
import { hotelRepository } from '@/repositories/hotelRepository';

export const hotelService = {
  async getOrganizations(): Promise<Organization[]> {
    return await organizationRepository.getAll();
  },

  async getHotels(organizationId?: string): Promise<Hotel[]> {
    return await hotelRepository.getHotels(organizationId);
  }
};

// src/services/adminService.ts
import { UserProfile, Role, IntegrationSetting, Hotel, Organization } from '@/types';
import { userRepository } from '@/repositories/userRepository';
import { roleRepository } from '@/repositories/roleRepository';
import { integrationRepository } from '@/repositories/integrationRepository';
import { hotelRepository } from '@/repositories/hotelRepository';
import { organizationRepository } from '@/repositories/organizationRepository';

export const adminService = {
  // User Management
  async getAllUsers(): Promise<UserProfile[]> {
    return await userRepository.getAllUsers();
  },

  async addUser(user: Omit<UserProfile, 'id' | 'createdAt'>): Promise<UserProfile> {
    return await userRepository.addUser(user);
  },

  async editUser(id: string, user: Omit<UserProfile, 'id' | 'createdAt'>): Promise<UserProfile> {
    return await userRepository.editUser(id, user);
  },

  async deleteUser(id: string): Promise<void> {
    return await userRepository.deleteUser(id);
  },

  // Roles
  async getRoles(): Promise<Role[]> {
    return await roleRepository.getAllRoles();
  },

  // Integration Settings
  async getSettings(): Promise<IntegrationSetting[]> {
    return await integrationRepository.getSettings();
  },

  async updateSettingStatus(id: string, status: 'connected' | 'disconnected' | 'error'): Promise<IntegrationSetting> {
    return await integrationRepository.updateSettingStatus(id, status);
  },

  // Hotel Management
  async addHotel(hotel: { name: string; organizationId: string }): Promise<Hotel> {
    return await hotelRepository.addHotel(hotel);
  },

  async editHotel(id: string, hotel: { name: string; organizationId: string }): Promise<Hotel> {
    return await hotelRepository.editHotel(id, hotel);
  },

  // Organization Management
  async editOrganizationName(id: string, name: string): Promise<Organization> {
    return await organizationRepository.editOrganizationName(id, name);
  }
};

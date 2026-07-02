// src/services/adminService.ts
import { UserProfile, Role, IntegrationSetting, Hotel, Organization } from '@/types';
import { userRepository } from '@/repositories/userRepository';
import { roleRepository } from '@/repositories/roleRepository';
import { integrationRepository } from '@/repositories/integrationRepository';
import { hotelRepository } from '@/repositories/hotelRepository';
import { organizationRepository } from '@/repositories/organizationRepository';
import { supabase } from '@/lib/supabase';

export const adminService = {
  // User Management
  async getAllUsers(): Promise<UserProfile[]> {
    return await userRepository.getAllUsers();
  },

  async addUser(user: Omit<UserProfile, 'id' | 'createdAt'> & { password?: string }): Promise<UserProfile> {
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
    console.log('[Admin Service] getRoles: Calling roleRepository.getAllRoles...');
    const roles = await roleRepository.getAllRoles();
    console.log('[Admin Service] getRoles returned:', roles);
    return roles;
  },

  // Integration Settings
  async getSettings(): Promise<IntegrationSetting[]> {
    return await integrationRepository.getSettings();
  },

  async updateSettingStatus(id: string, status: 'connected' | 'disconnected' | 'error'): Promise<IntegrationSetting> {
    return await integrationRepository.updateSettingStatus(id, status);
  },

  // Hotel Management
  async addHotel(hotel: { name: string; organizationId: string; googleMapsLink?: string; googleMapsUrl?: string; tripadvisorUrl?: string; bookingPropertyId?: string }): Promise<Hotel> {
    console.log('[ADMIN SERVICE ADD HOTEL]', hotel);
    return await hotelRepository.addHotel({
      name: hotel.name,
      organizationId: hotel.organizationId,
      googleMapsLink: hotel.googleMapsUrl || hotel.googleMapsLink,
      tripadvisorUrl: hotel.tripadvisorUrl,
      bookingPropertyId: hotel.bookingPropertyId
    });
  },

  async editHotel(id: string, hotel: { name: string; organizationId: string; googleMapsLink?: string; googleMapsUrl?: string; tripadvisorUrl?: string; bookingPropertyId?: string }): Promise<Hotel> {
    console.log('[ADMIN SERVICE EDIT HOTEL]', { id, hotel });
    return await hotelRepository.editHotel(id, {
      name: hotel.name,
      organizationId: hotel.organizationId,
      googleMapsLink: hotel.googleMapsUrl || hotel.googleMapsLink,
      tripadvisorUrl: hotel.tripadvisorUrl,
      bookingPropertyId: hotel.bookingPropertyId
    });
  },

  // Organization Management
  async editOrganizationName(id: string, name: string): Promise<Organization> {
    return await organizationRepository.editOrganizationName(id, name);
  },
  async updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization> {
    return await organizationRepository.updateOrganization(id, updates);
  },
  async onboardCustomer(data: any): Promise<any> {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error('Missing token');

    const response = await fetch('/api/admin-onboard-customer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Onboarding failed');
    }
    return result;
  }
};

// src/repositories/organizationRepository.ts
import { supabase } from '@/lib/supabase';
import { Organization } from '@/types';

export const organizationRepository = {
  async getAll(): Promise<Organization[]> {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('name');

    if (error) {
      // If table doesn't exist yet, return the default organization as a fallback
      if (error.code === 'PGRST116' || error.message.includes('relation "organizations" does not exist') || error.message.includes('schema cache')) {
        return [{ id: '7cc77cc7-7cc7-7cc7-7cc7-7cc77cc77cc7', name: 'GuestReview.ai', createdAt: new Date().toISOString() }];
      }
      throw error;
    }

    if (!data || data.length === 0) {
      return [{ id: '7cc77cc7-7cc7-7cc7-7cc7-7cc77cc77cc7', name: 'GuestReview.ai', createdAt: new Date().toISOString() }];
    }

    return data.map((item: any) => ({
      id: item.id,
      name: item.name,
      createdAt: item.created_at || item.createdAt,
      logoUrl: item.logo_url,
      taxOffice: item.tax_office,
      taxNumber: item.tax_number,
      phone: item.phone,
      email: item.email,
      website: item.website,
      address: item.address,
      country: item.country,
      city: item.city,
      currency: item.currency,
      defaultLanguage: item.default_language
    }));
  },

  async editOrganizationName(id: string, name: string): Promise<Organization> {
    return this.updateOrganization(id, { name });
  },

  async updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization> {
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.logoUrl !== undefined) dbUpdates.logo_url = updates.logoUrl;
    if (updates.taxOffice !== undefined) dbUpdates.tax_office = updates.taxOffice;
    if (updates.taxNumber !== undefined) dbUpdates.tax_number = updates.taxNumber;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.website !== undefined) dbUpdates.website = updates.website;
    if (updates.address !== undefined) dbUpdates.address = updates.address;
    if (updates.country !== undefined) dbUpdates.country = updates.country;
    if (updates.city !== undefined) dbUpdates.city = updates.city;
    if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
    if (updates.defaultLanguage !== undefined) dbUpdates.default_language = updates.defaultLanguage;

    const { data, error } = await supabase
      .from('organizations')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return {
      id: data.id,
      name: data.name,
      createdAt: data.created_at,
      logoUrl: data.logo_url,
      taxOffice: data.tax_office,
      taxNumber: data.tax_number,
      phone: data.phone,
      email: data.email,
      website: data.website,
      address: data.address,
      country: data.country,
      city: data.city,
      currency: data.currency,
      defaultLanguage: data.default_language
    };
  }
};

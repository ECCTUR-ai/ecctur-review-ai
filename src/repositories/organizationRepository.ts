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
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error('Unauthenticated');

    const response = await fetch('/api/admin?action=update-organization', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ id, updates })
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to update organization');
    }

    const data = result.organization;
    return {
      id: data.id,
      name: data.name,
      createdAt: data.created_at || data.createdAt,
      logoUrl: data.logo_url || data.logoUrl,
      taxOffice: data.tax_office || data.taxOffice,
      taxNumber: data.tax_number || data.taxNumber,
      phone: data.phone,
      email: data.email,
      website: data.website,
      address: data.address,
      country: data.country,
      city: data.city,
      currency: data.currency,
      defaultLanguage: data.default_language || data.defaultLanguage
    };
  }
};

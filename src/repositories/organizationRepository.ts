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
        return [{ id: '7cc77cc7-7cc7-7cc7-7cc7-7cc77cc77cc7', name: 'ECCTUR', createdAt: new Date().toISOString() }];
      }
      throw error;
    }

    if (!data || data.length === 0) {
      return [{ id: '7cc77cc7-7cc7-7cc7-7cc7-7cc77cc77cc7', name: 'ECCTUR', createdAt: new Date().toISOString() }];
    }

    return data.map((item: any) => ({
      id: item.id,
      name: item.name,
      createdAt: item.created_at || item.createdAt
    }));
  },

  async editOrganizationName(id: string, name: string): Promise<Organization> {
    const { data, error } = await supabase
      .from('organizations')
      .update({ name })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return {
      id: data.id,
      name: data.name,
      createdAt: data.created_at
    };
  }
};

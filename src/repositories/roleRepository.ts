// src/repositories/roleRepository.ts
import { supabase } from '@/lib/supabase';

export interface Role {
  id: string;
  name: string; // e.g., 'admin', 'manager', 'staff'
  description?: string;
}

export const roleRepository = {
  async getAllRoles(): Promise<Role[]> {
    console.log('[Role Repository] getAllRoles: Fetching from Supabase...');
    const { data, error } = await supabase.from('roles').select('*');
    console.log('[Role Repository] getAllRoles response:', { data, error });
    if (error) throw error;
    
    const results = (data as Role[]) ?? [];
    if (results.length === 0) {
      console.warn('[Role Repository] Database returned 0 roles (possibly blocked by RLS). Using fallback seed roles.');
      return [
        { id: '8a800000-0000-0000-0000-000000000001', name: 'Super Admin', description: 'Full platform access and database admin capabilities.' },
        { id: '8a800000-0000-0000-0000-000000000002', name: 'Admin', description: 'Administrative access to manage users and hotels.' },
        { id: '8a800000-0000-0000-0000-000000000003', name: 'Hotel Manager', description: 'Access to manage specific hotels and tasks.' },
        { id: '8a800000-0000-0000-0000-000000000004', name: 'Department Manager', description: 'Access to specific departments inside a hotel.' },
        { id: '8a800000-0000-0000-0000-000000000005', name: 'Staff', description: 'General staff access to view reviews and complete tasks.' },
        { id: '8a800000-0000-0000-0000-000000000006', name: 'Read Only', description: 'Read only access across assigned hotels.' }
      ];
    }
    return results;
  },
  async getRoleById(id: string): Promise<Role | null> {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null; // not found
      throw error;
    }
    return data as Role;
  },
  async createRole(role: Omit<Role, 'id'>): Promise<Role> {
    const { data, error } = await supabase.from('roles').insert(role).select().single();
    if (error) throw error;
    return data as Role;
  },
  async deleteRole(id: string): Promise<void> {
    const { error } = await supabase.from('roles').delete().eq('id', id);
    if (error) throw error;
  },
};

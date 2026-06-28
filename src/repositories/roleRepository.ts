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
    return (data as Role[]) ?? [];
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

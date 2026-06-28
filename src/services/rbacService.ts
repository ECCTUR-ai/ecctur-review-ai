// src/services/rbacService.ts
import { supabase } from '@/lib/supabase';

export interface UserRoleInfo {
  role: string;
  permissions: string[];
}

export const rbacService = {
  async getUserRoleAndPermissions(userId: string): Promise<UserRoleInfo> {
    // query by profile_id instead of user_id to match db schema
    const { data: userRolesData, error: rError } = await supabase
      .from('user_roles')
      .select('roles(name)')
      .eq('profile_id', userId);

    if (rError) {
      console.warn('Could not load user roles from database, falling back to staff:', rError.message);
      return {
        role: 'staff',
        permissions: ['view:dashboard', 'view:tasks', 'manage:tasks']
      };
    }

    const roleName = (userRolesData as any)?.[0]?.roles?.name || 'staff';
    const roleNameLower = roleName.toLowerCase();

    let permissions: string[] = [];
    if (roleNameLower === 'admin' || roleNameLower === 'super admin') {
      permissions = [
        'view:dashboard',
        'view:reviews',
        'view:tasks',
        'view:departments',
        'view:analytics',
        'view:whatsapp',
        'view:settings',
        'manage:tasks',
        'manage:reviews'
      ];
    } else if (roleNameLower === 'manager' || roleNameLower === 'hotel manager') {
      permissions = [
        'view:dashboard',
        'view:reviews',
        'view:tasks',
        'view:analytics',
        'manage:tasks',
        'manage:reviews'
      ];
    } else {
      // staff / department manager / read only / others
      permissions = [
        'view:dashboard',
        'view:tasks',
        'manage:tasks'
      ];
    }

    return {
      role: roleName,
      permissions
    };
  }
};

import { supabase } from '@/lib/supabase';

export interface UserRoleInfo {
  role: string;
  permissions: string[];
}

export const rbacService = {
  async getUserRoleAndPermissions(userId: string): Promise<UserRoleInfo> {
    const { data: userRolesData, error: rError } = await supabase
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', userId);

    if (rError) {
      console.warn('Could not load user roles from database, falling back to staff:', rError.message);
      return {
        role: 'staff',
        permissions: ['view:dashboard', 'view:tasks', 'manage:tasks']
      };
    }

    const roleName = (userRolesData as any)?.[0]?.roles?.name || 'staff';

    let permissions: string[] = [];
    if (roleName === 'admin') {
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
    } else if (roleName === 'manager') {
      permissions = [
        'view:dashboard',
        'view:reviews',
        'view:tasks',
        'view:analytics',
        'manage:tasks',
        'manage:reviews'
      ];
    } else {
      // staff
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

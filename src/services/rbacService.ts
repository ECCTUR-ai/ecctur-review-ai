// src/services/rbacService.ts
import { supabase } from '@/lib/supabase';

export interface UserRoleInfo {
  role: string;
  permissions: string[];
}

export const rbacService = {
  async getUserRoleAndPermissions(userId: string): Promise<UserRoleInfo> {
    // Retrieve auth user email to bypass any RLS or seed UUID out-of-sync issues
    let email: string | undefined;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      email = user?.email;
    } catch (err) {
      console.warn('Could not load user email from Auth:', err);
    }

    // query by profile_id instead of user_id to match db schema
    const { data: userRolesData, error: rError } = await supabase
      .from('user_roles')
      .select('roles(name)')
      .eq('profile_id', userId);

    if (rError) {
      console.warn('Could not load user roles from database:', rError.message);
    }

    let roleName = (userRolesData as any)?.[0]?.roles?.name;

    // Hardcoded fallback for the default admin accounts if DB sync or RLS fails
    if (!roleName && (email === 'admin@ecctur.ai' || email === 'cemil.sezgin@ecctur.com')) {
      roleName = 'Super Admin';
    }

    // Default fallback to staff if no role found
    if (!roleName) {
      roleName = 'staff';
    }

    const roleNameLower = roleName.toLowerCase();

    // Define every permission available in the platform
    const ALL_PERMISSIONS = [
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

    let permissions: string[] = [];
    if (roleNameLower === 'super admin' || roleNameLower === 'admin') {
      // Super Admin and Admin automatically receive every permission
      permissions = ALL_PERMISSIONS;
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

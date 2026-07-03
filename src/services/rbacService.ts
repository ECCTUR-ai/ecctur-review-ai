// src/services/rbacService.ts
import { supabase } from '@/lib/supabase';

export interface UserRoleInfo {
  role: string;
  permissions: string[];
  hotelIds?: string[];
  organizationId?: string | null;
  roleKey?: string;
}

export const rbacService = {
  async getUserRoleAndPermissions(userId: string): Promise<UserRoleInfo> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (token) {
        const response = await fetch('/api/admin?action=get-current-user', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const result = await response.json();
          console.log('[rbacService] User role loaded from backend API:', result.user.role, 'with key:', result.user.roleKey);
          return {
            role: result.user.role || '',
            permissions: result.user.permissions || [],
            hotelIds: result.user.hotelIds || [],
            organizationId: result.user.organizationId || null,
            roleKey: result.user.roleKey || ''
          };
        }
      }
    } catch (err) {
      console.warn('[rbacService] Failed backend role fetch, using local client fallback:', err);
    }

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

    // Enforce true Super Admin email-based clearance check on local fallback
    if (roleName.toLowerCase() === 'super admin' && email !== 'cemil.sezgin@ecctur.com') {
      roleName = 'Admin';
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
      'view:users',
      'manage:tasks',
      'manage:reviews',
      'manage:users'
    ];

    let permissions: string[] = [];
    if (roleNameLower === 'super admin' || roleNameLower === 'admin') {
      // Super Admin and Admin automatically receive every permission
      permissions = ALL_PERMISSIONS;
    } else if (roleNameLower === 'manager' || roleNameLower === 'hotel manager') {
      // Hotel Managers can view/manage tasks, reviews, and users of their hotels
      permissions = [
        'view:dashboard',
        'view:reviews',
        'view:tasks',
        'view:analytics',
        'view:users',
        'manage:tasks',
        'manage:reviews',
        'manage:users'
      ];
    } else if (roleNameLower === 'staff' || roleNameLower === 'department manager') {
      // Staff can view dashboard, reviews, tasks, and update/manage tasks
      permissions = [
        'view:dashboard',
        'view:reviews',
        'view:tasks',
        'manage:tasks'
      ];
    } else {
      // Read Only or others get read-only view of reviews/tasks with absolutely no manage capabilities
      permissions = [
        'view:dashboard',
        'view:reviews',
        'view:tasks'
      ];
    }

    return {
      role: roleName,
      permissions
    };
  }
};

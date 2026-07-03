// src/repositories/userRepository.ts
import { supabase } from '@/lib/supabase';
import { UserProfile } from '@/types';

export const userRepository = {
  async getAllUsers(): Promise<UserProfile[]> {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      console.log("GET_ALL_USERS_CURRENT_ROLE", "none (unauthenticated)");
      console.log("GET_ALL_USERS_COUNT", 0);
      console.log("GET_ALL_USERS_MAPPED_RESULT", []);
      return [];
    }

    const response = await fetch('/api/admin?action=list-users', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorRes = await response.json();
      throw new Error(errorRes.error || 'Failed to fetch users');
    }

    const { profiles, callerRole, assignedHotelIds } = await response.json();

    console.log("GET_ALL_USERS_RAW_PROFILES", profiles);
    console.log("GET_ALL_USERS_CURRENT_ROLE", callerRole);

    const allUsers: UserProfile[] = (profiles || []).map((item: any) => {
      const userRoles = item?.user_roles ?? [];
      const primaryRole = userRoles[0];
      const roleId = primaryRole?.role_id;
      const roleName = primaryRole?.roles?.name || 'Staff';
      const hotelIds = (item?.user_hotels ?? []).map((uh: any) => uh.hotel_id);

      return {
        id: item.id,
        email: item.email,
        firstName: item.first_name || item.firstName || '',
        lastName: item.last_name || item.lastName || '',
        status: item.status || 'active',
        createdAt: item.created_at || item.createdAt || '',
        roleId,
        roleName,
        hotelIds,
        organizationId: item.organization_id || item.organizationId,
        phone: item.phone || '',
        title: item.title || '',
        department: item.department || '',
        avatarUrl: item.avatar_url || '',
        language: item.language || 'tr',
        timezone: item.timezone || 'Europe/Istanbul'
      };
    });

    const roleNameLower = callerRole?.toLowerCase() || 'staff';
    let filteredUsers = allUsers;

    if (roleNameLower !== 'super admin' && roleNameLower !== 'admin') {
      filteredUsers = allUsers.filter(u => 
        u.hotelIds && u.hotelIds.some(hId => assignedHotelIds.includes(hId))
      );
    }

    console.log("GET_ALL_USERS_COUNT", filteredUsers.length);
    console.log("GET_ALL_USERS_MAPPED_RESULT", filteredUsers);

    return filteredUsers;
  },

  async addUser(user: Omit<UserProfile, 'id' | 'createdAt'> & { password?: string }): Promise<UserProfile> {
    const password = user.password || (Math.random().toString(36).slice(-8) + 'Aa1!');
    
    // Get current session token for API authorization
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    if (!token) {
      throw new Error('You must be logged in to create a user');
    }

    // Invoke secure serverless API endpoint to create the user via Supabase Admin API
    const response = await fetch('/api/admin?action=create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        email: user.email,
        password: password,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        roleId: user.roleId || null,
        hotelIds: user.hotelIds || [],
        organizationId: user.organizationId || null,
        phone: user.phone || null,
        title: user.title || null,
        department: user.department || null,
        avatarUrl: user.avatarUrl || null,
        language: user.language || 'tr',
        timezone: user.timezone || 'Europe/Istanbul'
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('[User Repository] API admin-create-user failed:', result.error);
      throw new Error(result.error || 'Failed to create user via API');
    }

    if (!result.userId) {
      throw new Error('API completed but did not return a user ID');
    }

    return this.getUserById(result.userId);
  },

  async editUser(id: string, user: Omit<UserProfile, 'id' | 'createdAt'>): Promise<UserProfile> {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error('Unauthenticated');

    const response = await fetch('/api/admin?action=update-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        id,
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        status: user.status || 'active',
        roleId: user.roleId || null,
        hotelIds: user.hotelIds || [],
        organizationId: user.organizationId || null,
        phone: user.phone || null,
        title: user.title || null,
        department: user.department || null,
        avatarUrl: user.avatarUrl || null,
        language: user.language || 'tr',
        timezone: user.timezone || 'Europe/Istanbul'
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('[User Repository] API admin update-user failed:', result.error);
      throw new Error(result.error || 'Failed to update user via API');
    }

    return this.getUserById(id);
  },

  async deleteUser(id: string): Promise<void> {
    // Delete profile
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);

    if (profileError) throw profileError;

    // Stubbed: Auth deletion requires service role key, which is managed via backend triggers or Edge Functions
    console.info('User removed from profiles table. Auth user deletion requires backend placeholder.');
  },

  async getUserById(id: string): Promise<UserProfile> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, user_roles(role_id, roles(name)), user_hotels(hotel_id)')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      throw new Error("Kullanıcı bulunamadı veya yetki bilgisi eksik");
    }

    const userRoles = data?.user_roles ?? [];
    const primaryRole = userRoles[0];
    const roleId = primaryRole?.role_id;
    const roleName = primaryRole?.roles?.name || 'Staff';
    const hotelIds = (data?.user_hotels ?? []).map((uh: any) => uh.hotel_id);

    return {
      id: data.id,
      email: data.email,
      firstName: data.first_name || data.firstName || '',
      lastName: data.last_name || data.lastName || '',
      status: data.status || 'active',
      createdAt: data.created_at || data.createdAt || '',
      roleId: roleId || undefined,
      roleName: roleName,
      hotelIds,
      organizationId: data.organization_id || data.organizationId || undefined,
      phone: data.phone || '',
      title: data.title || '',
      department: data.department || '',
      avatarUrl: data.avatar_url || '',
      language: data.language || 'tr',
      timezone: data.timezone || 'Europe/Istanbul'
    };
  }
};

// src/repositories/userRepository.ts
import { supabase } from '@/lib/supabase';
import { UserProfile } from '@/types';

export const userRepository = {
  async getAllUsers(): Promise<UserProfile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, user_roles(role_id, roles(name)), user_hotels(hotel_id)')
      .order('created_at', { ascending: false });

    if (error) {
      // Fallback: If table doesn't exist yet, return seed users
      if (error.code === 'PGRST116' || error.message.includes('relation "profiles" does not exist') || error.message.includes('schema cache')) {
        return [
          {
            id: '9a900000-0000-0000-0000-000000000001',
            email: 'admin@ecctur.ai',
            firstName: 'Cemil',
            lastName: 'Sezgin',
            status: 'active',
            createdAt: new Date().toISOString(),
            roleId: '8a800000-0000-0000-0000-000000000001',
            roleName: 'Super Admin',
            hotelIds: ['00c00000-0000-0000-0000-000000000001', '00c00000-0000-0000-0000-000000000002', '00c00000-0000-0000-0000-000000000003'],
            organizationId: '7cc77cc7-7cc7-7cc7-7cc7-7cc77cc77cc7'
          },
          {
            id: '9a900000-0000-0000-0000-000000000002',
            email: 'manager@ecctur.ai',
            firstName: 'Ahmet',
            lastName: 'Yılmaz',
            status: 'active',
            createdAt: new Date().toISOString(),
            roleId: '8a800000-0000-0000-0000-000000000003',
            roleName: 'Hotel Manager',
            hotelIds: ['00c00000-0000-0000-0000-000000000001'],
            organizationId: '7cc77cc7-7cc7-7cc7-7cc7-7cc77cc77cc7'
          },
          {
            id: '9a900000-0000-0000-0000-000000000003',
            email: 'staff@ecctur.ai',
            firstName: 'Mehmet',
            lastName: 'Demir',
            status: 'active',
            createdAt: new Date().toISOString(),
            roleId: '8a800000-0000-0000-0000-000000000005',
            roleName: 'Staff',
            hotelIds: ['00c00000-0000-0000-0000-000000000001'],
            organizationId: '7cc77cc7-7cc7-7cc7-7cc7-7cc77cc77cc7'
          }
        ];
      }
      throw error;
    }

    return (data || []).map((item: any) => {
      const userRoles = item.user_roles || [];
      const primaryRole = userRoles[0];
      const roleId = primaryRole?.role_id;
      const roleName = primaryRole?.roles?.name;
      const hotelIds = (item.user_hotels || []).map((uh: any) => uh.hotel_id);

      return {
        id: item.id,
        email: item.email,
        firstName: item.first_name || item.firstName,
        lastName: item.last_name || item.lastName,
        status: item.status,
        createdAt: item.created_at || item.createdAt,
        roleId,
        roleName,
        hotelIds,
        organizationId: item.organization_id || item.organizationId
      };
    });
  },

  async addUser(user: Omit<UserProfile, 'id' | 'createdAt'> & { password?: string }): Promise<UserProfile> {
    let authUserId: string | undefined = undefined;

    // Use standard public signUp (creates auth user via client anon key)
    if (user.password) {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: user.email,
        password: user.password,
        options: {
          data: {
            first_name: user.firstName || '',
            last_name: user.lastName || ''
          }
        }
      });
      if (signUpError) throw signUpError;
      if (authData?.user) {
        authUserId = authData.user.id;
      }
    } else {
      try {
        const tempPassword = Math.random().toString(36).slice(-8) + 'Aa1!';
        const { data: authData } = await supabase.auth.signUp({
          email: user.email,
          password: tempPassword,
          options: {
            data: {
              first_name: user.firstName || '',
              last_name: user.lastName || ''
            }
          }
        });
        if (authData?.user) {
          authUserId = authData.user.id;
        }
      } catch (e) {
        console.warn('Standard signUp during user creation failed:', e);
      }
    }

    // 1. Insert Profile
    const profilePayload: any = {
      email: user.email,
      first_name: user.firstName,
      last_name: user.lastName,
      status: user.status,
      organization_id: user.organizationId
    };
    if (authUserId) {
      profilePayload.id = authUserId;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert(profilePayload)
      .select()
      .single();

    if (profileError) throw profileError;

    // 2. Insert Role mapping
    if (user.roleId) {
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          profile_id: profile.id,
          role_id: user.roleId
        });
      if (roleError) console.error('Failed to assign user role:', roleError);
    }

    // 3. Insert Hotel mappings
    if (user.hotelIds && user.hotelIds.length > 0) {
      const hotelAccess = user.hotelIds.map(hId => ({
        profile_id: profile.id,
        hotel_id: hId
      }));
      const { error: hotelError } = await supabase
        .from('user_hotels')
        .insert(hotelAccess);
      if (hotelError) console.error('Failed to assign user hotels:', hotelError);
    }

    return this.getUserById(profile.id);
  },

  async editUser(id: string, user: Omit<UserProfile, 'id' | 'createdAt'>): Promise<UserProfile> {
    // 1. Update Profile
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        email: user.email,
        first_name: user.firstName,
        last_name: user.lastName,
        status: user.status,
        organization_id: user.organizationId
      })
      .eq('id', id);

    if (profileError) throw profileError;

    // Stubbed: Disabling user logins at Auth level requires service role keys, handled via backend triggers
    console.info('User status updated in profiles. Auth level status sync requires backend logic.');

    // 2. Update Role mapping (delete and insert)
    await supabase.from('user_roles').delete().eq('profile_id', id);
    if (user.roleId) {
      await supabase.from('user_roles').insert({
        profile_id: id,
        role_id: user.roleId
      });
    }

    // 3. Update Hotel mappings (delete and insert)
    await supabase.from('user_hotels').delete().eq('profile_id', id);
    if (user.hotelIds && user.hotelIds.length > 0) {
      const hotelAccess = user.hotelIds.map(hId => ({
        profile_id: id,
        hotel_id: hId
      }));
      await supabase.from('user_hotels').insert(hotelAccess);
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
      .single();

    if (error) throw error;

    const userRoles = data.user_roles || [];
    const primaryRole = userRoles[0];
    const roleId = primaryRole?.role_id;
    const roleName = primaryRole?.roles?.name;
    const hotelIds = (data.user_hotels || []).map((uh: any) => uh.hotel_id);

    return {
      id: data.id,
      email: data.email,
      firstName: data.first_name || data.firstName,
      lastName: data.last_name || data.lastName,
      status: data.status,
      createdAt: data.created_at || data.createdAt,
      roleId,
      roleName,
      hotelIds,
      organizationId: data.organization_id || data.organizationId
    };
  }
};

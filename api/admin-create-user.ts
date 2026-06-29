import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  // CORS handling
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Use SUPABASE_SERVICE_ROLE_KEY for admin actions
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('Server configuration error: Missing Supabase credentials');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  let createdUserId: string | null = null;
  let isExistingUser = false;

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Unauthorized: Missing authorization header' });
    }
    
    // Verify the caller's JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    // Security check: Join profiles -> user_roles -> roles to identify the user's role
    const userEmail = user.email || '';
    const { data: profileWithRoles, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, email, user_roles(roles(name))')
      .eq('email', userEmail)
      .single();

    let roleName: string | undefined;

    if (profileWithRoles) {
      const rolesArray = (profileWithRoles as any).user_roles || [];
      if (rolesArray.length > 0) {
        roleName = rolesArray[0]?.roles?.name;
      }
    }

    // Fallback: If not found by email profile join, query directly by user.id
    if (!roleName) {
      const { data: directUserRoles } = await supabaseAdmin
        .from('user_roles')
        .select('roles(name)')
        .eq('profile_id', user.id);

      if (directUserRoles && directUserRoles.length > 0) {
        roleName = (directUserRoles as any)[0]?.roles?.name;
      }
    }

    // Server-side fallback: Force Super Admin for default admin accounts if DB sync fails
    if (!roleName && (userEmail === 'admin@ecctur.ai' || userEmail === 'cemil.sezgin@ecctur.com')) {
      roleName = 'Super Admin';
    }

    const roleNameLower = roleName?.toLowerCase();
    
    // Only allow Admin or Super Admin roles
    if (roleNameLower !== 'admin' && roleNameLower !== 'super admin') {
      return res.status(403).json({ 
        error: `Forbidden: Insufficient permissions to create users. Detected Email: ${userEmail}, Detected Role: ${roleName || 'None'}` 
      });
    }

    const { email, password, firstName, lastName, roleId, hotelIds, organizationId } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // 1. Create Auth User using Admin API
    let authUserId: string;
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName }
    });

    if (createError) {
      const errMsg = createError.message?.toLowerCase();
      // Handle scenario: "user already registered" / "email already in use"
      if (errMsg.includes('already registered') || errMsg.includes('already in use') || errMsg.includes('already exists')) {
        isExistingUser = true;
        
        // Find existing Auth user ID
        const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) {
          console.error('Failed to list users during repair:', listError);
          return res.status(400).json({ error: createError.message });
        }
        
        const existingUser = listData.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
        if (!existingUser) {
          return res.status(400).json({ error: `User already exists but could not be located in directory.` });
        }
        
        authUserId = existingUser.id;
      } else {
        console.error('Supabase Admin createUser error:', createError);
        return res.status(400).json({ error: createError.message });
      }
    } else {
      authUserId = authData.user.id;
      createdUserId = authUserId; // Track for rollback in case of new user failure
    }

    // 2. Check if a profile already exists for this email
    const { data: existingProfile, error: profileCheckError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (profileCheckError) {
      console.warn('Profile existence check query warning:', profileCheckError);
    }

    const targetProfileId = existingProfile ? existingProfile.id : authUserId;

    if (!existingProfile) {
      // Repair / Create profile
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: targetProfileId,
          email,
          first_name: firstName || '',
          last_name: lastName || '',
          status: 'active',
          organization_id: organizationId || null,
          created_at: new Date().toISOString()
        });

      if (profileError) {
        throw new Error(`Profile database write/repair error: ${profileError.message}`);
      }
    } else {
      // Ensure existing profile details are active and aligned
      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({
          first_name: firstName || '',
          last_name: lastName || '',
          status: 'active',
          organization_id: organizationId || null
        })
        .eq('id', targetProfileId);

      if (profileUpdateError) {
        console.warn('Profile state sync warning:', profileUpdateError);
      }
    }

    // 3. Upsert Role mapping
    if (roleId) {
      // Clear out any stale mappings to avoid duplicate key violations
      await supabaseAdmin.from('user_roles').delete().eq('profile_id', targetProfileId);
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({ profile_id: targetProfileId, role_id: roleId });
      
      if (roleError) {
        throw new Error(`Role mapping database error: ${roleError.message}`);
      }
    }

    // 4. Upsert Hotel mappings
    if (hotelIds) {
      await supabaseAdmin.from('user_hotels').delete().eq('profile_id', targetProfileId);
      if (hotelIds.length > 0) {
        const hotelAccess = hotelIds.map((hId: string) => ({ profile_id: targetProfileId, hotel_id: hId }));
        const { error: hotelsError } = await supabaseAdmin
          .from('user_hotels')
          .insert(hotelAccess);
        
        if (hotelsError) {
          throw new Error(`Hotel mapping database error: ${hotelsError.message}`);
        }
      }
    }

    return res.status(200).json({ userId: targetProfileId });
  } catch (error: any) {
    console.error('API Error:', error);
    
    // Rollback ONLY if it was a newly created user (don't delete pre-existing user accounts)
    if (createdUserId && !isExistingUser) {
      console.warn(`Rollback: Deleting newly created auth user: ${createdUserId}`);
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(createdUserId);
      if (deleteError) {
        console.error(`Rollback deletion failed for user ${createdUserId}:`, deleteError);
      }
    }

    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

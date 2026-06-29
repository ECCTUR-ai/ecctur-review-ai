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

    // Security check: Only allow Super Admin or Admin to create users
    const { data: userRole } = await supabaseAdmin
      .from('user_roles')
      .select('role_id, roles(name)')
      .eq('profile_id', user.id)
      .single();

    const roleName = userRole?.roles?.name?.toLowerCase();
    if (roleName !== 'admin' && roleName !== 'super admin') {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to create users' });
    }

    const { email, password, firstName, lastName, roleId, hotelIds, organizationId } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // 1. Create Auth User using Admin API
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName }
    });

    if (createError) {
      console.error('Supabase Admin createUser error:', createError);
      return res.status(400).json({ error: createError.message });
    }

    const newUserId = authData.user.id;
    createdUserId = newUserId; // Track for rollback

    // 2. Insert Profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: newUserId,
        email,
        first_name: firstName || '',
        last_name: lastName || '',
        status: 'active',
        organization_id: organizationId || null,
        created_at: new Date().toISOString()
      });

    if (profileError) {
      throw new Error(`Profile creation database error: ${profileError.message}`);
    }

    // 3. Insert Role mapping
    if (roleId) {
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({ profile_id: newUserId, role_id: roleId });
      if (roleError) {
        throw new Error(`Role assignment database error: ${roleError.message}`);
      }
    }

    // 4. Insert Hotel mappings
    if (hotelIds && hotelIds.length > 0) {
      const hotelAccess = hotelIds.map((hId: string) => ({ profile_id: newUserId, hotel_id: hId }));
      const { error: hotelsError } = await supabaseAdmin
        .from('user_hotels')
        .insert(hotelAccess);
      if (hotelsError) {
        throw new Error(`Hotel assignment database error: ${hotelsError.message}`);
      }
    }

    return res.status(200).json({ userId: newUserId });
  } catch (error: any) {
    console.error('API Error:', error);
    
    // Rollback: delete created auth user if profile/roles/hotels inserts failed
    if (createdUserId) {
      console.warn(`Rollback triggered: Deleting created auth user with ID: ${createdUserId}`);
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(createdUserId);
      if (deleteError) {
        console.error(`Rollback failed to delete user ${createdUserId}:`, deleteError);
      } else {
        console.log(`Successfully rolled back created user ${createdUserId}`);
      }
    }

    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

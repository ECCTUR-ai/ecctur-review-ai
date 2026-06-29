import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  // CORS handling
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

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

    // 1. Identify the caller's role securely on the server-side
    const { data: userRoles } = await supabaseAdmin
      .from('user_roles')
      .select('roles(name)')
      .eq('profile_id', user.id);

    let callerRole = userRoles?.[0]?.roles?.name || 'staff';

    // Fallback for default admin emails if database records are empty/out-of-sync
    const userEmail = user.email || '';
    if (callerRole === 'staff' && (userEmail === 'admin@ecctur.ai' || userEmail === 'cemil.sezgin@ecctur.com')) {
      callerRole = 'Super Admin';
    }

    // 2. Fetch the caller's assigned hotels
    const { data: currentUserHotels } = await supabaseAdmin
      .from('user_hotels')
      .select('hotel_id')
      .eq('profile_id', user.id);
    const assignedHotelIds = (currentUserHotels || []).map((uh: any) => uh.hotel_id);

    // 3. Fetch all profiles, joining user_roles and user_hotels
    const { data: profiles, error: queryError } = await supabaseAdmin
      .from('profiles')
      .select('*, user_roles(role_id, roles(name)), user_hotels(hotel_id)')
      .order('created_at', { ascending: false });

    if (queryError) {
      console.error('Profiles query error:', queryError);
      return res.status(500).json({ error: queryError.message });
    }

    return res.status(200).json({ 
      profiles: profiles || [], 
      callerRole,
      assignedHotelIds
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

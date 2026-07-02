import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Authorization check
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid authentication token' });
  }

  // Load caller role
  const { data: userRolesData } = await supabaseAdmin
    .from('user_roles')
    .select('*, roles(name)')
    .eq('profile_id', user.id);

  let userRole = userRolesData?.[0]?.roles?.name;
  if (!userRole && (user.email === 'admin@ecctur.ai' || user.email === 'cemil.sezgin@ecctur.com')) {
    userRole = 'Super Admin';
  }

  const roleNameLower = userRole?.toLowerCase();
  if (roleNameLower !== 'admin' && roleNameLower !== 'super admin') {
    return res.status(403).json({ error: 'Forbidden: Insufficient permissions for onboarding' });
  }

  const { org, hotel, connections, users, aiSettings } = req.body;

  try {
    // Step 1: Create Organization
    const { data: newOrg, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: org.name,
        logo_url: org.logoUrl || null,
        tax_office: org.taxOffice || null,
        tax_number: org.taxNumber || null,
        phone: org.phone || null,
        email: org.email || null,
        website: org.website || null,
        address: org.address || null,
        country: org.country || null,
        city: org.city || null,
        currency: org.currency || 'TRY',
        default_language: org.defaultLanguage || 'tr',
        created_at: new Date().toISOString()
      })
      .select()
      .maybeSingle();

    if (orgError) {
      throw new Error(`Step 1 (Organization Creation) failed: ${orgError.message}`);
    }

    const orgId = newOrg.id;

    // Step 2: Create Hotel
    const { data: newHotel, error: hotelError } = await supabaseAdmin
      .from('hotels')
      .insert({
        organization_id: orgId,
        name: hotel.name,
        google_account_id: hotel.googleAccountId || null,
        google_location_id: hotel.googleLocationId || null,
        google_business_name: hotel.googleBusinessName || null,
        google_business_connected: !!hotel.googleLocationId,
        address: hotel.address || null,
        phone: hotel.phone || null,
        website: hotel.website || null,
        city: hotel.city || null,
        country: hotel.country || null,
        timezone: hotel.timezone || 'Europe/Istanbul',
        default_language: hotel.defaultLanguage || 'tr',
        created_at: new Date().toISOString()
      })
      .select()
      .maybeSingle();

    if (hotelError) {
      throw new Error(`Step 2 (Hotel Creation) failed: ${hotelError.message}`);
    }

    const hotelId = newHotel.id;

    // Step 3: Create Users and assign Roles & Hotel Clearances
    const rolesListResult = await supabaseAdmin.from('roles').select('id, name');
    const dbRoles = rolesListResult.data || [];

    for (let u of users) {
      const matchingRole = dbRoles.find(r => r.name.toLowerCase() === u.role.toLowerCase());
      const roleId = matchingRole ? matchingRole.id : null;

      // 3.1: Register Auth User
      const { data: authData, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: u.password || 'TempPass123!',
        email_confirm: true,
        user_metadata: { first_name: u.firstName, last_name: u.lastName }
      });

      let targetUserId = '';

      if (authCreateError) {
        const errorMsg = authCreateError.message.toLowerCase();
        const isDuplicate = 
          errorMsg.includes("already registered") ||
          errorMsg.includes("already exists") ||
          errorMsg.includes("email already");

        if (isDuplicate) {
          const { data: listUsers } = await supabaseAdmin.auth.admin.listUsers();
          const existingUser = listUsers?.users.find(usr => usr.email?.toLowerCase() === u.email.toLowerCase());
          if (existingUser) {
            targetUserId = existingUser.id;
          } else {
            throw new Error(`Step 4 (User creation) failed for ${u.email}: User already exists but could not be located.`);
          }
        } else {
          throw new Error(`Step 4 (User creation) failed for ${u.email}: ${authCreateError.message}`);
        }
      } else {
        targetUserId = authData.user.id;
      }

      // 3.2: Upsert Profile details
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: targetUserId,
          email: u.email,
          first_name: u.firstName || '',
          last_name: u.lastName || '',
          status: 'active',
          organization_id: orgId,
          phone: u.phone || null,
          title: u.title || null,
          department: u.department || null,
          language: u.language || 'tr',
          timezone: u.timezone || 'Europe/Istanbul',
          created_at: new Date().toISOString()
        });

      if (profileError) {
        throw new Error(`Step 4 (Profile writing) failed for ${u.email}: ${profileError.message}`);
      }

      // 3.3: Set Role Map
      if (roleId) {
        await supabaseAdmin.from('user_roles').delete().eq('profile_id', targetUserId);
        await supabaseAdmin.from('user_roles').insert({
          profile_id: targetUserId,
          role_id: roleId
        });
      }

      // 3.4: Set Hotel Access Map
      await supabaseAdmin.from('user_hotels').delete().eq('profile_id', targetUserId);
      await supabaseAdmin.from('user_hotels').insert({
        profile_id: targetUserId,
        hotel_id: hotelId
      });
    }

    // Step 4: Setup Integration Settings status values
    const integrations = [
      { 
        id: 'google_business', 
        name: 'Google Business API', 
        status: (connections.googleLocationId || connections.googleConnected) ? 'connected' : 'disconnected', 
        provider: 'google',
        is_active: !!(connections.googleLocationId || connections.googleConnected),
        organization_id: orgId,
        hotel_id: hotelId,
        config: {
          google_account_id: connections.googleAccountId || hotel.googleAccountId || null,
          google_location_id: connections.googleLocationId || hotel.googleLocationId || null,
          google_business_name: connections.googleBusinessName || hotel.googleBusinessName || null
        },
        updated_at: new Date().toISOString() 
      },
      { id: 'whatsapp', name: 'WhatsApp Business API', status: connections.whatsappNumber ? 'connected' : 'disconnected', provider: 'whatsapp', is_active: !!connections.whatsappNumber, organization_id: orgId, hotel_id: hotelId, updated_at: new Date().toISOString() },
      { id: 'n8n', name: 'n8n Webhook Pipeline', status: connections.tripadvisorLink ? 'connected' : 'disconnected', provider: 'n8n', is_active: !!connections.tripadvisorLink, organization_id: orgId, hotel_id: hotelId, updated_at: new Date().toISOString() }
    ];

    for (let item of integrations) {
      await supabaseAdmin.from('integration_settings').upsert(item);
    }

    // Step 5: Seed initial reviews to prepare the dashboard
    const initialReviews = [
      {
        hotel_id: hotelId,
        organization_id: orgId,
        guest_name: 'Ahmet Yılmaz',
        rating: 5,
        comment: 'Harika bir otel, servis ve çalışanlar mükemmeldi. Kesinlikle tekrar geleceğiz!',
        sentiment: 'positive',
        status: 'published',
        source: 'google',
        created_at: new Date().toISOString()
      },
      {
        hotel_id: hotelId,
        organization_id: orgId,
        guest_name: 'Sarah Connor',
        rating: 2,
        comment: 'Room service was a bit slow, and the water pressure in the shower was low.',
        sentiment: 'negative',
        status: 'draft',
        source: 'tripadvisor',
        created_at: new Date().toISOString()
      }
    ];

    await supabaseAdmin.from('reviews').insert(initialReviews);

    return res.status(200).json({ success: true, organizationId: orgId, hotelId });
  } catch (err: any) {
    console.error('Onboarding wizard transaction failed:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}

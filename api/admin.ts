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

async function getGoogleAccessToken() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_BUSINESS_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google OAuth credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_BUSINESS_REFRESH_TOKEN) are not configured in the environment.');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to refresh Google access token: ${response.status} ${errText}`);
  }

  const data = await response.json();
  return data.access_token;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS handling
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const action = req.query.action;

  // Verify caller and setup Supabase Admin context
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ success: false, error: 'Invalid authentication token' });
  }

  // Identify caller's role
  const { data: userRolesData } = await supabaseAdmin
    .from('user_roles')
    .select('*, roles(name)')
    .eq('profile_id', user.id);

  let userRole = userRolesData?.[0]?.roles?.name;
  if (Array.isArray(userRole)) {
    userRole = (userRole as any)[0]?.name;
  } else if (userRolesData?.[0]?.roles) {
    userRole = (userRolesData[0].roles as any)?.name;
  }

  if (!userRole && (user.email === 'admin@ecctur.ai' || user.email === 'cemil.sezgin@ecctur.com')) {
    userRole = 'Super Admin';
  }

  const roleNameLower = (userRole || 'staff').toLowerCase();

  // -------------------------------------------------------------
  // Action: google-locations
  // -------------------------------------------------------------
  if (action === 'google-locations') {
    if (roleNameLower !== 'admin' && roleNameLower !== 'super admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin permissions required' });
    }

    try {
      const googleAccessToken = await getGoogleAccessToken();
      const accountsRes = await fetch('https://mybusinessbusinessinformation.googleapis.com/v1/accounts', {
        headers: { 'Authorization': `Bearer ${googleAccessToken}` }
      });

      if (!accountsRes.ok) {
        const errText = await accountsRes.text();
        throw new Error(`Google API accounts list failed: ${accountsRes.status} ${errText}`);
      }

      const accountsData = await accountsRes.json();
      const accounts = accountsData.accounts || [];
      const allLocations: any[] = [];

      for (let acc of accounts) {
        const accId = acc.name.split('/').pop();
        const locationsRes = await fetch(`https://mybusinessbusinessinformation.googleapis.com/v1/${acc.name}/locations?readMask=name,title,storefrontAddress`, {
          headers: { 'Authorization': `Bearer ${googleAccessToken}` }
        });

        if (!locationsRes.ok) continue;

        const locData = await locationsRes.json();
        const locations = locData.locations || [];

        for (let loc of locations) {
          const locId = loc.name.split('/').pop();
          const addressLines = loc.storefrontAddress?.addressLines || [];
          const addressText = [
            addressLines.join(', '),
            loc.storefrontAddress?.locality,
            loc.storefrontAddress?.administrativeArea
          ].filter(Boolean).join(' ');

          allLocations.push({
            accountId: accId,
            locationId: locId,
            businessName: loc.title || 'Unnamed Location',
            address: addressText || 'No address listed',
            reviewsCount: null
          });
        }
      }

      return res.status(200).json({ success: true, locations: allLocations });
    } catch (err: any) {
      console.error('Google locations lookup failed:', err);
      return res.status(500).json({ success: false, error: err.message || 'Failed to retrieve locations' });
    }
  }

  // -------------------------------------------------------------
  // Action: connect-location
  // -------------------------------------------------------------
  if (action === 'connect-location') {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }
    if (roleNameLower !== 'admin' && roleNameLower !== 'super admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin permissions required' });
    }

    try {
      const { hotelId, googleAccountId, googleLocationId, googleBusinessName } = req.body;
      if (!hotelId || !googleLocationId) {
        return res.status(400).json({ success: false, error: 'Missing hotelId or googleLocationId parameter' });
      }

      const { data: hotelData, error: hotelErr } = await supabaseAdmin
        .from('hotels')
        .select('organization_id')
        .eq('id', hotelId)
        .maybeSingle();

      if (hotelErr || !hotelData) {
        throw new Error(`Hotel lookup failed: ${hotelErr?.message || 'Hotel not found'}`);
      }

      const orgId = hotelData.organization_id;

      const { data: sampleRows } = await supabaseAdmin.from('hotels').select('*').limit(1);
      const actualHotelCols = sampleRows && sampleRows.length > 0 ? Object.keys(sampleRows[0]) : [];
      const { data: sampleSettings } = await supabaseAdmin.from('integration_settings').select('*').limit(1);
      const actualSettingsCols = sampleSettings && sampleSettings.length > 0 ? Object.keys(sampleSettings[0]) : [];

      const hotelUpdates: any = {};
      if (actualHotelCols.includes('google_account_id')) hotelUpdates.google_account_id = googleAccountId;
      if (actualHotelCols.includes('google_location_id')) hotelUpdates.google_location_id = googleLocationId;
      if (actualHotelCols.includes('google_business_name')) hotelUpdates.google_business_name = googleBusinessName;
      if (actualHotelCols.includes('google_business_connected')) hotelUpdates.google_business_connected = true;
      if (actualHotelCols.includes('updated_at')) hotelUpdates.updated_at = new Date().toISOString();

      if (Object.keys(hotelUpdates).length > 0) {
        const { error: hotelUpdateError } = await supabaseAdmin.from('hotels').update(hotelUpdates).eq('id', hotelId);
        if (hotelUpdateError) throw new Error(hotelUpdateError.message);
      }

      const integrationPayload: any = {
        id: 'google_business',
        name: 'Google Business API',
        status: 'connected',
        updated_at: new Date().toISOString()
      };

      if (actualSettingsCols.includes('organization_id')) integrationPayload.organization_id = orgId;
      if (actualSettingsCols.includes('hotel_id')) integrationPayload.hotel_id = hotelId;
      if (actualSettingsCols.includes('provider')) integrationPayload.provider = 'google';
      if (actualSettingsCols.includes('is_active')) integrationPayload.is_active = true;
      if (actualSettingsCols.includes('config')) {
        integrationPayload.config = {
          google_account_id: googleAccountId,
          google_location_id: googleLocationId,
          google_business_name: googleBusinessName
        };
      }

      const { error: settingsError } = await supabaseAdmin.from('integration_settings').upsert(integrationPayload);
      if (settingsError) throw new Error(settingsError.message);

      return res.status(200).json({ success: true, hotelId, googleLocationId });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // -------------------------------------------------------------
  // Action: list-users
  // -------------------------------------------------------------
  if (action === 'list-users') {
    if (roleNameLower !== 'admin' && roleNameLower !== 'super admin' && roleNameLower !== 'hotel manager') {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    try {
      const { data: currentUserHotels } = await supabaseAdmin.from('user_hotels').select('hotel_id').eq('profile_id', user.id);
      const assignedHotelIds = (currentUserHotels || []).map((uh: any) => uh.hotel_id);

      const { data: profiles, error: queryError } = await supabaseAdmin
        .from('profiles')
        .select('*, user_roles(role_id, roles(name)), user_hotels(hotel_id)')
        .order('created_at', { ascending: false });

      if (queryError) throw queryError;

      let returnedProfiles = profiles || [];
      if (roleNameLower === 'hotel manager') {
        returnedProfiles = (profiles || []).filter((p: any) => {
          const profileHotels = (p.user_hotels || []).map((uh: any) => uh.hotel_id);
          return profileHotels.some((hId: string) => assignedHotelIds.includes(hId));
        });
      }

      return res.status(200).json({
        profiles: returnedProfiles,
        callerRole: userRole || 'staff',
        assignedHotelIds
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // -------------------------------------------------------------
  // Action: create-user
  // -------------------------------------------------------------
  if (action === 'create-user') {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    if (roleNameLower !== 'admin' && roleNameLower !== 'super admin') {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    let createdUserId: string | null = null;
    let isExistingUser = false;

    try {
      const { 
        email, 
        password, 
        firstName, 
        lastName, 
        roleId, 
        hotelIds, 
        organizationId,
        phone,
        title,
        department,
        avatarUrl,
        language,
        timezone
      } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      let authUserId: string | null = null;
      let authData: any = null;
      let createError: any = null;

      try {
        const result = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { first_name: firstName, last_name: lastName }
        });
        authData = result.data;
        createError = result.error;
      } catch (err: any) {
        createError = err;
      }

      if (createError) {
        const errorMsg = (createError.message || String(createError)).toLowerCase();
        const isDuplicate = 
          errorMsg.includes("already registered") ||
          errorMsg.includes("already exists") ||
          errorMsg.includes("email already");

        if (isDuplicate) {
          isExistingUser = true;
          const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
          if (listError) throw listError;
          const existingUser = listData.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
          if (!existingUser) throw new Error('User already exists but could not be located.');
          authUserId = existingUser.id;
        } else {
          throw createError;
        }
      } else {
        authUserId = authData.user.id;
        createdUserId = authUserId;
      }

      const { data: existingProfile } = await supabaseAdmin.from('profiles').select('id').eq('email', email).maybeSingle();
      const targetProfileId = existingProfile ? existingProfile.id : authUserId!;

      if (!existingProfile) {
        const { error: profileError } = await supabaseAdmin.from('profiles').insert({
          id: targetProfileId,
          email,
          first_name: firstName || '',
          last_name: lastName || '',
          status: 'active',
          organization_id: organizationId || null,
          created_at: new Date().toISOString(),
          phone: phone || null,
          title: title || null,
          department: department || null,
          avatar_url: avatarUrl || null,
          language: language || 'tr',
          timezone: timezone || 'Europe/Istanbul'
        });
        if (profileError) throw profileError;
      } else {
        await supabaseAdmin.from('profiles').update({
          first_name: firstName || '',
          last_name: lastName || '',
          status: 'active',
          organization_id: organizationId || null,
          phone: phone || null,
          title: title || null,
          department: department || null,
          avatar_url: avatarUrl || null,
          language: language || 'tr',
          timezone: timezone || 'Europe/Istanbul'
        }).eq('id', targetProfileId);
      }

      if (roleId) {
        await supabaseAdmin.from('user_roles').delete().eq('profile_id', targetProfileId);
        await supabaseAdmin.from('user_roles').insert({ profile_id: targetProfileId, role_id: roleId });
      }

      if (hotelIds) {
        await supabaseAdmin.from('user_hotels').delete().eq('profile_id', targetProfileId);
        if (hotelIds.length > 0) {
          const hotelAccess = hotelIds.map((hId: string) => ({ profile_id: targetProfileId, hotel_id: hId }));
          await supabaseAdmin.from('user_hotels').insert(hotelAccess);
        }
      }

      return res.status(200).json({ userId: targetProfileId });
    } catch (err: any) {
      if (createdUserId && !isExistingUser) {
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
      }
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}

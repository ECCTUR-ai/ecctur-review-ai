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

async function getGoogleAccessToken(hotelId?: string) {
  const { data: settingsData } = await supabaseAdmin
    .from('integration_settings')
    .select('*');

  const gSetting = settingsData?.find((s: any) => 
    (s.id === 'google_business' || s.provider === 'google') && 
    (!hotelId || s.hotel_id === hotelId || s.id === 'google_business')
  );

  let configObj: any = {};
  if (gSetting && gSetting.config) {
    configObj = typeof gSetting.config === 'string' ? JSON.parse(gSetting.config) : gSetting.config;
  }

  const clientId = configObj?.client_id || configObj?.clientId || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = configObj?.client_secret || configObj?.clientSecret || process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = configObj?.refresh_token || configObj?.refreshToken || process.env.GOOGLE_BUSINESS_REFRESH_TOKEN;
  const accessToken = configObj?.access_token || configObj?.accessToken;
  const tokenExpiresAt = configObj?.token_expires_at || configObj?.tokenExpiresAt;

  if (accessToken && tokenExpiresAt && new Date(tokenExpiresAt).getTime() > Date.now() + 60000) {
    return accessToken;
  }

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google OAuth credentials (client_id, client_secret, refresh_token) are not configured.');
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
  const newAccessToken = data.access_token;
  const newExpiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();

  if (gSetting && newAccessToken) {
    configObj.access_token = newAccessToken;
    configObj.token_expires_at = newExpiresAt;
    await supabaseAdmin
      .from('integration_settings')
      .update({
        config: configObj,
        updated_at: new Date().toISOString()
      })
      .eq('id', gSetting.id);
  }

  return newAccessToken;
}

function cleanBookingUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.trim());
    const paramsToRemove = ['label', 'sid', 'aid', 'srpvid', 'error_url', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    paramsToRemove.forEach(p => parsed.searchParams.delete(p));
    // Remove trailing search question mark if query params are completely empty
    let result = parsed.origin + parsed.pathname;
    if (parsed.search) {
      result += parsed.search;
    }
    return result;
  } catch (e) {
    return url.trim();
  }
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

  // -------------------------------------------------------------
  // Action: google-oauth-callback (Public Endpoint, browser redirect)
  // -------------------------------------------------------------
  if (action === 'google-oauth-callback') {
    const { code, state, error } = req.query;
    const frontendUrl = process.env.APP_URL || 'https://ecctur-review-ai.vercel.app';

    if (error) {
      console.error('[Google OAuth Callback] Error from Google:', error);
      res.writeHead(302, { Location: `${frontendUrl}/admin?google_connected=false&error=${encodeURIComponent(String(error))}` });
      res.end();
      return;
    }

    if (!code) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Missing code parameter' }));
      return;
    }

    try {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const redirectUri = `${frontendUrl}/api/admin?action=google-oauth-callback`;

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        })
      });

      if (!tokenResponse.ok) {
        const errText = await tokenResponse.text();
        throw new Error(`Failed to exchange code: ${tokenResponse.status} ${errText}`);
      }

      const tokenData = await tokenResponse.json();
      const { access_token, refresh_token, expires_in } = tokenData;
      const tokenExpiresAt = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString();

      const hotelId = state && state !== 'default' ? String(state) : null;

      let orgId = null;
      if (hotelId) {
        const { data: hotelData } = await supabaseAdmin
          .from('hotels')
          .select('organization_id')
          .eq('id', hotelId)
          .maybeSingle();
        orgId = hotelData?.organization_id;
      }

      const config: any = {
        access_token,
        refresh_token,
        token_expires_at: tokenExpiresAt
      };
      
      const { data: existingSetting } = await supabaseAdmin
        .from('integration_settings')
        .select('*')
        .eq('id', 'google_business')
        .maybeSingle();

      const mergedConfig = {
        ...(existingSetting?.config || {}),
        ...config
      };

      const integrationPayload: any = {
        id: 'google_business',
        name: 'Google Business API',
        status: 'connected',
        updated_at: new Date().toISOString(),
        config: mergedConfig
      };

      if (orgId) integrationPayload.organization_id = orgId;
      if (hotelId) integrationPayload.hotel_id = hotelId;
      integrationPayload.provider = 'google_business';
      integrationPayload.is_active = true;

      const { error: upsertErr } = await supabaseAdmin.from('integration_settings').upsert(integrationPayload);
      if (upsertErr) throw upsertErr;

      if (hotelId) {
        const { data: sampleRows } = await supabaseAdmin.from('hotels').select('id, google_business_connected').limit(1);
        const actualHotelCols = sampleRows && sampleRows.length > 0 ? Object.keys(sampleRows[0]) : [];
        const hotelUpdates: any = {
          updated_at: new Date().toISOString()
        };
        if (actualHotelCols.includes('google_business_connected')) {
          hotelUpdates.google_business_connected = true;
        }
        await supabaseAdmin.from('hotels').update(hotelUpdates).eq('id', hotelId);
      }

      res.writeHead(302, { Location: `${frontendUrl}/admin?google_connected=true${hotelId ? `&hotelId=${hotelId}` : ''}` });
      res.end();
      return;
    } catch (err: any) {
      console.error('[Google OAuth Callback] Exception:', err);
      res.writeHead(302, { Location: `${frontendUrl}/admin?google_connected=false&error=${encodeURIComponent(err.message || 'OAuth callback failed')}` });
      res.end();
      return;
    }
  }


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

  const isTrueSuperAdmin = user.email === 'cemil.sezgin@ecctur.com';

  if (!userRole && (user.email === 'admin@ecctur.ai' || user.email === 'cemil.sezgin@ecctur.com')) {
    userRole = 'Super Admin';
  }

  let finalUserRole = userRole;
  if (finalUserRole && finalUserRole.toLowerCase() === 'super admin' && !isTrueSuperAdmin) {
    finalUserRole = 'Admin';
  }

  const roleNameLower = (finalUserRole || 'staff').toLowerCase();

  // -------------------------------------------------------------
  // Action: get-current-user
  // -------------------------------------------------------------
  if (action === 'get-current-user') {
    try {
      const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', user.id).maybeSingle();
      const { data: userHotels } = await supabaseAdmin.from('user_hotels').select('hotel_id').eq('profile_id', user.id);
      
      const getRoleKey = (name: string | null) => {
        if (!name) return 'staff';
        return name.toLowerCase().trim().replace(/\s+/g, '_');
      };

      let displayRoleName = finalUserRole || null;
      const roleKey = getRoleKey(displayRoleName);

      let hotelIds = (userHotels || []).map(uh => uh.hotel_id);

      // Super Admin can see all hotels in their organization, true Super Admin sees all hotels in database
      if (roleKey === 'super_admin') {
        let query = supabaseAdmin.from('hotels').select('id');
        if (!isTrueSuperAdmin) {
          const orgId = profile?.organization_id;
          if (orgId) {
            query = query.eq('organization_id', orgId);
          }
        }
        const { data: allOrgsHotels } = await query;
        if (allOrgsHotels) {
          hotelIds = allOrgsHotels.map((h: any) => h.id);
        }
      }

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
      if (roleKey === 'super_admin' || roleKey === 'admin') {
        permissions = ALL_PERMISSIONS;
      } else if (roleKey === 'manager' || roleKey === 'hotel_manager') {
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
      } else if (roleKey === 'staff' || roleKey === 'department_manager') {
        permissions = [
          'view:dashboard',
          'view:reviews',
          'view:tasks',
          'manage:tasks'
        ];
      } else if (roleKey) {
        permissions = [
          'view:dashboard',
          'view:reviews',
          'view:tasks'
        ];
      }

      console.log('[API Admin get-current-user] Resolved:', { userId: user.id, email: user.email, roleKey, hotelIdsCount: hotelIds.length });

      return res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          firstName: profile?.first_name || '',
          lastName: profile?.last_name || '',
          status: profile?.status || 'active',
          organizationId: profile?.organization_id || null,
          hotelIds,
          role: displayRoleName,
          roleKey,
          permissions
        },
        profileId: user.id,
        roleKey: roleKey,
        hotelIds: hotelIds,
        hotelCount: hotelIds.length
      });
    } catch (err: any) {
      console.error('[API Admin get-current-user Error]:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // -------------------------------------------------------------
  // Action: get-google-oauth-url
  // -------------------------------------------------------------
  if (action === 'get-google-oauth-url') {
    if (roleNameLower !== 'admin' && roleNameLower !== 'super admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin permissions required' });
    }

    try {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) {
        throw new Error('Google OAuth client ID (GOOGLE_CLIENT_ID) is not configured in the server environment.');
      }
      const frontendUrl = process.env.APP_URL || 'https://ecctur-review-ai.vercel.app';
      const redirectUri = `${frontendUrl}/api/admin?action=google-oauth-callback`;
      console.log('[Google Connection API] Generating OAuth URL. Callback URL:', redirectUri);
      const scope = 'https://www.googleapis.com/auth/business.manage';
      const hotelId = req.query.hotelId || 'default';
      const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + 
        `client_id=${encodeURIComponent(clientId)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent(scope)}&` +
        `access_type=offline&` +
        `prompt=consent&` +
        `state=${encodeURIComponent(hotelId as string)}`;

      return res.status(200).json({ success: true, url: oauthUrl });
    } catch (err: any) {
      console.error('[API get-google-oauth-url] Failure:', err);
      return res.status(500).json({ success: false, error: err.message || 'OAuth URL üretilemedi' });
    }
  }

  // -------------------------------------------------------------
  // Action: test-google-connection
  // -------------------------------------------------------------
  if (action === 'test-google-connection') {
    if (roleNameLower !== 'admin' && roleNameLower !== 'super admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin permissions required' });
    }

    try {
      const hotelId = req.query.hotelId ? String(req.query.hotelId) : undefined;
      const googleAccessToken = await getGoogleAccessToken(hotelId);
      
      const accountsRes = await fetch('https://mybusinessbusinessinformation.googleapis.com/v1/accounts', {
        headers: { 'Authorization': `Bearer ${googleAccessToken}` }
      });

      if (!accountsRes.ok) {
        const errText = await accountsRes.text();
        throw new Error(`Google API check failed: ${accountsRes.status} ${errText}`);
      }

      return res.status(200).json({ success: true, message: 'Google Business bağlantısı aktif' });
    } catch (err: any) {
      console.error('[API test-google-connection] Failure:', err);
      return res.status(400).json({ success: false, error: err.message || 'Google Business bağlantısı eksik veya yetkilendirme gerekli.' });
    }
  }

  // -------------------------------------------------------------
  // Action: google-locations
  // -------------------------------------------------------------
  if (action === 'google-locations') {
    if (roleNameLower !== 'admin' && roleNameLower !== 'super admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin permissions required' });
    }

    try {
      const hotelId = req.query.hotelId ? String(req.query.hotelId) : undefined;
      const googleAccessToken = await getGoogleAccessToken(hotelId);
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

      const { data: sampleRows } = await supabaseAdmin.from('hotels').select('id, google_account_id, google_location_id, google_business_name, google_business_connected, updated_at').limit(1);
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
      if (!isTrueSuperAdmin) {
        // Load caller profile organization
        const { data: callerProfile } = await supabaseAdmin.from('profiles').select('organization_id').eq('id', user.id).maybeSingle();
        const callerOrgId = callerProfile?.organization_id;
        
        // Filter users by organization
        returnedProfiles = (profiles || []).filter((p: any) => p.organization_id === callerOrgId);
        
        // And if caller is a hotel manager, filter further by hotel clearances
        if (roleNameLower === 'hotel manager') {
          returnedProfiles = returnedProfiles.filter((p: any) => {
            const profileHotels = (p.user_hotels || []).map((uh: any) => uh.hotel_id);
            return profileHotels.some((hId: string) => assignedHotelIds.includes(hId));
          });
        }
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

      let finalOrgId = organizationId;
      if (!isTrueSuperAdmin) {
        const { data: callerProfile } = await supabaseAdmin.from('profiles').select('organization_id').eq('id', user.id).maybeSingle();
        const callerOrgId = callerProfile?.organization_id;
        finalOrgId = callerOrgId || null;

        // Verify hotelIds belong to finalOrgId
        if (hotelIds && hotelIds.length > 0) {
          const { data: orgHotels } = await supabaseAdmin.from('hotels').select('id').eq('organization_id', finalOrgId);
          const orgHotelIds = (orgHotels || []).map(h => h.id);
          const hasInvalidHotel = hotelIds.some((hId: string) => !orgHotelIds.includes(hId));
          if (hasInvalidHotel) {
            return res.status(403).json({ error: 'Forbidden: Cannot assign users to hotels outside your organization' });
          }
        }

        // Verify roleId is not Super Admin
        if (roleId) {
          const { data: targetRole } = await supabaseAdmin.from('roles').select('name').eq('id', roleId).maybeSingle();
          if (targetRole && targetRole.name.toLowerCase() === 'super admin') {
            return res.status(403).json({ error: 'Forbidden: Cannot create or update Super Admin roles' });
          }
        }
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
          organization_id: finalOrgId || null,
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
          organization_id: finalOrgId || null,
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

  // -------------------------------------------------------------
  // Action: update-user
  // -------------------------------------------------------------
  if (action === 'update-user') {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    if (roleNameLower !== 'admin' && roleNameLower !== 'super admin') {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    try {
      const {
        id,
        email,
        firstName,
        lastName,
        status,
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

      if (!id) {
        return res.status(400).json({ error: 'User ID is required for update' });
      }

      let finalOrgId = organizationId;
      if (!isTrueSuperAdmin) {
        const { data: callerProfile } = await supabaseAdmin.from('profiles').select('organization_id').eq('id', user.id).maybeSingle();
        const callerOrgId = callerProfile?.organization_id;
        finalOrgId = callerOrgId || null;

        // Verify hotelIds belong to finalOrgId
        if (hotelIds && hotelIds.length > 0) {
          const { data: orgHotels } = await supabaseAdmin.from('hotels').select('id').eq('organization_id', finalOrgId);
          const orgHotelIds = (orgHotels || []).map(h => h.id);
          const hasInvalidHotel = hotelIds.some((hId: string) => !orgHotelIds.includes(hId));
          if (hasInvalidHotel) {
            return res.status(403).json({ error: 'Forbidden: Cannot assign users to hotels outside your organization' });
          }
        }

        // Verify roleId is not Super Admin
        if (roleId) {
          let resolvedRoleId = roleId;
          if (roleId.length < 30) {
            const { data: dbRole } = await supabaseAdmin.from('roles').select('id').ilike('name', roleId.replace('_', ' ')).maybeSingle();
            if (dbRole) resolvedRoleId = dbRole.id;
          }
          const { data: targetRole } = await supabaseAdmin.from('roles').select('name').eq('id', resolvedRoleId).maybeSingle();
          if (targetRole && targetRole.name.toLowerCase() === 'super admin') {
            return res.status(403).json({ error: 'Forbidden: Cannot create or update Super Admin roles' });
          }
        }
      }

      console.log('[API Admin Update User] Payload received:', { id, email, firstName, lastName, roleId, hotelIds, organizationId: finalOrgId });

      // Check if profile exists
      const { data: existingProfile } = await supabaseAdmin.from('profiles').select('id, email').eq('id', id).maybeSingle();
      if (!existingProfile) {
        return res.status(404).json({ error: 'User profile not found' });
      }

      // Update email in auth if it changed
      if (email && email !== existingProfile.email) {
        const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(id, { email });
        if (authUpdateError) throw authUpdateError;
      }

      // Update profiles
      const { error: profileError } = await supabaseAdmin.from('profiles').update({
        email: email || existingProfile.email,
        first_name: firstName || '',
        last_name: lastName || '',
        status: status || 'active',
        organization_id: finalOrgId || null,
        phone: phone || null,
        title: title || null,
        department: department || null,
        avatar_url: avatarUrl || null,
        language: language || 'tr',
        timezone: timezone || 'Europe/Istanbul'
      }).eq('id', id);

      if (profileError) throw profileError;

      // Update user_roles
      if (roleId) {
        let resolvedRoleId = roleId;
        // Resolve roles case-insensitivity mapping (e.g. 'Super Admin' vs 'super_admin')
        if (roleId.length < 30) {
          const { data: dbRole } = await supabaseAdmin.from('roles').select('id').ilike('name', roleId.replace('_', ' ')).maybeSingle();
          if (dbRole) resolvedRoleId = dbRole.id;
        }
        await supabaseAdmin.from('user_roles').delete().eq('profile_id', id);
        await supabaseAdmin.from('user_roles').insert({ profile_id: id, role_id: resolvedRoleId });
      }

      // Update user_hotels
      if (hotelIds) {
        await supabaseAdmin.from('user_hotels').delete().eq('profile_id', id);
        if (hotelIds.length > 0) {
          const hotelAccess = hotelIds.map((hId: string) => ({ profile_id: id, hotel_id: hId }));
          await supabaseAdmin.from('user_hotels').insert(hotelAccess);
        }
      }

      return res.status(200).json({ success: true, userId: id });
    } catch (err: any) {
      console.error('[API Admin Update User Error]:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // -------------------------------------------------------------
  // Action: create-hotel
  // -------------------------------------------------------------
  if (action === 'create-hotel') {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    if (!isTrueSuperAdmin) {
      return res.status(403).json({ error: 'Forbidden: Super Admin permissions required to create hotels' });
    }
    try {
      const { name, organizationId, googleMapsLink, googleMapsUrl, tripadvisorUrl, bookingUrl } = req.body;
      if (!name || !organizationId) {
        return res.status(400).json({ error: 'Missing name or organizationId parameter' });
      }
      const { data: newHotel, error: hotelError } = await supabaseAdmin
        .from('hotels')
        .insert({
          name,
          organization_id: organizationId,
          google_maps_link: googleMapsUrl || googleMapsLink || null,
          google_maps_url: googleMapsUrl || googleMapsLink || null,
          tripadvisor_url: tripadvisorUrl || null,
          booking_url: cleanBookingUrl(bookingUrl) || null
        })
        .select()
        .maybeSingle();

      if (hotelError) throw hotelError;
      return res.status(200).json({ success: true, hotel: newHotel });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // -------------------------------------------------------------
  // Action: update-hotel
  // -------------------------------------------------------------
  if (action === 'update-hotel') {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    if (roleNameLower !== 'admin' && roleNameLower !== 'super admin') {
      return res.status(403).json({ error: 'Forbidden: Admin permissions required to update hotels' });
    }
    try {
      const { id, name, organizationId, googleMapsLink, googleMapsUrl, tripadvisorUrl, bookingUrl } = req.body;
      if (!id || !name || !organizationId) {
        return res.status(400).json({ error: 'Missing id, name or organizationId parameter' });
      }

      if (!isTrueSuperAdmin) {
        // Enforce caller organization check
        const { data: callerProfile } = await supabaseAdmin.from('profiles').select('organization_id').eq('id', user.id).maybeSingle();
        if (!callerProfile || callerProfile.organization_id !== organizationId) {
          return res.status(403).json({ error: 'Forbidden: Cannot edit hotels of another organization' });
        }
      }

      const { data: updatedHotel, error: hotelError } = await supabaseAdmin
        .from('hotels')
        .update({
          name,
          organization_id: organizationId,
          google_maps_link: googleMapsUrl || googleMapsLink || null,
          google_maps_url: googleMapsUrl || googleMapsLink || null,
          tripadvisor_url: tripadvisorUrl || null,
          booking_url: cleanBookingUrl(bookingUrl) || null
        })
        .eq('id', id)
        .select()
        .maybeSingle();

      if (hotelError) throw hotelError;
      return res.status(200).json({ success: true, hotel: updatedHotel });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // -------------------------------------------------------------
  // Action: delete-hotel
  // -------------------------------------------------------------
  if (action === 'delete-hotel') {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    if (!isTrueSuperAdmin) {
      return res.status(403).json({ error: 'Forbidden: Super Admin permissions required to delete hotels' });
    }
    try {
      const { id } = req.body;
      if (!id) {
        return res.status(400).json({ error: 'Missing hotel id parameter' });
      }
      const { error: hotelError } = await supabaseAdmin
        .from('hotels')
        .delete()
        .eq('id', id);

      if (hotelError) throw hotelError;
      return res.status(200).json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // -------------------------------------------------------------
  // Action: update-organization
  // -------------------------------------------------------------
  if (action === 'update-organization') {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    if (roleNameLower !== 'admin' && roleNameLower !== 'super admin') {
      return res.status(403).json({ error: 'Forbidden: Admin permissions required to update organization' });
    }
    try {
      const { id, updates } = req.body;
      if (!id || !updates) {
        return res.status(400).json({ error: 'Missing id or updates parameter' });
      }

      if (!isTrueSuperAdmin) {
        // Enforce caller organization check
        const { data: callerProfile } = await supabaseAdmin.from('profiles').select('organization_id').eq('id', user.id).maybeSingle();
        if (!callerProfile || callerProfile.organization_id !== id) {
          return res.status(403).json({ error: 'Forbidden: Cannot edit another organization' });
        }
      }

      // Convert camelCase parameters to snake_case db columns if present
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.logoUrl !== undefined) dbUpdates.logo_url = updates.logoUrl;
      if (updates.taxOffice !== undefined) dbUpdates.tax_office = updates.taxOffice;
      if (updates.taxNumber !== undefined) dbUpdates.tax_number = updates.taxNumber;
      if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
      if (updates.email !== undefined) dbUpdates.email = updates.email;
      if (updates.website !== undefined) dbUpdates.website = updates.website;
      if (updates.address !== undefined) dbUpdates.address = updates.address;
      if (updates.country !== undefined) dbUpdates.country = updates.country;
      if (updates.city !== undefined) dbUpdates.city = updates.city;
      if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
      if (updates.defaultLanguage !== undefined) dbUpdates.default_language = updates.defaultLanguage;

      const { data: updatedOrg, error: orgError } = await supabaseAdmin
        .from('organizations')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (orgError) throw orgError;
      return res.status(200).json({ success: true, organization: updatedOrg });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }


  return res.status(400).json({ error: `Unknown action: ${action}` });
}

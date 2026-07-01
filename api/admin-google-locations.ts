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
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 1. Authorization check
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ success: false, error: 'Invalid authentication token' });
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
      return res.status(403).json({ success: false, error: 'Forbidden: Admin permissions required' });
    }

    // Check mock mode
    const isMock = process.env.USE_MOCK_GOOGLE_PROVIDER === 'true' || 
                   (!process.env.GOOGLE_CLIENT_ID && !process.env.GOOGLE_BUSINESS_REFRESH_TOKEN);

    if (isMock) {
      console.log('[Google Locations] Running in Mock Mode');
      return res.status(200).json({
        success: true,
        locations: [
          {
            accountId: '1122334455',
            locationId: 'loc-istanbul-001',
            businessName: 'ECCTUR Seyahat Acentesi - Merkez',
            address: 'Caddebostan Mah. Bağdat Cad. No:123 Kadıköy, İstanbul',
            reviewsCount: 154
          },
          {
            accountId: '1122334455',
            locationId: 'loc-antalya-002',
            businessName: 'ECCTUR Seyahat Acentesi - Antalya Ofisi',
            address: 'Liman Mah. Atatürk Bulvarı No:45 Konyaaltı, Antalya',
            reviewsCount: 86
          },
          {
            accountId: '1122334455',
            locationId: 'loc-bodrum-003',
            businessName: 'ECCTUR Seyahat Acentesi - Bodrum Ofisi',
            address: 'Çarşı Mah. Neyzen Tevfik Cad. No:78 Bodrum, Muğla',
            reviewsCount: 42
          }
        ]
      });
    }

    // Real API implementation
    const googleAccessToken = await getGoogleAccessToken();
    console.log('[Google Locations] Access Token refreshed successfully.');

    // 1. Fetch accounts
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

    // 2. Fetch locations for each account
    for (let acc of accounts) {
      const accId = acc.name.split('/').pop();
      const locationsRes = await fetch(`https://mybusinessbusinessinformation.googleapis.com/v1/${acc.name}/locations?readMask=name,title,storefrontAddress`, {
        headers: { 'Authorization': `Bearer ${googleAccessToken}` }
      });

      if (!locationsRes.ok) {
        console.warn(`[Google Locations] Failed to fetch locations for account ${acc.name}: ${locationsRes.statusText}`);
        continue;
      }

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
          reviewsCount: null // Optional Google Reviews API count can go here
        });
      }
    }

    return res.status(200).json({ success: true, locations: allLocations });

  } catch (err: any) {
    console.error('Google locations lookup failed:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to retrieve Google locations',
      details: err.stack || String(err)
    });
  }
}

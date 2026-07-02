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
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
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

    const { hotelId, googleAccountId, googleLocationId, googleBusinessName } = req.body;
    if (!hotelId || !googleLocationId) {
      return res.status(400).json({ success: false, error: 'Missing hotelId or googleLocationId parameter' });
    }

    // A: Fetch hotel details to get organization ID
    const { data: hotelData, error: hotelErr } = await supabaseAdmin
      .from('hotels')
      .select('organization_id')
      .eq('id', hotelId)
      .maybeSingle();

    if (hotelErr || !hotelData) {
      throw new Error(`Hotel lookup failed: ${hotelErr?.message || 'Hotel not found'}`);
    }

    const orgId = hotelData.organization_id;

    // Inspect columns of hotels table first (Requirement 9 / startup debugging)
    const { data: sampleRows } = await supabaseAdmin.from('hotels').select('*').limit(1);
    const actualHotelCols = sampleRows && sampleRows.length > 0 ? Object.keys(sampleRows[0]) : [];

    // Inspect integration_settings table columns
    const { data: sampleSettings } = await supabaseAdmin.from('integration_settings').select('*').limit(1);
    const actualSettingsCols = sampleSettings && sampleSettings.length > 0 ? Object.keys(sampleSettings[0]) : [];

    // B: Update hotels table dynamically based on column availability
    const hotelUpdates: any = {};
    if (actualHotelCols.includes('google_account_id')) {
      hotelUpdates.google_account_id = googleAccountId;
    }
    if (actualHotelCols.includes('google_location_id')) {
      hotelUpdates.google_location_id = googleLocationId;
    }
    if (actualHotelCols.includes('google_business_name')) {
      hotelUpdates.google_business_name = googleBusinessName;
    }
    if (actualHotelCols.includes('google_business_connected')) {
      hotelUpdates.google_business_connected = true;
    }
    if (actualHotelCols.includes('updated_at')) {
      hotelUpdates.updated_at = new Date().toISOString();
    }

    if (Object.keys(hotelUpdates).length > 0) {
      const { error: hotelUpdateError } = await supabaseAdmin
        .from('hotels')
        .update(hotelUpdates)
        .eq('id', hotelId);

      if (hotelUpdateError) {
        throw new Error(`Failed to update hotel record: ${hotelUpdateError.message}`);
      }
    }

    // C: Update integration_settings dynamically based on column availability
    const integrationPayload: any = {
      id: 'google_business',
      name: 'Google Business API',
      status: 'connected',
      updated_at: new Date().toISOString()
    };

    if (actualSettingsCols.includes('organization_id')) {
      integrationPayload.organization_id = orgId;
    }
    if (actualSettingsCols.includes('hotel_id')) {
      integrationPayload.hotel_id = hotelId;
    }
    if (actualSettingsCols.includes('provider')) {
      integrationPayload.provider = 'google';
    }
    if (actualSettingsCols.includes('is_active')) {
      integrationPayload.is_active = true;
    }
    if (actualSettingsCols.includes('config')) {
      integrationPayload.config = {
        google_account_id: googleAccountId,
        google_location_id: googleLocationId,
        google_business_name: googleBusinessName
      };
    }

    const { error: settingsError } = await supabaseAdmin
      .from('integration_settings')
      .upsert(integrationPayload);

    if (settingsError) {
      throw new Error(`Failed to update integration settings record: ${settingsError.message}`);
    }

    console.log(`[Google Locations Connect] Connected hotel ${hotelId} to location ${googleLocationId}`);
    return res.status(200).json({ success: true, hotelId, googleLocationId });

  } catch (err: any) {
    console.error('Google locations connection failed:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to connect Google location',
      details: err.stack || String(err)
    });
  }
}

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { reviewImportService, NormalizedReview } from './reviewImportService.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

export interface SyncResult {
  platform: string;
  success: boolean;
  imported: number;
  updated: number;
  skipped: number;
  error?: string;
  syncedAt: string;
}

export const PLATFORM_MAPPINGS: Record<string, { dbPlatform: string; dbUrlColumn: string; provider: string }> = {
  google: { dbPlatform: 'Google', dbUrlColumn: 'google_maps_url', provider: 'apify' },
  booking: { dbPlatform: 'Booking', dbUrlColumn: 'booking_url', provider: 'apify' },
  tripadvisor: { dbPlatform: 'TripAdvisor', dbUrlColumn: 'tripadvisor_url', provider: 'apify' },
  hotels: { dbPlatform: 'Hotels.com', dbUrlColumn: 'hotelscom_url', provider: 'apify' },
  holidaycheck: { dbPlatform: 'HolidayCheck', dbUrlColumn: 'holidaycheck_url', provider: 'apify' },
  otelpuan: { dbPlatform: 'otelpuan', dbUrlColumn: 'otelpuan_url', provider: 'custom' }
};

/**
 * Generate a deterministic fingerprint for a review to prevent duplicate insertions when external_review_id is absent.
 */
export function createReviewFingerprint(hotelId: string, platform: string, reviewerName?: string, reviewDate?: string, reviewText?: string): string {
  const normName = (reviewerName || '').trim().toLowerCase();
  const normDate = (reviewDate || '').trim();
  const normText = (reviewText || '').trim().slice(0, 150).toLowerCase();
  const rawString = `${hotelId}:${platform.toLowerCase()}:${normName}:${normDate}:${normText}`;
  return crypto.createHash('sha256').update(rawString).digest('hex');
}

/**
 * Ensures integration records exist in `hotel_review_integrations` for a given hotel.
 * If not existing, backfills from `hotels` table.
 */
export async function ensureHotelIntegrations(hotelId: string) {
  const { data: hotel, error: hotelErr } = await supabaseAdmin
    .from('hotels')
    .select('id, google_maps_url, google_maps_link, booking_url, tripadvisor_url, hotelscom_url, holidaycheck_url, otelpuan_url')
    .eq('id', hotelId)
    .maybeSingle();

  if (hotelErr || !hotel) {
    throw new Error(`Hotel not found for ID: ${hotelId}`);
  }

  const platforms = ['google', 'booking', 'tripadvisor', 'hotels', 'holidaycheck', 'otelpuan'];
  const integrations: any[] = [];

  for (const plat of platforms) {
    const map = PLATFORM_MAPPINGS[plat];
    let sourceUrl = '';
    if (plat === 'google') sourceUrl = hotel.google_maps_url || hotel.google_maps_link || '';
    else if (plat === 'booking') sourceUrl = hotel.booking_url || '';
    else if (plat === 'tripadvisor') sourceUrl = hotel.tripadvisor_url || '';
    else if (plat === 'hotels') sourceUrl = hotel.hotelscom_url || '';
    else if (plat === 'holidaycheck') sourceUrl = hotel.holidaycheck_url || '';
    else if (plat === 'otelpuan') sourceUrl = hotel.otelpuan_url || '';

    const isEnabled = !!(sourceUrl && sourceUrl.trim().length > 0);

    const { data: existing } = await supabaseAdmin
      .from('hotel_review_integrations')
      .select('*')
      .eq('hotel_id', hotelId)
      .eq('platform', plat)
      .maybeSingle();

    if (!existing) {
      const { data: created } = await supabaseAdmin
        .from('hotel_review_integrations')
        .insert({
          hotel_id: hotelId,
          platform: plat,
          provider: map.provider,
          source_url: sourceUrl || null,
          is_enabled: isEnabled,
          sync_status: isEnabled ? 'idle' : 'disabled'
        })
        .select()
        .single();
      if (created) integrations.push(created);
    } else {
      // Sync URL if missing in integration record
      if (!existing.source_url && sourceUrl) {
        await supabaseAdmin
          .from('hotel_review_integrations')
          .update({ source_url: sourceUrl, is_enabled: true })
          .eq('id', existing.id);
        existing.source_url = sourceUrl;
        existing.is_enabled = true;
      }
      integrations.push(existing);
    }
  }

  return integrations;
}

/**
 * Deduplicated bulk insertion logic for reviews
 */
export async function saveNormalizedReviews(
  hotelId: string,
  platformKey: string,
  reviews: NormalizedReview[]
): Promise<{ imported: number; updated: number; skipped: number }> {
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  const mapping = PLATFORM_MAPPINGS[platformKey.toLowerCase()] || { dbPlatform: platformKey };
  const dbPlatform = mapping.dbPlatform;

  // Get hotel details for organization_id & hotel_name
  const { data: hotelData } = await supabaseAdmin
    .from('hotels')
    .select('organization_id, name')
    .eq('id', hotelId)
    .maybeSingle();

  const orgId = hotelData?.organization_id || null;
  const hotelName = hotelData?.name || '';

  // Get existing reviews for this hotel and platform to prevent duplicate queries in loop
  const { data: existingReviews } = await supabaseAdmin
    .from('reviews')
    .select('id, platform_review_id, guest_name, review_date, review_text, metadata')
    .eq('hotel_id', hotelId)
    .ilike('platform', dbPlatform);

  const existingExternalIds = new Set<string>();
  const existingFingerprints = new Set<string>();

  (existingReviews || []).forEach(r => {
    if (r.platform_review_id) {
      existingExternalIds.add(String(r.platform_review_id));
    }
    const fp = r.metadata?.fingerprint || createReviewFingerprint(hotelId, dbPlatform, r.guest_name, r.review_date, r.review_text);
    existingFingerprints.add(fp);
  });

  for (const r of reviews) {
    const externalId = r.externalId ? String(r.externalId) : null;
    const fingerprint = createReviewFingerprint(hotelId, dbPlatform, r.guestName, r.reviewDate || undefined, r.reviewText);

    // Primary check: external ID match
    if (externalId && existingExternalIds.has(externalId)) {
      skipped++;
      continue;
    }

    // Secondary check: fingerprint match
    if (existingFingerprints.has(fingerprint)) {
      skipped++;
      continue;
    }

    // Prepare sentiment
    const sentiment = r.rating >= 4 ? 'positive' : r.rating === 3 ? 'neutral' : 'negative';

    const mergedMetadata = {
      ...(r.metadata || {}),
      fingerprint,
      source_url: r.sourceUrl || null,
      liked_text: r.likedText || null,
      disliked_text: r.dislikedText || null
    };

    const reviewRecord = {
      hotel_id: hotelId,
      hotel_name: hotelName,
      organization_id: orgId,
      guest_name: r.guestName || 'Misafir',
      rating: r.rating || 5,
      review_text: r.reviewText || '',
      platform: dbPlatform,
      platform_review_id: externalId,
      sentiment,
      status: 'draft',
      published: 'No',
      created_at: new Date().toISOString(),
      review_date: r.reviewDate || new Date().toISOString(),
      metadata: mergedMetadata
    };

    const { error: insErr } = await supabaseAdmin.from('reviews').insert(reviewRecord);

    if (!insErr) {
      imported++;
      if (externalId) existingExternalIds.add(externalId);
      existingFingerprints.add(fingerprint);
    } else {
      console.error(`[Orchestrator ${dbPlatform}] Insert error:`, insErr);
      skipped++;
    }
  }

  return { imported, updated, skipped };
}

/**
 * Individual Platform Sync Functions
 */
export async function syncGoogleReviews(hotelId: string, integration: any): Promise<SyncResult> {
  const startedAt = new Date().toISOString();
  const sourceUrl = integration.source_url;
  if (!sourceUrl) {
    return { platform: 'google', success: false, imported: 0, updated: 0, skipped: 0, error: 'Google Maps URL not configured', syncedAt: startedAt };
  }

  const reviews = await reviewImportService.importReviews('google', sourceUrl);
  const { imported, updated, skipped } = await saveNormalizedReviews(hotelId, 'google', reviews);
  return { platform: 'google', success: true, imported, updated, skipped, syncedAt: startedAt };
}

export async function syncBookingReviews(hotelId: string, integration: any): Promise<SyncResult> {
  const startedAt = new Date().toISOString();
  const sourceUrl = integration.source_url;
  if (!sourceUrl) {
    return { platform: 'booking', success: false, imported: 0, updated: 0, skipped: 0, error: 'Booking.com URL not configured', syncedAt: startedAt };
  }

  const reviews = await reviewImportService.importReviews('booking', sourceUrl);
  const { imported, updated, skipped } = await saveNormalizedReviews(hotelId, 'booking', reviews);
  return { platform: 'booking', success: true, imported, updated, skipped, syncedAt: startedAt };
}

export async function syncTripadvisorReviews(hotelId: string, integration: any): Promise<SyncResult> {
  const startedAt = new Date().toISOString();
  const sourceUrl = integration.source_url;
  if (!sourceUrl) {
    return { platform: 'tripadvisor', success: false, imported: 0, updated: 0, skipped: 0, error: 'TripAdvisor URL not configured', syncedAt: startedAt };
  }

  const reviews = await reviewImportService.importReviews('tripadvisor', sourceUrl);
  const { imported, updated, skipped } = await saveNormalizedReviews(hotelId, 'tripadvisor', reviews);
  return { platform: 'tripadvisor', success: true, imported, updated, skipped, syncedAt: startedAt };
}

export async function syncHotelsReviews(hotelId: string, integration: any): Promise<SyncResult> {
  const startedAt = new Date().toISOString();
  const sourceUrl = integration.source_url;
  if (!sourceUrl) {
    return { platform: 'hotels', success: false, imported: 0, updated: 0, skipped: 0, error: 'Hotels.com URL not configured', syncedAt: startedAt };
  }

  const reviews = await reviewImportService.importReviews('hotels.com', sourceUrl);
  const { imported, updated, skipped } = await saveNormalizedReviews(hotelId, 'hotels', reviews);
  return { platform: 'hotels', success: true, imported, updated, skipped, syncedAt: startedAt };
}

export async function syncHolidayCheckReviews(hotelId: string, integration: any): Promise<SyncResult> {
  const startedAt = new Date().toISOString();
  const sourceUrl = integration.source_url;
  if (!sourceUrl) {
    return { platform: 'holidaycheck', success: false, imported: 0, updated: 0, skipped: 0, error: 'HolidayCheck URL not configured', syncedAt: startedAt };
  }

  const reviews = await reviewImportService.importReviews('holidaycheck', sourceUrl);
  const { imported, updated, skipped } = await saveNormalizedReviews(hotelId, 'holidaycheck', reviews);
  return { platform: 'holidaycheck', success: true, imported, updated, skipped, syncedAt: startedAt };
}

export async function syncOtelpuanReviews(hotelId: string, integration: any): Promise<SyncResult> {
  const startedAt = new Date().toISOString();
  const sourceUrl = integration.source_url;
  if (!sourceUrl) {
    return { platform: 'otelpuan', success: false, imported: 0, updated: 0, skipped: 0, error: 'Otelpuan URL not configured', syncedAt: startedAt };
  }

  const reviews = await reviewImportService.importReviews('otelpuan', sourceUrl);
  const { imported, updated, skipped } = await saveNormalizedReviews(hotelId, 'otelpuan', reviews);

  // Preserve existing Otelpuan duplicate cleaning logic: clean exact duplicate text entries if any
  try {
    const { data: otelpuanRows } = await supabaseAdmin
      .from('reviews')
      .select('id, review_text, guest_name, created_at')
      .eq('hotel_id', hotelId)
      .eq('platform', 'otelpuan')
      .order('created_at', { ascending: true });

    if (otelpuanRows && otelpuanRows.length > 0) {
      const seen = new Set<string>();
      const dupIdsToDelete: string[] = [];
      for (const row of otelpuanRows) {
        const key = `${(row.guest_name || '').trim()}:${(row.review_text || '').trim()}`;
        if (seen.has(key)) {
          dupIdsToDelete.push(row.id);
        } else {
          seen.add(key);
        }
      }
      if (dupIdsToDelete.length > 0) {
        console.log(`[Otelpuan Deduplication Cleanup] Removing ${dupIdsToDelete.length} duplicate entries.`);
        await supabaseAdmin.from('reviews').delete().in('id', dupIdsToDelete);
      }
    }
  } catch (cleanErr) {
    console.error('[Otelpuan Clean Error]', cleanErr);
  }

  return { platform: 'otelpuan', success: true, imported, updated, skipped, syncedAt: startedAt };
}

/**
 * Common Router Function for a Single Platform
 */
export async function syncPlatform(platform: string, hotelId: string): Promise<SyncResult> {
  const normPlatform = platform.toLowerCase();
  const startedAt = new Date().toISOString();

  // Ensure integrations are seeded
  const integrations = await ensureHotelIntegrations(hotelId);
  const integration = integrations.find(i => i.platform === normPlatform);

  if (!integration) {
    return { platform: normPlatform, success: false, imported: 0, updated: 0, skipped: 0, error: `Integration not found for platform: ${platform}`, syncedAt: startedAt };
  }

  if (!integration.is_enabled) {
    return { platform: normPlatform, success: false, imported: 0, updated: 0, skipped: 0, error: 'Platform integration is disabled', syncedAt: startedAt };
  }

  // Set status to syncing
  await supabaseAdmin
    .from('hotel_review_integrations')
    .update({ sync_status: 'syncing', updated_at: startedAt })
    .eq('hotel_id', hotelId)
    .eq('platform', normPlatform);

  let result: SyncResult;
  try {
    switch (normPlatform) {
      case 'google':
        result = await syncGoogleReviews(hotelId, integration);
        break;
      case 'booking':
        result = await syncBookingReviews(hotelId, integration);
        break;
      case 'tripadvisor':
        result = await syncTripadvisorReviews(hotelId, integration);
        break;
      case 'hotels':
      case 'hotels.com':
        result = await syncHotelsReviews(hotelId, integration);
        break;
      case 'holidaycheck':
        result = await syncHolidayCheckReviews(hotelId, integration);
        break;
      case 'otelpuan':
        result = await syncOtelpuanReviews(hotelId, integration);
        break;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  } catch (err: any) {
    result = {
      platform: normPlatform,
      success: false,
      imported: 0,
      updated: 0,
      skipped: 0,
      error: err.message || 'Unknown synchronization error',
      syncedAt: startedAt
    };
  }

  const completedAt = new Date().toISOString();

  // Update integration table status
  await supabaseAdmin
    .from('hotel_review_integrations')
    .update({
      sync_status: result.success ? 'success' : 'error',
      last_sync_at: completedAt,
      last_success_at: result.success ? completedAt : integration.last_success_at,
      last_error: result.success ? null : result.error,
      last_imported_count: result.imported,
      updated_at: completedAt
    })
    .eq('hotel_id', hotelId)
    .eq('platform', normPlatform);

  // Record audit sync log
  await supabaseAdmin
    .from('review_sync_logs')
    .insert({
      hotel_id: hotelId,
      platform: normPlatform,
      status: result.success ? 'success' : 'error',
      imported_count: result.imported,
      updated_count: result.updated,
      skipped_count: result.skipped,
      error_message: result.error || null,
      started_at: startedAt,
      completed_at: completedAt
    });

  return result;
}

/**
 * Orchestration Function for "Sync All"
 * Runs active integrations sequentially with isolated try/catch blocks.
 */
export async function syncAllPlatforms(hotelId: string): Promise<SyncResult[]> {
  const integrations = await ensureHotelIntegrations(hotelId);
  const results: SyncResult[] = [];

  for (const integration of integrations) {
    if (!integration.is_enabled) {
      results.push({
        platform: integration.platform,
        success: false,
        imported: 0,
        updated: 0,
        skipped: 0,
        error: 'Integration not enabled / not configured',
        syncedAt: new Date().toISOString()
      });
      continue;
    }

    try {
      const res = await syncPlatform(integration.platform, hotelId);
      results.push(res);
    } catch (err: any) {
      results.push({
        platform: integration.platform,
        success: false,
        imported: 0,
        updated: 0,
        skipped: 0,
        error: err.message || 'Synchronization exception',
        syncedAt: new Date().toISOString()
      });
    }
  }

  return results;
}

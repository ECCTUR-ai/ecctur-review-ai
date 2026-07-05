export type NormalizedPlatform = 'google' | 'tripadvisor' | 'booking' | 'hotelscom' | 'holidaycheck' | 'other';

export function normalizeReviewPlatform(platform: string): NormalizedPlatform {
  if (!platform) return 'other';
  const lower = platform.toLowerCase().trim();
  if (lower === 'google' || lower === 'google reviews' || lower === 'google maps' || lower === 'google-maps' || lower === 'google_maps') {
    return 'google';
  }
  if (lower === 'tripadvisor' || lower === 'trip advisor') {
    return 'tripadvisor';
  }
  if (lower === 'booking' || lower === 'booking.com') {
    return 'booking';
  }
  if (lower === 'hotels.com' || lower === 'hotelscom' || lower === 'hotels com') {
    return 'hotelscom';
  }
  if (lower === 'holidaycheck' || lower === 'holiday check') {
    return 'holidaycheck';
  }
  return 'other';
}

export function getPlatformLabel(platformKey: string): string {
  const normalized = normalizeReviewPlatform(platformKey);
  switch (normalized) {
    case 'google':
      return 'Google Reviews';
    case 'tripadvisor':
      return 'TripAdvisor';
    case 'booking':
      return 'Booking.com';
    case 'hotelscom':
      return 'Hotels.com';
    case 'holidaycheck':
      return 'HolidayCheck';
    default:
      return platformKey || 'Other';
  }
}

export function getPlatformColorClass(platformKey: string): string {
  const normalized = normalizeReviewPlatform(platformKey);
  switch (normalized) {
    case 'google':
      return 'bg-blue-50 text-blue-600 border-blue-100';
    case 'tripadvisor':
      return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    case 'booking':
      return 'bg-sky-50 text-sky-600 border-sky-100';
    case 'hotelscom':
      return 'bg-indigo-50 text-indigo-600 border-indigo-100';
    case 'holidaycheck':
      return 'bg-rose-50 text-rose-600 border-rose-100';
    default:
      return 'bg-slate-50 text-slate-600 border-slate-100';
  }
}

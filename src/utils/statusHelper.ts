export type NormalizedReviewStatus = 'pending' | 'draft' | 'approved' | 'archived' | 'manual_replied';

export function normalizeReviewStatus(status: any): NormalizedReviewStatus {
  if (status === null || status === undefined) return 'pending';
  const s = String(status).toLowerCase().trim();
  
  if (s === '' || s === 'new' || s === 'waiting' || s === 'pending' || s === 'pending_approval' || s === 'waiting_approval') {
    return 'pending';
  }
  if (s === 'draft' || s === 'taslak') {
    return 'draft';
  }
  if (s === 'approved' || s === 'onaylandi' || s === 'published' || s === 'yayinlandi' || s === 'cevaplandi') {
    return 'approved';
  }
  if (s === 'archived' || s === 'arsiv' || s === 'arsivlendi') {
    return 'archived';
  }
  if (s === 'manual_replied' || s === 'manual' || s === 'manually_replied' || s === 'manual-replied') {
    return 'manual_replied';
  }
  
  return 'pending'; // Fallback
}

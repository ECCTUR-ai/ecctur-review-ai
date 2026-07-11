import crypto from 'crypto';

/**
 * Generates a deterministic SHA-256 hash from a review's content.
 * Normalizes case, whitespaces, and trims inputs to prevent duplicate bypass.
 */
export function generateDeterministicId(
  hotelUrl: string,
  reviewerName: string | null,
  reviewDate: string | null,
  reviewText: string
): string {
  const normHotelUrl = (hotelUrl || '').trim().toLowerCase();
  const normName = (reviewerName || '').trim().toLowerCase();
  const normDate = (reviewDate || '').trim().toLowerCase();
  
  // Normalize whitespaces: replace any sequence of whitespace chars with a single space
  const normText = (reviewText || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  const combined = `${normHotelUrl}|${normName}|${normDate}|${normText}`;
  return crypto.createHash('sha256').update(combined).digest('hex');
}

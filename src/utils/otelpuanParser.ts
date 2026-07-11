import { OtelpuanReview } from '../types/otelpuan.js';
import { generateDeterministicId } from './reviewHash.js';

// Maps Turkish month names to ISO double-digit month numbers
const TURKISH_MONTHS: Record<string, string> = {
  ocak: '01',
  subat: '02',
  subât: '02',
  şubat: '02',
  mart: '03',
  nisan: '04',
  mayis: '05',
  mayıs: '05',
  haziran: '06',
  temmuz: '07',
  agustos: '08',
  ağustos: '08',
  eylul: '09',
  eylül: '09',
  ekim: '10',
  kasim: '11',
  kasım: '11',
  aralik: '12',
  aralık: '12'
};

/**
 * Parses Turkish dates (e.g. "11 Temmuz 2026") into ISO standard "2026-07-11".
 * Returns null if parsing fails or input only contains month/year.
 */
export function parseTurkishDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const clean = dateStr.replace(/\s+/g, ' ').trim().toLowerCase();

  // Match: Day Month Year (e.g., "11 Temmuz 2026" or "1 Temmuz 2026")
  const regex = /^(\d{1,2})\s+([a-zA-ZğüşıöçĞÜŞİÖÇ]+)\s+(\d{4})$/i;
  const match = clean.match(regex);

  if (match) {
    const day = parseInt(match[1], 10);
    const monthName = match[2];
    const year = match[3];
    
    const monthNum = TURKISH_MONTHS[monthName];
    if (monthNum) {
      const dayStr = day < 10 ? `0${day}` : `${day}`;
      return `${year}-${monthNum}-${dayStr}`;
    }
  }

  return null;
}

/**
 * Normalizes Otelpuan rating scale (usually 1.0 - 10.0) into GuestReview's 1.0 - 5.0 standard.
 */
export function normalizeOtelpuanRating(rating: number | null): number | null {
  if (rating === null || rating === undefined || isNaN(rating)) return null;
  
  // Guard the rating value between 1 and 10
  const clamped = Math.max(1, Math.min(10, rating));
  
  // Convert 10-scale to 5-scale
  const normalized = clamped / 2;
  
  // Round to 1 decimal place (e.g. 4.6)
  return Math.round(normalized * 10) / 10;
}

/**
 * Searches recursively inside an arbitrary object to find an array of review-like objects.
 */
function findReviewsInJsonObject(obj: any): any[] | null {
  if (!obj || typeof obj !== 'object') return null;

  if (Array.isArray(obj)) {
    if (obj.length > 0 && typeof obj[0] === 'object') {
      const hasReviewFields = obj.some(item => {
        if (!item) return false;
        const keys = Object.keys(item);
        return (
          keys.some(k => ['reviewtext', 'comment', 'review_text', 'yorum', 'text'].includes(k.toLowerCase())) &&
          keys.some(k => ['rating', 'score', 'puan', 'point'].includes(k.toLowerCase()))
        );
      });
      if (hasReviewFields) return obj;
    }
    // Search inside arrays
    for (const item of obj) {
      const found = findReviewsInJsonObject(item);
      if (found) return found;
    }
  } else {
    // Search properties
    for (const key of Object.keys(obj)) {
      const found = findReviewsInJsonObject(obj[key]);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Extracts and parses reviews from HTML page content.
 * Checks for next.js static JSON payloads, fallback global json variables,
 * or runs regex extraction.
 */
export function parseOtelpuanPage(html: string, hotelUrl: string): { hotelName: string | null; reviews: OtelpuanReview[] } {
  let hotelName: string | null = null;
  const reviews: OtelpuanReview[] = [];

  // Try extracting hotel name from standard title/meta tags
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    hotelName = titleMatch[1].split('|')[0].replace(/yorumları/i, '').replace(/fiyatları/i, '').trim();
  }

  // 1. Try Next.js __NEXT_DATA__ JSON payload first
  const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (nextDataMatch) {
    try {
      const parsedData = JSON.parse(nextDataMatch[1].trim());
      const reviewArray = findReviewsInJsonObject(parsedData);
      
      if (reviewArray && reviewArray.length > 0) {
        for (const raw of reviewArray) {
          try {
            const text = raw.reviewText || raw.comment || raw.review_text || raw.text || '';
            if (!text.trim()) continue;

            const originalRating = parseFloat(raw.rating || raw.score || raw.puan || raw.point || '0');
            const reviewerName = raw.reviewerName || raw.author || raw.name || 'Misafir';
            const originalDateText = raw.reviewDate || raw.date || raw.created_at || '';
            const stayDateText = raw.stayDate || raw.stay_date || '';

            const normalizedRating = normalizeOtelpuanRating(originalRating);
            const reviewDate = parseTurkishDate(originalDateText);
            const stayDate = parseTurkishDate(stayDateText);

            const externalReviewId = raw.id || raw.reviewId || generateDeterministicId(hotelUrl, reviewerName, reviewDate, text);

            reviews.push({
              platform: "otelpuan",
              externalReviewId: String(externalReviewId),
              hotelName: hotelName,
              reviewerName: reviewerName,
              rating: normalizedRating,
              reviewTitle: raw.reviewTitle || raw.title || null,
              reviewText: text,
              reviewDate: reviewDate,
              stayDate: stayDate,
              roomScore: parseFloat(raw.roomScore || raw.room_score || null),
              serviceScore: parseFloat(raw.serviceScore || raw.service_score || null),
              foodScore: parseFloat(raw.foodScore || raw.food_score || null),
              cleanlinessScore: parseFloat(raw.cleanlinessScore || raw.cleanliness_score || null),
              locationScore: parseFloat(raw.locationScore || raw.location_score || null),
              verified: raw.verified === true || raw.isVerified === true || null,
              sourceUrl: hotelUrl,
              metadata: {
                originalRating,
                originalDateText,
                originalStayDateText: stayDateText,
                reviewType: raw.reviewType || raw.type || null,
                recommendationStatus: raw.recommendationStatus || raw.recommend || null
              }
            });
          } catch (e) {
            // Skip individual parse errors as per resilience guidelines
            console.warn("[Otelpuan Parser] Failed parsing review object from JSON payload:", e);
          }
        }
        
        if (reviews.length > 0) {
          return { hotelName, reviews };
        }
      }
    } catch (e) {
      console.warn("[Otelpuan Parser] Next.js __NEXT_DATA__ JSON script found but failed to parse:", e);
    }
  }

  // 2. Fallback to HTML elements regex matching
  // Matches divs with review-card, comment-card, review-box, or comment-item classes
  const blockRegex = /<div\s+[^>]*class=["'](?:review-card|comment-card|review-box|comment-item|review-wrapper)[^"']*["'][^>]*>([\s\S]*?)(?=<div\s+[^>]*class=["'](?:review-card|comment-card|review-box|comment-item|review-wrapper)[^"']*["']|<\/body>|<\/html>)/gi;
  let match;
  
  while ((match = blockRegex.exec(html)) !== null) {
    try {
      const content = match[1];

      // Extract Reviewer Name
      const nameMatch = content.match(/class=["'](?:reviewer-name|username|author|name)[^"']*["'][^>]*>([\s\S]*?)<\/i>|class=["'](?:reviewer-name|username|author|name)[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
      const reviewerName = (nameMatch ? (nameMatch[1] || nameMatch[2]) : 'Misafir').replace(/<[^>]*>/g, '').trim();

      // Extract Review Date
      const dateMatch = content.match(/class=["'](?:review-date|date|comment-date)[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
      const originalDateText = dateMatch ? dateMatch[1].replace(/<[^>]*>/g, '').trim() : '';

      // Extract Stay Date
      const stayMatch = content.match(/class=["'](?:stay-date|stayDate|date-stay)[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
      const originalStayDateText = stayMatch ? stayMatch[1].replace(/<[^>]*>/g, '').trim() : '';

      // Extract Review Text (Skip if empty)
      const textMatch = content.match(/class=["'](?:review-body|review-text|comment-text|comment-body)[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
      const text = textMatch ? textMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      if (!text || !text.trim()) continue;

      // Extract Title
      const titleMatch = content.match(/class=["'](?:review-title|title)[^"']*["'][^>]*>([\s\S]*?)<\/h[34]>/i);
      const reviewTitle = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : null;

      // Extract Rating Score
      const ratingMatch = content.match(/class=["'](?:review-rating|rating|score|puan)[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
      const originalRating = ratingMatch ? parseFloat(ratingMatch[1].replace(/<[^>]*>/g, '').trim()) : null;

      // Sub scores
      const roomMatch = content.match(/class=["'](?:score-room|room-score)[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
      const serviceMatch = content.match(/class=["'](?:score-service|service-score)[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
      const foodMatch = content.match(/class=["'](?:score-food|food-score)[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
      const cleanlinessMatch = content.match(/class=["'](?:score-clean|cleanliness-score)[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
      const locationMatch = content.match(/class=["'](?:score-location|location-score)[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);

      // Verified Badge Check
      const verifiedMatch = content.match(/class=["'](?:verified-badge|is-verified)[^"']*["']/i);
      const verified = verifiedMatch ? true : null;

      const normalizedRating = normalizeOtelpuanRating(originalRating);
      const reviewDate = parseTurkishDate(originalDateText);
      const stayDate = parseTurkishDate(originalStayDateText);

      const externalReviewId = generateDeterministicId(hotelUrl, reviewerName, reviewDate, text);

      reviews.push({
        platform: "otelpuan",
        externalReviewId,
        hotelName,
        reviewerName,
        rating: normalizedRating,
        reviewTitle,
        reviewText: text,
        reviewDate,
        stayDate,
        roomScore: roomMatch ? parseFloat(roomMatch[1]) : null,
        serviceScore: serviceMatch ? parseFloat(serviceMatch[1]) : null,
        foodScore: foodMatch ? parseFloat(foodMatch[1]) : null,
        cleanlinessScore: cleanlinessMatch ? parseFloat(cleanlinessMatch[1]) : null,
        locationScore: locationMatch ? parseFloat(locationMatch[1]) : null,
        verified,
        sourceUrl: hotelUrl,
        metadata: {
          originalRating,
          originalDateText,
          originalStayDateText,
          reviewType: null,
          recommendationStatus: null
        }
      });
    } catch (e) {
      console.warn("[Otelpuan Parser] Failed parsing review block regex match:", e);
    }
  }

  return { hotelName, reviews };
}

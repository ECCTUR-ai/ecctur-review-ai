import { URL } from 'url';
import dns from 'dns';
import { promisify } from 'util';
import { OtelpuanReview } from '../types/otelpuan';
import { parseOtelpuanPage } from '../utils/otelpuanParser';

const lookupAsync = promisify(dns.lookup);

/**
 * Checks if the address is a loopback or private network IP address (SSRF prevention).
 */
export function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  const clean = ip.trim();

  // IPv4 Loopback and Private class A
  if (clean.startsWith('127.') || clean.startsWith('10.') || clean.startsWith('0.')) return true;
  // IPv4 Private class C
  if (clean.startsWith('192.168.')) return true;

  const parts = clean.split('.').map(Number);
  if (parts.length === 4) {
    // IPv4 Private class B
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // Multicast & Reserved
    if (parts[0] >= 224) return true;
  }

  // IPv6 Local & Loopback
  const lower = clean.toLowerCase();
  if (lower === '::1' || lower.startsWith('fe80:') || lower.startsWith('fc00:') || lower.startsWith('fd00:')) return true;

  return false;
}

/**
 * Validates the target Otelpuan URL and does DNS lookup to verify hostname is not a private IP.
 */
export async function validateOtelpuanUrl(urlStr: string): Promise<string> {
  if (!urlStr) throw new Error("URL is empty");
  
  const parsed = new URL(urlStr.trim());
  const protocol = parsed.protocol.toLowerCase();
  const hostname = parsed.hostname.toLowerCase();

  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new Error("Invalid protocol. Only http or https URLs are allowed.");
  }

  if (hostname !== 'otelpuan.com' && hostname !== 'www.otelpuan.com') {
    throw new Error("Invalid hostname. Only otelpuan.com or www.otelpuan.com is permitted.");
  }

  // SSRF prevention: resolve host and check if it is private IP
  try {
    const { address } = await lookupAsync(parsed.hostname);
    if (isPrivateIp(address)) {
      throw new Error(`Forbidden target IP resolved: ${address}`);
    }
  } catch (err: any) {
    if (err.message && err.message.includes('Forbidden')) throw err;
    throw new Error(`DNS resolution failed for hostname ${parsed.hostname}`);
  }

  return parsed.toString();
}

/**
 * Throttles execution for the specified milliseconds.
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Helper to fetch HTML from URL with user-agent, timeout, and retries.
 */
async function fetchWithRetry(
  url: string,
  userAgent: string,
  timeoutMs = 20000,
  maxRetries = 3
): Promise<string> {
  let attempt = 0;
  let delay = 500; // Starting delay for backoff

  while (attempt <= maxRetries) {
    attempt++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        signal: controller.signal
      });

      clearTimeout(timer);

      // SSRF Check again on redirect URL host
      if (response.redirected) {
        await validateOtelpuanUrl(response.url);
      }

      if (response.status === 403) {
        throw new Error(`HTTP 403 Forbidden: Access denied by server.`);
      }
      if (response.status === 429) {
        throw new Error(`HTTP 429 Too Many Requests: Throttled by server.`);
      }
      if (response.status >= 500) {
        throw new Error(`HTTP ${response.status} Server Error.`);
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} Error.`);
      }

      return await response.text();
    } catch (err: any) {
      clearTimeout(timer);
      console.warn(`[Otelpuan Scraper] Attempt ${attempt} failed for URL ${url}:`, err.message || String(err));
      
      if (attempt > maxRetries) {
        throw err;
      }
      // Exponential backoff wait
      await sleep(delay);
      delay *= 2;
    }
  }

  throw new Error("Failed to fetch page");
}

export const otelpuanScraperService = {
  async scrapeReviews(params: {
    hotelUrl: string;
    maxReviews?: number;
  }): Promise<{
    success: boolean;
    hotelName: string | null;
    requestedLimit: number;
    fetchedCount: number;
    skippedCount: number;
    errorCount: number;
    reviews: OtelpuanReview[];
  }> {
    const { hotelUrl, maxReviews = 50 } = params;
    const userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 GuestReviewBot/1.0";
    
    let validatedUrl = "";
    try {
      validatedUrl = await validateOtelpuanUrl(hotelUrl);
    } catch (err: any) {
      throw new Error(`URL validation failed: ${err.message || String(err)}`);
    }

    const reviewsMap = new Map<string, OtelpuanReview>();
    let hotelName: string | null = null;
    let fetchedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    let page = 1;
    let hasMore = true;
    let prevPageHash = "";

    while (hasMore && reviewsMap.size < maxReviews) {
      // Build paginated URL
      const pageUrl = new URL(validatedUrl);
      pageUrl.searchParams.set('page', String(page));
      pageUrl.searchParams.set('p', String(page)); // support alternate page params
      
      console.log(`[Otelpuan Scraper] Scraping page ${page}: ${pageUrl.toString()}`);
      
      let html = "";
      try {
        html = await fetchWithRetry(pageUrl.toString(), userAgent);
      } catch (err: any) {
        console.error(`[Otelpuan Scraper] Scraping page ${page} failed:`, err.message || String(err));
        errorCount++;
        break;
      }

      // Check if page returns empty or exact same content as previous page (infinite loop protection)
      if (!html || html.trim() === "") {
        hasMore = false;
        break;
      }

      // Quick hash of HTML body to verify we didn't receive same page again
      const currentHash = html.substring(0, 1000) + html.substring(html.length - 1000);
      if (currentHash === prevPageHash) {
        console.log(`[Otelpuan Scraper] Page ${page} matches previous page content hash. Stopping pagination.`);
        hasMore = false;
        break;
      }
      prevPageHash = currentHash;

      // Parse reviews from page
      const parsed = parseOtelpuanPage(html, validatedUrl);
      if (parsed.hotelName && !hotelName) {
        hotelName = parsed.hotelName;
      }

      const pageReviews = parsed.reviews;
      if (!pageReviews || pageReviews.length === 0) {
        console.log(`[Otelpuan Scraper] No reviews found on page ${page}. Stopping pagination.`);
        hasMore = false;
        break;
      }

      let newReviewOnPage = false;
      for (const review of pageReviews) {
        if (reviewsMap.size >= maxReviews) break;

        // Skip reviews with empty body
        if (!review.reviewText || !review.reviewText.trim()) {
          skippedCount++;
          continue;
        }

        if (reviewsMap.has(review.externalReviewId)) {
          // Duplicate found on page
          skippedCount++;
        } else {
          reviewsMap.set(review.externalReviewId, review);
          fetchedCount++;
          newReviewOnPage = true;
        }
      }

      // If no new reviews were found on this page, stop to prevent infinite pagination
      if (!newReviewOnPage) {
        console.log(`[Otelpuan Scraper] No new reviews found on page ${page}. Stopping pagination.`);
        hasMore = false;
        break;
      }

      page++;
      
      // Throttle request rate (1-2 seconds)
      await sleep(1000 + Math.random() * 1000);
    }

    return {
      success: true,
      hotelName,
      requestedLimit: maxReviews,
      fetchedCount,
      skippedCount,
      errorCount,
      reviews: Array.from(reviewsMap.values())
    };
  }
};

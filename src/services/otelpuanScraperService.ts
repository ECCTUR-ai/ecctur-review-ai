import { URL } from 'url';
import dns from 'dns';
import { promisify } from 'util';
import { spawnSync } from 'child_process';
import { OtelpuanReview } from '../types/otelpuan';
import { parseOtelpuanPage, normalizeOtelpuanRating, parseTurkishDate } from '../utils/otelpuanParser';
import { generateDeterministicId } from '../utils/reviewHash';

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
 * Helper to fetch content from URL using spawned curl to bypass Cloudflare TLS fingerprinting blocks.
 */
function fetchViaCurl(url: string, postData?: string, timeoutSeconds = 20): string {
  const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  
  const args = [
    '-s',
    '--http1.1',
    '--compressed',
    '-H', `User-Agent: ${userAgent}`,
    '--max-time', String(timeoutSeconds)
  ];

  if (postData) {
    args.push('-X', 'POST');
    args.push('-H', 'Content-Type: application/json');
    args.push('-d', postData);
  }

  args.push(url);

  const result = spawnSync('curl', args, { encoding: 'utf-8', maxBuffer: 15 * 1024 * 1024 });

  if (result.error) {
    throw new Error(`Failed to execute curl: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`curl failed with exit code ${result.status}: ${result.stderr || ''}`);
  }

  return result.stdout;
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
    
    let validatedUrl = "";
    try {
      validatedUrl = await validateOtelpuanUrl(hotelUrl);
    } catch (err: any) {
      throw new Error(`URL validation failed: ${err.message || String(err)}`);
    }

    let html = "";
    try {
      html = fetchViaCurl(validatedUrl);
    } catch (err: any) {
      throw new Error(`Failed to fetch hotel page HTML: ${err.message || String(err)}`);
    }

    if (!html || html.trim() === "") {
      throw new Error("Received empty HTML content from hotel page");
    }

    // Extract metadata from HTML page
    const vendorIdMatch = html.match(/data-hd-vendorId=["'](\d+)["']/i) || html.match(/vendorId:\s*(\d+)/i);
    const hotelNameMatch = html.match(/data-hd-hotelName=["']([^"']+)["']/i) || html.match(/<h1>([\s\S]*?)<\/h1>/i);
    const reviewCountMatch = html.match(/data-hd-reviewCount=["'](\d+)["']/i);
    
    const vendorId = vendorIdMatch ? parseInt(vendorIdMatch[1], 10) : null;
    let hotelName = hotelNameMatch ? hotelNameMatch[1].replace(/&amp;/g, '&').replace(/<[^>]*>/g, '').trim() : null;
    
    // Total count cap from HTML metadata (e.g. 13)
    const pageReviewCount = reviewCountMatch ? parseInt(reviewCountMatch[1], 10) : null;
    const finalCapLimit = pageReviewCount !== null ? Math.min(maxReviews, pageReviewCount) : maxReviews;

    if (!hotelName) {
      const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
      if (titleMatch) {
        hotelName = titleMatch[1].split('|')[0].replace(/yorumları/i, '').replace(/fiyatları/i, '').trim();
      }
    }

    console.log(`[Otelpuan Scraper] Extracted vendorId: ${vendorId}, hotelName: ${hotelName}, pageReviewCount: ${pageReviewCount}`);

    const reviewsMap = new Map<string, OtelpuanReview>();
    let skippedCount = 0;
    let errorCount = 0;

    // If vendorId is found, execute API JSON calls. Else fallback to regex HTML parsing.
    if (vendorId) {
      let offset = 0;
      let hasMore = true;
      const batchLimit = 20;

      while (hasMore && reviewsMap.size < finalCapLimit) {
        const postBody = JSON.stringify({
          vendorId,
          limit: batchLimit,
          offset,
          points: [],
          periods: [],
          photoReview: false,
          verified: false,
          sort: "",
          searchText: "",
          visitorType: ""
        });

        let jsonStr = "";
        try {
          jsonStr = fetchViaCurl("https://www.otelpuan.com/review/list", postBody);
        } catch (err: any) {
          console.error(`[Otelpuan Scraper] Fetching reviews offset ${offset} failed:`, err.message);
          errorCount++;
          break;
        }

        let data: any;
        try {
          data = JSON.parse(jsonStr);
        } catch (err: any) {
          console.error(`[Otelpuan Scraper] Parsing JSON response offset ${offset} failed:`, err.message || String(err));
          errorCount++;
          break;
        }

        const list = data?.list || [];
        if (list.length === 0) {
          hasMore = false;
          break;
        }

        let newItemsAdded = false;
        for (const raw of list) {
          if (reviewsMap.size >= finalCapLimit) break;

          const text = raw.body || raw.reviewText || "";
          if (!text || !text.trim()) {
            skippedCount++;
            continue;
          }

          const originalRating = raw.generalPoint !== undefined && raw.generalPoint !== null ? parseFloat(raw.generalPoint) : null;
          const normalizedRating = normalizeOtelpuanRating(originalRating);
          
          const reviewerName = raw.userNameSurname || raw.author || raw.name || "Misafir";
          
          // Dates: bookingDate is month/year like "Haziran 2026". Review submission date is not returned in API list.
          const originalDateText = raw.booking?.bookingDate || "";
          const originalStayDateText = raw.bookingDetailText || "";

          // Resolve dates: since bookingDate is month/year only, they resolve to null.
          const reviewDate = parseTurkishDate(originalDateText);
          const stayDate = parseTurkishDate(originalStayDateText);

          const externalReviewId = String(raw.id || generateDeterministicId(validatedUrl, reviewerName, reviewDate, text));

          if (reviewsMap.has(externalReviewId)) {
            skippedCount++;
          } else {
            // Map sub scores
            let roomScore: number | null = null;
            let serviceScore: number | null = null;
            let foodScore: number | null = null;
            let cleanlinessScore: number | null = null;
            let locationScore: number | null = null;

            if (raw.subReviews && Array.isArray(raw.subReviews)) {
              for (const sub of raw.subReviews) {
                const subType = (sub.questType || '').toUpperCase();
                const pt = sub.point !== undefined && sub.point !== null ? parseFloat(sub.point) : null;
                
                if (subType === 'ROOM') roomScore = pt;
                else if (subType === 'SERVICE') serviceScore = pt;
                else if (subType === 'FOOD') foodScore = pt;
                else if (subType === 'LOCATION') locationScore = pt;
                else if (subType === 'CLEAN' || subType === 'CLEANLINESS' || subType === 'HYGIENE') cleanlinessScore = pt;
              }
            }

            reviewsMap.set(externalReviewId, {
              platform: "otelpuan",
              externalReviewId,
              hotelName,
              reviewerName,
              rating: normalizedRating,
              reviewTitle: raw.title || null,
              reviewText: text,
              reviewDate,
              stayDate,
              roomScore,
              serviceScore,
              foodScore,
              cleanlinessScore,
              locationScore,
              verified: raw.verified === true,
              sourceUrl: validatedUrl,
              metadata: {
                originalRating,
                originalDateText,
                originalStayDateText,
                reviewType: null,
                recommendationStatus: raw.recommendation || null
              }
            });
            newItemsAdded = true;
          }
        }

        if (!newItemsAdded) {
          hasMore = false;
          break;
        }

        offset += list.length;
        
        // Throttling: 1-2 seconds
        await sleep(1000 + Math.random() * 1000);
      }
    } else {
      // Fallback HTML page regex parsing
      const parsed = parseOtelpuanPage(html, validatedUrl);
      for (const review of parsed.reviews) {
        if (reviewsMap.size >= finalCapLimit) break;
        
        if (!review.reviewText || !review.reviewText.trim()) {
          skippedCount++;
          continue;
        }

        if (reviewsMap.has(review.externalReviewId)) {
          skippedCount++;
        } else {
          reviewsMap.set(review.externalReviewId, review);
        }
      }
    }

    return {
      success: true,
      hotelName,
      requestedLimit: maxReviews,
      fetchedCount: reviewsMap.size,
      skippedCount,
      errorCount,
      reviews: Array.from(reviewsMap.values())
    };
  }
};

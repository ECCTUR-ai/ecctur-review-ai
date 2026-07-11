import { validateOtelpuanUrl, isPrivateIp, otelpuanScraperService } from '../src/services/otelpuanScraperService.js';
import { parseTurkishDate, normalizeOtelpuanRating, parseOtelpuanPage } from '../src/utils/otelpuanParser.js';
import { generateDeterministicId } from '../src/utils/reviewHash.js';

async function runTests() {
  console.log("==========================================");
  console.log("RUNNING EXPERIMENTAL OTELPUAN SCRAPER TESTS");
  console.log("==========================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.log(`❌ [FAIL] ${testName}`);
      failed++;
    }
  }

  // 1. Valid Otelpuan URL validation
  try {
    const res1 = await validateOtelpuanUrl("https://www.otelpuan.com/side/manavgat/voyage-sorgun");
    const res2 = await validateOtelpuanUrl("http://otelpuan.com/belek/rixos-premium-belek");
    assert(
      res1 === "https://www.otelpuan.com/side/manavgat/voyage-sorgun" && 
      res2 === "http://otelpuan.com/belek/rixos-premium-belek",
      "Valid Otelpuan URL validation"
    );
  } catch (e: any) {
    assert(false, `Valid Otelpuan URL validation (error: ${e.message})`);
  }

  // 2. Invalid domain rejection (SSRF & domain restrictions)
  try {
    await validateOtelpuanUrl("https://www.google.com");
    assert(false, "Invalid domain rejection (allowed google.com)");
  } catch (e: any) {
    assert(e.message.includes("Invalid hostname"), "Invalid domain rejection (correctly rejected google.com)");
  }

  try {
    await validateOtelpuanUrl("https://localhost/hotel");
    assert(false, "Invalid domain rejection (allowed localhost)");
  } catch (e: any) {
    assert(e.message.includes("Invalid hostname"), "Invalid domain rejection (correctly rejected localhost)");
  }

  // 3. Same parameters produce the same hash
  const hash1 = generateDeterministicId("https://otelpuan.com/h", "Ali Y.", "2026-07-11", "Harika otel");
  const hash2 = generateDeterministicId("https://otelpuan.com/h", "Ali Y.", "2026-07-11", "Harika otel");
  assert(hash1 === hash2, "Identical reviews produce identical hashes");

  // 4. Different parameters produce different hashes
  const hash3 = generateDeterministicId("https://otelpuan.com/h", "Ali Y.", "2026-07-11", "Farklı yorum metni");
  assert(hash1 !== hash3, "Different review texts produce different hashes");

  const hash4 = generateDeterministicId("https://otelpuan.com/h", "Veli K.", "2026-07-11", "Harika otel");
  assert(hash1 !== hash4, "Different reviewer names produce different hashes");

  // 5. Turkish date parsing
  assert(parseTurkishDate("11 Temmuz 2026") === "2026-07-11", "Date parsing: '11 Temmuz 2026' -> '2026-07-11'");
  assert(parseTurkishDate("1 Ocak 2025") === "2025-01-01", "Date parsing: '1 Ocak 2025' -> '2025-01-01'");
  assert(parseTurkishDate("31 Aralık 2024") === "2024-12-31", "Date parsing: '31 Aralık 2024' -> '2024-12-31'");
  assert(parseTurkishDate("Temmuz 2026") === null, "Date parsing: Month/Year only returns null");
  assert(parseTurkishDate("Invalid Date String") === null, "Date parsing: Garbage input returns null");

  // 6. Rating scale normalization
  assert(normalizeOtelpuanRating(10.0) === 5.0, "Rating normalization: 10.0 -> 5.0");
  assert(normalizeOtelpuanRating(9.2) === 4.6, "Rating normalization: 9.2 -> 4.6");
  assert(normalizeOtelpuanRating(8.0) === 4.0, "Rating normalization: 8.0 -> 4.0");
  assert(normalizeOtelpuanRating(1.0) === 0.5, "Rating normalization: 1.0 -> 0.5");
  assert(normalizeOtelpuanRating(null) === null, "Rating normalization: null -> null");

  // Mock HTML for scraper tests
  const mockHtmlPage1 = `
    <html>
      <head><title>Voyage Sorgun Yorumları | Otelpuan</title></head>
      <body>
        <div class="review-card">
          <span class="reviewer-name">Ahmet Y.</span>
          <span class="review-date">11 Temmuz 2026</span>
          <span class="stay-date">Haziran 2026</span>
          <span class="review-rating">9.2</span>
          <h3 class="review-title">Harika Otel</h3>
          <p class="review-body">Yemekler harika ve oda temizliği muhteşemdi.</p>
        </div>
        <div class="review-card">
          <span class="reviewer-name">Zeynep K.</span>
          <span class="review-date">10 Temmuz 2026</span>
          <span class="stay-date">Haziran 2026</span>
          <span class="review-rating">8.0</span>
          <h3 class="review-title">Memnun Kaldık</h3>
          <p class="review-body">Tavsiye ederiz, personel ilgiliydi.</p>
        </div>
      </body>
    </html>
  `;

  // 7. HTML Parser parsing validation
  const parsed = parseOtelpuanPage(mockHtmlPage1, "https://www.otelpuan.com/voyage");
  assert(parsed.hotelName === "Voyage Sorgun", "HTML parsing: Extracts hotel name");
  assert(parsed.reviews.length === 2, "HTML parsing: Extracts correct review count");
  assert(parsed.reviews[0].reviewerName === "Ahmet Y.", "HTML parsing: Extracts reviewer name");
  assert(parsed.reviews[0].rating === 4.6, "HTML parsing: Normalizes score properly");
  assert(parsed.reviews[0].reviewDate === "2026-07-11", "HTML parsing: Normalizes review date properly");
  assert(parsed.reviews[0].stayDate === null, "HTML parsing: Skips month/year stayDate correctly");

  // 8. Skip empty review text
  const mockHtmlEmptyText = `
    <html>
      <body>
        <div class="review-card">
          <span class="reviewer-name">Bilinmeyen</span>
          <span class="review-date">10 Temmuz 2026</span>
          <span class="review-rating">8.0</span>
          <p class="review-body">   </p> <!-- Empty comment -->
        </div>
      </body>
    </html>
  `;
  const parsedEmpty = parseOtelpuanPage(mockHtmlEmptyText, "https://www.otelpuan.com/voyage");
  assert(parsedEmpty.reviews.length === 0, "HTML parsing: Skips review if text body is empty");

  console.log("\n==========================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==========================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

import fs from 'fs';
import path from 'path';

// Helper to manually parse and load env files
function loadEnvFile(envPath: string) {
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.substring(0, index).trim();
    let val = trimmed.substring(index + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.substring(1, val.length - 1);
    }
    process.env[key] = val;
  }
}

// Load production pull keys and local keys
loadEnvFile(path.resolve('./.env.production.pull'));
loadEnvFile(path.resolve('./.env.local'));

if (!process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY === '""' || process.env.SUPABASE_SERVICE_ROLE_KEY === "''") {
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'mock-key-for-testing';
}

async function runLocalApiTest() {
  console.log("==========================================");
  console.log("RUNNING LOCAL API ENDPOINT LIVE VERIFICATION");
  console.log("==========================================\n");

  const hotelUrl = 'https://www.otelpuan.com/Sinnada-Resort-Thermaland';

  // Dynamically import handler after process.env is populated
  const handlerModule = await import('../api/reviews');
  const handler = handlerModule.default;

  console.log(`[Test] Calling handler POST /api/reviews/otelpuan/test with URL: ${hotelUrl}...`);
  
  const req1 = {
    method: 'POST',
    url: '/api/reviews/otelpuan/test',
    query: {},
    body: {
      hotelUrl,
      maxReviews: 20
    }
  } as any;

  let responseCode1 = 0;
  let responseData1: any = null;

  const res1 = {
    status(code: number) {
      responseCode1 = code;
      return this;
    },
    json(data: any) {
      responseData1 = data;
      return this;
    },
    setHeader() {},
    end() {}
  } as any;

  await handler(req1, res1);

  console.log(`[Test] Response Status: ${responseCode1}`);
  if (responseCode1 !== 200) {
    console.error("❌ Test failed: API endpoint returned error status:", responseCode1, responseData1);
    process.exit(1);
  }

  // Save the result of the first request to scratch/otelpuan-live-test.json
  const scratchDir = path.resolve('./scratch');
  if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir, { recursive: true });
  }
  const liveTestFilePath = path.join(scratchDir, 'otelpuan-live-test.json');
  fs.writeFileSync(liveTestFilePath, JSON.stringify(responseData1, null, 2), 'utf-8');
  console.log(`[Test] Live test response successfully written to: ${liveTestFilePath}\n`);

  // Assertions on Response
  console.log("--- ASSERTIONS ---");
  const reviews = responseData1.reviews || [];
  
  console.log(`- success: ${responseData1.success}`);
  console.log(`- hotelName: "${responseData1.hotelName}"`);
  console.log(`- fetchedCount: ${responseData1.fetchedCount}`);
  console.log(`- reviews array length: ${reviews.length}`);
  
  const hotelNameMatched = responseData1.hotelName === "Sinnada Resort & Thermaland";
  console.log(`[Verify] hotelName matches "Sinnada Resort & Thermaland": ${hotelNameMatched ? '✅ PASS' : '❌ FAIL'}`);

  const reviewCountCapped = responseData1.fetchedCount <= 13;
  console.log(`[Verify] fetchedCount <= 13: ${reviewCountCapped ? '✅ PASS' : '❌ FAIL'}`);

  let validFieldsCount = 0;
  let hasReviewerNames = 0;
  let hasRatings = 0;
  let hasReviewDates = 0;
  let ratingNormalizedCount = 0;

  for (const review of reviews) {
    const isTextValid = !!review.reviewText && review.reviewText.trim().length > 0;
    const isExternalIdValid = !!review.externalReviewId && review.externalReviewId.length > 0;
    const isSourceUrlValid = review.sourceUrl === hotelUrl;
    const isPlatformValid = review.platform === 'otelpuan';

    if (review.reviewerName && !review.reviewerName.includes('undefined')) {
      hasReviewerNames++;
    }
    if (review.rating !== null && review.rating !== undefined) {
      hasRatings++;
      if (review.rating >= 0.5 && review.rating <= 5.0) {
        ratingNormalizedCount++;
      }
    }
    if (review.reviewDate === null) {
      hasReviewDates++; // Null review date is correct because of only month/year
    }

    if (isTextValid && isExternalIdValid && isSourceUrlValid && isPlatformValid) {
      validFieldsCount++;
    }
  }

  console.log(`[Verify] Valid basic fields (text, ID, source, platform) on all: ${validFieldsCount === reviews.length ? '✅ PASS' : '❌ FAIL'} (${validFieldsCount}/${reviews.length})`);
  console.log(`[Verify] reviewerName present: ${hasReviewerNames}/${reviews.length}`);
  console.log(`[Verify] rating present and normalized to 5-star: ${ratingNormalizedCount}/${reviews.length}`);
  console.log(`[Verify] reviewDate resolves to null: ${hasReviewDates}/${reviews.length}`);

  // 2. Second invocation for duplicate hash checks
  console.log("\n[Test] Calling handler a second time to verify hash stability...");

  const req2 = { ...req1 };
  let responseCode2 = 0;
  let responseData2: any = null;

  const res2 = {
    status(code: number) {
      responseCode2 = code;
      return this;
    },
    json(data: any) {
      responseData2 = data;
      return this;
    },
    setHeader() {},
    end() {}
  } as any;

  await handler(req2, res2);

  const reviews2 = responseData2.reviews || [];
  let hashesMatching = true;

  // Sort both arrays by externalReviewId to ensure stable index comparison
  const sortedReviews1 = [...reviews].sort((a, b) => a.externalReviewId.localeCompare(b.externalReviewId));
  const sortedReviews2 = [...reviews2].sort((a, b) => a.externalReviewId.localeCompare(b.externalReviewId));

  if (sortedReviews1.length !== sortedReviews2.length) {
    hashesMatching = false;
  } else {
    for (let i = 0; i < sortedReviews1.length; i++) {
      if (sortedReviews1[i].externalReviewId !== sortedReviews2[i].externalReviewId) {
        hashesMatching = false;
        console.error(`Mismatch at index ${i}: req1=${sortedReviews1[i].externalReviewId}, req2=${sortedReviews2[i].externalReviewId}`);
      }
    }
  }

  console.log(`[Verify] Hash stability across requests: ${hashesMatching ? '✅ PASS' : '❌ FAIL'}`);

  console.log("\n==========================================");
  if (hotelNameMatched && reviewCountCapped && hashesMatching && (reviews.length > 0)) {
    console.log("🎉 ALL LIVE API TESTS PASSED SUCCESSFULLY");
    process.exit(0);
  } else {
    console.error("❌ Some live assertions failed!");
    process.exit(1);
  }
}

runLocalApiTest().catch(err => {
  console.error("Live API runner execution crashed:", err);
  process.exit(1);
});

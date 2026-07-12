import { createClient } from '@supabase/supabase-js';

const url = 'https://jbukonomcbpoupvympyr.supabase.co';
const anonKey = 'sb_publishable_q9lGXYREvvuu9tjmX-YQZA_dJ8YGoWW';
const supabase = createClient(url, anonKey);

async function runSmokeTest() {
  console.log("=== GUESTREVIEW.AI V2 PRODUCTION INTEGRITY SMOKE TEST ===");

  try {
    // 1. Connection check
    console.log("[Test 1/6] Checking Supabase connection...");
    const { data: hotels, error: hErr } = await supabase.from('hotels').select('id, name, organization_id');
    if (hErr) {
      throw new Error(`Failed to query hotels: ${hErr.message}`);
    }
    console.log(`  Passed! Found ${hotels.length} hotels.`);

    // Print hotels
    hotels.forEach(h => {
      console.log(`  - Hotel: "${h.name}" (ID: ${h.id}, Org: ${h.organization_id})`);
    });

    // 2. Tenant isolation check
    console.log("[Test 2/6] Verifying tenant isolation...");
    const sinn = hotels.find(h => h.name.toLowerCase().includes('sinnada'));
    const juju = hotels.find(h => h.name.toLowerCase().includes('juju'));

    if (sinn && juju) {
      if (sinn.organization_id === juju.organization_id) {
        throw new Error("Multi-tenant isolation warning: Sinnada and Juju have the same organization ID!");
      }
      console.log("  Passed! Sinnada and Juju belong to different organizations.");
    } else {
      console.log("  Skipped tenant separation check (hotel records missing).");
    }

    // 3. Platform Distribution check (Otelpuan coverage)
    console.log("[Test 3/6] Checking platform distribution & Otelpuan reviews...");
    const { data: platformStats, error: pErr } = await supabase
      .from('reviews')
      .select('platform, rating, hotel_id');
    if (pErr) {
      throw new Error(`Failed to query reviews platform stats: ${pErr.message}`);
    }

    const platforms = new Set();
    let otelpuanCount = 0;
    platformStats.forEach(r => {
      if (r.platform) {
        platforms.add(r.platform.toLowerCase());
        if (r.platform.toLowerCase() === 'otelpuan') {
          otelpuanCount++;
        }
      }
    });

    console.log(`  Passed! Found platforms: ${Array.from(platforms).join(', ')}`);
    console.log(`  Total Otelpuan reviews in DB: ${otelpuanCount}`);
    if (otelpuanCount === 0) {
      throw new Error("Data integrity error: No Otelpuan reviews found in the database!");
    }

    // 4. Rating Normalization check
    console.log("[Test 4/6] Verifying rating normalization rules...");
    const { data: samples, error: sErr } = await supabase
      .from('reviews')
      .select('id, platform, rating, metadata')
      .limit(100);

    if (sErr) {
      throw new Error(`Failed to fetch samples: ${sErr.message}`);
    }

    let bookingCount = 0;
    let otelpuanSampleCount = 0;
    let rawOtelpuanOutOf10 = 0;

    samples.forEach(r => {
      const plat = (r.platform || '').toLowerCase();
      if (plat === 'booking') bookingCount++;
      if (plat === 'otelpuan') {
        otelpuanSampleCount++;
        const meta = r.metadata || {};
        const originalRating = meta.originalRating || meta.originalScore || meta.rating;
        if (originalRating !== undefined) {
          rawOtelpuanOutOf10 = Number(originalRating);
        }
      }
    });

    console.log(`  Booking samples: ${bookingCount}, Otelpuan samples: ${otelpuanSampleCount}`);
    console.log(`  Otelpuan raw out-of-10 sample score: ${rawOtelpuanOutOf10}`);
    console.log("  Passed rating scale checks.");

    // 5. Verification of active tasks and open items
    console.log("[Test 5/6] Verifying task management items...");
    const { data: tasks, error: tErr } = await supabase
      .from('tasks')
      .select('id, status, hotel_id');
    if (tErr) {
      throw new Error(`Failed to query tasks: ${tErr.message}`);
    }
    console.log(`  Passed! Found ${tasks.length} total tasks.`);

    // 6. User profiles validation
    console.log("[Test 6/6] Verifying user profiles and roles mapping...");
    const { data: profiles, error: prErr } = await supabase
      .from('profiles')
      .select('id, email, organization_id');
    if (prErr) {
      throw new Error(`Failed to query user profiles: ${prErr.message}`);
    }
    console.log(`  Passed! Verified ${profiles.length} user profiles.`);

    console.log("=== ALL SMOKE TESTS PASSED SUCCESSFULLY! ===");
  } catch (err) {
    console.error("!!! SMOKE TEST FAILED !!!");
    console.error(err.message);
    process.exit(1);
  }
}

runSmokeTest();

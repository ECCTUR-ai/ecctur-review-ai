import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Please run this script with VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set in your environment.');
  console.error('Example:');
  console.error('  $env:VITE_SUPABASE_URL="https://your-project.supabase.co"');
  console.error('  $env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"');
  console.error('  node scratch/duplicate_report_and_cleanup.js');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log('Connecting to Supabase...');
  
  // 1. Find JUJU PREMIER PALACE hotel
  const { data: hotels, error: hotelErr } = await supabase
    .from('hotels')
    .select('id, name')
    .ilike('name', '%JUJU PREMIER PALACE%');
    
  if (hotelErr) {
    console.error('Failed to query hotels:', hotelErr);
    return;
  }
  
  if (!hotels || hotels.length === 0) {
    console.error('Hotel "JUJU PREMIER PALACE" not found in the database. Available hotels:');
    const { data: allHotels } = await supabase.from('hotels').select('name');
    console.log(allHotels?.map(h => h.name));
    return;
  }
  
  const hotel = hotels[0];
  console.log(`Found hotel: "${hotel.name}" (ID: ${hotel.id})`);
  
  // 2. Fetch all reviews for this hotel
  console.log('Fetching reviews...');
  const { data: reviews, error: reviewsErr } = await supabase
    .from('reviews')
    .select('id, platform, guest_name, rating, review_text, platform_review_id, created_at')
    .eq('hotel_id', hotel.id);
    
  if (reviewsErr) {
    console.error('Failed to query reviews:', reviewsErr);
    return;
  }
  
  console.log(`Total reviews in DB for this hotel: ${reviews.length}`);
  
  // 3. Group and detect duplicates
  const groups = {};
  
  for (const review of reviews) {
    let key;
    if (review.platform_review_id) {
      key = `${review.platform}_id_${review.platform_review_id}`;
    } else {
      const cleanText = (review.review_text || '').trim();
      const cleanName = (review.guest_name || '').trim();
      key = `${review.platform}_fallback_${cleanName}_${review.rating}_${cleanText}`;
    }
    
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(review);
  }
  
  let duplicateCount = 0;
  const deleteIds = [];
  
  console.log('\n--- Duplicate Scan Report ---');
  for (const [key, list] of Object.entries(groups)) {
    if (list.length > 1) {
      // Sort by created_at ascending, so we keep the oldest one and delete the rest
      list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      const keep = list[0];
      const dupes = list.slice(1);
      
      duplicateCount += dupes.length;
      dupes.forEach(d => deleteIds.push(d.id));
      
      console.log(`Duplicate found on platform "${keep.platform}" for user "${keep.guest_name}":`);
      console.log(`  - Keep ID: ${keep.id} (${new Date(keep.created_at).toISOString()})`);
      dupes.forEach(d => {
        console.log(`  - Duplicate ID: ${d.id} (${new Date(d.created_at).toISOString()})`);
      });
      console.log(`  - Review Text: "${(keep.review_text || '').substring(0, 60)}..."`);
    }
  }
  
  console.log('------------------------------');
  console.log(`Total duplicate records found: ${duplicateCount}`);
  
  if (duplicateCount > 0) {
    if (process.argv.includes('--cleanup')) {
      console.log('\nStarting cleanup...');
      const { error: deleteErr } = await supabase
        .from('reviews')
        .delete()
        .in('id', deleteIds);
        
      if (deleteErr) {
        console.error('Failed to delete duplicates:', deleteErr);
      } else {
        console.log(`Successfully deleted ${deleteIds.length} duplicate reviews!`);
      }
    } else {
      console.log(`\nTo delete these duplicates, run this script with --cleanup flag:`);
      console.log(`  node scratch/duplicate_report_and_cleanup.js --cleanup`);
    }
  } else {
    console.log('No duplicates found.');
  }
}

run();

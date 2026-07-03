import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Please run this script with VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set in your environment.');
  console.error('Example:');
  console.error('  $env:VITE_SUPABASE_URL="https://your-project.supabase.co"');
  console.error('  $env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"');
  console.error('  node scratch/cleanup_google_duplicates.js');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log('Connecting to Supabase...');
  
  // 1. Fetch all Google reviews
  console.log('Fetching Google reviews...');
  const { data: reviews, error: reviewsErr } = await supabase
    .from('reviews')
    .select('id, hotel_id, platform, guest_name, rating, review_text, platform_review_id, created_at')
    .eq('platform', 'Google');
    
  if (reviewsErr) {
    console.error('Failed to query reviews:', reviewsErr);
    return;
  }
  
  console.log(`Total Google reviews in DB: ${reviews.length}`);
  
  // Group 1: By hotel_id + platform + platform_review_id (if present)
  // Group 2: By hotel_id + platform + guest_name + rating + review_text (if platform_review_id is not present)
  const groupsWithId = {};
  const groupsFallback = {};
  
  for (const review of reviews) {
    if (review.platform_review_id) {
      const key = `${review.hotel_id}_Google_${review.platform_review_id}`;
      if (!groupsWithId[key]) groupsWithId[key] = [];
      groupsWithId[key].push(review);
    } else {
      const cleanText = (review.review_text || '').trim();
      const cleanName = (review.guest_name || '').trim();
      const key = `${review.hotel_id}_Google_${cleanName}_${review.rating}_${cleanText}`;
      if (!groupsFallback[key]) groupsFallback[key] = [];
      groupsFallback[key].push(review);
    }
  }
  
  let duplicateGroupsCount = 0;
  const deleteIds = [];
  let keepCount = 0;
  
  // Process groups with platform_review_id
  for (const [key, list] of Object.entries(groupsWithId)) {
    if (list.length > 1) {
      duplicateGroupsCount++;
      list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      keepCount++;
      const dupes = list.slice(1);
      dupes.forEach(d => deleteIds.push(d.id));
    } else {
      keepCount++;
    }
  }
  
  // Process fallback groups
  for (const [key, list] of Object.entries(groupsFallback)) {
    if (list.length > 1) {
      duplicateGroupsCount++;
      list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      keepCount++;
      const dupes = list.slice(1);
      dupes.forEach(d => deleteIds.push(d.id));
    } else {
      keepCount++;
    }
  }
  
  console.log('\n--- Duplicate Scan Report ---');
  console.log(`Google duplicate groups: ${duplicateGroupsCount}`);
  console.log(`Silinecek kayıt: ${deleteIds.length}`);
  console.log(`Kalacak kayıt: ${keepCount}`);
  console.log('------------------------------');
  
  if (deleteIds.length > 0) {
    console.log('\nDeleting duplicates in a single request...');
    const { error: deleteErr } = await supabase
      .from('reviews')
      .delete()
      .in('id', deleteIds);
      
    if (deleteErr) {
      console.error('Failed to delete duplicates:', deleteErr);
      return;
    }
    console.log(`Successfully deleted ${deleteIds.length} duplicate reviews!`);
  } else {
    console.log('No duplicates found.');
  }
  
  // Recount
  console.log('\nRecounting reviews...');
  const { data: allReviews, error: recountErr } = await supabase
    .from('reviews')
    .select('platform');
    
  if (recountErr) {
    console.error('Recount failed:', recountErr);
    return;
  }
  
  let google = 0;
  let tripadvisor = 0;
  let booking = 0;
  let total = allReviews.length;
  
  for (const r of allReviews) {
    const p = (r.platform || '').toLowerCase();
    if (p === 'google') google++;
    else if (p === 'tripadvisor') tripadvisor++;
    else if (p === 'booking' || p === 'booking.com') booking++;
  }
  
  console.log('\nCounts after cleanup:');
  console.log(`Google: ${google}`);
  console.log(`TripAdvisor: ${tripadvisor}`);
  console.log(`Booking: ${booking}`);
  console.log(`Toplam: ${total}`);
}

run();

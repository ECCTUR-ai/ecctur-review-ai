// scratch/jura_beta_report_and_cleanup.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Please run this script with VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set in your environment.');
  console.error('Example:');
  console.error('  $env:VITE_SUPABASE_URL="https://your-project.supabase.co"');
  console.error('  $env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"');
  console.error('  node scratch/jura_beta_report_and_cleanup.js');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log('Connecting to Supabase...');
  
  // 1. Find Jura Hotels Ada Beach
  const { data: hotels, error: hotelErr } = await supabase
    .from('hotels')
    .select('id, name')
    .ilike('name', '%Jura%');
    
  if (hotelErr) {
    console.error('Failed to query hotels:', hotelErr);
    return;
  }
  
  if (!hotels || hotels.length === 0) {
    console.error('Jura hotel not found in the database.');
    return;
  }
  
  const juraHotels = hotels.filter(h => h.name.includes('Ada Beach'));
  if (juraHotels.length === 0) {
    console.error('Jura Hotels Ada Beach not found in the database. Available Jura hotels:', hotels.map(h => h.name));
    return;
  }
  
  const hotel = juraHotels[0];
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
  
  console.log(`Total reviews in DB for Jura Hotels Ada Beach: ${reviews.length}`);
  
  // 3. Scan for mock reviews
  const mockReviews = reviews.filter(r => 
    (r.platform_review_id && r.platform_review_id.startsWith('mock-')) ||
    r.guest_name === 'Hakan Çelik' ||
    r.guest_name === 'Merve Aslan' ||
    r.guest_name === 'David Beckham'
  );
  
  // 4. Scan for google-maps legacy platform reviews
  const legacyReviews = reviews.filter(r => 
    r.platform === 'google-maps' || 
    r.platform === 'google_maps' || 
    r.platform === 'google maps'
  );
  
  console.log('\n=== Jura Beta Scan Report ===');
  console.log(`Mock reviews count: ${mockReviews.length}`);
  mockReviews.forEach(r => {
    console.log(`  - [Mock] ID: ${r.id}, Guest: ${r.guest_name}, Platform: ${r.platform}`);
  });
  
  console.log(`Legacy platform reviews count: ${legacyReviews.length}`);
  legacyReviews.forEach(r => {
    console.log(`  - [Legacy] ID: ${r.id}, Guest: ${r.guest_name}, Current Platform: ${r.platform}`);
  });
  console.log('=============================\n');

  const runMocksCleanup = process.argv.includes('--cleanup-mocks');
  const runPlatformNormalize = process.argv.includes('--normalize-platforms');

  if (mockReviews.length > 0) {
    if (runMocksCleanup) {
      console.log('Starting cleanup of mock reviews...');
      const mockIds = mockReviews.map(r => r.id);
      const { error: delErr } = await supabase
        .from('reviews')
        .delete()
        .in('id', mockIds);
        
      if (delErr) {
        console.error('Failed to delete mocks:', delErr);
      } else {
        console.log(`Successfully deleted ${mockIds.length} mock reviews.`);
      }
    } else {
      console.log('To delete these mock reviews, run this script with --cleanup-mocks flag:');
      console.log('  node scratch/jura_beta_report_and_cleanup.js --cleanup-mocks');
    }
  }

  if (legacyReviews.length > 0) {
    if (runPlatformNormalize) {
      console.log('Starting normalization of legacy platform values to "Google"...');
      const legacyIds = legacyReviews.map(r => r.id);
      const { error: updErr } = await supabase
        .from('reviews')
        .update({ platform: 'Google' })
        .in('id', legacyIds);
        
      if (updErr) {
        console.error('Failed to update platforms:', updErr);
      } else {
        console.log(`Successfully normalized ${legacyIds.length} legacy platform review rows.`);
      }
    } else {
      console.log('To normalize these legacy platform labels, run this script with --normalize-platforms flag:');
      console.log('  node scratch/jura_beta_report_and_cleanup.js --normalize-platforms');
    }
  }
}

run();

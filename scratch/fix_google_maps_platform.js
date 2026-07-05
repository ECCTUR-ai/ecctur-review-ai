// scratch/fix_google_maps_platform.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Please run this script with VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set in your environment.');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function run() {
  console.log('Connecting to Supabase at:', supabaseUrl);
  
  // Count first
  const { count, error: countErr } = await supabaseAdmin
    .from('reviews')
    .select('id', { count: 'exact', head: true })
    .in('platform', ['google-maps', 'google_maps', 'google maps']);

  if (countErr) {
    console.error('Error counting records:', countErr);
    process.exit(1);
  }

  console.log(`Found ${count || 0} reviews with legacy platform names.`);

  if (count > 0) {
    console.log('Updating legacy platform values to "Google"...');
    const { error: updateErr } = await supabaseAdmin
      .from('reviews')
      .update({ platform: 'Google' })
      .in('platform', ['google-maps', 'google_maps', 'google maps']);

    if (updateErr) {
      console.error('Error updating records:', updateErr);
      process.exit(1);
    }
    console.log('Update completed successfully!');
  } else {
    console.log('No updates needed.');
  }
}

run();

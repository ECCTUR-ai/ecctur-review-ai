import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkColumns() {
  const { data, error } = await supabase
    .from('hotels')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching hotels:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Hotel columns in database:', Object.keys(data[0]));
  } else {
    console.log('No hotel records found to inspect.');
  }
}

checkColumns();

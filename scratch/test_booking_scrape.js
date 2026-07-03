import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fetchBookingReviews } from '../api-services/providers/bookingProvider.js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  try {
    console.log('Fetching hotel with booking_url...');
    const { data: hotels, error } = await supabaseAdmin
      .from('hotels')
      .select('id, name, booking_url')
      .not('booking_url', 'is', null);

    if (error) throw error;
    if (!hotels || hotels.length === 0) {
      console.log('No hotel found with booking_url configured in DB.');
      return;
    }

    const hotel = hotels[0];
    console.log(`Using hotel: ${hotel.name} (${hotel.booking_url})`);

    const reviews = await fetchBookingReviews(hotel.booking_url, 100);
    console.log('\n--- METRICS REPORT ---');
    const total = reviews.length;
    const withText = reviews.filter(r => r.reviewText && r.reviewText !== 'No comment review.').length;
    const scoreOnly = total - withText;
    console.log(`Toplam: ${total}`);
    console.log(`Metinli: ${withText}`);
    console.log(`Sadece puan: ${scoreOnly}`);

    console.log('\nFirst 5 normalized reviews:');
    console.log(JSON.stringify(reviews.slice(0, 5), null, 2));

  } catch (err) {
    console.error('Error running debug script:', err);
  }
}

run();

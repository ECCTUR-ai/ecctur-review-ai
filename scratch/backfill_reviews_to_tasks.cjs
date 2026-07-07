const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

let supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
let supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Fallback to reading .env.local
if (fs.existsSync('./.env.local')) {
  const envContent = fs.readFileSync('./.env.local', 'utf-8');
  const env = {};
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });

  if (!supabaseUrl) supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  if (!supabaseServiceKey) supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY;
}

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Please run this script with VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set in your environment.');
  console.error('Example:');
  console.error('  SUPABASE_SERVICE_ROLE_KEY="your-key" node scratch/backfill_reviews_to_tasks.cjs');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function runBackfill() {
  console.log('Connecting to Supabase at:', supabaseUrl);

  try {
    // 1. Fetch all reviews with rating <= 3
    const { data: reviews, error: fetchErr } = await supabaseAdmin
      .from('reviews')
      .select('*')
      .lte('rating', 3);

    if (fetchErr) throw fetchErr;

    console.log(`Retrieved ${reviews.length} reviews with rating <= 3. Starting evaluation...`);

    let scannedCount = 0;
    let createdCount = 0;
    let duplicateCount = 0;

    for (const review of reviews) {
      scannedCount++;
      
      const rating = Number(review.rating);
      const text = (review.review_text || '').toLowerCase();
      
      // Rule 2: Gating for operational tasks
      let requiresAction = false;
      if (rating === 1 || rating === 2) {
        requiresAction = true;
      } else if (rating === 3) {
        const operationalKeywords = [
          'klima', 'sıcak', 'soğuk', 'arıza', 'bozuk', 'çalışmıyor', 'elektrik', 'su', 'duş', 'internet', 'wifi',
          'temizlik', 'oda temizliği', 'havlu', 'çarşaf', 'housekeeping', 'kirli', 'pis', 'toz', 'banyo',
          'yemek', 'restoran', 'kahvaltı', 'servis', 'garson', 'bar', 'içecek', 'lezzetsiz', 'soğuktu',
          'resepsiyon', 'check-in', 'check out', 'bekleme', 'personel', 'kaba', 'saygısız', 'yavaş', 'ilgisiz',
          'spa', 'masaj', 'hamam', 'sauna',
          'kavga', 'hakaret', 'güvenlik', 'sağlık', 'yangın', 'hırsızlık', 'tehdit'
        ];
        requiresAction = operationalKeywords.some(keyword => text.includes(keyword));
      }

      if (!requiresAction) {
        continue;
      }

      // Rule 6: Duplicate task check (review_id + metadata.ai_action_required)
      const { data: existing, error: checkErr } = await supabaseAdmin
        .from('tasks')
        .select('id, metadata')
        .eq('review_id', review.id);

      if (checkErr) {
        console.warn(`[Backfill] Duplicate check error for review ${review.id}:`, checkErr);
      }

      const duplicateExists = existing?.some((t) => {
        const meta = typeof t.metadata === 'string' ? JSON.parse(t.metadata) : t.metadata;
        return meta?.ai_action_required === true;
      });

      if (duplicateExists) {
        duplicateCount++;
        continue;
      }

      // Rule 3: Department Assignment Rules
      let department = 'Misafir İlişkileri';
      const techKeywords = ['klima', 'sıcak', 'soğuk', 'arıza', 'bozuk', 'çalışmıyor', 'elektrik', 'su', 'duş', 'internet', 'wifi'];
      const hkKeywords = ['temizlik', 'oda temizliği', 'havlu', 'çarşaf', 'housekeeping', 'kirli', 'pis', 'toz', 'banyo'];
      const fbKeywords = ['yemek', 'restoran', 'kahvaltı', 'servis', 'garson', 'bar', 'içecek', 'lezzetsiz', 'soğuktu'];
      const foKeywords = ['resepsiyon', 'check-in', 'check out', 'bekleme', 'personel', 'kaba', 'saygısız', 'yavaş', 'ilgisiz'];
      const spaKeywords = ['spa', 'masaj', 'hamam', 'sauna'];

      if (techKeywords.some(kw => text.includes(kw))) department = 'Teknik Servis';
      else if (hkKeywords.some(kw => text.includes(kw))) department = 'Housekeeping';
      else if (fbKeywords.some(kw => text.includes(kw))) department = 'Yiyecek & İçecek';
      else if (foKeywords.some(kw => text.includes(kw))) department = 'Ön Büro';
      else if (spaKeywords.some(kw => text.includes(kw))) department = 'Spa';

      // Rule 4: Priority Rules
      let priority = 'medium';
      if (rating === 1) priority = 'critical';
      else if (rating === 2) priority = 'high';
      else if (rating === 3) priority = 'medium';

      if (text.match(/(kavga|hakaret|güvenlik|sağlık|yangın|hırsızlık|tehdit)/i)) {
        priority = 'critical';
      }

      const aiRecommendedAction = `Misafir ile iletişime geç, ${department.toLowerCase()} ekibiyle konuyu koordine et, çözüm sonrası geri bildirim al.`;
      const description = `Misafir Yorumu: "${review.review_text || ''}"\nPlatform: ${review.platform || 'Google'}\nMisafir: ${review.guest_name || 'Misafir'}\nPuan: ${rating} Yıldız\nYapay Zeka Aksiyon Önerisi: ${aiRecommendedAction}`;
      const title = rating <= 2 ? `Kritik Misafir Şikayeti: ${department}` : `Misafir Yorumu Takip Görevi: ${department}`;

      const taskPayload = {
        hotel_id: review.hotel_id,
        organization_id: review.organization_id,
        review_id: review.id,
        title,
        description,
        department,
        priority,
        status: 'open',
        source_platform: review.platform || 'Google',
        due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        metadata: {
          rating,
          guest_name: review.guest_name || 'Misafir',
          platform: review.platform || 'Google',
          review_date: review.created_at,
          ai_action_required: true,
          ai_recommended_action: aiRecommendedAction,
          detected_department: department
        }
      };

      const { error: insErr } = await supabaseAdmin.from('tasks').insert(taskPayload);
      if (insErr) {
        console.error(`[Backfill] Insert error for review ${review.id}:`, insErr);
      } else {
        createdCount++;
      }
    }

    console.log('\n--- BACKFILL STATISTICS ---');
    console.log(`Scanned Reviews: ${scannedCount}`);
    console.log(`Created Tasks:   ${createdCount}`);
    console.log(`Skipped Duplicates: ${duplicateCount}`);
    console.log('---------------------------\n');

  } catch (err) {
    console.error('Backfill process failed:', err);
  }
}

runBackfill();

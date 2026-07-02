// scripts/createAdminUser.ts
/**
 * Script to ensure a default admin user exists in Supabase Auth.
 * Runs using the Supabase service role key.
 *
 * Usage: `node scripts/createAdminUser.ts`
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Supabase service role key or URL not defined. Please verify environment.');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, supabaseServiceKey);
const ADMIN_EMAIL = 'admin@ecctur.ai';
const ADMIN_PASSWORD = 'Ecctur@2026!';

async function upsertAdmin() {
  try {
    // Check if user already exists by listing users
    const { data: listData, error: findError } = await adminClient
      .auth.admin.listUsers();

    if (findError) {
      console.error('Error checking existing admin user:', findError);
      process.exit(1);
    }

    const users = listData?.users || [];
    const existing = users.find(u => u.email === ADMIN_EMAIL);

    if (existing) {
      console.log(`Admin user ${ADMIN_EMAIL} already exists (id: ${existing.id}).`);
      return;
    }

    // Create new admin user
    const { data, error } = await adminClient.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
    });

    if (error) {
      console.error('Failed to create admin user:', error);
      process.exit(1);
    }

    console.log(`Admin user created successfully. ID: ${data?.user?.id}`);
  } catch (e) {
    console.error('Unexpected error:', e);
    process.exit(1);
  }
}

upsertAdmin();

// src/scripts/createAdminUser.ts
/**
 * Script to ensure a default admin user exists in Supabase Auth.
 * Runs using the Supabase service role key via supabaseAdmin client.
 *
 * Usage: `node src/scripts/createAdminUser.ts`
 */
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const ADMIN_EMAIL = 'admin@ecctur.ai';
const ADMIN_PASSWORD = 'Ecctur@2026!';

async function upsertAdmin() {
  try {
    // Check if user already exists
    const { data: existing, error: findError } = await supabaseAdmin
      .auth.admin.listUsers({ email: ADMIN_EMAIL, limit: 1 })
      .single();

    if (findError && findError.message !== 'User not found') {
      console.error('Error checking existing admin user:', findError);
      process.exit(1);
    }

    if (existing) {
      console.log(`Admin user ${ADMIN_EMAIL} already exists (id: ${existing.id}).`);
      return;
    }

    // Create new admin user
    const { data: user, error } = await supabaseAdmin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      // Additional metadata can be added here, e.g., role
      // user_metadata: { role: 'admin' },
    });

    if (error) {
      console.error('Failed to create admin user:', error);
      process.exit(1);
    }

    console.log(`Admin user created successfully. ID: ${user?.id}`);
  } catch (e) {
    console.error('Unexpected error:', e);
    process.exit(1);
  }
}

upsertAdmin();

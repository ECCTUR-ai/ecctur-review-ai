-- Migration: Confirm admin emails and ensure admin user passwords in auth.users
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

UPDATE auth.users 
SET email_confirmed_at = now(),
    encrypted_password = extensions.crypt('Ecctur@2026!', extensions.gen_salt('bf'))
WHERE email IN ('cemil.sezgin@ecctur.com', 'admin@ecctur.ai', 'testadmin@ecctur.com', 'cemil.sezgin@gmail.com');


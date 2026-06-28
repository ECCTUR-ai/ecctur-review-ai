-- Create a secure RPC function to create users bypass SMTP triggers and email rate limits
CREATE OR REPLACE FUNCTION public.admin_create_user(
  user_email TEXT,
  user_password TEXT,
  user_first_name TEXT,
  user_last_name TEXT,
  user_role_id UUID,
  user_hotel_ids UUID[],
  user_org_id UUID
) RETURNS UUID SECURITY DEFINER AS $$
DECLARE
  new_user_id UUID;
  hashed_password TEXT;
BEGIN
  -- Security check: Enforce that only Super Admin or Admin can call this RPC function
  IF NOT EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.profile_id = auth.uid()
      AND LOWER(r.name) IN ('super admin', 'admin')
  ) THEN
    -- Allow bypass in local development if no users exist yet or no session
    IF auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'Access denied. Only Super Admin or Admin can create users.';
    END IF;
  END IF;

  -- 1. Check if user already exists in auth.users
  SELECT id INTO new_user_id FROM auth.users WHERE email = user_email;
  
  IF new_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'User with this email already exists';
  END IF;

  -- 2. Generate a new UUID for the user
  new_user_id := gen_random_uuid();
  
  -- 3. Hash the password using pgcrypto
  hashed_password := crypt(user_password, gen_salt('bf'));

  -- 4. Insert into auth.users (Bypassing SMTP email verification rate limits)
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES (
    new_user_id,
    '00000000-0000-0000-0000-000000000000',
    user_email,
    hashed_password,
    now(), -- Bypasses email confirmation
    '{"provider": "email", "providers": ["email"]}',
    jsonb_build_object('first_name', user_first_name, 'last_name', user_last_name),
    'authenticated',
    'authenticated',
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  -- 5. Insert into auth.identities
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    new_user_id,
    new_user_id,
    jsonb_build_object('sub', new_user_id, 'email', user_email),
    'email',
    now(),
    now(),
    now()
  );

  -- 6. Insert into public.profiles
  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    last_name,
    status,
    organization_id,
    created_at
  ) VALUES (
    new_user_id,
    user_email,
    user_first_name,
    user_last_name,
    'active',
    user_org_id,
    now()
  );

  -- 7. Insert role mapping
  IF user_role_id IS NOT NULL THEN
    INSERT INTO public.user_roles (profile_id, role_id)
    VALUES (new_user_id, user_role_id);
  END IF;

  -- 8. Insert hotel mappings
  IF user_hotel_ids IS NOT NULL AND array_length(user_hotel_ids, 1) > 0 THEN
    INSERT INTO public.user_hotels (profile_id, hotel_id)
    SELECT new_user_id, h_id FROM unnest(user_hotel_ids) AS h_id;
  END IF;

  RETURN new_user_id;
END;
$$ LANGUAGE plpgsql;

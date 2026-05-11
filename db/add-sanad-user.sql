-- ============================================================================
-- Seed the Sanad AI user
--
-- Run this ONCE on each environment (dev, staging, prod).
-- Sanad is an AI assistant that lives in the Isnaad organization
-- and is auto-added to every room.
--
-- Prerequisites:
--   1. The Isnaad organization must already exist
--   2. You must create an auth.users entry first (or use a service-role insert)
--
-- Usage with Supabase Dashboard SQL Editor:
--   1. First create an auth user for Sanad (or use the seed script)
--   2. Then run this SQL to create the profile row
-- ============================================================================

-- Step 1: Find the Isnaad org (must already exist)
DO $$
DECLARE
  v_isnaad_org_id uuid;
  v_sanad_auth_id uuid;
BEGIN
  -- Get the Isnaad organization
  SELECT id INTO v_isnaad_org_id
  FROM organizations
  WHERE kind = 'isnaad'
  LIMIT 1;

  IF v_isnaad_org_id IS NULL THEN
    RAISE EXCEPTION 'Isnaad organization not found. Create it first.';
  END IF;

  -- Check if Sanad already exists
  SELECT id INTO v_sanad_auth_id
  FROM users
  WHERE is_ai = true
  LIMIT 1;

  IF v_sanad_auth_id IS NOT NULL THEN
    RAISE NOTICE 'Sanad AI user already exists with id: %', v_sanad_auth_id;
    RETURN;
  END IF;

  -- Create auth user for Sanad
  -- Note: In practice, create this via Supabase Admin API or Dashboard
  -- The auth user ID must match the users.id (FK constraint)
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    role,
    aud
  ) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'sanad@isnaad.ai',
    crypt('sanad-ai-no-login-' || gen_random_uuid()::text, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Sanad AI"}'::jsonb,
    now(),
    now(),
    'authenticated',
    'authenticated'
  )
  RETURNING id INTO v_sanad_auth_id;

  -- Create the user profile
  INSERT INTO users (id, org_id, role, email, full_name, is_ai)
  VALUES (
    v_sanad_auth_id,
    v_isnaad_org_id,
    'internal',
    'sanad@isnaad.ai',
    'Sanad AI',
    true
  );

  RAISE NOTICE 'Sanad AI user created with id: %', v_sanad_auth_id;

  -- Auto-add Sanad to all existing rooms
  INSERT INTO room_members (room_id, user_id)
  SELECT r.id, v_sanad_auth_id
  FROM rooms r
  WHERE r.archived_at IS NULL
  ON CONFLICT (room_id, user_id) DO NOTHING;

  RAISE NOTICE 'Sanad added to all existing rooms';
END $$;

-- ---------------------------------------------------------------------------
-- Auto-add Sanad to newly created rooms
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_add_sanad_to_room()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sanad_id uuid;
BEGIN
  SELECT id INTO v_sanad_id FROM users WHERE is_ai = true LIMIT 1;
  IF v_sanad_id IS NOT NULL THEN
    INSERT INTO room_members (room_id, user_id)
    VALUES (NEW.id, v_sanad_id)
    ON CONFLICT (room_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rooms_auto_add_sanad ON rooms;
CREATE TRIGGER rooms_auto_add_sanad
  AFTER INSERT ON rooms
  FOR EACH ROW EXECUTE FUNCTION public.auto_add_sanad_to_room();

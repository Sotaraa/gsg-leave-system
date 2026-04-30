-- ============================================================================
-- Supabase Auth Integration Migration
-- Purpose: Create trigger to auto-populate user_profiles when auth.users created
-- Execute this in Supabase SQL Editor
-- ============================================================================

-- STEP 1: Create trigger function to auto-create user_profile on auth.user creation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert placeholder profile when new auth user is created
  -- Organization will be updated by app after domain lookup
  INSERT INTO public.user_profiles (
    auth_user_id,
    organization_id,
    email,
    full_name,
    role,
    is_super_admin,
    is_organization_admin,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    'unknown', -- Will be updated by app after organization lookup
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    'Staff', -- Default role, will be updated from mt_staff
    NEW.email = 'info@sotara.co.uk', -- Mark Sotara admin as super admin
    false -- Will be updated if user is org admin
  )
  ON CONFLICT(auth_user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates a user_profile record when a new auth user is created. Called as a trigger on auth.users.';

-- STEP 2: Create trigger that fires after auth.users INSERT
-- ============================================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON TRIGGER on_auth_user_created ON auth.users IS 'Triggers handle_new_user() when new user signs up in auth.users table.';

-- STEP 3: Verify user_profiles table has proper indexes
-- ============================================================================
-- These should already exist, but verify they do for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_auth_user_id ON public.user_profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_organization_id ON public.user_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);

-- STEP 4: Verify RLS is enabled on user_profiles
-- ============================================================================
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Next steps:
-- 1. Verify in Supabase: Functions → handle_new_user() exists
-- 2. Verify in Supabase: Triggers → on_auth_user_created exists
-- 3. Run Phase 2: Update auth.js with authenticateWithSupabase()
-- ============================================================================

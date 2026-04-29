-- ============================================================================
-- RLS (Row Level Security) Setup for gsg-leave-system
-- Execute this entire script in Supabase SQL Editor
-- ============================================================================

-- STEP 1: Create user_profiles table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'Staff' CHECK (role IN ('Super Admin', 'Admin', 'Dept Head', 'Staff')),
  is_super_admin BOOLEAN DEFAULT false,
  is_organization_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_auth_user_id ON public.user_profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_organization_id ON public.user_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);

COMMENT ON TABLE public.user_profiles IS 'Maps auth users to organizations with roles. Primary table for RLS enforcement.';
COMMENT ON COLUMN public.user_profiles.is_super_admin IS 'True only for Sotara master admin (info@sotara.co.uk)';
COMMENT ON COLUMN public.user_profiles.is_organization_admin IS 'True for organization admin who can manage org settings';

-- STEP 2: Create RLS Helper Functions
-- ============================================================================
CREATE OR REPLACE FUNCTION public.current_user_organization_id()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT organization_id
  FROM public.user_profiles
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(is_super_admin, false)
  FROM public.user_profiles
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(is_organization_admin, false)
  FROM public.user_profiles
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT role
  FROM public.user_profiles
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.current_user_organization_id() IS 'Returns the organization_id of the current user. Used in RLS policies.';
COMMENT ON FUNCTION public.is_super_admin() IS 'Returns true if user is Sotara master admin.';
COMMENT ON FUNCTION public.is_org_admin() IS 'Returns true if user is organization admin.';
COMMENT ON FUNCTION public.current_user_role() IS 'Returns the role of the current user.';

-- STEP 3: Enable RLS on user_profiles
-- ============================================================================
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY "Super admin can view all profiles"
  ON public.user_profiles
  FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "Org admin can view org profiles"
  ON public.user_profiles
  FOR SELECT
  USING (
    public.is_org_admin()
    AND organization_id = public.current_user_organization_id()
  );

-- STEP 4: Enable RLS on mt_staff
-- ============================================================================
ALTER TABLE public.mt_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own organization staff"
  ON public.mt_staff
  FOR SELECT
  USING (organization_id = public.current_user_organization_id());

CREATE POLICY "Super admin sees all staff"
  ON public.mt_staff
  FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "Users insert staff in own organization"
  ON public.mt_staff
  FOR INSERT
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "Org admin updates staff in organization"
  ON public.mt_staff
  FOR UPDATE
  USING (organization_id = public.current_user_organization_id())
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "Org admin deletes staff in organization"
  ON public.mt_staff
  FOR DELETE
  USING (organization_id = public.current_user_organization_id());

-- STEP 5: Enable RLS on mt_requests
-- ============================================================================
ALTER TABLE public.mt_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see requests in own organization"
  ON public.mt_requests FOR SELECT
  USING (organization_id = public.current_user_organization_id());

CREATE POLICY "Super admin sees all requests"
  ON public.mt_requests FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "Users insert requests in own organization"
  ON public.mt_requests FOR INSERT
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "Users update own requests"
  ON public.mt_requests FOR UPDATE
  USING (organization_id = public.current_user_organization_id())
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "Org admin deletes requests"
  ON public.mt_requests FOR DELETE
  USING (organization_id = public.current_user_organization_id());

-- STEP 6: Enable RLS on mt_departments
-- ============================================================================
ALTER TABLE public.mt_departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see departments in own organization"
  ON public.mt_departments FOR SELECT
  USING (organization_id = public.current_user_organization_id());

CREATE POLICY "Super admin sees all departments"
  ON public.mt_departments FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "Org admin inserts departments"
  ON public.mt_departments FOR INSERT
  WITH CHECK (
    organization_id = public.current_user_organization_id()
    AND public.is_org_admin()
  );

CREATE POLICY "Org admin updates departments"
  ON public.mt_departments FOR UPDATE
  USING (
    organization_id = public.current_user_organization_id()
    AND public.is_org_admin()
  )
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "Org admin deletes departments"
  ON public.mt_departments FOR DELETE
  USING (
    organization_id = public.current_user_organization_id()
    AND public.is_org_admin()
  );

-- STEP 7: Enable RLS on mt_announcements
-- ============================================================================
ALTER TABLE public.mt_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see announcements in own organization"
  ON public.mt_announcements FOR SELECT
  USING (organization_id = public.current_user_organization_id());

CREATE POLICY "Super admin sees all announcements"
  ON public.mt_announcements FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "Org admin inserts announcements"
  ON public.mt_announcements FOR INSERT
  WITH CHECK (
    organization_id = public.current_user_organization_id()
    AND public.is_org_admin()
  );

CREATE POLICY "Org admin updates announcements"
  ON public.mt_announcements FOR UPDATE
  USING (
    organization_id = public.current_user_organization_id()
    AND public.is_org_admin()
  )
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "Org admin deletes announcements"
  ON public.mt_announcements FOR DELETE
  USING (
    organization_id = public.current_user_organization_id()
    AND public.is_org_admin()
  );

-- STEP 8: Enable RLS on mt_schoolTerms
-- ============================================================================
ALTER TABLE public.mt_schoolTerms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see school terms in own organization"
  ON public.mt_schoolTerms FOR SELECT
  USING (organization_id = public.current_user_organization_id());

CREATE POLICY "Super admin sees all school terms"
  ON public.mt_schoolTerms FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "Org admin inserts school terms"
  ON public.mt_schoolTerms FOR INSERT
  WITH CHECK (
    organization_id = public.current_user_organization_id()
    AND public.is_org_admin()
  );

CREATE POLICY "Org admin updates school terms"
  ON public.mt_schoolTerms FOR UPDATE
  USING (
    organization_id = public.current_user_organization_id()
    AND public.is_org_admin()
  )
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "Org admin deletes school terms"
  ON public.mt_schoolTerms FOR DELETE
  USING (
    organization_id = public.current_user_organization_id()
    AND public.is_org_admin()
  );

-- STEP 9: Enable RLS on mt_termDates
-- ============================================================================
ALTER TABLE public.mt_termDates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see term dates in own organization"
  ON public.mt_termDates FOR SELECT
  USING (organization_id = public.current_user_organization_id());

CREATE POLICY "Super admin sees all term dates"
  ON public.mt_termDates FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "Org admin inserts term dates"
  ON public.mt_termDates FOR INSERT
  WITH CHECK (
    organization_id = public.current_user_organization_id()
    AND public.is_org_admin()
  );

CREATE POLICY "Org admin updates term dates"
  ON public.mt_termDates FOR UPDATE
  USING (
    organization_id = public.current_user_organization_id()
    AND public.is_org_admin()
  )
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "Org admin deletes term dates"
  ON public.mt_termDates FOR DELETE
  USING (
    organization_id = public.current_user_organization_id()
    AND public.is_org_admin()
  );

-- STEP 10: Enable RLS on organizations
-- ============================================================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin sees all organizations"
  ON public.organizations FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "Users see their own organization"
  ON public.organizations FOR SELECT
  USING (id = public.current_user_organization_id());

CREATE POLICY "Org admin updates their organization"
  ON public.organizations FOR UPDATE
  USING (
    id = public.current_user_organization_id()
    AND public.is_org_admin()
  )
  WITH CHECK (id = public.current_user_organization_id());

-- ============================================================================
-- RLS SETUP COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Insert users into user_profiles table (link auth.users to organizations)
-- 2. Update auth.js to populate user_profiles on first login
-- 3. Test RLS by querying tables with different users
-- 4. Create OrganizationContext.tsx for frontend
-- 5. Update all queries to include organization_id filtering
-- ============================================================================

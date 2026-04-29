-- ============================================================================
-- mt_settings Table Creation & RLS Setup
-- Firebase → Supabase Migration - Phase 0
--
-- Execute this entire script in Supabase SQL Editor to create the missing
-- organization-scoped settings table needed for the migration.
--
-- Location: https://app.supabase.com/project/[PROJECT_ID]/sql/new
-- ============================================================================

-- ============================================================================
-- STEP 1: Create mt_settings table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.mt_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Leave allowance & carry forward settings
  defaultAllowance NUMERIC DEFAULT 20,
  maxCarryForwardDays NUMERIC DEFAULT 5,
  carryForwardEnabled BOOLEAN DEFAULT true,

  -- Holiday year configuration
  holidayYearStartMonth INTEGER DEFAULT 9 CHECK (holidayYearStartMonth BETWEEN 1 AND 12),
  holidayYearStartDay INTEGER DEFAULT 1 CHECK (holidayYearStartDay BETWEEN 1 AND 31),

  -- Term-time contract settings
  termTimeDaysTarget NUMERIC DEFAULT 30,
  hoursPerDay NUMERIC DEFAULT 8,

  -- Year-end reset tracking
  lastYearResetDate TIMESTAMPTZ,
  lastYearResetClosingDate DATE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create index on organization_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_mt_settings_organization_id ON public.mt_settings(organization_id);

-- Add table comments
COMMENT ON TABLE public.mt_settings IS 'Organization-scoped leave management system settings. Replaces Firebase gardener-schools.leave-v1/settings/global.';
COMMENT ON COLUMN public.mt_settings.defaultAllowance IS 'Default annual leave allowance in days (e.g., 20)';
COMMENT ON COLUMN public.mt_settings.holidayYearStartMonth IS 'Month when holiday year begins (1-12, default 9 = September)';
COMMENT ON COLUMN public.mt_settings.holidayYearStartDay IS 'Day of month when holiday year begins (default 1)';
COMMENT ON COLUMN public.mt_settings.termTimeDaysTarget IS 'Target working days for term-time staff (default 30)';
COMMENT ON COLUMN public.mt_settings.hoursPerDay IS 'Standard hours per working day for TOIL calculations (default 8)';

-- ============================================================================
-- STEP 2: Enable RLS on mt_settings
-- ============================================================================

ALTER TABLE public.mt_settings ENABLE ROW LEVEL SECURITY;

-- Policy 1: Organization admins can read their organization's settings
CREATE POLICY "mt_settings_select_org_members" ON public.mt_settings
  FOR SELECT
  USING (
    organization_id = public.current_user_organization_id()
    OR public.is_super_admin()
  );

-- Policy 2: Organization admins can update their organization's settings
CREATE POLICY "mt_settings_update_org_admins" ON public.mt_settings
  FOR UPDATE
  USING (
    organization_id = public.current_user_organization_id()
    AND (
      SELECT is_organization_admin FROM public.user_profiles
      WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id = public.current_user_organization_id()
    AND (
      SELECT is_organization_admin FROM public.user_profiles
      WHERE auth_user_id = auth.uid()
    )
  );

-- Policy 3: Only super admin can insert/delete settings
CREATE POLICY "mt_settings_insert_super_admin" ON public.mt_settings
  FOR INSERT
  WITH CHECK (public.is_super_admin());

CREATE POLICY "mt_settings_delete_super_admin" ON public.mt_settings
  FOR DELETE
  USING (public.is_super_admin());

-- ============================================================================
-- STEP 3: Verify other mt_* tables have required columns
-- ============================================================================

-- Check mt_requests for missing columns
-- These columns should exist: approvalSubType, importedSilently
-- If missing, uncomment and run:
/*
ALTER TABLE public.mt_requests ADD COLUMN IF NOT EXISTS approvalSubType TEXT;
ALTER TABLE public.mt_requests ADD COLUMN IF NOT EXISTS importedSilently BOOLEAN DEFAULT false;
COMMENT ON COLUMN public.mt_requests.approvalSubType IS 'Type of approval (TOIL, DaysOwed, Unpaid) for special request types';
COMMENT ON COLUMN public.mt_requests.importedSilently IS 'Flag indicating this record was imported from CSV without notification';
*/

-- Check mt_staff for missing columns
-- These columns should exist: approverEmail, carryForwardDays, termTimeDaysTarget, workingDays, hoursPerDay
-- If missing, uncomment and run:
/*
ALTER TABLE public.mt_staff ADD COLUMN IF NOT EXISTS approverEmail TEXT;
ALTER TABLE public.mt_staff ADD COLUMN IF NOT EXISTS carryForwardDays NUMERIC DEFAULT 0;
ALTER TABLE public.mt_staff ADD COLUMN IF NOT EXISTS termTimeDaysTarget NUMERIC;
ALTER TABLE public.mt_staff ADD COLUMN IF NOT EXISTS workingDays INTEGER[];
ALTER TABLE public.mt_staff ADD COLUMN IF NOT EXISTS hoursPerDay NUMERIC;
COMMENT ON COLUMN public.mt_staff.approverEmail IS 'Email of designated approver for this staff member';
COMMENT ON COLUMN public.mt_staff.carryForwardDays IS 'Annual leave days carried over from previous year';
COMMENT ON COLUMN public.mt_staff.termTimeDaysTarget IS 'Target working days for term-time contracts';
COMMENT ON COLUMN public.mt_staff.workingDays IS 'Array of working days (0=Mon, 1=Tue, etc.)';
COMMENT ON COLUMN public.mt_staff.hoursPerDay IS 'Standard hours per day for TOIL calculations';
*/

-- ============================================================================
-- STEP 4: Create Gardener Schools organization entry (if not exists)
-- ============================================================================

INSERT INTO public.organizations (
  id,
  name,
  domain,
  ssoConfigured,
  azureClientId,
  azureTenantId,
  azureRedirectUri,
  notificationEmail,
  useGraphApi
) VALUES (
  'gardener-schools',
  'Gardener Schools Group',
  '@gardenerschools.com',
  true,
  '097064c6-eeda-45ca-bf02-09498229f442',
  '9196dde2-b3f2-470e-bc68-ef2144cb2343',
  'https://gsg-leave-system.vercel.app/auth/gardener-schools',
  NULL,  -- Set notification email during onboarding
  true   -- Use Graph API
)
ON CONFLICT(id) DO NOTHING;

-- ============================================================================
-- STEP 5: Create default settings entry for Gardener Schools
-- ============================================================================

INSERT INTO public.mt_settings (
  organization_id,
  defaultAllowance,
  holidayYearStartMonth,
  holidayYearStartDay,
  maxCarryForwardDays,
  carryForwardEnabled,
  termTimeDaysTarget,
  hoursPerDay
) VALUES (
  'gardener-schools',
  20,  -- Default 20 days annual leave
  9,   -- September start
  1,   -- 1st of month
  5,   -- Max 5 days carry forward
  true,
  30,  -- Term-time target
  8    -- 8-hour day
)
ON CONFLICT(organization_id) DO NOTHING;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verify creation:
-- SELECT * FROM public.mt_settings WHERE organization_id = 'gardener-schools';
-- Expected: 1 row with Gardener Schools settings

COMMIT;

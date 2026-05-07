-- ============================================================================
-- God Mode RLS Policies — full CRUD for info@sotara.co.uk (super admin)
-- across every organisation's data.
--
-- Existing policies already let super admin SELECT everything.
-- This migration adds INSERT / UPDATE / DELETE bypass policies so super admin
-- can manage client data via the LeaveHub UI instead of direct Supabase access.
--
-- Apply via Supabase SQL editor or `supabase db push`.
-- Safe to re-run: each statement uses DROP IF EXISTS first.
-- ============================================================================

-- ── mt_staff ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Super admin inserts staff anywhere" ON public.mt_staff;
CREATE POLICY "Super admin inserts staff anywhere"
  ON public.mt_staff FOR INSERT
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin updates staff anywhere" ON public.mt_staff;
CREATE POLICY "Super admin updates staff anywhere"
  ON public.mt_staff FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin deletes staff anywhere" ON public.mt_staff;
CREATE POLICY "Super admin deletes staff anywhere"
  ON public.mt_staff FOR DELETE
  USING (public.is_super_admin());

-- ── mt_requests ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Super admin inserts requests anywhere" ON public.mt_requests;
CREATE POLICY "Super admin inserts requests anywhere"
  ON public.mt_requests FOR INSERT
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin updates requests anywhere" ON public.mt_requests;
CREATE POLICY "Super admin updates requests anywhere"
  ON public.mt_requests FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin deletes requests anywhere" ON public.mt_requests;
CREATE POLICY "Super admin deletes requests anywhere"
  ON public.mt_requests FOR DELETE
  USING (public.is_super_admin());

-- ── mt_departments ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Super admin inserts departments anywhere" ON public.mt_departments;
CREATE POLICY "Super admin inserts departments anywhere"
  ON public.mt_departments FOR INSERT
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin updates departments anywhere" ON public.mt_departments;
CREATE POLICY "Super admin updates departments anywhere"
  ON public.mt_departments FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin deletes departments anywhere" ON public.mt_departments;
CREATE POLICY "Super admin deletes departments anywhere"
  ON public.mt_departments FOR DELETE
  USING (public.is_super_admin());

-- ── mt_announcements ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Super admin inserts announcements anywhere" ON public.mt_announcements;
CREATE POLICY "Super admin inserts announcements anywhere"
  ON public.mt_announcements FOR INSERT
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin updates announcements anywhere" ON public.mt_announcements;
CREATE POLICY "Super admin updates announcements anywhere"
  ON public.mt_announcements FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin deletes announcements anywhere" ON public.mt_announcements;
CREATE POLICY "Super admin deletes announcements anywhere"
  ON public.mt_announcements FOR DELETE
  USING (public.is_super_admin());

-- ── mt_schoolterms ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Super admin inserts school terms anywhere" ON public.mt_schoolterms;
CREATE POLICY "Super admin inserts school terms anywhere"
  ON public.mt_schoolterms FOR INSERT
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin updates school terms anywhere" ON public.mt_schoolterms;
CREATE POLICY "Super admin updates school terms anywhere"
  ON public.mt_schoolterms FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin deletes school terms anywhere" ON public.mt_schoolterms;
CREATE POLICY "Super admin deletes school terms anywhere"
  ON public.mt_schoolterms FOR DELETE
  USING (public.is_super_admin());

-- ── mt_termdates ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Super admin inserts term dates anywhere" ON public.mt_termdates;
CREATE POLICY "Super admin inserts term dates anywhere"
  ON public.mt_termdates FOR INSERT
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin updates term dates anywhere" ON public.mt_termdates;
CREATE POLICY "Super admin updates term dates anywhere"
  ON public.mt_termdates FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin deletes term dates anywhere" ON public.mt_termdates;
CREATE POLICY "Super admin deletes term dates anywhere"
  ON public.mt_termdates FOR DELETE
  USING (public.is_super_admin());

-- ── mt_settings (if exists) ───────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'mt_settings') THEN

    EXECUTE 'DROP POLICY IF EXISTS "Super admin reads settings anywhere" ON public.mt_settings';
    EXECUTE 'CREATE POLICY "Super admin reads settings anywhere"
              ON public.mt_settings FOR SELECT
              USING (public.is_super_admin())';

    EXECUTE 'DROP POLICY IF EXISTS "Super admin inserts settings anywhere" ON public.mt_settings';
    EXECUTE 'CREATE POLICY "Super admin inserts settings anywhere"
              ON public.mt_settings FOR INSERT
              WITH CHECK (public.is_super_admin())';

    EXECUTE 'DROP POLICY IF EXISTS "Super admin updates settings anywhere" ON public.mt_settings';
    EXECUTE 'CREATE POLICY "Super admin updates settings anywhere"
              ON public.mt_settings FOR UPDATE
              USING (public.is_super_admin())
              WITH CHECK (public.is_super_admin())';

    EXECUTE 'DROP POLICY IF EXISTS "Super admin deletes settings anywhere" ON public.mt_settings';
    EXECUTE 'CREATE POLICY "Super admin deletes settings anywhere"
              ON public.mt_settings FOR DELETE
              USING (public.is_super_admin())';
  END IF;
END $$;

-- ── organizations (super admin needs to update org settings) ──────────────
DROP POLICY IF EXISTS "Super admin updates any organization" ON public.organizations;
CREATE POLICY "Super admin updates any organization"
  ON public.organizations FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin inserts organizations" ON public.organizations;
CREATE POLICY "Super admin inserts organizations"
  ON public.organizations FOR INSERT
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin deletes organizations" ON public.organizations;
CREATE POLICY "Super admin deletes organizations"
  ON public.organizations FOR DELETE
  USING (public.is_super_admin());

-- ── user_profiles (super admin needs to fix user profile assignments) ────
DROP POLICY IF EXISTS "Super admin inserts profiles" ON public.user_profiles;
CREATE POLICY "Super admin inserts profiles"
  ON public.user_profiles FOR INSERT
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin updates any profile" ON public.user_profiles;
CREATE POLICY "Super admin updates any profile"
  ON public.user_profiles FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin deletes profiles" ON public.user_profiles;
CREATE POLICY "Super admin deletes profiles"
  ON public.user_profiles FOR DELETE
  USING (public.is_super_admin());

-- ── organization_api_keys (super admin manages keys for any org) ─────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'organization_api_keys') THEN

    EXECUTE 'DROP POLICY IF EXISTS "Super admin all keys" ON public.organization_api_keys';
    EXECUTE 'CREATE POLICY "Super admin all keys"
              ON public.organization_api_keys
              FOR ALL
              USING (public.is_super_admin())
              WITH CHECK (public.is_super_admin())';
  END IF;
END $$;

-- ============================================================================
-- Verification: list all super-admin policies
-- ============================================================================
-- Run after applying:
-- SELECT schemaname, tablename, policyname FROM pg_policies
-- WHERE policyname ILIKE '%super admin%' ORDER BY tablename, policyname;

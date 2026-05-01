/**
 * Calendar Sync Verification Script
 *
 * Run this in Supabase SQL Editor to verify all tables and fields exist
 * for the holiday calendar synchronization system.
 */

-- 1. Check if organizations table has required Azure AD fields
SELECT
  'organizations table - Azure AD fields' as check_name,
  CASE
    WHEN COUNT(*) = 6 THEN 'PASS ✅'
    ELSE 'FAIL ❌ - Missing fields'
  END as status
FROM information_schema.columns
WHERE table_name = 'organizations'
AND column_name IN (
  'azureClientId',
  'azureClientSecret',
  'azureTenantId',
  'notificationemail',
  'ssoconfigured',
  'id'
);

-- 2. Check mt_termdates table structure for calendar fields
SELECT
  'mt_termdates table - Calendar fields' as check_name,
  CASE
    WHEN COUNT(*) = 3 THEN 'PASS ✅'
    ELSE 'FAIL ❌ - Missing calendar columns'
  END as status
FROM information_schema.columns
WHERE table_name = 'mt_termdates'
AND column_name IN (
  'calendar_event_id',
  'calendar_synced_at',
  'calendar_sync_status'
);

-- 3. Check if calendar_sync_log table exists
SELECT
  'calendar_sync_log table exists' as check_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'calendar_sync_log'
    ) THEN 'PASS ✅'
    ELSE 'FAIL ❌ - Table missing. Run migrations.'
  END as status;

-- 4. List all organizations and their sync readiness
SELECT
  org.id,
  org.name,
  org.ssoconfigured,
  CASE
    WHEN org.azureClientId IS NOT NULL THEN '✅'
    ELSE '❌'
  END as has_client_id,
  CASE
    WHEN org.azureClientSecret IS NOT NULL THEN '✅'
    ELSE '❌'
  END as has_client_secret,
  CASE
    WHEN org.azureTenantId IS NOT NULL THEN '✅'
    ELSE '❌'
  END as has_tenant_id,
  CASE
    WHEN org.notificationemail IS NOT NULL THEN '✅'
    ELSE '❌'
  END as has_notification_email,
  CASE
    WHEN org.ssoconfigured = true
      AND org.azureClientId IS NOT NULL
      AND org.azureClientSecret IS NOT NULL
      AND org.azureTenantId IS NOT NULL
      AND org.notificationemail IS NOT NULL
    THEN 'READY ✅'
    ELSE 'INCOMPLETE ❌'
  END as sync_readiness
FROM organizations org
ORDER BY org.name;

-- 5. Check mt_termdates calendar sync status by organization
SELECT
  organization_id,
  COUNT(*) as total_holidays,
  COUNT(CASE WHEN calendar_sync_status = 'synced' THEN 1 END) as synced,
  COUNT(CASE WHEN calendar_sync_status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN calendar_sync_status = 'error' THEN 1 END) as errors,
  COUNT(CASE WHEN calendar_synced_at IS NULL THEN 1 END) as never_synced,
  MAX(calendar_synced_at) as last_sync_time
FROM mt_termdates
WHERE type != 'Bank Holiday'
GROUP BY organization_id
ORDER BY organization_id;

-- 6. Check recent sync logs
SELECT
  organization_id,
  sync_type,
  holidays_synced,
  events_created,
  CASE
    WHEN errors IS NULL THEN 'OK ✅'
    ELSE errors
  END as status,
  created_at
FROM calendar_sync_log
ORDER BY created_at DESC
LIMIT 10;

-- 7. Check mt_termdates table for any sync errors
SELECT
  id,
  organization_id,
  description,
  date,
  calendar_sync_status,
  calendar_synced_at
FROM mt_termdates
WHERE calendar_sync_status = 'error'
ORDER BY calendar_synced_at DESC
LIMIT 10;

-- 8. Verify RLS is enabled on tables that need organization isolation
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('mt_termdates', 'calendar_sync_log')
ORDER BY tablename;

-- 9. Check if any organization is missing critical fields
SELECT
  'Organizations missing sync credentials' as issue,
  id,
  name,
  CASE
    WHEN azureClientId IS NULL THEN 'Missing Client ID'
    WHEN azureClientSecret IS NULL THEN 'Missing Client Secret'
    WHEN azureTenantId IS NULL THEN 'Missing Tenant ID'
    WHEN notificationemail IS NULL THEN 'Missing Notification Email'
    WHEN ssoconfigured != true THEN 'SSO Not Configured'
  END as missing_field
FROM organizations
WHERE ssoconfigured = true
  AND (
    azureClientId IS NULL
    OR azureClientSecret IS NULL
    OR azureTenantId IS NULL
    OR notificationemail IS NULL
  );

-- 10. Summary health check
SELECT
  (
    SELECT COUNT(*) FROM organizations
    WHERE ssoconfigured = true
      AND azureClientId IS NOT NULL
      AND azureClientSecret IS NOT NULL
      AND azureTenantId IS NOT NULL
      AND notificationemail IS NOT NULL
  ) as "Organizations Ready for Sync",
  (
    SELECT COUNT(*) FROM mt_termdates
    WHERE type != 'Bank Holiday'
      AND calendar_sync_status = 'synced'
  ) as "Holidays Successfully Synced",
  (
    SELECT COUNT(*) FROM mt_termdates
    WHERE type != 'Bank Holiday'
      AND calendar_sync_status != 'synced'
      AND organization_id IN (
        SELECT id FROM organizations
        WHERE ssoconfigured = true
          AND azureClientId IS NOT NULL
          AND azureClientSecret IS NOT NULL
          AND azureTenantId IS NOT NULL
          AND notificationemail IS NOT NULL
      )
  ) as "Holidays Pending Sync",
  (
    SELECT COUNT(*) FROM calendar_sync_log
    WHERE created_at > now() - interval '24 hours'
      AND errors IS NULL
  ) as "Successful Syncs Last 24h";

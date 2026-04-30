-- VERIFY NOTIFICATION EMAIL CONFIGURATION
-- Run this to check if organizations table has notification email setup

-- Check column names and values
SELECT
  id,
  name,
  domain,
  CASE WHEN notificationemail IS NULL THEN '❌ NO EMAIL' ELSE '✅ ' || notificationemail END as notification_email,
  CASE WHEN usegraphapi IS NULL THEN '❌ NO' ELSE CASE WHEN usegraphapi THEN '✅ YES' ELSE '❌ NO' END END as use_graph_api
FROM organizations
ORDER BY created_at DESC;

-- If notification emails are missing, update them
-- For Gardener Schools, use admin notification email from mt_staff or organizations superAdmin
UPDATE organizations
SET
  notificationemail = CASE
    WHEN id = 'gardener-schools' THEN 'noreply@gardenerschools.com' -- Change to actual school email
    ELSE notificationemail
  END,
  usegraphapi = CASE
    WHEN usegraphapi IS NULL THEN true
    ELSE usegraphapi
  END
WHERE notificationemail IS NULL OR usegraphapi IS NULL;

-- Verify the update
SELECT
  id,
  name,
  notificationemail,
  usegraphapi
FROM organizations;

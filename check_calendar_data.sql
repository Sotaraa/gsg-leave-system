-- Check what data exists for calendar
SELECT 
  'Organizations' as type,
  COUNT(*) as count
FROM organizations
UNION ALL
SELECT 
  'Term Dates',
  COUNT(*)
FROM mt_termDates
WHERE organization_id = 'gardener-schools'
UNION ALL
SELECT 
  'School Terms',
  COUNT(*)
FROM mt_schoolTerms
WHERE organization_id = 'gardener-schools'
UNION ALL
SELECT 
  'Approved Requests',
  COUNT(*)
FROM mt_requests
WHERE organization_id = 'gardener-schools' AND status = 'Approved';

-- Show actual org IDs
SELECT id, name FROM organizations LIMIT 5;

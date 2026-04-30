-- Import Gardener Schools Staff and Leave Requests Data
-- Generated from CSV files dated 2026-04-29

-- STEP 1: Clear existing data (OPTIONAL - comment out if you want to keep test data)
-- DELETE FROM mt_requests WHERE organization_id = 'gardener-schools' AND importedsilently = true;
-- DELETE FROM mt_staff WHERE organization_id = 'gardener-schools' AND createdat > NOW() - INTERVAL '1 day';

-- STEP 2: Insert Staff Members
INSERT INTO mt_staff (id, organization_id, name, email, department, role, allowance, carryforwarddays, istermtime, termtimedaystarget, approveremail)
VALUES
  (gen_random_uuid(), 'gardener-schools', 'Alfie Thompson', 'alfie.thompson@gardenerschools.com', 'IT', 'Staff', 0, 0, true, 24, 'hitesh.bhojani@gardenerschools.com'),
  (gen_random_uuid(), 'gardener-schools', 'Angela Clarke', 'angela.clarke@gardenerschools.com', 'HR', 'Staff', 0, 0, true, 24.5, 'anita.ral@gardenerschools.com'),
  (gen_random_uuid(), 'gardener-schools', 'Anita Ral', 'anita.ral@gardenerschools.com', 'HR', 'Admin', 30, 0, true, 30, 'Jessen.Chen@gardenerschools.com'),
  (gen_random_uuid(), 'gardener-schools', 'Edyta Chojnacka', 'edyta.chojnacka@gardenerschools.com', 'KHS Finance', 'Staff', 24, 0, false, NULL, 'neha.gandhi@gardenerschools.com'),
  (gen_random_uuid(), 'gardener-schools', 'Georgina Savic', 'georgina.savic@gardenerschools.com', 'Marketing', 'Dept Head', 30, 0, false, NULL, 'Jessen.Chen@gardenerschools.com'),
  (gen_random_uuid(), 'gardener-schools', 'Grant Bell', 'grant.bell@gardenerschools.com', 'Marketing', 'Staff', 22, 0, false, NULL, 'georgina.savic@gardenerschools.com'),
  (gen_random_uuid(), 'gardener-schools', 'Hinda Ahmed', 'hinda.ahmed@gardenerschools.com', 'HR', 'Staff', 25, 0, false, NULL, 'Jessen.Chen@gardenerschools.com'),
  (gen_random_uuid(), 'gardener-schools', 'Hitesh Bhojani', 'hitesh.bhojani@gardenerschools.com', 'IT', 'Admin', 25, 5, false, NULL, 'Jessen.Chen@gardenerschools.com'),
  (gen_random_uuid(), 'gardener-schools', 'Jessen Chen', 'Jessen.Chen@gardenerschools.com', 'Other', 'Admin', 25, 0, false, NULL, NULL),
  (gen_random_uuid(), 'gardener-schools', 'Jessica McDonnell', 'jessica.mcdonnell@gardenerschools.com', 'Marketing', 'Staff', 12.5, 0, false, NULL, 'georgina.savic@gardenerschools.com'),
  (gen_random_uuid(), 'gardener-schools', 'John Neill', 'john.neill@gardenerschools.com', 'GSG Finance', 'Dept Head', 22, 0, false, NULL, 'Jessen.Chen@gardenerschools.com'),
  (gen_random_uuid(), 'gardener-schools', 'John Vasquez', 'john.vasquez@gardenerschools.com', 'IT', 'Dept Head', 25, 0, false, NULL, 'hitesh.bhojani@gardenerschools.com'),
  (gen_random_uuid(), 'gardener-schools', 'Karl Cheng', 'karl.cheng@gardenerschools.com', 'IT', 'Staff', 21, 0, false, NULL, 'hitesh.bhojani@gardenerschools.com'),
  (gen_random_uuid(), 'gardener-schools', 'Louise Doughty', 'louise.doughty@gardenerschools.com', 'Finance', 'Staff', 20, 0, false, NULL, 'Jessen.Chen@gardenerschools.com'),
  (gen_random_uuid(), 'gardener-schools', 'Mario Wageman', 'Mario.Wageman@gardenerschools.com', 'Marketing', 'Staff', 22, 0, false, NULL, 'georgina.savic@gardenerschools.com'),
  (gen_random_uuid(), 'gardener-schools', 'Monika Munjal', 'monika.munjal@gardenerschools.com', 'GSG Finance', 'Staff', 21, 0, false, NULL, 'john.neill@gardenerschools.com'),
  (gen_random_uuid(), 'gardener-schools', 'Neha Gandhi', 'neha.gandhi@gardenerschools.com', 'KHS Finance', 'Dept Head', 22, 0, false, NULL, 'Jessen.Chen@gardenerschools.com'),
  (gen_random_uuid(), 'gardener-schools', 'Salli Donovan', 'salli.donovan@gardenerschools.com', 'Other', 'Staff', 25, 0, false, NULL, 'Jessen.Chen@gardenerschools.com'),
  (gen_random_uuid(), 'gardener-schools', 'Tricia Paterson', 'tricia.paterson@gardenerschools.com', 'Marketing', 'Staff', 14, 0, false, NULL, 'georgina.savic@gardenerschools.com'),
  (gen_random_uuid(), 'gardener-schools', 'Vince Marcelo', 'vince.marcelo@gardenerschools.com', 'IT', 'Staff', 22, 0, false, NULL, 'hitesh.bhojani@gardenerschools.com')
ON CONFLICT DO NOTHING;

-- STEP 3: Insert Leave Requests (Sample - first 50 records)
INSERT INTO mt_requests (id, organization_id, employeename, employeeemail, department, type, startdate, enddate, dayscount, ishalfday, status, submittedat, importedsilently)
VALUES
  (gen_random_uuid(), 'gardener-schools', 'Edyta Chojnacka', 'edyta.chojnacka@gardenerschools.com', 'KHS Finance', 'Annual Leave', '2026-05-01'::date, '2026-05-01'::date, 1, false, 'Approved', '2026-04-29'::timestamp, true),
  (gen_random_uuid(), 'gardener-schools', 'Angela Clarke', 'angela.clarke@gardenerschools.com', 'HR', 'School Holiday Worked', '2026-05-07'::date, '2026-05-07'::date, 0.5, true, 'Approved', '2026-04-28'::timestamp, true),
  (gen_random_uuid(), 'gardener-schools', 'Edyta Chojnacka', 'edyta.chojnacka@gardenerschools.com', 'KHS Finance', 'Annual Leave', '2026-05-01'::date, '2026-05-01'::date, 0.5, true, 'Rejected', '2026-04-28'::timestamp, true),
  (gen_random_uuid(), 'gardener-schools', 'Angela Clarke', 'angela.clarke@gardenerschools.com', 'HR', 'Medical Appt', '2026-04-17'::date, '2026-04-17'::date, 0.5, true, 'Approved', '2026-04-27'::timestamp, true),
  (gen_random_uuid(), 'gardener-schools', 'Angela Clarke', 'angela.clarke@gardenerschools.com', 'HR', 'Medical Appt', '2026-04-14'::date, '2026-04-14'::date, 0.5, true, 'Approved', '2026-04-27'::timestamp, true),
  (gen_random_uuid(), 'gardener-schools', 'Angela Clarke', 'angela.clarke@gardenerschools.com', 'HR', 'Sick Leave', '2026-04-24'::date, '2026-04-24'::date, 1, false, 'Approved', '2026-04-27'::timestamp, true),
  (gen_random_uuid(), 'gardener-schools', 'Neha Gandhi', 'neha.gandhi@gardenerschools.com', 'KHS Finance', 'Annual Leave', '2026-04-28'::date, '2026-04-28'::date, 1, false, 'Approved', '2026-04-24'::timestamp, true),
  (gen_random_uuid(), 'gardener-schools', 'Angela Clarke', 'angela.clarke@gardenerschools.com', 'HR', 'Sick Leave', '2026-04-22'::date, '2026-04-23'::date, 2, false, 'Approved', '2026-04-24'::timestamp, true),
  (gen_random_uuid(), 'gardener-schools', 'Edyta Chojnacka', 'edyta.chojnacka@gardenerschools.com', 'KHS Finance', 'Annual Leave', '2026-04-23'::date, '2026-04-23'::date, 0.5, true, 'Approved', '2026-04-20'::timestamp, true),
  (gen_random_uuid(), 'gardener-schools', 'Neha Gandhi', 'neha.gandhi@gardenerschools.com', 'KHS Finance', 'Annual Leave', '2026-04-22'::date, '2026-04-22'::date, 0.5, true, 'Approved', '2026-04-20'::timestamp, true),
  (gen_random_uuid(), 'gardener-schools', 'John Vasquez', 'john.vasquez@gardenerschools.com', 'IT', 'Annual Leave', '2026-04-30'::date, '2026-05-01'::date, 2, false, 'Approved', '2026-04-20'::timestamp, true),
  (gen_random_uuid(), 'gardener-schools', 'Anita Ral', 'anita.ral@gardenerschools.com', 'HR', 'School Holiday Worked', '2026-04-17'::date, '2026-04-17'::date, 1, false, 'Approved', '2026-04-17'::timestamp, true),
  (gen_random_uuid(), 'gardener-schools', 'Neha Gandhi', 'neha.gandhi@gardenerschools.com', 'KHS Finance', 'Annual Leave', '2026-04-17'::date, '2026-04-17'::date, 1, false, 'Approved', '2026-04-15'::timestamp, true),
  (gen_random_uuid(), 'gardener-schools', 'Vince Marcelo', 'vince.marcelo@gardenerschools.com', 'IT', 'Annual Leave', '2026-04-15'::date, '2026-04-15'::date, 1, false, 'Approved', '2026-04-15'::timestamp, true),
  (gen_random_uuid(), 'gardener-schools', 'Anita Ral', 'anita.ral@gardenerschools.com', 'HR', 'School Holiday Worked', '2026-04-14'::date, '2026-04-14'::date, 1, false, 'Approved', '2026-04-14'::timestamp, true)
ON CONFLICT DO NOTHING;

-- Verify import
SELECT 'Staff imported:' as message, COUNT(*) as count FROM mt_staff WHERE organization_id = 'gardener-schools';
SELECT 'Requests imported:' as message, COUNT(*) as count FROM mt_requests WHERE organization_id = 'gardener-schools';

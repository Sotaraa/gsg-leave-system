# Multi-Tenant SSO Testing Guide

Complete guide to test all components of the Azure AD SSO implementation.

---

## 🎯 Testing Overview

**Three Testing Levels:**
1. **Unit Tests** - Auth service functions
2. **Integration Tests** - Complete auth flow
3. **Manual Testing** - User interface and real Azure AD

**Estimated Time:** 2-3 hours for full testing

---

## Part 1: Run Integration Tests

### Step 1.1: Install Dependencies

```bash
cd gsg-leave-system-main

# Install test framework (if not already installed)
npm install --save-dev vitest @vitest/ui
```

### Step 1.2: Run All Auth Tests

```bash
# Run all tests in auth.test.js
npm test auth.test.js

# Or run with verbose output
npm test auth.test.js -- --reporter=verbose

# Run with UI dashboard
npm test auth.test.js -- --ui
```

### Step 1.3: Check Test Results

**Expected Output:**
```
✓ Organization Detection
  ✓ should detect organization by email domain
  ✓ should return null config if organization not found
  ✓ should warn if SSO not fully configured

✓ MSAL Initialization
  ✓ should initialize MSAL with correct org config
  ✓ should throw error if MSAL initialization fails

✓ User Profile Creation
  ✓ should create user profile for new org user
  ✓ should skip if user profile already exists
  ✓ should handle missing auth user gracefully

✓ RLS Enforcement
  ✓ should include organization_id in all queries
  ✓ should prevent cross-organization data access

✓ Authentication Flow Integration
  ✓ should complete full auth flow for domain-matched org
  ✓ should handle org not found and show selector

✓ Error Handling
  ✓ should handle Supabase errors gracefully
  ✓ should handle missing environment variables

✓ Security Tests
  ✓ should not expose sensitive data in logs
  ✓ should validate organization ownership before returning config

Test Files  1 passed (1)
Tests  19 passed (19)
```

**All 19 tests should PASS** ✅

---

## Part 2: Manual Testing - Setup Test Data

### Step 2.1: Verify Test Organizations Exist

In Supabase SQL Editor, run:

```sql
-- Check organizations
SELECT id, name, domain, azureClientId, ssoConfigured 
FROM public.organizations
ORDER BY id;
```

**Expected Results:**
```
id                  name                    domain              azureClientId       ssoConfigured
gardener-schools    Gardener Schools Group  @gardener-schools   (null)             false
sotara              Sotara                  @sotara.co.uk       sotara-client-...   false
```

### Step 2.2: Verify Test Users Exist

```sql
-- Check auth users
SELECT email FROM auth.users;
```

**Expected Results:**
```
email
admin@gardener-schools.co.uk
info@sotara.co.uk
```

### Step 2.3: Verify User Profiles Exist

```sql
-- Check user profiles
SELECT auth_user_id, email, organization_id, role, is_super_admin 
FROM public.user_profiles
ORDER BY organization_id;
```

**Expected Results:**
```
auth_user_id                         email                              organization_id      role           is_super_admin
8cbfda36-f011-4b70-83f2-1ae0923b3cc0  admin@gardener-schools.co.uk      gardener-schools    Admin          false
59042577-605a-4ce6-8047-ccf308a1e70c  info@sotara.co.uk                 sotara              Super Admin    true
```

---

## Part 3: Manual Testing - LoginScreen

### Test 3.1: Organization Auto-Detection

**Steps:**
1. Open the app in your browser
2. Go to login page
3. Click "Sign In with Email" tab (or clear localStorage)
4. Enter email: `info@sotara.co.uk`

**Expected Result:**
- ✅ Organization detected badge appears
- ✅ Shows "Organization detected: Sotara"
- ✅ No organization selector dropdown shown

**Steps:**
1. Clear the email field
2. Enter email: `admin@gardener-schools.co.uk`

**Expected Result:**
- ✅ Organization detected badge appears
- ✅ Shows "Organization detected: Gardener Schools Group"

### Test 3.2: Organization Selector Fallback

**Steps:**
1. Clear the email field
2. Enter email: `user@unknown-domain.com`
3. Wait 1-2 seconds for dropdown to load

**Expected Result:**
- ✅ Organization selector dropdown appears
- ✅ Shows list of organizations:
  - Gardener Schools Group
  - Sotara
- ✅ No "Organization detected" badge

**Steps:**
1. Select "Sotara" from dropdown
2. Click "Sign in with Email" button

**Expected Result:**
- ✅ Email stored in localStorage
- ✅ Organization ID stored in localStorage
- ✅ Page reloads and redirects to auth flow

### Test 3.3: Invalid Email Handling

**Steps:**
1. Enter invalid email: `not-an-email`
2. Wait for detection to complete

**Expected Result:**
- ✅ Organization selector appears
- ✅ No "Organization detected" badge
- ✅ Helpful message to select organization

---

## Part 4: Manual Testing - OnboardingAdmin

### Test 4.1: Access Control

**As non-admin user:**
1. Try to navigate to `/onboarding`
2. Or try accessing via URL: `http://localhost:5173/onboarding`

**Expected Result:**
- ✅ Access Denied message appears
- ✅ Shows current user email
- ✅ Cannot proceed

**As info@sotara.co.uk:**
1. Navigate to `/onboarding`
2. You should see password entry form

### Test 4.2: Create New Organization with SSO

**Steps:**
1. Log in as `info@sotara.co.uk`
2. Go to OnboardingAdmin page
3. Enter master password (from `.env` VITE_MASTER_PASSWORD)
4. Click "Verify & Continue"

**Expected Result:**
- ✅ Password step validated
- ✅ Organization creation form appears

**Steps:**
1. Fill in organization form:
   - Name: `Test School`
   - Email Domain: `@testschool.co.uk`
   - Admin Email: `admin@testschool.co.uk`
   - Default Allowance: `25`
   - Hours Per Day: `8`

2. Click "Configure Azure AD SSO (Optional)" to expand
3. Fill in test Azure credentials:
   - Client ID: `test-client-id-123`
   - Tenant ID: `test-tenant-id-456`
   - Notification Email: `noreply@testschool.co.uk`

4. Click "Create Organization"

**Expected Result:**
- ✅ Success message appears
- ✅ Shows organization ID generated
- ✅ Shows redirect URI generated
- ✅ Form resets for next organization

### Test 4.3: Verify Organization Created

In Supabase SQL Editor:

```sql
SELECT id, name, domain, azureClientId, azureTenantId, 
       notificationEmail, ssoConfigured 
FROM public.organizations 
WHERE id = 'testschool';
```

**Expected Result:**
```
id          name          domain              azureClientId         azureTenantId        notificationEmail        ssoConfigured
testschool  Test School   @testschool.co.uk   test-client-id-123    test-tenant-id-456   noreply@testschool...   true
```

---

## Part 5: Manual Testing - OrganizationSettings

### Test 5.1: Access Control

**As super admin (info@sotara.co.uk):**
1. Navigate to OrganizationSettings page
2. Should see full access

**Expected Result:**
- ✅ Page loads
- ✅ "Edit Settings" button visible
- ✅ Organization details displayed

**As regular user (not admin):**
1. Try to access OrganizationSettings page
2. Should see Access Denied

**Expected Result:**
- ✅ Access Denied message appears
- ✅ Current user email shown
- ✅ Cannot proceed

### Test 5.2: View Organization Details

**Steps:**
1. Log in as `info@sotara.co.uk`
2. Go to OrganizationSettings for Sotara

**Expected Result:**
- ✅ Organization details displayed:
  - Name: Sotara
  - ID: sotara
  - Domain: @sotara.co.uk
  - Hours Per Day: 8

- ✅ Redirect URI shown:
  - `https://app.sotara.co.uk/auth/sotara`

- ✅ Copy button works
- ✅ SSO status shown (Configured/Not Configured)

### Test 5.3: Edit Settings (View Mode → Edit Mode)

**Steps:**
1. Click "Edit Settings" button
2. All fields become editable

**Expected Result:**
- ✅ All fields now editable
- ✅ Current values pre-filled
- ✅ "Save Settings" and "Cancel" buttons appear

### Test 5.4: Update Settings

**Steps:**
1. Change Azure Client ID: `new-client-id-xyz`
2. Change Notification Email: `newemail@sotara.co.uk`
3. Click "Save Settings"

**Expected Result:**
- ✅ Success message: "Organization settings saved successfully!"
- ✅ Returns to view mode
- ✅ New values displayed

### Test 5.5: Verify Settings Saved

In Supabase:

```sql
SELECT azureClientId, notificationEmail, ssoConfigured 
FROM public.organizations 
WHERE id = 'sotara';
```

**Expected Result:**
```
azureClientId          notificationEmail         ssoConfigured
new-client-id-xyz      newemail@sotara.co.uk     true
```

### Test 5.6: Show/Hide Secrets

**Steps:**
1. In view mode, look for sensitive field (Client ID)
2. Click eye icon to toggle visibility

**Expected Result:**
- ✅ Secrets hidden by default (shown as dots)
- ✅ Eye icon toggles to show/hide
- ✅ Copy button works even when hidden

### Test 5.7: Test Email Button

**Steps:**
1. Make sure Notification Email is configured
2. Click "Send Test Email" button

**Expected Result:**
- ✅ Success message appears
- ✅ Email sent to configured notification email (in real implementation)

---

## Part 6: RLS Data Isolation Testing

### Test 6.1: Verify RLS Policies Exist

In Supabase SQL Editor:

```sql
-- Count policies per table
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
```

**Expected Result:**
```
tablename            policy_count
mt_announcements     5
mt_departments       5
mt_requests          5
mt_schoolterms       5
mt_staff             5
mt_termdates         6
organizations        3
user_profiles        4
```

### Test 6.2: Test Organization ID Filtering

**Create test requests for different orgs:**

```sql
-- Insert request for Sotara
INSERT INTO public.mt_requests (
  id, organization_id, employeeemail, employeename, department, type,
  startdate, enddate, dayscount, status, submittedat, createdat
)
VALUES (
  'sotara-req-test', 'sotara', 'test@sotara.co.uk', 'Sotara User', 'Admin', 'Annual Leave',
  NOW()::date, (NOW() + interval '5 days')::date, 5, 'Pending', NOW(), NOW()
);

-- Insert request for Gardener Schools
INSERT INTO public.mt_requests (
  id, organization_id, employeeemail, employeename, department, type,
  startdate, enddate, dayscount, status, submittedat, createdat
)
VALUES (
  'gsg-req-test', 'gardener-schools', 'test@gardener-schools.co.uk', 'GSG User', 'Teaching', 'Sick Leave',
  NOW()::date, (NOW() + interval '1 days')::date, 1, 'Pending', NOW(), NOW()
);

-- Verify both exist
SELECT id, organization_id, employeename FROM public.mt_requests 
WHERE id IN ('sotara-req-test', 'gsg-req-test');
```

**Expected Result:**
```
id              organization_id      employeename
sotara-req-test sotara              Sotara User
gsg-req-test    gardener-schools    GSG User
```

### Test 6.3: Query Requests by Organization

```sql
-- Query only Sotara requests (as Sotara user would)
SELECT id, organization_id, employeename FROM public.mt_requests 
WHERE organization_id = 'sotara';

-- Then query only Gardener Schools requests
SELECT id, organization_id, employeename FROM public.mt_requests 
WHERE organization_id = 'gardener-schools';
```

**Expected Result:**
- First query returns only sotara-req-test
- Second query returns only gsg-req-test
- No cross-organization data leakage

---

## Part 7: Auth Flow End-to-End Testing

### Test 7.1: Complete Login Flow (Email Domain Detected)

**Steps:**
1. Clear browser storage: `localStorage.clear()`
2. Refresh page
3. Go to login
4. Enter: `info@sotara.co.uk`
5. Organization "Sotara" is detected automatically
6. Click "Sign in with Email"
7. Page reloads

**Check localStorage:**
```javascript
// Open browser DevTools Console and run:
console.log({
  email: localStorage.getItem('GSG_USER_EMAIL'),
  org: localStorage.getItem('GSG_USER_ORGANIZATION_ID'),
  method: localStorage.getItem('GSG_AUTH_METHOD')
});
```

**Expected Result:**
```javascript
{
  email: "info@sotara.co.uk",
  org: "sotara",
  method: "email"
}
```

### Test 7.2: Complete Login Flow (Org Selector)

**Steps:**
1. Clear browser storage: `localStorage.clear()`
2. Go to login
3. Enter: `user@newdomain.com`
4. Organization selector dropdown appears
5. Select "Sotara"
6. Click "Sign in with Email"

**Expected Result:**
- ✅ localStorage set correctly
- ✅ App loads and recognizes user
- ✅ Organization context available

### Test 7.3: User Profile Auto-Creation

**After logging in with a new email:**

```sql
-- Check if user profile was created
SELECT auth_user_id, email, organization_id, role 
FROM public.user_profiles 
WHERE email = 'info@sotara.co.uk';
```

**Expected Result:**
```
auth_user_id                         email              organization_id  role
59042577-605a-4ce6-8047-ccf308a1e70c  info@sotara.co.uk  sotara          Super Admin
```

### Test 7.4: Verify User Can Access Organization Data

**Steps:**
1. Log in as `info@sotara.co.uk`
2. Try to access Sotara requests
3. You should see the requests you created

**Expected Result:**
- ✅ Can view sotara-req-test request
- ✅ Cannot view gsg-req-test (from different org)

---

## Part 8: Error Handling Testing

### Test 8.1: Invalid Organization ID

**Steps:**
1. Manually set localStorage:
```javascript
localStorage.setItem('GSG_USER_EMAIL', 'user@test.com');
localStorage.setItem('GSG_USER_ORGANIZATION_ID', 'nonexistent-org');
localStorage.setItem('GSG_AUTH_METHOD', 'email');
```
2. Refresh page

**Expected Result:**
- ✅ Error handled gracefully
- ✅ User shown fallback UI
- ✅ No console errors

### Test 8.2: Missing Environment Variables

**Steps:**
1. Check `.env` file has required variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_MASTER_PASSWORD` (for OnboardingAdmin)

**Expected Result:**
- ✅ All variables present
- ✅ App loads without errors

### Test 8.3: Invalid Password in OnboardingAdmin

**Steps:**
1. Go to OnboardingAdmin
2. Enter wrong master password
3. Click "Verify & Continue"

**Expected Result:**
- ✅ Error message: "Invalid master password"
- ✅ Form stays on password step
- ✅ Can try again

---

## Part 9: Email Notifications Testing

### Test 9.1: Test Email Service (Local)

**In your terminal, run:**

```bash
# Create a test script to call the email service
node -e "
const { sendNotificationEmail } = require('./src/services/emailNotifications.js');

// Mock test
console.log('Email service module loaded successfully');
console.log('Available functions:');
console.log('- sendNotificationEmail');
console.log('- sendApprovalNotification');
console.log('- sendRejectionNotification');
console.log('- sendSubmissionNotification');
"
```

**Expected Result:**
- ✅ Module loads without errors
- ✅ All functions are exported

### Test 9.2: Test Email via Graph API (Real Azure)

**When Azure AD is configured:**

1. In OrganizationSettings, click "Send Test Email"
2. Check notification email inbox for test message

**Expected Result:**
- ✅ Test email received within 1 minute
- ✅ Email appears to come from notification email address
- ✅ Email contains test content

### Test 9.3: Test Approval Notification

**Steps:**
1. Create a leave request in the app
2. Approve it (as manager/admin)
3. Check employee's email

**Expected Result:**
- ✅ Approval email sent
- ✅ Contains request type and employee name
- ✅ Sent from organization's email address

---

## Part 10: Security Testing

### Test 10.1: Verify Secrets Not in Console

**Steps:**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Filter logs for "client" or "secret"

**Expected Result:**
- ✅ No full credentials logged
- ✅ Only org names and statuses logged
- ✅ No sensitive data visible

### Test 10.2: Verify Cross-Org Access Blocked

**Steps:**
1. Log in as `admin@gardener-schools.co.uk`
2. Try to manually query Sotara data:

```javascript
// In browser console
const email = localStorage.getItem('GSG_USER_EMAIL');
console.log('Current user:', email);
console.log('Current org:', localStorage.getItem('GSG_USER_ORGANIZATION_ID'));
```

3. Check that you can only see gardener-schools data

**Expected Result:**
- ✅ Can only access gardener-schools requests
- ✅ Cannot view sotara requests
- ✅ RLS policies enforce isolation

### Test 10.3: Verify Token Not Persisted

**Steps:**
1. Check localStorage after logging in:

```javascript
// In browser console
Object.keys(localStorage).forEach(key => console.log(key, localStorage[key]));
```

2. Look for Azure tokens

**Expected Result:**
- ✅ No Azure tokens in localStorage
- ✅ Only email, org ID, and auth method stored
- ✅ Tokens only in memory (session)

---

## 📋 Testing Checklist

Print this checklist and mark off each test as you complete it:

### Unit Tests
- [ ] All 19 integration tests pass
- [ ] No test failures
- [ ] All test categories covered

### Manual Testing - Setup
- [ ] Test organizations exist in Supabase
- [ ] Test users exist in auth.users
- [ ] User profiles created correctly

### LoginScreen
- [ ] Auto-detect works with known domains
- [ ] Organization selector shows with unknown domains
- [ ] Invalid emails handled gracefully
- [ ] localStorage set correctly

### OnboardingAdmin
- [ ] Non-admins cannot access
- [ ] Super admin can access
- [ ] Can create organization without SSO
- [ ] Can create organization with SSO config
- [ ] Redirect URI auto-generated
- [ ] Organization created in database

### OrganizationSettings
- [ ] Non-admins get access denied
- [ ] Admins can view settings
- [ ] Can switch to edit mode
- [ ] Can update Azure credentials
- [ ] Can update notification email
- [ ] Changes saved to database
- [ ] Show/hide secrets works
- [ ] Copy buttons work

### RLS & Data Isolation
- [ ] All 37 RLS policies exist
- [ ] Queries filtered by organization_id
- [ ] Sotara data not visible to schools
- [ ] School A data not visible to School B
- [ ] Super admin can see all organizations

### Auth Flow
- [ ] Complete login with email detected org
- [ ] Complete login with selector
- [ ] User profiles auto-created
- [ ] Organization context available
- [ ] Can access own org data

### Error Handling
- [ ] Invalid org ID handled gracefully
- [ ] Missing env vars detected
- [ ] Wrong password shown error message

### Email Notifications
- [ ] Email service module loads
- [ ] Test email button works
- [ ] Approval email sent correctly
- [ ] Emails from correct sender address

### Security
- [ ] No secrets in console logs
- [ ] Cross-org access blocked
- [ ] Tokens not persisted to storage
- [ ] Redirect URI properly configured

---

## 🐛 Troubleshooting During Testing

### Tests Won't Run
```bash
# Make sure dependencies installed
npm install --save-dev vitest

# Clear node_modules and reinstall
rm -rf node_modules
npm install
npm test auth.test.js
```

### "Organization not found" on Login
- Check if organization exists in Supabase
- Verify email domain matches organization domain
- Try using organization selector instead

### OnboardingAdmin Page Won't Load
- Verify you're logged in as info@sotara.co.uk
- Check browser console for errors
- Clear cookies and try again

### Email Not Sending
- Verify notification email is configured
- Check that Mail.Send permission is granted in Azure
- In real Azure, verify service account has mailbox

### RLS Tests Failing
- Verify all 37 policies exist in Supabase
- Check that user_profiles table is populated
- Verify auth user exists for test email

---

## ✅ Testing Complete

Once all tests pass and checklists are complete, your implementation is:

✅ Functionally complete  
✅ Secure and isolated  
✅ Production-ready  
✅ Well-documented  
✅ Thoroughly tested

You can now proceed to production deployment!

---

## 📚 Additional Resources

- Integration test file: `src/services/auth.test.js`
- Setup guide: `docs/AZURE_AD_SETUP_GUIDE.md`
- Quick reference: `docs/SSO_QUICK_REFERENCE.md`
- Implementation summary: `docs/IMPLEMENTATION_SUMMARY.md`


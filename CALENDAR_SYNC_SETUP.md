# Holiday Calendar Sync Setup Guide

This document explains how to set up automated holiday calendar synchronization using the Vercel cron job that syncs school holidays to Outlook shared calendars for all organizations.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ Vercel Cron Job (Daily at 2:00 AM UTC)                      │
│ /api/cron/sync-holidays                                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ├─ Fetch all configured organizations
                       │
                       └─ For each organization:
                          ├─ Get Azure service token (Client Credentials)
                          ├─ Fetch holidays from Supabase (mt_termdates)
                          └─ Create/update events in shared Outlook calendar
```

## How It Works

### 1. Real-Time Sync (When Admin Adds/Edits Holidays)
- Admin creates/updates a holiday in the app
- `app.jsx` calls `syncSingleHoliday()` immediately
- Uses admin's Azure token to push event to shared calendar

### 2. Scheduled Sync (Nightly Backup, 2:00 AM UTC)
- Cron job runs automatically every day
- Uses **service-to-service authentication** (not user tokens)
- Each organization authenticated independently
- Syncs all non-synced or recently-modified holidays

### 3. Data Storage
- Holidays stored in `mt_termdates` table (Supabase)
- Calendar event IDs stored in `calendar_event_id` field
- Sync status tracked in `calendar_synced_at` and `calendar_sync_status`
- Audit trail in `calendar_sync_log` table

## Setup Steps

### Phase 1: Vercel Deployment Configuration

#### 1.1 Set Environment Variables in Vercel

Go to Vercel dashboard → Your Project → Settings → Environment Variables

Add these three variables:

```
SUPABASE_URL           = https://uzmdqryhzijkmwedvwka.supabase.co
SUPABASE_SERVICE_ROLE_KEY = (get from Supabase dashboard → Settings → API)
CRON_SECRET            = (generate any random string, used to verify cron requests)
```

**Where to get Supabase credentials:**
- Log in to Supabase dashboard
- Select your project
- Go to Settings → API
- Copy: Project URL and Service Role Key

**⚠️ CRITICAL: Service Role Key is sensitive!**
- Only use in backend/cron (never in frontend)
- Has full database access
- Keep secret

#### 1.2 Verify vercel.json Configuration

File already exists at root: `vercel.json`

Current configuration:
```json
{
  "crons": [{
    "path": "/api/cron/sync-holidays",
    "schedule": "0 2 * * *"
  }]
}
```

This schedules the cron to run at 02:00 UTC every day.

To change schedule, use cron syntax: `minute hour * * dayOfWeek`
- `0 2 * * *` = Every day at 2:00 AM UTC
- `0 8 * * 1-5` = Weekdays at 8:00 AM UTC
- `0 */6 * * *` = Every 6 hours

### Phase 2: Azure AD Service Principal Setup (Per Organization)

For each school/organization that wants calendar sync, complete these steps:

#### 2.1 Create Azure AD App Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory → App registrations**
3. Click **New registration**
4. Fill in:
   - Name: `GSG Leave System - Holiday Sync` (or similar)
   - Supported account types: **Single tenant** (this org's Azure AD only)
   - Redirect URI: Leave blank (cron jobs don't use UI redirects)
5. Click **Register**

#### 2.2 Create Client Secret

1. In the app registration, go to **Certificates & secrets**
2. Click **New client secret**
3. Fill in:
   - Description: `Holiday calendar sync`
   - Expires: Select **24 months** (or your preference)
4. Click **Add**
5. **Copy the secret value immediately** (you can't see it again!)

**You now have:**
- Client ID (Application ID)
- Client Secret (regenerate if lost)
- Tenant ID (from Overview tab)

#### 2.3 Grant API Permissions

1. In the app registration, go to **API permissions**
2. Click **Add a permission**
3. Select **Microsoft Graph**
4. Choose **Application permissions** (NOT delegated)
5. Search for and add:
   - `Calendars.ReadWrite` - Create/edit calendar events
   - `Calendar.ReadWrite.Shared` - Access shared calendars
6. Click **Grant admin consent** (requires Azure AD admin)

#### 2.4 Save Credentials Securely

Don't paste these into .env files! We'll store them in Supabase:

```
Azure Client ID:     xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Azure Tenant ID:     xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Azure Client Secret: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Phase 3: Supabase Configuration

#### 3.1 Add Azure Credentials to Organization Record

Each organization needs these fields in the `organizations` table:

| Field | Type | Value | Example |
|-------|------|-------|---------|
| `azureClientId` | text | From Azure AD app registration | `550e8400-e29b-41d4-a716-446655440000` |
| `azureTenantId` | text | From Azure AD overview | `f47ac10b-58cc-4372-a567-0e02b2c3d479` |
| `azureClientSecret` | text | From client secret (store encrypted) | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `notificationemail` | text | School's shared calendar email | `calendars@schoolname.onmicrosoft.com` |
| `ssoConfigured` | boolean | Must be `true` for sync to work | `true` |

**Option A: Manual Update via SQL**

```sql
UPDATE organizations
SET 
  azureClientId = 'your-client-id',
  azureTenantId = 'your-tenant-id',
  azureClientSecret = 'your-client-secret',
  notificationemail = 'shared-calendar@schoolname.onmicrosoft.com',
  ssoConfigured = true
WHERE id = 'organization-id';
```

**Option B: Update via Supabase Dashboard**
1. Go to Supabase → Your Project → Editor
2. Select `organizations` table
3. Find the organization row
4. Edit the fields directly

#### 3.2 Verify Database Tables Exist

The sync job requires these tables:

| Table | Purpose | Columns |
|-------|---------|---------|
| `mt_termdates` | Holiday dates | `id`, `organization_id`, `date`, `description`, `type`, `calendar_event_id`, `calendar_synced_at`, `calendar_sync_status` |
| `calendar_sync_log` | Audit trail | `id`, `organization_id`, `sync_type`, `holidays_synced`, `errors`, `created_at` |

To verify, run in Supabase SQL editor:

```sql
-- Check mt_termdates structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'mt_termdates' 
ORDER BY ordinal_position;

-- Check calendar_sync_log exists
SELECT * FROM calendar_sync_log LIMIT 1;
```

### Phase 4: Testing the Cron Job

#### 4.1 Manual Test Before Deployment

Before deploying, test locally:

```bash
cd api/cron
node --experimental-modules sync-holidays.js
```

This won't work without proper environment setup, but you can verify syntax.

#### 4.2 Trigger Cron Manually (via Vercel Dashboard)

After deploying to Vercel:

1. Go to Vercel dashboard → Your Project
2. Navigate to **Cron Jobs** tab
3. Find `sync-holidays`
4. Click **Run** button to execute immediately

#### 4.3 Check Execution Results

1. In Vercel dashboard, go to **Logs**
2. Filter by `/api/cron/sync-holidays`
3. View stdout/stderr output

Expected success output:
```
🌍 [CRON] Starting multi-tenant holiday sync at 2026-04-30T02:00:00Z
📊 Found 2 organizations ready for sync
📧 Processing: Gardener Schools Group (gardener-schools)
✅ Got Azure service token for gardener-schools
📅 Found 15 holidays to sync
✅ Synced: Easter Monday
✅ Synced: May Bank Holiday
...
✅ Cron completed in 2345ms - Synced: 15, Errors: 0
```

#### 4.4 Verify Calendar Events in Outlook

1. School admin logs into Outlook Web (outlook.office.com)
2. Go to Calendar
3. Look for "School Holidays" calendar in sidebar
4. Verify holidays appear on correct dates

### Phase 5: Monitoring & Troubleshooting

#### 5.1 Check Sync Status in Database

```sql
-- View latest sync for an organization
SELECT 
  organization_id,
  sync_type,
  holidays_synced,
  errors,
  created_at
FROM calendar_sync_log
WHERE organization_id = 'gardener-schools'
ORDER BY created_at DESC
LIMIT 5;

-- Check individual holiday sync status
SELECT 
  id,
  description,
  calendar_event_id,
  calendar_synced_at,
  calendar_sync_status
FROM mt_termdates
WHERE organization_id = 'gardener-schools'
ORDER BY date DESC
LIMIT 10;
```

#### 5.2 Common Issues & Solutions

**Issue: Cron runs but shows "requires-auth"**
- **Cause:** Azure credentials not configured for organization
- **Fix:** Complete Phase 3 - add azureClientId, azureTenantId, azureClientSecret to organization record

**Issue: Token request fails with 401 Unauthorized**
- **Cause:** Invalid Client ID or Client Secret
- **Fix:** Verify credentials in Supabase match what's in Azure AD

**Issue: Graph API returns 403 Forbidden**
- **Cause:** App permissions not granted or missing admin consent
- **Fix:** In Azure AD, re-grant admin consent to app in API permissions

**Issue: Events appear but won't sync again**
- **Cause:** 24-hour check prevents re-syncing recently synced holidays
- **Fix:** Normal behavior. Events re-sync if modified or after 24 hours.

**Issue: "No organizations configured for holiday sync"**
- **Cause:** No organizations have complete Azure AD setup
- **Fix:** Verify at least one organization has:
  - `ssoConfigured = true`
  - `azureClientId` populated
  - `azureTenantId` populated
  - `azureClientSecret` populated
  - `notificationemail` populated

#### 5.3 Enable Detailed Logging

To add more verbose logging:

1. Edit `api/cron/sync-holidays.js`
2. Uncomment or add `console.log()` statements
3. Deploy to Vercel
4. Check Logs tab after next cron execution

#### 5.4 Set Up Alerts

Option A: Vercel Deployments Email
- Vercel automatically emails if cron fails repeatedly

Option B: Monitor Sync Log Table
- Create a database trigger to alert on errors
- Or write a separate "health check" API that queries calendar_sync_log

## Security Considerations

### 1. Client Secrets
- ✅ Stored in Supabase (encrypted at rest)
- ✅ Never exposed to frontend (uses service-to-service auth)
- ✅ Rotated via Azure AD key rotation

### 2. CRON_SECRET
- ✅ Prevents unauthorized cron execution
- ✅ Vercel passes in `x-vercel-cron-secret` header
- ✅ Validate on every request

### 3. Service Role Key
- ✅ Only used in server-side cron (never in frontend)
- ✅ Has full database access - use sparingly
- ✅ Rotate regularly in Supabase settings

### 4. RLS Policies
- Calendar sync respects organization_id isolation
- Each organization only syncs its own holidays
- No data leak between organizations

## Scaling to Multiple Organizations

To add a new organization to calendar sync:

1. **Create org in Supabase** (if not exists)
2. **Complete Phase 2** (Azure AD setup in that org)
3. **Complete Phase 3** (Add credentials to Supabase)
4. Next cron run automatically includes new organization

No code changes needed! The cron job dynamically discovers all configured organizations.

## API Reference

### POST /api/cron/sync-holidays

**Trigger:** Runs automatically daily at 2:00 AM UTC (configured in vercel.json)

**Manual Trigger:** Vercel dashboard → Cron Jobs → Run

**Headers (Automatic):**
- `x-vercel-cron-secret`: Provided by Vercel, validated against `CRON_SECRET`

**Response (Success):**
```json
{
  "timestamp": "2026-04-30T02:00:00Z",
  "organizations": [
    {
      "organizationId": "gardener-schools",
      "organizationName": "Gardener Schools Group",
      "status": "success",
      "holidaysSynced": 15,
      "errors": []
    }
  ],
  "totalSynced": 15,
  "totalErrors": 0,
  "totalSkipped": 0,
  "duration": 2345,
  "message": "Holiday sync completed: 15 synced, 0 errors, 0 skipped"
}
```

**Response (Error):**
```json
{
  "timestamp": "2026-04-30T02:00:00Z",
  "organizations": [],
  "totalSynced": 0,
  "totalErrors": 1,
  "totalSkipped": 0,
  "error": "SUPABASE_SERVICE_ROLE_KEY not configured",
  "message": "Cron execution failed"
}
```

## Next Steps

1. ✅ Deploy code to Vercel (includes this cron endpoint)
2. ✅ Set environment variables in Vercel dashboard
3. ✅ For each organization:
   - Create Azure AD app registration
   - Grant permissions and create client secret
   - Add credentials to Supabase
4. ✅ Test manually via Vercel dashboard
5. ✅ Verify events appear in Outlook
6. ✅ Monitor first few automatic runs

## Support

If issues occur:

1. Check Vercel Logs for cron execution errors
2. Verify Supabase SQL queries work (see Phase 5.2)
3. Check Azure AD app permissions are correct
4. Ensure credentials in Supabase match Azure AD

## References

- [Microsoft Graph Calendar API](https://learn.microsoft.com/en-us/graph/api/resources/calendar)
- [Azure Client Credentials Flow](https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-client-creds-grant-flow)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [RFC 5545 - iCalendar Format](https://tools.ietf.org/html/rfc5545)

# LeaveHub — New Organisation Setup Guide

This guide explains how to onboard a new organisation onto LeaveHub. Three identity providers are supported: **Microsoft 365 / Azure AD** (recommended), **Google Workspace** (planned), and **Manual accounts** (Supabase email auth).

---

## Prerequisites

You will need:
- Access to the Supabase dashboard: `https://app.supabase.com/project/uzmdqryhzijkmwedvwka`
- The Sotara admin account: `info@sotara.co.uk`
- (For Microsoft tenants) Admin access to the organisation's Microsoft 365 / Azure AD

---

## Option A — Microsoft 365 / Azure AD (Recommended)

### Step 1: Register the App in the Client's Azure AD

> The client's IT admin needs to do this in *their own* Azure AD tenant.

1. Sign in to [Azure Portal](https://portal.azure.com) as a Global Admin
2. Navigate to **Azure Active Directory → App Registrations → New Registration**
3. Fill in:
   - **Name:** `LeaveHub`
   - **Supported account types:** Accounts in this organisational directory only
   - **Redirect URI:** `Web` → `https://gsg-leave-system.vercel.app/`
   - *(For local dev also add:* `http://localhost:5173/`*)*
4. Click **Register** — copy the **Application (client) ID** and **Directory (tenant) ID**
5. Go to **Certificates & Secrets → New client secret** — copy the value immediately
6. Go to **API Permissions → Add a permission → Microsoft Graph → Application permissions:**
   - `Calendars.ReadWrite`
   - `Mail.Send` *(optional — for email notifications from their mailbox)*
7. Click **Grant admin consent** for all permissions

### Step 2: Add the Organisation to Supabase

Run this SQL in the Supabase SQL editor:

```sql
INSERT INTO organizations (id, name, domain, ssoconfigured, azureclientid, azuretenantid, azureclientsecret, azureredirecturi, notificationemail)
VALUES (
  'your-org-id',                          -- short slug, e.g. 'st-james-school'
  'Your Organisation Name',
  '@yourdomain.com',                       -- the email domain, with @ prefix
  true,
  'PASTE_CLIENT_ID_HERE',
  'PASTE_TENANT_ID_HERE',
  'PASTE_CLIENT_SECRET_HERE',
  'https://gsg-leave-system.vercel.app/',
  'noreply@yourdomain.com'                 -- mailbox used for calendar sync
);
```

### Step 3: Add Staff Members

Either use the Admin panel in the app, or insert directly:

```sql
INSERT INTO mt_staff (id, organization_id, email, name, department, role, allowance)
VALUES
  (gen_random_uuid()::text, 'your-org-id', 'admin@yourdomain.com', 'Admin User', 'Management', 'Admin', 25),
  (gen_random_uuid()::text, 'your-org-id', 'staff@yourdomain.com', 'Staff Member', 'Teaching', 'Staff', 25);
```

### Step 4: Test Login

1. Open the app and enter `admin@yourdomain.com` in the email field
2. The organisation should be detected automatically
3. Click **Sign in with Microsoft 365**
4. The user signs in with their normal Microsoft 365 credentials
5. They'll land on the dashboard with their correct role

---

## Option B — Google Workspace (Coming Soon)

Google OAuth2 login via Supabase Auth is planned. When enabled:

1. The Google Workspace admin will need to authorise the LeaveHub OAuth app
2. Email domain will be used for organisation detection (same as Microsoft flow)
3. Calendar sync will use Google Calendar API instead of Microsoft Graph

*Contact Sotara to be added to the beta.*

---

## Option C — Manual Accounts (Supabase Email Auth)

For organisations without Microsoft 365 or Google Workspace.

> ⚠️ Less secure than SSO — use only where no identity provider is available.

### Step 1: Add Organisation (no SSO)

```sql
INSERT INTO organizations (id, name, domain, ssoconfigured)
VALUES (
  'your-org-id',
  'Your Organisation Name',
  '@yourdomain.com',
  false    -- no SSO; Supabase email auth used instead
);
```

### Step 2: Create Staff in Supabase Auth

For each staff member, use the Supabase dashboard:
- **Authentication → Users → Invite user**
- Enter the user's email — they'll receive an invite link
- Once they accept, their account is active

### Step 3: Add Staff to mt_staff

```sql
INSERT INTO mt_staff (id, organization_id, email, name, department, role, allowance)
VALUES (gen_random_uuid()::text, 'your-org-id', 'user@yourdomain.com', 'Full Name', 'Department', 'Staff', 25);
```

---

## Vercel Environment Variables

The cron job and server-side functions require these to be set in Vercel:

| Variable                  | Value                            | Where to find it                          |
|---------------------------|----------------------------------|-------------------------------------------|
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (long JWT)            | Supabase → Settings → API → Service role key |
| `CRON_SECRET`             | Any strong random string         | You choose — store securely               |

Set these at: **Vercel → gsg-leave-system → Settings → Environment Variables**

---

## Security Notes

- **Never commit** `SUPABASE_SERVICE_ROLE_KEY` or Azure client secrets to git
- The service role key bypasses all Supabase RLS — only use in server-side cron functions
- All user-facing requests use the `anon` key + Supabase Auth JWT (RLS enforced)
- Microsoft login is enforced in the auth layer — email-only sessions are rejected
- Each organisation's data is isolated via `organization_id` foreign keys + RLS policies

---

## Row-Level Security (RLS) Summary

All `mt_*` tables enforce organisation isolation. A user can only see records where `organization_id` matches their own. The Super Admin (`info@sotara.co.uk`) can see all organisations.

```
mt_staff       → scoped to organization_id
mt_requests    → scoped to organization_id
mt_departments → scoped to organization_id
mt_termdates   → scoped to organization_id
mt_settings    → scoped to organization_id
```

---

## Holiday Calendar Sync (Cron)

The cron job at `/api/cron/sync-holidays` runs daily at 2:00 AM UTC and:
1. Fetches all organisations with Azure credentials configured
2. Obtains a service token using Client Credentials OAuth 2.0
3. Creates calendar events in the organisation's shared Outlook calendar
4. Updates sync status in `mt_termdates`

Requires: `SUPABASE_SERVICE_ROLE_KEY` in Vercel environment variables.

---

## Support

Contact: `info@sotara.co.uk`

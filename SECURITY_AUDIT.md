# Security Audit Report

**Date:** 2026-04-30  
**Status:** Issues identified, partial fixes applied. Architectural changes still required.

---

## CRITICAL Issues Found

### 1. ❌ FIXED: Master password exposed in JS bundle
**Was:** `VITE_MASTER_PASSWORD=C0ntroller` in `.env.local`. Anything prefixed with `VITE_` is bundled into the frontend JavaScript and visible to anyone who downloads the page.

**Fix applied:** Removed master password feature entirely. Access to OnboardingAdmin now relies solely on Microsoft authentication + email check (`info@sotara.co.uk`).

**Action required by you:**
- Delete `.env.local` (or remove the `VITE_MASTER_PASSWORD` line) from your local machine
- Remove `VITE_MASTER_PASSWORD` from Vercel environment variables (if set there)

---

### 2. ❌ FIXED: Legacy unsecured tables
**Was:** Tables `departments` and `requests` (Firebase migration leftovers) had RLS disabled, allowing anyone with the anon key to read/write them.

**Fix applied:** Tables dropped (`DROP TABLE`).

---

### 3. ⚠️ ARCHITECTURAL: Anon key has full read/write access
**Issue:** The Supabase anon key is in the JS bundle (publicly visible). All `mt_*` tables have RLS policies allowing anon role to:
- Read all data across ALL organizations
- Insert/update/delete data for any organization
- Bypass multi-tenant isolation entirely

**Why it works this way:** The app uses MSAL (Microsoft) for authentication, but never authenticates with Supabase. So `auth.uid()` returns NULL, and the strict RLS policies (using `current_user_organization_id()`) don't actually restrict anything. The permissive anon policies are needed for the app to function.

**Risk level:** HIGH - Anyone who inspects the JS bundle can:
1. Extract the anon key
2. Query the Supabase REST API directly
3. Read all leave requests, staff data, salary information across ALL organizations
4. Modify or delete any data

**Fix required (architectural, NOT yet applied):**

**Option A - Recommended: Implement Supabase Auth integration**
1. After successful Microsoft login, create or sign in user to Supabase Auth using their verified email
2. Use the resulting Supabase JWT for all database operations
3. Update RLS policies to use `auth.uid()` and `auth.email()`
4. Remove anon policies entirely

**Option B: Server-side Edge Functions**
1. Move all CRUD operations to Supabase Edge Functions
2. Edge Functions validate the MSAL token server-side
3. Use service role key on backend (never exposed to frontend)
4. Frontend calls Edge Functions, not Supabase directly

---

## MEDIUM Issues

### 4. ⚠️ Hardcoded super admin in client config
**Location:** `src/config.js`
```javascript
superAdmins: ['hitesh.bhojani@gardenerschools.com'],
```

**Issue:** Visible in JS bundle. Not a secret, but better practice to keep authorization logic server-side.

**Recommendation:** Move super admin determination to RLS policy / database function.

---

### 5. ⚠️ Firebase config still in code
**Location:** `src/firebase.js` and `.env`

**Issue:** Firebase credentials (API key, project ID) are still in the codebase even though Firebase is no longer used for primary operations.

**Recommendation:** 
- Either delete `src/firebase.js` and clear Firebase env variables
- Or document why they're kept (legacy data archive)

---

### 6. ⚠️ Session stored in localStorage
**Location:** `src/main.jsx` and `src/services/auth.js`

**Issue:** Stores `GSG_USER_EMAIL`, `GSG_USER_NAME`, `GSG_AUTH_METHOD` in localStorage. Vulnerable to XSS attacks.

**Mitigation already in place:** MSAL session validation checks that localStorage email matches MSAL cache. Manual localStorage manipulation is detected and rejected.

**Recommendation:** Continue using MSAL's secure session handling. Consider httpOnly cookies for additional defense.

---

## LOW Issues

### 7. ℹ️ Hardcoded Supabase URL/anon key in src/supabase.js
**Location:** `src/supabase.js`

**Issue:** Supabase URL and anon key hardcoded. Anon key is meant to be public, but better practice to use env variables for flexibility.

**Recommendation:** Move to `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` environment variables.

---

## Authentication Flow (After Recent Changes)

✅ **Strong points:**
- Email-only login removed; all users must authenticate via Microsoft
- MSAL session validation on every page load
- Auto-logout after 10 minutes of inactivity
- Domain-based organization detection
- Verified email check (Microsoft confirms identity)

⚠️ **Weaknesses:**
- No Supabase Auth integration → multi-tenant isolation not enforced server-side
- Frontend-only role enforcement → could be bypassed
- No rate limiting on auth attempts

---

## Recommended Next Steps (in priority order)

1. **HIGH PRIORITY**: Implement Supabase Auth integration (Option A above)
2. **HIGH PRIORITY**: Remove `VITE_MASTER_PASSWORD` from Vercel environment variables
3. **MEDIUM**: Move all sensitive operations (delete, update settings, create organizations) to Edge Functions
4. **MEDIUM**: Add audit logging for admin operations
5. **LOW**: Move Supabase URL/anon key to environment variables
6. **LOW**: Delete or document Firebase legacy code

---

## Current Authentication & Authorization Stack

```
┌──────────────────────────────────────────────────┐
│ Microsoft Entra ID (MSAL)                        │
│ - User authentication                            │
│ - Email verification                             │
│ - Session validation                             │
└──────────────────────────────────────────────────┘
            │
            ↓
┌──────────────────────────────────────────────────┐
│ Frontend (React)                                  │
│ - Reads MSAL email from localStorage             │
│ - Looks up org by email domain                   │
│ - Loads user from mt_staff                       │
│ - Determines role (Staff/Admin/Super Admin)     │
└──────────────────────────────────────────────────┘
            │
            ↓
┌──────────────────────────────────────────────────┐
│ Supabase (Anon Key)                               │
│ ⚠️ ALL queries use anon key                       │
│ ⚠️ RLS policies are permissive for anon          │
│ ⚠️ No server-side auth enforcement               │
└──────────────────────────────────────────────────┘
```

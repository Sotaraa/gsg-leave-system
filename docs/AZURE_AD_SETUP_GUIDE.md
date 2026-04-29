# Azure AD SSO Setup Guide for Schools

## Overview

This guide walks your school through setting up Single Sign-On (SSO) with your own Azure Active Directory tenant. Once configured, your staff members will be able to sign in using their school Office 365 email address.

**Time to complete:** ~15 minutes

---

## Prerequisites

Before you start, you'll need:
- ✅ Access to your school's Azure Active Directory (Azure AD)
- ✅ Admin or Application Administrator role in Azure AD
- ✅ Your school's redirect URI (provided by Sotara during onboarding)
- ✅ Your school's organization ID in Sotara LeaveHub

---

## Part 1: Create Azure AD App Registration

### Step 1.1: Go to Azure Portal

1. Open [https://portal.azure.com](https://portal.azure.com)
2. Sign in with your school's Azure AD admin account

### Step 1.2: Navigate to App Registrations

1. In the left sidebar, click **Azure Active Directory**
2. Click **App registrations**
3. Click **+ New registration**

### Step 1.3: Register the Application

Fill in the form:

| Field | Value |
|-------|-------|
| **Name** | `Sotara LeaveHub` (or your preferred name) |
| **Supported account types** | `Accounts in this organizational directory only (Default)` |
| **Redirect URI** | Select **Web** and paste your redirect URI:<br/>`https://app.sotara.co.uk/auth/YOUR-ORG-ID` |

**Example redirect URI:**
```
https://app.sotara.co.uk/auth/stjames-school
```

4. Click **Register**

### Step 1.4: Save Your Credentials

After registration, you'll see the **Overview** page. **Copy and save these values:**

- **Application (client) ID** ← You'll need this
- **Directory (tenant) ID** ← You'll need this

**Save them somewhere secure** - you'll need them in Part 3.

---

## Part 2: Configure API Permissions

### Step 2.1: Add Permissions

1. From the app's page, click **API permissions** in the left menu
2. Click **+ Add a permission**

### Step 2.2: Request Mail.Send Permission

1. Click **Microsoft Graph**
2. Click **Application permissions**
3. Search for `Mail.Send`
4. Check the box next to `Mail.Send`
5. Click **Add permissions**

### Step 2.3: Request User.Read Permission

1. Click **+ Add a permission** again
2. Click **Microsoft Graph**
3. Click **Delegated permissions**
4. Search for `User.Read`
5. Check the box next to `User.Read`
6. Click **Add permissions**

### Step 2.4: Grant Admin Consent

1. On the **API permissions** page, click **Grant admin consent for [Your School Name]**
2. Click **Yes** to confirm

You should see a green checkmark next to both permissions.

---

## Part 3: Create a Client Secret (Optional but Recommended)

A client secret allows secure token requests.

### Step 3.1: Create the Secret

1. Click **Certificates & secrets** in the left menu
2. Click **+ New client secret**
3. Enter a description: `Sotara LeaveHub Secret`
4. Set expiration to **24 months**
5. Click **Add**

### Step 3.2: Copy the Secret Value

⚠️ **Important:** Copy the secret value immediately and save it securely. You won't be able to see it again.

---

## Part 4: Configure Organization Settings in Sotara LeaveHub

### Step 4.1: Access Organization Settings

1. Log in to Sotara LeaveHub as your organization admin
2. Go to **Settings** → **Organization Settings**
3. Click **Edit Settings**

### Step 4.2: Enter Your Azure AD Credentials

Paste the values you saved in Part 1:

| Field | Paste Value From |
|-------|------------------|
| **Azure Client ID** | Application (client) ID from Step 1.4 |
| **Azure Tenant ID** | Directory (tenant) ID from Step 1.4 |
| **Notification Email** | Your school's email for sending notifications (e.g., noreply@stjames.co.uk) |

### Step 4.3: Save Settings

1. Click **Save Settings**
2. You should see "✅ SSO Configured" badge

---

## Part 5: Test the Login Flow

### Step 5.1: Sign Out

1. Log out from Sotara LeaveHub
2. Go to the login page

### Step 5.2: Try Signing In

1. Enter an email address from your school domain (e.g., teacher@stjames.co.uk)
2. You should see "Organization detected: [Your School Name]"
3. Click **Sign in with Microsoft**
4. You'll be redirected to your school's Azure AD login
5. Sign in with your school email and password
6. You should be redirected back to Sotara LeaveHub

**Congratulations!** 🎉 SSO is now working.

---

## Troubleshooting

### ❌ "Organization not found" on login

**Problem:** Email domain doesn't match your organization's domain in Sotara.

**Solution:**
- Make sure your email is from the correct domain
- Or select your organization from the dropdown if your domain isn't auto-detected

### ❌ "Invalid Redirect URI"

**Problem:** The redirect URI you configured in Azure doesn't match what Sotara is using.

**Solution:**
1. Go back to your app registration in Azure Portal
2. Click **Authentication** in the left menu
3. Find **Redirect URIs** section
4. Make sure the URI is exactly: `https://app.sotara.co.uk/auth/YOUR-ORG-ID`
5. Click **Save**

### ❌ "Missing API permissions"

**Problem:** Email notifications aren't being sent.

**Solution:**
1. Go to **API permissions** in Azure
2. Make sure both `Mail.Send` and `User.Read` are present
3. Click **Grant admin consent** if they don't have green checkmarks
4. Wait 5-10 minutes for permissions to propagate

### ❌ "Redirect loop" or "This site can't be reached"

**Problem:** Infinite redirect between Sotara and Azure AD login.

**Solution:**
1. Clear your browser's cookies and cache
2. Try in a private/incognito window
3. Make sure your browser allows third-party cookies for both sotara.co.uk and login.microsoftonline.com

### ❌ Users can't sign in after SSO setup

**Problem:** SSO is configured but users still can't log in.

**Possible causes:**
- User is not in the staff list for your organization
- User's Azure AD account is not assigned to the app registration
- User is in a different Azure AD tenant

**Solution:**
1. As a school admin, add users to your organization in Sotara
2. Assign users to the Sotara app in Azure AD (if required by your policy)
3. Make sure users are signing in with their school Azure AD account, not personal Microsoft accounts

---

## Testing Email Notifications

Once SSO is configured, you can test if emails are being sent:

1. Go to **Organization Settings**
2. Click **Send Test Email**
3. Check the notification email inbox (configured in Step 4.2)
4. You should receive a test email within 1 minute

If the email doesn't arrive:
- Check spam/junk folder
- Verify the notification email address is correct
- Make sure `Mail.Send` permission was granted in Part 2

---

## Security Best Practices

### 🔐 Protect Your Credentials

- **Never share** your Client ID or Tenant ID with anyone
- **Never paste** them in emails or shared documents
- Store the Client Secret securely (don't share it)
- Rotate secrets every 12-24 months

### 🔐 Monitor Sign-In Activity

- Regularly check Azure AD sign-in logs for suspicious activity
- Go to **Azure AD** → **Sign-in logs** to view login attempts
- Enable **Conditional Access** to require multi-factor authentication (MFA) for sign-ins

### 🔐 Limit API Permissions

- Only grant the minimum permissions needed:
  - `Mail.Send` - to send emails
  - `User.Read` - to read user profile information
- Don't grant Directory Administrator or other broad permissions

---

## Frequently Asked Questions

### Q: What if we don't have an Azure AD tenant?

**A:** You'll need to set up Microsoft 365 for your school. Contact your Microsoft partner or start a trial at [microsoft.com/microsoft-365](https://microsoft.com/microsoft-365).

### Q: Can multiple schools use different Azure AD tenants?

**A:** Yes! This is the whole point of per-organization SSO. Each school has completely separate Azure AD and email settings.

### Q: What happens if the school is using Google Workspace instead of Microsoft 365?

**A:** Currently, Sotara supports Azure AD. Support for other identity providers (Google, Okta, etc.) can be added in future versions.

### Q: Can we still log in with email/password if SSO is broken?

**A:** Yes. You can always use the "Sign in with Email" option on the login page as a fallback.

### Q: How often do we need to renew the Client Secret?

**A:** We recommend rotating secrets every 12-24 months. Set a calendar reminder:
1. Create a new secret in Azure (before the old one expires)
2. Update it in Sotara LeaveHub
3. Delete the old secret from Azure

### Q: What if a teacher's Azure AD account is deleted?

**A:** They won't be able to sign in via SSO. Admin can:
1. Remove them from the organization in Sotara
2. Or re-invite them once their Azure AD account is restored

---

## Getting Help

If you run into issues:

1. **Check this guide** - Most common issues are covered above
2. **Contact your Azure AD administrator** - They may need to grant additional permissions
3. **Contact Sotara Support** - Email support@sotara.co.uk with:
   - Your organization name
   - The error message you're seeing
   - Screenshot of the issue (if possible)
   - Don't include credentials or sensitive information

---

## Next Steps

After setting up SSO:

1. ✅ Verify all staff can sign in with their school email
2. ✅ Test email notifications by submitting a test request
3. ✅ Review the staff list and add any missing employees
4. ✅ Set up leave approval workflows
5. ✅ Train staff on how to submit leave requests

---

## Additional Resources

- [Azure AD Documentation](https://docs.microsoft.com/en-us/azure/active-directory/)
- [Microsoft Graph API Documentation](https://docs.microsoft.com/en-us/graph/)
- [Sotara LeaveHub User Guide](./USER_GUIDE.md)
- [Sotara Admin Guide](./ADMIN_GUIDE.md)

---

**Last Updated:** April 2026  
**Version:** 1.0

For the latest version of this guide, visit: https://docs.sotara.co.uk/azure-setup


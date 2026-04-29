# Sotara LeaveHub - SSO Quick Reference Card

Print this card and post it in your IT office for quick reference.

---

## 🚀 5-Minute Setup Checklist

- [ ] I have access to Azure Portal as admin
- [ ] I have my Redirect URI from Sotara (https://app.sotara.co.uk/auth/YOUR-ORG-ID)
- [ ] I can create app registrations in Azure AD

---

## 📋 Azure Portal Checklist

| Step | Do This | ✓ |
|------|---------|---|
| **1** | Go to Azure AD → App registrations → New registration | |
| **2** | Name: `Sotara LeaveHub` | |
| **3** | Redirect URI (Web): Paste your Redirect URI | |
| **4** | Click Register | |
| **5** | Copy **Client ID** (Application (client) ID) | |
| **6** | Copy **Tenant ID** (Directory (tenant) ID) | |
| **7** | Go to API permissions | |
| **8** | Add `Mail.Send` (Application) | |
| **9** | Add `User.Read` (Delegated) | |
| **10** | Grant admin consent | |

---

## 🔐 Sotara Organization Settings

**Go to:** Settings → Organization Settings → Edit Settings

| Field | Paste From Azure |
|-------|------------------|
| **Azure Client ID** | Application (client) ID |
| **Azure Tenant ID** | Directory (tenant) ID |
| **Notification Email** | school@yourdomain.com |
| **Use Graph API** | ✓ (checked) |

**Click:** Save Settings

---

## ✅ Test SSO

1. Log out of Sotara
2. Enter your school email: `yourname@yourdomain.com`
3. Click "Sign in with Microsoft"
4. Sign in with your school Azure AD account
5. You should be logged in! 🎉

---

## 🐛 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| "Invalid Redirect URI" | Check URL in Azure exactly matches what Sotara shows |
| "Missing permissions" | Go to API permissions, grant admin consent again |
| "Users can't sign in" | Add them to staff list in Sotara first |
| "Emails not sending" | Make sure Mail.Send permission is granted |
| "Infinite redirect loop" | Clear cookies, try incognito window |

---

## 📞 Support

- **Need help?** See full guide: `docs/AZURE_AD_SETUP_GUIDE.md`
- **Contact:** support@sotara.co.uk
- **Include:** Organization name, error message, screenshot (no credentials)

---

## 🔐 Security Reminders

⚠️ **DO:**
- ✅ Keep Client ID and Tenant ID private
- ✅ Rotate Client Secret every 12-24 months
- ✅ Monitor Azure AD sign-in logs
- ✅ Enable MFA for admin accounts

⚠️ **DON'T:**
- ❌ Share credentials via email
- ❌ Store secrets in plain text
- ❌ Give broad Directory permissions
- ❌ Skip admin consent for permissions

---

**Print & Share** - Cut along the dotted line and post in your IT office!


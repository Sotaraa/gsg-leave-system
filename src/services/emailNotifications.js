import { supabase } from '../supabase';

/**
 * Email Notifications Service
 *
 * Sends emails using organization's Microsoft Graph API token.
 * Each organization sends from their own email using their own Azure AD token.
 *
 * Defense in depth:
 * - Emails are sent from organization's own Office 365/Exchange mailbox
 * - Uses organization-specific Azure AD token (not Sotara's)
 * - No credential sharing between organizations
 */

/**
 * Send notification email using Microsoft Graph API
 *
 * @param {string} toEmail - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} htmlBody - Email body (HTML format)
 * @param {string} organizationId - Organization ID (used to fetch config)
 * @param {string} azureToken - Azure AD access token from user's org
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export const sendNotificationEmail = async (
  toEmail,
  subject,
  htmlBody,
  organizationId,
  azureToken
) => {
  try {
    if (!toEmail || !subject || !htmlBody || !organizationId) {
      throw new Error('Missing required parameters: toEmail, subject, htmlBody, organizationId');
    }

    // Fetch organization config from Supabase
    // Note: Supabase returns column names in lowercase
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('notificationemail, usegraphapi')
      .eq('id', organizationId)
      .single();

    if (orgError || !org) {
      throw new Error(`Failed to fetch organization config: ${orgError?.message || 'Not found'}`);
    }

    if (!org.notificationemail) {
      throw new Error(`Organization ${organizationId} does not have a notification email configured`);
    }

    // If Graph API is enabled and we have a token, use it
    if (org.usegraphapi && azureToken) {
      return await sendViaGraphApi(
        toEmail,
        subject,
        htmlBody,
        org.notificationemail,
        azureToken,
        organizationId
      );
    }

    // Fallback: Log that we would send via SMTP (future implementation)
    console.warn(
      `⚠️ Graph API not enabled for organization ${organizationId}. SMTP fallback not yet implemented.`
    );

    return {
      success: false,
      error: 'Email notification not sent: Graph API disabled and SMTP not configured'
    };
  } catch (error) {
    console.error(`❌ Error sending notification email: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send email via Microsoft Graph API
 *
 * Uses the organization's Azure AD token to send from their mailbox.
 * Emails appear to come from the organization's official email address.
 *
 * @private
 */
const sendViaGraphApi = async (
  toEmail,
  subject,
  htmlBody,
  senderEmail,
  azureToken,
  organizationId
) => {
  try {
    // Microsoft Graph API endpoint for sending mail
    const graphEndpoint = 'https://graph.microsoft.com/v1.0/me/sendMail';

    // Construct email message
    const emailMessage = {
      message: {
        subject: subject,
        body: {
          contentType: 'HTML',
          content: htmlBody
        },
        toRecipients: [
          {
            emailAddress: {
              address: toEmail
            }
          }
        ],
        from: {
          emailAddress: {
            address: senderEmail
          }
        }
      },
      saveToSentItems: true
    };

    // Send via Graph API
    const response = await fetch(graphEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${azureToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailMessage)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Graph API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
      );
    }

    console.log(`✅ Email sent via Graph API from ${senderEmail} to ${toEmail} (org: ${organizationId})`);

    return {
      success: true,
      messageId: 'sent-via-graph-api'
    };
  } catch (error) {
    console.error(`❌ Graph API error sending email: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send request approval notification
 *
 * Called when a leave request is approved by a manager/admin
 *
 * @param {string} employeeEmail - Employee's email
 * @param {string} employeeName - Employee's name
 * @param {string} requestType - Type of leave (Annual, Sick, etc.)
 * @param {string} organizationId - Organization ID
 * @param {string} azureToken - Azure token for sending
 */
export const sendApprovalNotification = async (
  employeeEmail,
  employeeName,
  requestType,
  organizationId,
  azureToken
) => {
  const subject = `Leave Request Approved: ${requestType}`;

  const htmlBody = `
    <html>
      <body style="font-family: Arial, sans-serif;">
        <h2>Leave Request Approved</h2>
        <p>Dear ${employeeName},</p>
        <p>Your ${requestType} leave request has been approved.</p>
        <p>Please log in to the leave management system to view details.</p>
        <br />
        <p>Regards,<br />Human Resources</p>
      </body>
    </html>
  `;

  return sendNotificationEmail(
    employeeEmail,
    subject,
    htmlBody,
    organizationId,
    azureToken
  );
};

/**
 * Send request rejection notification
 */
export const sendRejectionNotification = async (
  employeeEmail,
  employeeName,
  requestType,
  reason,
  organizationId,
  azureToken
) => {
  const subject = `Leave Request Rejected: ${requestType}`;

  const htmlBody = `
    <html>
      <body style="font-family: Arial, sans-serif;">
        <h2>Leave Request Status Update</h2>
        <p>Dear ${employeeName},</p>
        <p>Your ${requestType} leave request has been reviewed and rejected.</p>
        <p><strong>Reason:</strong> ${reason}</p>
        <p>Please contact your manager for further discussion.</p>
        <br />
        <p>Regards,<br />Human Resources</p>
      </body>
    </html>
  `;

  return sendNotificationEmail(
    employeeEmail,
    subject,
    htmlBody,
    organizationId,
    azureToken
  );
};

/**
 * Send new request submitted notification to managers
 */
export const sendSubmissionNotification = async (
  managerEmail,
  employeeName,
  requestType,
  startDate,
  endDate,
  organizationId,
  azureToken
) => {
  const subject = `New Leave Request for Review: ${employeeName}`;

  const htmlBody = `
    <html>
      <body style="font-family: Arial, sans-serif;">
        <h2>New Leave Request Pending Review</h2>
        <p>A new leave request has been submitted for your review.</p>
        <p>
          <strong>Employee:</strong> ${employeeName}<br />
          <strong>Leave Type:</strong> ${requestType}<br />
          <strong>Period:</strong> ${startDate} to ${endDate}
        </p>
        <p>Please log in to the leave management system to review and approve/reject this request.</p>
        <br />
        <p>Regards,<br />Leave Management System</p>
      </body>
    </html>
  `;

  return sendNotificationEmail(
    managerEmail,
    subject,
    htmlBody,
    organizationId,
    azureToken
  );
};

/**
 * Send a welcome / onboarding email to a newly-created organisation admin.
 *
 * The email is sent from the currently-authenticated Sotara super admin's
 * mailbox (whoever just created the org), using their Graph API token.
 *
 * Note: this does NOT call sendNotificationEmail because the new org's
 * notificationemail isn't reachable yet — we use the current user's
 * mailbox directly via /me/sendMail.
 *
 * @param {string} adminEmail        – New admin's email (recipient)
 * @param {string} adminFirstName    – Optional first name for greeting
 * @param {string} organizationName  – Display name of the new org
 * @param {string} azureToken        – Sotara admin's Graph API token
 * @param {string} [portalUrl]       – Login URL (defaults to leavehub.sotara.co.uk)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const sendOrgWelcomeEmail = async (
  adminEmail,
  adminFirstName,
  organizationName,
  azureToken,
  portalUrl = 'https://leavehub.sotara.co.uk'
) => {
  if (!adminEmail || !azureToken) {
    return { success: false, error: 'Missing adminEmail or azureToken' };
  }

  const greeting = adminFirstName ? `Hi ${adminFirstName},` : 'Hi,';
  const subject = `Welcome to Sotara LeaveHub — ${organizationName} is ready`;

  const htmlBody = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border-radius:12px;overflow:hidden;">

        <tr><td style="background:#064e3b;padding:28px 32px;">
          <p style="margin:0 0 6px 0;color:rgba(255,255,255,0.85);font-size:11px;text-transform:uppercase;letter-spacing:2px;">LeaveHub</p>
          <p style="margin:0;color:#fff;font-size:22px;font-weight:bold;">Welcome to Sotara LeaveHub</p>
        </td></tr>

        <tr><td style="padding:28px 32px 12px 32px;color:#111827;font-size:14px;line-height:1.55;">
          <p style="margin:0 0 14px 0;">${greeting}</p>
          <p style="margin:0 0 14px 0;">
            Your organisation <strong>${organizationName}</strong> is now set up on Sotara LeaveHub
            and you have been added as the administrator.
          </p>
          <p style="margin:0 0 14px 0;">
            You can sign in at any time using your Microsoft 365 account — no password needed.
            On first sign-in, Microsoft will ask you to consent to the app's permissions
            (read profile, send notification emails, access the Global Address List). If you
            are an Azure AD administrator at ${organizationName}, tick the
            <em>"Consent on behalf of your organisation"</em> box so other staff don't get
            prompted individually.
          </p>
        </td></tr>

        <tr><td style="padding:8px 32px 20px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;">
            <tr><td style="padding:14px 16px;">
              <p style="margin:0 0 8px 0;color:#065f46;font-weight:bold;font-size:13px;">Your getting-started checklist</p>
              <ol style="margin:0;padding-left:20px;color:#065f46;font-size:13px;line-height:1.7;">
                <li>Sign in at the link below with your M365 account</li>
                <li>Open <strong>Admin → Manage Staff</strong> and add your team (or import them)</li>
                <li>Set <strong>Default Settings</strong> (leave allowance, hours per day, holiday year)</li>
                <li>Add <strong>Term Dates</strong> if you're a school</li>
                <li>Optional: appoint <strong>Dept Heads</strong> to handle approvals</li>
              </ol>
            </td></tr>
          </table>
        </td></tr>

        <tr><td align="center" style="padding:0 32px 28px 32px;">
          <a href="${portalUrl}" target="_blank"
             style="background:#064e3b;border-radius:6px;color:#fff;display:inline-block;font-size:14px;font-weight:bold;padding:13px 28px;text-decoration:none;">
            Sign in to LeaveHub
          </a>
          <p style="margin:10px 0 0 0;font-size:11px;color:#9ca3af;">
            Or copy this link: <a href="${portalUrl}" style="color:#6b7280;">${portalUrl}</a>
          </p>
        </td></tr>

        <tr><td style="padding:0 32px 24px 32px;color:#374151;font-size:13px;line-height:1.55;">
          <p style="margin:0 0 8px 0;">
            Need help? Reply to this email — it goes straight to the Sotara team.
          </p>
          <p style="margin:0;">Welcome aboard,<br/>The Sotara team</p>
        </td></tr>

        <tr><td style="background:#f9fafb;padding:14px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:11px;text-align:center;">Sotara LeaveHub &bull; Onboarding Notification</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${azureToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: 'HTML', content: htmlBody },
          toRecipients: [{ emailAddress: { address: adminEmail } }],
        },
        saveToSentItems: true,
      }),
    });

    if (!response.ok) {
      let errorData;
      try { errorData = await response.json(); } catch { errorData = { status: response.status }; }
      const msg = errorData?.error?.message || `HTTP ${response.status}`;
      console.error('Welcome email failed:', msg);
      return { success: false, error: msg };
    }
    return { success: true };
  } catch (err) {
    console.error('Welcome email exception:', err.message);
    return { success: false, error: err.message };
  }
};

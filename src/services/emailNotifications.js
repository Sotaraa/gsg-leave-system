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

import { supabase } from '../supabase';

/**
 * Log every notification email attempt to email_log so admins can see
 * "did Jessen actually get the email?" without guessing.
 *
 * Status values:
 *   'sent'          – Graph API returned 2xx
 *   'failed'        – Graph API returned an error
 *   'no_recipients' – recipient list was empty after filters
 *   'no_token'      – user had no Microsoft Graph token
 *   'skipped'       – email send was suppressed (e.g. silent import)
 *
 * Never throws — logging failures must not break the calling flow.
 */
export const logEmail = async ({
  organizationId,
  triggeredBy = null,
  recipients = [],
  subject = null,
  context = null,
  status,
  errorMessage = null,
  requestId = null,
}) => {
  if (!organizationId || !status) return;
  try {
    await supabase.from('email_log').insert({
      organization_id: organizationId,
      triggered_by: triggeredBy,
      recipients: recipients,
      subject,
      context,
      status,
      error_message: errorMessage,
      request_id: requestId,
    });
  } catch (err) {
    // Logging is best-effort — never break the parent operation
    console.warn('email_log insert failed:', err?.message);
  }
};

/**
 * Fetch recent email log entries for the current organization.
 * @param {string} organizationId
 * @param {number} limit
 */
export const getRecentEmailLog = async (organizationId, limit = 50) => {
  if (!organizationId) return [];
  try {
    const { data, error } = await supabase
      .from('email_log')
      .select('*')
      .eq('organization_id', organizationId)
      .order('sent_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('email_log fetch failed:', err);
    return [];
  }
};

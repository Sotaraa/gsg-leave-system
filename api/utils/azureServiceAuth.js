/**
 * Azure Service-to-Service Authentication Utility
 * Enables cron jobs and backend services to obtain Azure AD tokens on behalf of organizations
 * Uses Client Credentials OAuth 2.0 flow (app-only authentication)
 *
 * IMPORTANT: Organizations must configure their Azure AD app registration with:
 * 1. Client ID and Client Secret stored in Supabase organizations table
 * 2. Calendars.ReadWrite and Calendar.ReadWrite.Shared permissions granted
 * 3. Admin consent given in Azure AD
 */

/**
 * Get Azure AD access token using Client Credentials flow
 * @param {string} organizationId - Organization ID in Supabase
 * @param {object} supabase - Supabase client instance
 * @returns {Promise<string>} Azure AD access token
 *
 * @throws {Error} If organization not found, credentials missing, or token request fails
 *
 * Token is valid for 1 hour. Cache if called multiple times in short succession.
 */
export async function getAzureServiceToken(organizationId, supabase) {
  if (!organizationId || !supabase) {
    throw new Error('organizationId and supabase client required');
  }

  // Fetch organization's Azure credentials from Supabase
  // Note: Postgres stores column names as lowercase, so we use lowercase keys
  const { data: org, error: fetchErr } = await supabase
    .from('organizations')
    .select(
      'id, azureclientid, azureclientsecret, azuretenantid, ssoconfigured'
    )
    .eq('id', organizationId)
    .single();

  if (fetchErr || !org) {
    throw new Error(
      `Organization ${organizationId} not found or not configured`
    );
  }

  if (!org.ssoconfigured) {
    throw new Error(
      `SSO not configured for organization ${organizationId}. Setup required before cron can sync.`
    );
  }

  if (!org.azureclientid || !org.azureclientsecret || !org.azuretenantid) {
    throw new Error(
      `Azure AD credentials incomplete for organization ${organizationId}. ` +
        `Required: azureclientid, azureclientsecret, azuretenantid in organizations table`
    );
  }

  // Request token from Azure AD Token Endpoint
  // Uses Client Credentials flow: https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-client-creds-grant-flow
  const tokenEndpoint = `https://login.microsoftonline.com/${org.azuretenantid}/oauth2/v2.0/token`;

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: org.azureclientid,
      client_secret: org.azureclientsecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `❌ Token request failed for ${organizationId}: ${response.status} - ${errorText}`
    );
    throw new Error(
      `Failed to obtain Azure token for organization ${organizationId}: ${response.status}`
    );
  }

  const tokenData = await response.json();

  if (!tokenData.access_token) {
    throw new Error(`No access token in response for organization ${organizationId}`);
  }

  console.log(`✅ Obtained Azure service token for ${organizationId}`);
  return tokenData.access_token;
}

/**
 * Get tokens for multiple organizations
 * @param {string[]} organizationIds - Array of organization IDs
 * @param {object} supabase - Supabase client instance
 * @returns {Promise<object>} Map of organizationId -> token
 *
 * Continues even if some organizations fail to get tokens.
 * Useful for batch operations where partial success is acceptable.
 */
export async function getAzureServiceTokens(organizationIds, supabase) {
  const tokens = {};
  const errors = [];

  for (const orgId of organizationIds) {
    try {
      tokens[orgId] = await getAzureServiceToken(orgId, supabase);
    } catch (err) {
      console.warn(`⚠️ Token error for ${orgId}:`, err.message);
      errors.push({
        organizationId: orgId,
        error: err.message,
      });
    }
  }

  return {
    tokens,
    errors,
    successCount: Object.keys(tokens).length,
    failureCount: errors.length,
  };
}

/**
 * Validate that organization has required Azure credentials
 * Useful for pre-flight checks before cron execution
 * @param {string} organizationId - Organization ID
 * @param {object} supabase - Supabase client instance
 * @returns {Promise<boolean>} True if credentials are present and SSO is configured
 */
export async function hasAzureCredentials(organizationId, supabase) {
  try {
    const { data: org } = await supabase
      .from('organizations')
      .select('ssoconfigured, azureclientid, azureclientsecret, azuretenantid')
      .eq('id', organizationId)
      .single();

    return !!(
      org &&
      org.ssoconfigured &&
      org.azureclientid &&
      org.azureclientsecret &&
      org.azuretenantid
    );
  } catch (err) {
    return false;
  }
}

/**
 * Get organizations that are ready for service-to-service auth
 * @param {object} supabase - Supabase client instance
 * @returns {Promise<object[]>} Array of organization objects with credentials
 */
export async function getConfiguredOrganizations(supabase) {
  try {
    const { data: orgs, error } = await supabase
      .from('organizations')
      .select(
        'id, name, azureclientid, azureclientsecret, azuretenantid, notificationemail, ssoconfigured'
      )
      .eq('ssoconfigured', true)
      .not('azureclientid', 'is', null)
      .not('azureclientsecret', 'is', null)
      .not('azuretenantid', 'is', null)
      .not('notificationemail', 'is', null);

    if (error) {
      console.error('Error fetching organizations:', error.message);
      return [];
    }

    return orgs || [];
  } catch (err) {
    console.error('Error in getConfiguredOrganizations:', err);
    return [];
  }
}

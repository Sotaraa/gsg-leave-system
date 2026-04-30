/**
 * Staff Calendar Debug Endpoint
 * Troubleshoots why staff calendar imports are failing
 */

const SUPABASE_URL = 'https://uzmdqryhzijkmwedvwka.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6bWRxcnloemlqa213ZWR2d2thIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNjM2MzMsImV4cCI6MjA5MjkzOTYzM30.O249bdKDyI4IUFRD5pdKIvtxYF1ihR0uQ2SOVBvl3qc';

async function supabaseQuery(table, query = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Accept': 'application/json',
      'Content-Profile': 'public'
    }
  });

  if (!response.ok) {
    throw new Error(`${response.status}: ${await response.text()}`);
  }

  return response.json();
}

export default async function handler(req, res) {
  try {
    const { org: organizationId, token } = req.query;

    const debug = {
      organizationId,
      token: token ? `${token.substring(0, 8)}...${token.substring(token.length - 4)}` : 'MISSING',
      timestamp: new Date().toISOString(),
      checks: {}
    };

    // Check 1: Organization exists
    try {
      const orgs = await supabaseQuery('organizations', `id=eq.${organizationId}&select=id,name,calendar_access_token,calendar_token_enabled`);
      debug.checks.organization = {
        found: orgs.length > 0,
        data: orgs[0] ? {
          id: orgs[0].id,
          name: orgs[0].name,
          tokenEnabled: orgs[0].calendar_token_enabled,
          tokenExists: !!orgs[0].calendar_access_token,
          tokenStored: orgs[0].calendar_access_token ? `${orgs[0].calendar_access_token.substring(0, 8)}...` : 'NONE'
        } : null
      };
    } catch (err) {
      debug.checks.organization = { error: err.message };
    }

    // Check 2: Token validation
    try {
      if (!organizationId || !token) {
        debug.checks.tokenValidation = { error: 'Missing org or token parameter' };
      } else {
        const orgs = await supabaseQuery('organizations', `id=eq.${organizationId}&select=calendar_access_token,calendar_token_enabled`);
        const org = orgs[0];

        debug.checks.tokenValidation = {
          tokenProvided: !!token,
          tokenEnabled: org?.calendar_token_enabled,
          tokenMatches: org?.calendar_access_token === token,
          valid: org?.calendar_token_enabled && org?.calendar_access_token === token
        };
      }
    } catch (err) {
      debug.checks.tokenValidation = { error: err.message };
    }

    // Check 3: Data availability
    try {
      const termDates = await supabaseQuery('mt_termdates', `organization_id=eq.${organizationId}&select=count`);
      const leaves = await supabaseQuery(
        'mt_requests',
        `organization_id=eq.${organizationId}&status=eq.Approved&select=count`
      );
      const schoolTerms = await supabaseQuery('mt_schoolterms', `organization_id=eq.${organizationId}&select=count`);

      debug.checks.data = {
        termDates: termDates?.length || 0,
        approvedLeave: leaves?.length || 0,
        schoolTerms: schoolTerms?.length || 0
      };
    } catch (err) {
      debug.checks.data = { error: err.message };
    }

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(debug);
  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
}

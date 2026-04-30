/**
 * Debug endpoint - shows what data the calendar API is finding
 * Visit: /api/calendar-debug?org=gardener-schools
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
    const { org: organizationId } = req.query;

    if (!organizationId) {
      return res.status(400).json({ error: 'Missing org parameter' });
    }

    const debug = {
      organizationId,
      timestamp: new Date().toISOString(),
      data: {}
    };

    // Check organization
    try {
      const orgs = await supabaseQuery('organizations', `id=eq.${organizationId}`);
      debug.data.organization = orgs[0] || null;
    } catch (err) {
      debug.data.organization_error = err.message;
    }

    // Check term dates (use lowercase table/column names)
    try {
      const termDates = await supabaseQuery(
        'mt_termdates',
        `organization_id=eq.${organizationId}&select=date,type,description`
      );
      debug.data.termDates = {
        count: termDates.length,
        sample: termDates.slice(0, 2)
      };
    } catch (err) {
      debug.data.termDates_error = err.message;
    }

    // Check school terms (use lowercase table/column names)
    try {
      const schoolTerms = await supabaseQuery(
        'mt_schoolterms',
        `organization_id=eq.${organizationId}&select=academicyear,autumnstart,autumnend`
      );
      debug.data.schoolTerms = {
        count: schoolTerms.length,
        sample: schoolTerms.slice(0, 1)
      };
    } catch (err) {
      debug.data.schoolTerms_error = err.message;
    }

    // Check approved leave (use lowercase column names)
    try {
      const today = new Date().toISOString().split('T')[0];
      const leaves = await supabaseQuery(
        'mt_requests',
        `organization_id=eq.${organizationId}&status=eq.Approved&enddate=gte.${today}&select=id,employeename,type,startdate,enddate,status`
      );
      debug.data.approvedLeave = {
        count: leaves.length,
        sample: leaves.slice(0, 3)
      };
    } catch (err) {
      debug.data.approvedLeave_error = err.message;
    }

    // Check ALL requests (regardless of status) to see what's there (use lowercase)
    try {
      const allRequests = await supabaseQuery(
        'mt_requests',
        `organization_id=eq.${organizationId}&select=id,employeename,type,startdate,status`
      );
      debug.data.allRequests = {
        count: allRequests.length,
        statuses: [...new Set(allRequests.map(r => r.status))],
        sample: allRequests.slice(0, 3)
      };
    } catch (err) {
      debug.data.allRequests_error = err.message;
    }

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(debug);
  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
}

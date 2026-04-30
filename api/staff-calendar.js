/**
 * Staff Calendar Endpoint
 * Public subscription endpoint for approved leave + holidays (excludes sick/medical)
 *
 * Requires valid organization ID and access token for security
 * Query params: ?org=ORGANIZATION_ID&token=ACCESS_TOKEN&include=leave
 *
 * Returns iCalendar (.ics) format for Outlook/Google Calendar subscription
 */

import { generateICalendar } from '../src/services/calendarSync.js';

const SUPABASE_URL = 'https://uzmdqryhzijkmwedvwka.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6bWRxcnloemlqa213ZWR2d2thIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNjM2MzMsImV4cCI6MjA5MjkzOTYzM30.O249bdKDyI4IUFRD5pdKIvtxYF1ihR0uQ2SOVBvl3qc';

/**
 * Validate organization token from database
 */
async function validateToken(organizationId, token) {
  const url = `${SUPABASE_URL}/rest/v1/organizations?id=eq.${organizationId}&select=calendar_access_token,calendar_token_enabled`;

  try {
    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      return { valid: false, reason: 'Organization not found' };
    }

    const data = await response.json();
    if (!data.length) {
      return { valid: false, reason: 'Organization not found' };
    }

    const org = data[0];

    // Check if token is enabled
    if (!org.calendar_token_enabled) {
      return { valid: false, reason: 'Calendar token is disabled' };
    }

    // Validate token matches
    if (org.calendar_access_token !== token) {
      return { valid: false, reason: 'Invalid token' };
    }

    return { valid: true };
  } catch (err) {
    return { valid: false, reason: `Validation error: ${err.message}` };
  }
}

/**
 * Query Supabase with fetch
 */
async function supabaseQuery(table, query = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;

  try {
    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Accept': 'application/json',
        'Content-Profile': 'public'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Supabase ${response.status}: ${error}`);
    }

    return await response.json();
  } catch (err) {
    throw err;
  }
}

export default async function handler(req, res) {
  try {
    const { org: organizationId, token, include } = req.query;

    // Validate required parameters
    if (!organizationId || !token) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['org', 'token']
      });
    }

    // Validate token
    const validation = await validateToken(organizationId, token);
    if (!validation.valid) {
      return res.status(403).json({
        error: 'Unauthorized',
        reason: validation.reason
      });
    }

    // Fetch organization
    let orgData;
    try {
      const orgs = await supabaseQuery('organizations', `id=eq.${organizationId}&select=id,name,domain`);
      orgData = orgs[0];
    } catch (err) {
      return res.status(404).json({
        error: `Organization not found`,
        details: err.message
      });
    }

    if (!orgData) {
      return res.status(404).json({
        error: `Organization not found`
      });
    }

    // Fetch term dates
    let termDates = [];
    try {
      termDates = await supabaseQuery(
        'mt_termdates',
        `organization_id=eq.${organizationId}&select=date,type,description&order=date.asc`
      );
    } catch (err) {
      console.warn(`[Staff Calendar] Term dates fetch error:`, err.message);
    }

    // Fetch school terms
    let schoolTerms = [];
    try {
      const rawTerms = await supabaseQuery(
        'mt_schoolterms',
        `organization_id=eq.${organizationId}&select=academicyear,autumnstart,autumnend,springstart,springend,summerstart,summerend&order=academicyear.desc&limit=3`
      );
      schoolTerms = rawTerms.map(t => ({
        academicYear: t.academicyear,
        autumnStart: t.autumnstart,
        autumnEnd: t.autumnend,
        springStart: t.springstart,
        springEnd: t.springend,
        summerStart: t.summerstart,
        summerEnd: t.summerend
      }));
    } catch (err) {
      console.warn(`[Staff Calendar] School terms fetch error:`, err.message);
    }

    // Fetch approved leave (EXCLUDING restricted types)
    let approvedLeave = [];
    if (include === 'leave') {
      try {
        const today = new Date().toISOString().split('T')[0];
        const rawLeaves = await supabaseQuery(
          'mt_requests',
          `organization_id=eq.${organizationId}&status=eq.Approved&enddate=gte.${today}&select=id,employeename,employeeemail,type,startdate,enddate,status,dayscount&order=startdate.asc`
        );

        // Filter out restricted leave types
        const restrictedTypes = ['Sick Leave', 'Medical Appt', 'Compassionate'];
        approvedLeave = rawLeaves
          .filter(leave => !restrictedTypes.includes(leave.type))
          .map(leave => ({
            id: leave.id,
            employeeName: leave.employeename,
            employeeEmail: leave.employeeemail,
            type: leave.type,
            startDate: leave.startdate,
            endDate: leave.enddate,
            status: leave.status,
            daysCount: leave.dayscount
          }));
      } catch (err) {
        console.warn(`[Staff Calendar] Leave fetch error:`, err.message);
      }
    }

    // Generate iCalendar
    const icsContent = generateICalendar(
      organizationId,
      termDates,
      schoolTerms,
      approvedLeave,
      orgData
    );

    if (!icsContent || icsContent.length < 100) {
      return res.status(500).json({
        error: 'Failed to generate valid calendar data'
      });
    }

    // Set response headers for .ics file
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(icsContent, 'utf-8'));
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    return res.status(200).send(icsContent);
  } catch (error) {
    console.error('[Staff Calendar] Unhandled error:', error);
    return res.status(500).json({
      error: 'Failed to generate calendar',
      message: error.message
    });
  }
}

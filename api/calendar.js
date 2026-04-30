/**
 * Vercel Serverless Function - Calendar iCalendar Feed
 *
 * Endpoint: /api/calendar?org=ORGANIZATION_ID&include=leave
 *
 * Returns an iCalendar (.ics) file that can be:
 * - Subscribed to in Outlook (webcal://)
 * - Imported to Google Calendar
 * - Used with any iCalendar-compatible app
 *
 * Uses direct Supabase REST API instead of client library for reliability
 */

import { generateICalendar } from '../src/services/calendarSync.js';

// Supabase credentials (hardcoded, same as in src/supabase.js)
const SUPABASE_URL = 'https://uzmdqryhzijkmwedvwka.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6bWRxcnloemlqa213ZWR2d2thIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNjM2MzMsImV4cCI6MjA5MjkzOTYzM30.O249bdKDyI4IUFRD5pdKIvtxYF1ihR0uQ2SOVBvl3qc';

console.log('[Calendar API] Supabase initialized:', {
  url: SUPABASE_URL ? '✓' : '✗',
  key: SUPABASE_KEY ? '✓' : '✗'
});

/**
 * Make authenticated request to Supabase REST API
 */
async function supabaseQuery(table, query = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
  console.log(`[Calendar API] Querying: ${url.substring(0, 80)}...`);

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
      console.error(`[Calendar API] Query failed (${response.status}):`, error.substring(0, 200));
      throw new Error(`Supabase ${response.status}: ${error}`);
    }

    const data = await response.json();
    console.log(`[Calendar API] Query returned ${Array.isArray(data) ? data.length : 1} record(s)`);
    return data;
  } catch (err) {
    console.error(`[Calendar API] Fetch error:`, err.message);
    throw err;
  }
}

export default async function handler(req, res) {
  try {
    const { org: organizationId, include } = req.query;

    if (!organizationId) {
      return res.status(400).json({
        error: 'Missing organization ID. Use ?org=ORGANIZATION_ID'
      });
    }

    console.log(`[Calendar API] Generating calendar for org: ${organizationId}`);

    // Fetch organization details
    let orgData;
    try {
      const orgs = await supabaseQuery('organizations', `id=eq.${organizationId}&select=id,name,domain`);
      orgData = orgs[0];
    } catch (err) {
      console.error(`[Calendar API] Org fetch error:`, err.message);
      return res.status(404).json({
        error: `Organization "${organizationId}" not found`,
        details: err.message
      });
    }

    if (!orgData) {
      return res.status(404).json({
        error: `Organization "${organizationId}" not found`
      });
    }

    console.log(`[Calendar API] Found organization: ${orgData.name}`);

    // Fetch term dates (holidays, school breaks)
    // Note: Table names in Supabase are lowercase!
    let termDates = [];
    try {
      termDates = await supabaseQuery(
        'mt_termdates',
        `organization_id=eq.${organizationId}&select=date,type,description&order=date.asc`
      );
    } catch (err) {
      console.warn(`[Calendar API] Term dates fetch error:`, err.message);
    }

    // Fetch school terms
    let schoolTerms = [];
    try {
      const rawTerms = await supabaseQuery(
        'mt_schoolterms',
        `organization_id=eq.${organizationId}&select=academicyear,autumnstart,autumnend,springstart,springend,summerstart,summerend&order=academicyear.desc&limit=3`
      );
      // Map lowercase column names to camelCase
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
      console.warn(`[Calendar API] School terms fetch error:`, err.message);
    }

    // Optionally fetch approved leave
    // Note: Column names in Supabase are lowercase!
    let approvedLeave = [];
    if (include === 'leave') {
      try {
        const today = new Date().toISOString().split('T')[0];
        const rawLeaves = await supabaseQuery(
          'mt_requests',
          `organization_id=eq.${organizationId}&status=eq.Approved&enddate=gte.${today}&select=id,employeename,employeeemail,type,startdate,enddate,status,dayscount&order=startdate.asc`
        );
        // Map lowercase column names to camelCase
        approvedLeave = rawLeaves.map(leave => ({
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
        console.warn(`[Calendar API] Leave fetch error:`, err.message);
      }
    }

    // Generate iCalendar
    console.log(`[Calendar API] Generating iCalendar with ${termDates.length} term dates, ${approvedLeave.length} leave records`);

    const icsContent = generateICalendar(
      organizationId,
      termDates,
      schoolTerms,
      approvedLeave,
      orgData
    );

    if (!icsContent || icsContent.length < 100) {
      console.error('[Calendar API] Generated invalid iCalendar content', { length: icsContent?.length });
      return res.status(500).json({
        error: 'Failed to generate valid calendar data'
      });
    }

    console.log(`[Calendar API] Generated iCalendar (${icsContent.length} bytes)`);

    // Set response headers for .ics file
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(icsContent, 'utf-8'));
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    return res.status(200).send(icsContent);
  } catch (error) {
    console.error('[Calendar API] Unhandled error:', error);
    return res.status(500).json({
      error: 'Failed to generate calendar',
      message: error.message
    });
  }
}

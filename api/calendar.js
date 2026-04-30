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

// Get Supabase credentials from environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

console.log('[Calendar API] Credentials available:', {
  url: !!SUPABASE_URL,
  key: !!SUPABASE_KEY
});

/**
 * Make authenticated request to Supabase REST API
 */
async function supabaseQuery(table, query = '') {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Missing Supabase credentials');
  }

  const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
  console.log(`[Calendar API] Querying: ${table}`);

  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[Calendar API] Query failed:`, error);
    throw new Error(`Supabase query failed: ${response.status} ${error}`);
  }

  return response.json();
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
    let termDates = [];
    try {
      termDates = await supabaseQuery(
        'mt_termDates',
        `organization_id=eq.${organizationId}&select=date,type,description&order=date.asc`
      );
    } catch (err) {
      console.warn(`[Calendar API] Term dates fetch error:`, err.message);
    }

    // Fetch school terms
    let schoolTerms = [];
    try {
      schoolTerms = await supabaseQuery(
        'mt_schoolTerms',
        `organization_id=eq.${organizationId}&select=academicYear,autumnStart,autumnEnd,springStart,springEnd,summerStart,summerEnd&order=academicYear.desc&limit=3`
      );
    } catch (err) {
      console.warn(`[Calendar API] School terms fetch error:`, err.message);
    }

    // Optionally fetch approved leave
    let approvedLeave = [];
    if (include === 'leave') {
      try {
        const today = new Date().toISOString().split('T')[0];
        approvedLeave = await supabaseQuery(
          'mt_requests',
          `organization_id=eq.${organizationId}&status=eq.Approved&endDate=gte.${today}&select=id,employeeName,employeeEmail,type,startDate,endDate,status,daysCount&order=startDate.asc`
        );
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

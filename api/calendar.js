/**
 * Vercel Serverless Function - Calendar iCalendar Feed
 *
 * Endpoint: /api/calendar?org=ORGANIZATION_ID&include=leave
 *
 * Returns an iCalendar (.ics) file that can be:
 * - Subscribed to in Outlook (webcal://)
 * - Imported to Google Calendar
 * - Used with any iCalendar-compatible app
 */

import { createClient } from '@supabase/supabase-js';
import { generateICalendar } from '../src/services/calendarSync.js';

// Get Supabase credentials from environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
                     process.env.SUPABASE_SERVICE_ROLE_KEY ||
                     process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase environment variables', {
    url: !!SUPABASE_URL,
    key: !!SUPABASE_KEY
  });
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req, res) {
  try {
    // Verify environment variables are set
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.error('Supabase environment variables not configured');
      return res.status(500).json({
        error: 'Server misconfiguration: Missing Supabase credentials'
      });
    }

    const { org: organizationId, include } = req.query;

    if (!organizationId) {
      return res.status(400).json({
        error: 'Missing organization ID. Use ?org=ORGANIZATION_ID'
      });
    }

    console.log(`[Calendar API] Generating calendar for org: ${organizationId}`);

    // Fetch organization details
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, domain')
      .eq('id', organizationId)
      .single();

    if (orgError) {
      console.error(`[Calendar API] Org fetch error: ${orgError.message}`);
      return res.status(404).json({
        error: `Organization "${organizationId}" not found`,
        details: orgError.message
      });
    }

    if (!orgData) {
      return res.status(404).json({
        error: `Organization "${organizationId}" not found`
      });
    }

    console.log(`[Calendar API] Found organization: ${orgData.name}`);

    // Fetch term dates (holidays, school breaks)
    const { data: termDates } = await supabase
      .from('mt_termDates')
      .select('date, type, description')
      .eq('organization_id', organizationId)
      .order('date', { ascending: true });

    // Fetch school terms
    const { data: schoolTerms } = await supabase
      .from('mt_schoolTerms')
      .select('academicYear, autumnStart, autumnEnd, springStart, springEnd, summerStart, summerEnd')
      .eq('organization_id', organizationId)
      .order('academicYear', { ascending: false })
      .limit(3); // Last 3 academic years

    // Optionally fetch approved leave
    let approvedLeave = [];
    if (include === 'leave') {
      const { data: leaves } = await supabase
        .from('mt_requests')
        .select('id, employeeName, employeeEmail, type, startDate, endDate, status, daysCount')
        .eq('organization_id', organizationId)
        .eq('status', 'Approved')
        .gte('endDate', new Date().toISOString().split('T')[0])
        .order('startDate', { ascending: true });

      approvedLeave = leaves || [];
    }

    // Generate iCalendar
    console.log(`[Calendar API] Generating iCalendar with ${termDates?.length || 0} term dates, ${approvedLeave?.length || 0} leave records`);

    const icsContent = generateICalendar(
      organizationId,
      termDates || [],
      schoolTerms || [],
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
    // Important: Don't use attachment for webcal protocol - browsers need to process it
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(icsContent, 'utf-8'));
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allow CORS
    res.setHeader('X-Content-Type-Options', 'nosniff');

    return res.status(200).send(icsContent);
  } catch (error) {
    console.error('[Calendar API] Unhandled error:', error);
    return res.status(500).json({
      error: 'Failed to generate calendar',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

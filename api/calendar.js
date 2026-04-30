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

// Initialize Supabase client (uses service role for public data fetch)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  try {
    const { org: organizationId, include } = req.query;

    if (!organizationId) {
      return res.status(400).json({
        error: 'Missing organization ID. Use ?org=ORGANIZATION_ID'
      });
    }

    // Fetch organization details
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, domain')
      .eq('id', organizationId)
      .single();

    if (orgError || !orgData) {
      return res.status(404).json({
        error: `Organization "${organizationId}" not found`
      });
    }

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
    const icsContent = generateICalendar(
      organizationId,
      termDates || [],
      schoolTerms || [],
      approvedLeave,
      orgData
    );

    // Set response headers for .ics file
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${orgData.name.replace(/[^a-zA-Z0-9]/g, '_')}_calendar.ics"`);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allow iframe embeds

    return res.status(200).send(icsContent);
  } catch (error) {
    console.error('Calendar API Error:', error);
    return res.status(500).json({
      error: 'Failed to generate calendar',
      message: error.message
    });
  }
}

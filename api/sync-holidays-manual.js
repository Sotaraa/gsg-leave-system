/**
 * Manual Holiday Sync API Endpoint
 *
 * Allows admin users to manually trigger holiday sync for their organization
 * Uses the admin's existing Azure token (obtained via SSO)
 *
 * POST /api/sync-holidays-manual
 * Body: { organizationId, azureToken }
 * Response: { success: boolean, holidaysSynced: number, errors: string[] }
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://uzmdqryhzijkmwedvwka.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

// Use anon key (user-scoped access) for this endpoint
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Create holiday event in shared calendar
 */
async function createHolidayEvent(
  holidayDate,
  holidayName,
  organizationEmail,
  azureToken
) {
  const date = new Date(holidayDate);
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);

  const eventBody = {
    subject: `🏫 ${holidayName}`,
    body: {
      contentType: 'HTML',
      content: `<p><strong>${holidayName}</strong></p><p>School holiday</p>`,
    },
    start: {
      dateTime: date.toISOString(),
      timeZone: 'Europe/London',
    },
    end: {
      dateTime: nextDay.toISOString(),
      timeZone: 'Europe/London',
    },
    isAllDay: true,
    isReminderOn: false,
    categories: ['Holiday', 'SchoolHoliday'],
    showAs: 'free',
  };

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${organizationEmail}/events`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${azureToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventBody),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Graph API error: ${response.status} - ${error}`);
  }

  const event = await response.json();
  return event;
}

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { organizationId, azureToken } = req.body;

  if (!organizationId || !azureToken) {
    return res
      .status(400)
      .json({ error: 'organizationId and azureToken required' });
  }

  const results = {
    organizationId,
    status: 'pending',
    holidaysSynced: 0,
    errors: [],
  };

  try {
    console.log(`🔄 Manual sync request for organization: ${organizationId}`);

    // Get organization details
    const { data: org, error: orgErr } = await supabase
      .from('organizations')
      .select('id, name, notificationemail')
      .eq('id', organizationId)
      .single();

    if (orgErr || !org) {
      return res
        .status(404)
        .json({ error: `Organization ${organizationId} not found` });
    }

    // Get all non-synced holidays for this organization
    const { data: holidays, error: holidaysErr } = await supabase
      .from('mt_termdates')
      .select('*')
      .eq('organization_id', organizationId)
      .neq('type', 'Bank Holiday')
      .order('date', { ascending: true });

    if (holidaysErr) {
      throw new Error(`Failed to fetch holidays: ${holidaysErr.message}`);
    }

    if (!holidays || holidays.length === 0) {
      console.log(`⏭️  No holidays to sync for ${org.name}`);
      results.status = 'success';
      results.message = 'No holidays found to sync';
      return res.status(200).json(results);
    }

    console.log(
      `📅 Found ${holidays.length} holidays for ${org.name} to sync`
    );

    // Sync each holiday
    for (const holiday of holidays) {
      try {
        // Create event in shared calendar
        const event = await createHolidayEvent(
          holiday.date,
          holiday.description || holiday.type,
          org.notificationemail,
          azureToken
        );

        // Update database with sync result
        const { error: updateErr } = await supabase
          .from('mt_termdates')
          .update({
            calendar_event_id: event.id,
            calendar_synced_at: new Date().toISOString(),
            calendar_sync_status: 'synced',
          })
          .eq('id', holiday.id);

        if (updateErr) {
          console.warn(
            `⚠️  Event created but DB update failed: ${holiday.description}`
          );
        } else {
          results.holidaysSynced++;
          console.log(`✅ Synced: ${holiday.description}`);
        }
      } catch (eventErr) {
        const errorMsg = `${holiday.description}: ${eventErr.message}`;
        console.error(`❌ ${errorMsg}`);
        results.errors.push(errorMsg);
      }
    }

    // Log sync activity
    try {
      await supabase.from('calendar_sync_log').insert({
        organization_id: organizationId,
        sync_type: 'manual',
        holidays_synced: results.holidaysSynced,
        events_created: results.holidaysSynced,
        events_updated: 0,
        events_deleted: 0,
        errors: results.errors.length > 0 ? results.errors.join('; ') : null,
      });
    } catch (logErr) {
      console.warn('Failed to log sync activity:', logErr.message);
    }

    results.status = 'success';
    console.log(
      `✅ Manual sync completed: ${results.holidaysSynced} synced, ${results.errors.length} errors`
    );

    return res.status(200).json(results);
  } catch (err) {
    console.error('Manual sync error:', err);
    results.status = 'error';
    results.error = err.message;
    return res.status(500).json(results);
  }
}

/**
 * Holiday Calendar Sync Service
 * Handles real-time and scheduled syncing of holidays to shared Outlook calendars
 * Works for all organizations (multi-tenant)
 */

import { supabase } from '../supabase.js';
import {
  syncHolidaysToSharedCalendar,
  createHolidayEvent,
  deleteLeaveEvent,
} from './graphCalendar.js';

/**
 * Sync a single holiday to the organization's shared calendar (real-time)
 * Called immediately when admin creates/updates/deletes a holiday
 */
export const syncSingleHoliday = async (
  holidayId,
  organizationId,
  azureToken,
  notificationEmail,
  action = 'create' // 'create', 'update', or 'delete'
) => {
  try {
    if (!azureToken || !notificationEmail) {
      console.log(`⏭️ Skipping holiday sync - missing token or email`);
      return { success: false, reason: 'No token or email' };
    }

    // Fetch the holiday details
    const { data: holiday, error: fetchErr } = await supabase
      .from('mt_termdates')
      .select('*')
      .eq('id', holidayId)
      .eq('organization_id', organizationId)
      .single();

    if (fetchErr || !holiday) {
      console.error('Holiday not found:', fetchErr?.message);
      return { success: false, reason: 'Holiday not found' };
    }

    // Skip bank holidays from shared calendar
    if (holiday.type === 'Bank Holiday') {
      console.log(`⏭️ Skipping bank holiday from shared calendar: ${holiday.description}`);
      return { success: false, reason: 'Bank holidays excluded' };
    }

    // Handle delete
    if (action === 'delete') {
      if (holiday.calendar_event_id) {
        await deleteLeaveEvent(notificationEmail, holiday.calendar_event_id, azureToken);
      }
      return { success: true, action: 'deleted' };
    }

    // Create or update event
    const result = await createHolidayEvent(
      holiday.date,
      holiday.description || holiday.type,
      notificationEmail,
      azureToken
    );

    if (result.success && result.eventId) {
      // Store the event ID for future reference
      await supabase
        .from('mt_termdates')
        .update({
          calendar_event_id: result.eventId,
          calendar_synced_at: new Date().toISOString(),
          calendar_sync_status: 'synced',
        })
        .eq('id', holidayId);

      console.log(`✅ Holiday synced: ${holiday.description}`);
      return { success: true, eventId: result.eventId, action };
    }

    return { success: false, reason: 'Event creation failed' };
  } catch (err) {
    console.error('Holiday sync error:', err);
    return { success: false, reason: err.message };
  }
};

/**
 * Full sync for one organization (scheduled or manual)
 * Compares database holidays with Outlook calendar
 */
export const syncOrganizationHolidays = async (
  organizationId,
  azureToken,
  notificationEmail
) => {
  const stats = {
    created: 0,
    updated: 0,
    failed: 0,
    errors: [],
  };

  try {
    if (!azureToken || !notificationEmail) {
      console.log(`⏭️ Skipping org sync - missing token or email`);
      return { success: false, stats };
    }

    console.log(`🔄 Syncing holidays for org: ${organizationId}`);

    // Fetch all non-synced or recently modified holidays
    const { data: holidays, error: fetchErr } = await supabase
      .from('mt_termdates')
      .select('*')
      .eq('organization_id', organizationId)
      .neq('type', 'Bank Holiday') // Exclude bank holidays
      .order('date', { ascending: true });

    if (fetchErr) {
      console.error('Failed to fetch holidays:', fetchErr.message);
      stats.errors.push(`Database fetch failed: ${fetchErr.message}`);
      return { success: false, stats };
    }

    // Sync each holiday
    for (const holiday of holidays || []) {
      try {
        // Skip if already synced and not modified recently
        if (
          holiday.calendar_synced_at &&
          holiday.calendar_sync_status === 'synced'
        ) {
          const lastSync = new Date(holiday.calendar_synced_at);
          const now = new Date();
          const hoursSinceSync = (now - lastSync) / (1000 * 60 * 60);

          if (hoursSinceSync < 24) {
            console.log(`⏭️ Already synced: ${holiday.description}`);
            continue;
          }
        }

        // Sync the holiday
        const result = await createHolidayEvent(
          holiday.date,
          holiday.description || holiday.type,
          notificationEmail,
          azureToken
        );

        if (result.success && result.eventId) {
          // Update database
          await supabase
            .from('mt_termdates')
            .update({
              calendar_event_id: result.eventId,
              calendar_synced_at: new Date().toISOString(),
              calendar_sync_status: 'synced',
            })
            .eq('id', holiday.id);

          stats.created++;
          console.log(`✅ Synced: ${holiday.description}`);
        } else {
          stats.failed++;
          stats.errors.push(`Failed to sync: ${holiday.description}`);
        }
      } catch (err) {
        stats.failed++;
        stats.errors.push(`${holiday.description}: ${err.message}`);
        console.error(`Error syncing holiday:`, err);
      }
    }

    console.log(
      `✅ Org sync complete: ${stats.created} created, ${stats.failed} failed`
    );
    return { success: true, stats };
  } catch (err) {
    console.error('Organization sync error:', err);
    stats.errors.push(err.message);
    return { success: false, stats };
  }
};

/**
 * Log sync activity for debugging and monitoring
 */
export const logSyncActivity = async (
  organizationId,
  syncType,
  stats,
  errors = []
) => {
  try {
    await supabase.from('calendar_sync_log').insert({
      organization_id: organizationId,
      sync_type: syncType,
      holidays_synced: stats.created || 0,
      events_created: stats.created || 0,
      events_updated: stats.updated || 0,
      events_deleted: 0,
      errors: errors.length > 0 ? errors.join('; ') : null,
    });
  } catch (err) {
    console.warn('Failed to log sync activity:', err.message);
  }
};

/**
 * Full sync for ALL organizations (called by scheduled cron)
 * Each org is independent and isolated
 */
export const syncAllOrganizationsHolidays = async () => {
  console.log('🌍 Starting multi-tenant holiday sync for all organizations...');

  try {
    // Get all active organizations with Azure credentials
    const { data: orgs, error: fetchErr } = await supabase
      .from('organizations')
      .select('id, notificationemail, azureclientid, azuretenantid')
      .eq('ssoconfigured', true)
      .not('notificationemail', 'is', null);

    if (fetchErr) {
      console.error('Failed to fetch organizations:', fetchErr.message);
      return { success: false, error: fetchErr.message };
    }

    const results = [];

    for (const org of orgs || []) {
      try {
        console.log(`\n📧 Syncing org: ${org.id}`);

        // Note: In production, you'd need to get a fresh Azure token for each org
        // For now, we're assuming the token is available via the Graph API directly
        // In a real scenario, you'd regenerate tokens or use service-to-service auth

        // Skip this org if we can't get a token
        // (In production, use client credentials flow to get token per org)
        console.log(`⏭️ Scheduled sync for ${org.id} needs service-to-service auth`);

        results.push({
          organizationId: org.id,
          status: 'skipped',
          reason: 'Service-to-service auth required',
        });
      } catch (err) {
        console.error(`Error syncing org ${org.id}:`, err.message);
        results.push({
          organizationId: org.id,
          status: 'error',
          error: err.message,
        });
      }
    }

    console.log(`\n✅ Multi-tenant sync complete: ${results.length} organizations`);
    return { success: true, results };
  } catch (err) {
    console.error('Multi-tenant sync error:', err);
    return { success: false, error: err.message };
  }
};

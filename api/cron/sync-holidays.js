/**
 * Vercel Cron Function - Sync Holidays Daily
 * Runs automatically every day at 2:00 AM UTC
 * Works for all organizations independently
 *
 * Configuration in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/sync-holidays",
 *     "schedule": "0 2 * * *"
 *   }]
 * }
 *
 * IMPORTANT: Set CRON_SECRET in Vercel environment variables for security
 * (any non-empty string works as a basic verification)
 *
 * Requirements:
 * - SUPABASE_URL environment variable (project URL)
 * - SUPABASE_SERVICE_ROLE_KEY environment variable (service role key for full access)
 * - Each organization must have:
 *   * azureClientId, azureClientSecret, azureTenantId in Supabase
 *   * Azure AD app registration with Calendars.ReadWrite + Calendar.ReadWrite.Shared permissions
 */

import { getConfiguredOrganizations, getAzureServiceToken } from '../utils/azureServiceAuth.js';
import { createClient } from '@supabase/supabase-js';

// Use hardcoded Supabase URL (avoid environment variable issues on deployment)
const SUPABASE_URL = 'https://uzmdqryhzijkmwedvwka.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate environment variables before creating client
if (!SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is not set. Required for cron job to function.');
}

// Create Supabase client with service role key (full access, use sparingly)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function supabaseQuery(table, query = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Accept': 'application/json',
      'Content-Profile': 'public',
    },
  });

  if (!response.ok) {
    throw new Error(`${response.status}: ${await response.text()}`);
  }

  return response.json();
}

/**
 * Create or update holiday event in organization's shared calendar via Graph API
 */
async function createHolidayEvent(
  holidayDate,
  holidayName,
  organizationEmail,
  azureToken
) {
  if (!azureToken) {
    throw new Error('Azure token required to create calendar events');
  }

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

/**
 * Get or create shared calendar
 */
async function getOrCreateSharedCalendar(organizationEmail, azureToken) {
  // Try to find existing calendar
  const listResponse = await fetch(
    `https://graph.microsoft.com/v1.0/users/${organizationEmail}/calendars`,
    {
      headers: {
        'Authorization': `Bearer ${azureToken}`,
      },
    }
  );

  if (listResponse.ok) {
    const calendars = await listResponse.json();
    const holidayCalendar = calendars.value?.find(
      (cal) => cal.name === 'School Holidays' || cal.name === 'Holidays'
    );

    if (holidayCalendar) {
      return holidayCalendar;
    }
  }

  // Create new calendar
  const createResponse = await fetch(
    `https://graph.microsoft.com/v1.0/users/${organizationEmail}/calendars`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${azureToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'School Holidays',
        isDefaultCalendar: false,
      }),
    }
  );

  if (!createResponse.ok) {
    throw new Error(`Failed to create calendar: ${createResponse.status}`);
  }

  return createResponse.json();
}

/**
 * Main cron handler - Syncs holidays for all configured organizations
 */
export default async function handler(req, res) {
  // Verify cron secret - Vercel sends: Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers['authorization'];
  const cronSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret && (!cronSecret || cronSecret !== expectedSecret)) {
    console.warn('⚠️ Cron request rejected: invalid secret');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing CRON_SECRET',
    });
  }

  const startTime = Date.now();
  const results = {
    timestamp: new Date().toISOString(),
    organizations: [],
    totalSynced: 0,
    totalErrors: 0,
    totalSkipped: 0,
  };

  try {
    console.log(
      '🌍 [CRON] Starting multi-tenant holiday sync at',
      new Date().toISOString()
    );

    // Get all organizations configured for service-to-service auth
    const orgs = await getConfiguredOrganizations(supabase);

    if (orgs.length === 0) {
      console.warn('⚠️ No organizations configured for holiday sync');
      return res.status(200).json({
        ...results,
        message: 'No organizations with complete Azure AD configuration found',
      });
    }

    console.log(`📊 Found ${orgs.length} organizations ready for sync`);

    // Process each organization
    for (const org of orgs) {
      const orgResult = {
        organizationId: org.id,
        organizationName: org.name,
        status: 'pending',
        holidaysSynced: 0,
        errors: [],
      };

      try {
        console.log(`\n📧 Processing: ${org.name} (${org.id})`);

        // Step 1: Get Azure service token using Client Credentials flow
        let azureToken;
        try {
          azureToken = await getAzureServiceToken(org.id, supabase);
          console.log(`✅ Got Azure service token for ${org.id}`);
        } catch (tokenErr) {
          console.error(`❌ Token error for ${org.id}:`, tokenErr.message);
          orgResult.status = 'token-error';
          orgResult.errors.push(`Token acquisition failed: ${tokenErr.message}`);
          results.totalErrors++;
          results.organizations.push(orgResult);
          continue;
        }

        // Step 2: Get all non-bank holidays for this organization
        const { data: holidays, error: holidaysErr } = await supabase
          .from('mt_termdates')
          .select('*')
          .eq('organization_id', org.id)
          .neq('type', 'Bank Holiday')
          .order('date', { ascending: true });

        if (holidaysErr) {
          throw new Error(`Failed to fetch holidays: ${holidaysErr.message}`);
        }

        console.log(`📅 Found ${holidays?.length || 0} holidays to sync`);

        if (!holidays || holidays.length === 0) {
          orgResult.status = 'success';
          orgResult.message = 'No holidays to sync';
          results.totalSkipped++;
          results.organizations.push(orgResult);
          continue;
        }

        // Step 3: Sync each holiday to the shared calendar
        let syncedCount = 0;
        for (const holiday of holidays) {
          try {
            // Skip if recently synced (within 24 hours)
            if (
              holiday.calendar_synced_at &&
              holiday.calendar_sync_status === 'synced'
            ) {
              const lastSync = new Date(holiday.calendar_synced_at);
              const now = new Date();
              const hoursSinceSync = (now - lastSync) / (1000 * 60 * 60);

              if (hoursSinceSync < 24) {
                console.log(
                  `⏭️  Skipping (recently synced): ${holiday.description}`
                );
                continue;
              }
            }

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
              syncedCount++;
              console.log(`✅ Synced: ${holiday.description}`);
            }
          } catch (eventErr) {
            // Log error but continue with next holiday
            const errorMsg = `Failed to sync ${holiday.description}: ${eventErr.message}`;
            console.warn(`⚠️ ${errorMsg}`);
            orgResult.errors.push(errorMsg);
          }
        }

        orgResult.status = 'success';
        orgResult.holidaysSynced = syncedCount;
        results.totalSynced += syncedCount;

        console.log(`✅ Synced ${syncedCount} holidays for ${org.name}`);

        results.organizations.push(orgResult);
      } catch (err) {
        console.error(
          `❌ Error processing organization ${org.id}:`,
          err.message
        );
        orgResult.status = 'error';
        orgResult.errors.push(err.message);
        results.totalErrors++;
        results.organizations.push(orgResult);
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `\n✅ Cron completed in ${duration}ms - Synced: ${results.totalSynced}, Errors: ${results.totalErrors}`
    );

    // Log cron execution to database for monitoring
    try {
      await supabase.from('calendar_sync_log').insert({
        organization_id: 'system-cron',
        sync_type: 'scheduled-cron',
        holidays_synced: results.totalSynced,
        events_created: results.totalSynced,
        events_updated: 0,
        events_deleted: 0,
        errors:
          results.totalErrors > 0
            ? `${results.totalErrors} organizations had errors`
            : null,
      });
    } catch (logErr) {
      console.warn('⚠️ Failed to log cron execution:', logErr.message);
    }

    res.status(200).json({
      ...results,
      duration,
      message: `Holiday sync completed: ${results.totalSynced} synced, ${results.totalErrors} errors, ${results.totalSkipped} skipped`,
    });
  } catch (err) {
    console.error('🔴 Cron fatal error:', err);
    results.totalErrors++;
    res.status(500).json({
      ...results,
      error: err.message,
      message: 'Cron execution failed',
    });
  }
}

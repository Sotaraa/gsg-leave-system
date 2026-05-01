/**
 * Microsoft Graph API Calendar Service
 * Pushes leave events directly to employee Outlook calendars
 * Creates and maintains shared holiday calendar
 */

/**
 * Create a leave event in employee's Outlook calendar
 * @param {string} employeeEmail - Employee email address
 * @param {string} employeeName - Employee display name
 * @param {string} leaveType - Type of leave (Annual Leave, Sick Leave, etc.)
 * @param {string} startDate - ISO date (YYYY-MM-DD)
 * @param {string} endDate - ISO date (YYYY-MM-DD)
 * @param {string} azureToken - Microsoft Graph API token
 * @returns {object} Created event or error
 */
export const createLeaveEvent = async (
  employeeEmail,
  employeeName,
  leaveType,
  startDate,
  endDate,
  azureToken
) => {
  if (!azureToken) {
    console.warn('⚠️ No Azure token available - skipping calendar event creation');
    return { success: false, reason: 'No Azure token' };
  }

  try {
    // Parse dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    // Calendar API needs end date as day after for all-day events
    end.setDate(end.getDate() + 1);

    const eventBody = {
      subject: `${employeeName} - ${leaveType}`,
      bodyPreview: `Leave request: ${leaveType}`,
      body: {
        contentType: 'HTML',
        content: `<p><strong>${employeeName}</strong> is on <strong>${leaveType}</strong></p>`,
      },
      start: {
        dateTime: start.toISOString(),
        timeZone: 'Europe/London',
      },
      end: {
        dateTime: end.toISOString(),
        timeZone: 'Europe/London',
      },
      isReminderOn: false,
      isAllDay: true,
      categories: ['Leave', leaveType],
      showAs: 'outOfOffice',
    };

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users/${employeeEmail}/events`,
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
      console.error(`❌ Failed to create calendar event: ${response.status} - ${error}`);
      return {
        success: false,
        reason: `Graph API error: ${response.status}`,
      };
    }

    const event = await response.json();
    console.log(`✅ Created calendar event for ${employeeName}: ${event.id}`);
    return { success: true, eventId: event.id };
  } catch (err) {
    console.error('Graph API calendar creation error:', err);
    return { success: false, reason: err.message };
  }
};

/**
 * Delete a leave event from employee's calendar
 * @param {string} employeeEmail - Employee email address
 * @param {string} eventId - Calendar event ID
 * @param {string} azureToken - Microsoft Graph API token
 * @returns {boolean} Success status
 */
export const deleteLeaveEvent = async (
  employeeEmail,
  eventId,
  azureToken
) => {
  if (!azureToken || !eventId) {
    console.warn('⚠️ Missing token or event ID - skipping event deletion');
    return false;
  }

  try {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users/${employeeEmail}/events/${eventId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${azureToken}`,
        },
      }
    );

    if (!response.ok && response.status !== 404) {
      console.error(`⚠️ Failed to delete calendar event: ${response.status}`);
      return false;
    }

    console.log(`✅ Deleted calendar event for ${employeeEmail}`);
    return true;
  } catch (err) {
    console.error('Graph API event deletion error:', err);
    return false;
  }
};

/**
 * Create or update a holiday in the shared organization calendar
 * @param {string} holidayDate - ISO date (YYYY-MM-DD)
 * @param {string} holidayName - Holiday name (e.g., "Easter Monday")
 * @param {string} organizationEmail - Shared calendar email
 * @param {string} azureToken - Microsoft Graph API token
 * @returns {object} Created event or error
 */
export const createHolidayEvent = async (
  holidayDate,
  holidayName,
  organizationEmail,
  azureToken
) => {
  if (!azureToken) {
    console.warn('⚠️ No Azure token - skipping holiday creation');
    return { success: false };
  }

  try {
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
      console.error(`❌ Failed to create holiday event: ${response.status}`);
      return { success: false };
    }

    const event = await response.json();
    console.log(`✅ Created holiday event: ${event.id}`);
    return { success: true, eventId: event.id };
  } catch (err) {
    console.error('Holiday event creation error:', err);
    return { success: false, reason: err.message };
  }
};

/**
 * Get shared calendar ID or create if doesn't exist
 * @param {string} organizationEmail - Organization email
 * @param {string} organizationName - Organization name
 * @param {string} azureToken - Microsoft Graph API token
 * @returns {object} Calendar object with id and webLink
 */
export const getOrCreateSharedCalendar = async (
  organizationEmail,
  organizationName,
  azureToken
) => {
  if (!azureToken) {
    return { success: false, reason: 'No Azure token' };
  }

  try {
    // Try to find existing calendar named "School Holidays"
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
        console.log(`✅ Found existing holiday calendar: ${holidayCalendar.id}`);
        return { success: true, calendar: holidayCalendar };
      }
    }

    // Create new calendar if not found
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
      console.error(`⚠️ Could not create holiday calendar: ${createResponse.status}`);
      return { success: false, reason: 'Failed to create calendar' };
    }

    const calendar = await createResponse.json();
    console.log(`✅ Created new holiday calendar: ${calendar.id}`);
    return { success: true, calendar };
  } catch (err) {
    console.error('Shared calendar setup error:', err);
    return { success: false, reason: err.message };
  }
};

/**
 * Sync all holidays and term dates to the shared calendar
 * @param {string} organizationEmail - Organization email
 * @param {array} termDates - Term date events from database
 * @param {array} schoolTerms - School term definitions from database
 * @param {string} azureToken - Microsoft Graph API token
 */
export const syncHolidaysToSharedCalendar = async (
  organizationEmail,
  termDates = [],
  schoolTerms = [],
  azureToken
) => {
  if (!azureToken) {
    console.log('⏭️ Skipping holiday sync - no Azure token');
    return { success: false, reason: 'No token' };
  }

  try {
    // Get or create shared calendar
    const calResult = await getOrCreateSharedCalendar(
      organizationEmail,
      'School Holidays',
      azureToken
    );

    if (!calResult.success) {
      console.warn('⚠️ Could not sync holidays - calendar unavailable');
      return { success: false, reason: 'Calendar not found' };
    }

    const calendarId = calResult.calendar.id;
    const createdCount = { holidays: 0, terms: 0 };

    // Sync term dates (holidays, school breaks)
    if (termDates && termDates.length > 0) {
      for (const td of termDates) {
        // Skip bank holidays - they're less important for shared calendar
        if (td.type === 'Bank Holiday') continue;

        const eventBody = {
          subject: `🏫 ${td.description || td.type}`,
          body: {
            contentType: 'HTML',
            content: `<p><strong>${td.description || td.type}</strong></p>`,
          },
          start: {
            dateTime: new Date(td.date).toISOString(),
            timeZone: 'Europe/London',
          },
          end: {
            dateTime: new Date(new Date(td.date).getTime() + 86400000).toISOString(),
            timeZone: 'Europe/London',
          },
          isAllDay: true,
          isReminderOn: false,
          categories: ['Holiday', 'SchoolCalendar'],
          showAs: 'free',
        };

        try {
          const response = await fetch(
            `https://graph.microsoft.com/v1.0/users/${organizationEmail}/calendars/${calendarId}/events`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${azureToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(eventBody),
            }
          );

          if (response.ok || response.status === 409) {
            // 409 = conflict (event likely already exists)
            createdCount.holidays++;
          }
        } catch (err) {
          console.warn(`⚠️ Failed to add holiday event: ${td.description}`);
        }
      }
    }

    // Sync school terms
    if (schoolTerms && schoolTerms.length > 0) {
      for (const term of schoolTerms) {
        const periods = [
          { name: 'Autumn', start: term.autumnStart, end: term.autumnEnd },
          { name: 'Spring', start: term.springStart, end: term.springEnd },
          { name: 'Summer', start: term.summerStart, end: term.summerEnd },
        ];

        for (const period of periods) {
          if (!period.start || !period.end) continue;

          const eventBody = {
            subject: `📚 ${period.name} Term (${term.academicYear})`,
            body: {
              contentType: 'HTML',
              content: `<p><strong>${period.name} Term</strong></p><p>${term.academicYear}</p>`,
            },
            start: {
              dateTime: new Date(period.start).toISOString(),
              timeZone: 'Europe/London',
            },
            end: {
              dateTime: new Date(new Date(period.end).getTime() + 86400000).toISOString(),
              timeZone: 'Europe/London',
            },
            isAllDay: true,
            isReminderOn: false,
            categories: ['SchoolTerm'],
            showAs: 'free',
          };

          try {
            const response = await fetch(
              `https://graph.microsoft.com/v1.0/users/${organizationEmail}/calendars/${calendarId}/events`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${azureToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(eventBody),
              }
            );

            if (response.ok || response.status === 409) {
              createdCount.terms++;
            }
          } catch (err) {
            console.warn(`⚠️ Failed to add term event: ${period.name}`);
          }
        }
      }
    }

    console.log(
      `✅ Holiday calendar synced: ${createdCount.holidays} holidays, ${createdCount.terms} terms`
    );
    return {
      success: true,
      calendar: calResult.calendar,
      events: createdCount,
    };
  } catch (err) {
    console.error('Holiday sync error:', err);
    return { success: false, reason: err.message };
  }
};

/**
 * Share calendar with user (for future use)
 * @param {string} organizationEmail - Organization email
 * @param {string} calendarId - Calendar ID
 * @param {string} userEmail - User to share with
 * @param {string} azureToken - Microsoft Graph API token
 */
export const shareCalendarWithUser = async (
  organizationEmail,
  calendarId,
  userEmail,
  azureToken
) => {
  // This would implement calendar sharing via Graph API
  // Currently not implemented as we can make the calendar public or use mailbox sharing
  console.log(`📧 Calendar sharing not yet implemented for ${userEmail}`);
  return false;
};

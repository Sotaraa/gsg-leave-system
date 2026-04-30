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

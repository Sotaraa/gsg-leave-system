/**
 * Calendar Sync Service
 * Generates iCalendar (ICS) format for Outlook/Google Calendar subscription
 *
 * Includes:
 * - School holidays
 * - Term dates (school term periods)
 * - Approved leave requests (optional, configurable per organization)
 */

/**
 * Format date to iCalendar format (YYYYMMDD)
 */
const formatICalDate = (date) => {
  if (typeof date === 'string') date = new Date(date);
  return date.toISOString().split('T')[0].replace(/-/g, '');
};

/**
 * Format datetime to iCalendar format (YYYYMMDDTHHMMSSZ)
 */
const formatICalDateTime = (date) => {
  if (typeof date === 'string') date = new Date(date);
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
};

/**
 * Escape text for iCalendar format
 */
const escapeICalText = (text) => {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
};

/**
 * Generate iCalendar feed with holidays, term dates, and optional leave
 *
 * @param {string} organizationId - Organization ID
 * @param {array} termDates - Term date events [{date, type, description}]
 * @param {array} schoolTerms - School term definitions [{academicYear, autumnStart, ...}]
 * @param {array} approvedLeave - Optional approved leave requests
 * @param {object} org - Organization details {name, notificationEmail}
 * @returns {string} iCalendar (.ics) format
 */
export const generateICalendar = (
  organizationId,
  termDates = [],
  schoolTerms = [],
  approvedLeave = [],
  org = {}
) => {
  const orgName = org.name || organizationId;
  const now = new Date();
  const nowIcal = formatICalDateTime(now);

  // Calendar VTIMEZONE for UK (GMT/BST)
  const vtimezone = `BEGIN:VTIMEZONE
TZID:Europe/London
BEGIN:STANDARD
DTSTART:19701025T020000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
TZOFFSETFROM:+0100
TZOFFSETTO:+0000
TZNAME:GMT
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:19700329T010000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
TZOFFSETFROM:+0000
TZOFFSETTO:+0100
TZNAME:BST
END:DAYLIGHT
END:VTIMEZONE`;

  // Build events
  let events = '';

  // Add term dates (holidays, school breaks, etc.)
  if (termDates && termDates.length > 0) {
    termDates.forEach((td, idx) => {
      const startDate = formatICalDate(td.date);
      // For all-day events, end date is day after in iCalendar format
      const endDate = formatICalDate(new Date(new Date(td.date).getTime() + 86400000));

      events += `BEGIN:VEVENT
UID:termdate-${organizationId}-${idx}@gsg-leave-system
DTSTAMP:${nowIcal}
DTSTART;VALUE=DATE:${startDate}
DTEND;VALUE=DATE:${endDate}
SUMMARY:${escapeICalText(td.description || td.type)}
DESCRIPTION:${escapeICalText(td.type)}
CATEGORIES:Holiday,SchoolCalendar
STATUS:CONFIRMED
TRANSP:TRANSPARENT
END:VEVENT
`;
    });
  }

  // Add school terms (visual blocks)
  if (schoolTerms && schoolTerms.length > 0) {
    schoolTerms.forEach((term, idx) => {
      const termPeriods = [
        { name: 'Autumn', start: term.autumnStart, end: term.autumnEnd },
        { name: 'Spring', start: term.springStart, end: term.springEnd },
        { name: 'Summer', start: term.summerStart, end: term.summerEnd }
      ];

      termPeriods.forEach((period) => {
        if (period.start && period.end) {
          const startDate = formatICalDate(period.start);
          const endDate = formatICalDate(new Date(new Date(period.end).getTime() + 86400000));

          events += `BEGIN:VEVENT
UID:schoolterm-${organizationId}-${term.academicYear}-${period.name}@gsg-leave-system
DTSTAMP:${nowIcal}
DTSTART;VALUE=DATE:${startDate}
DTEND;VALUE=DATE:${endDate}
SUMMARY:${escapeICalText(period.name)} Term (${term.academicYear})
DESCRIPTION:School term period
CATEGORIES:SchoolTerm
STATUS:CONFIRMED
TRANSP:OPAQUE
END:VEVENT
`;
        }
      });
    });
  }

  // Add approved leave (if included)
  if (approvedLeave && approvedLeave.length > 0) {
    approvedLeave.forEach((leave, idx) => {
      if (leave.status === 'Approved') {
        const startDate = formatICalDate(leave.startDate);
        const endDate = formatICalDate(new Date(new Date(leave.endDate || leave.startDate).getTime() + 86400000));

        events += `BEGIN:VEVENT
UID:leave-${organizationId}-${leave.id}@gsg-leave-system
DTSTAMP:${nowIcal}
DTSTART;VALUE=DATE:${startDate}
DTEND;VALUE=DATE:${endDate}
SUMMARY:${escapeICalText(leave.employeeName)} - ${escapeICalText(leave.type)}
DESCRIPTION:${escapeICalText(leave.employeeName)} on ${leave.type}
CATEGORIES:Leave,ApprovedLeave
STATUS:CONFIRMED
TRANSP:TRANSPARENT
END:VEVENT
`;
      }
    });
  }

  // Build complete iCalendar
  const ical = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Sotara//GSG Leave System//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:${escapeICalText(orgName)} - Leave & Holiday Calendar
X-WR-CALDESC:School holidays, term dates, and approved staff leave for ${escapeICalText(orgName)}
X-WR-TIMEZONE:Europe/London
${vtimezone}
${events}END:VCALENDAR`;

  return ical;
};

/**
 * Generate Outlook subscription URL
 * Webcal protocol triggers Outlook add calendar dialog
 *
 * @param {string} baseUrl - Base URL of the app (e.g., https://gsg-leave-system.vercel.app)
 * @param {string} organizationId - Organization ID
 * @returns {object} URLs for different calendar apps
 */
export const getCalendarSubscriptionUrls = (baseUrl, organizationId) => {
  const calendarUrl = `${baseUrl}/api/calendar?org=${organizationId}`;
  const webcalUrl = `webcal://${calendarUrl.replace('https://', '')}`;

  return {
    ics: calendarUrl,           // Direct .ics file download
    webcal: webcalUrl,          // Outlook/Apple Calendar subscription
    google: `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(calendarUrl)}`,
    outlook: `https://outlook.live.com/calendar/0/addevent?url=${encodeURIComponent(calendarUrl)}`
  };
};

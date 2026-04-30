/**
 * Calendar Sync Service
 * Generates iCalendar (ICS) format for Outlook/Google Calendar subscription
 *
 * RFC 5545 compliant - uses CRLF line endings as required by the spec
 */

const CRLF = '\r\n';

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
 * Build a VEVENT block with proper CRLF line endings
 */
const buildEvent = (props) => {
  const lines = ['BEGIN:VEVENT'];
  for (const [key, value] of Object.entries(props)) {
    lines.push(`${key}:${value}`);
  }
  lines.push('END:VEVENT');
  return lines.join(CRLF);
};

/**
 * Generate iCalendar feed with holidays, term dates, and optional leave
 */
export const generateICalendar = (
  organizationId,
  termDates = [],
  schoolTerms = [],
  approvedLeave = [],
  org = {}
) => {
  const orgName = org.name || organizationId;
  const nowIcal = formatICalDateTime(new Date());

  const lines = [];

  // Calendar header
  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push('PRODID:-//Sotara//GSG Leave System//EN');
  lines.push('CALSCALE:GREGORIAN');
  lines.push('METHOD:PUBLISH');
  lines.push(`X-WR-CALNAME:${escapeICalText(orgName)} - Leave & Holiday Calendar`);
  lines.push(`X-WR-CALDESC:School holidays\\, term dates\\, and approved staff leave for ${escapeICalText(orgName)}`);
  lines.push('X-WR-TIMEZONE:Europe/London');

  // VTIMEZONE block for UK (GMT/BST)
  lines.push('BEGIN:VTIMEZONE');
  lines.push('TZID:Europe/London');
  lines.push('BEGIN:STANDARD');
  lines.push('DTSTART:19701025T020000');
  lines.push('RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU');
  lines.push('TZOFFSETFROM:+0100');
  lines.push('TZOFFSETTO:+0000');
  lines.push('TZNAME:GMT');
  lines.push('END:STANDARD');
  lines.push('BEGIN:DAYLIGHT');
  lines.push('DTSTART:19700329T010000');
  lines.push('RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU');
  lines.push('TZOFFSETFROM:+0000');
  lines.push('TZOFFSETTO:+0100');
  lines.push('TZNAME:BST');
  lines.push('END:DAYLIGHT');
  lines.push('END:VTIMEZONE');

  // Term dates (holidays, school breaks)
  if (termDates && termDates.length > 0) {
    termDates.forEach((td, idx) => {
      const startDate = formatICalDate(td.date);
      const endDate = formatICalDate(new Date(new Date(td.date).getTime() + 86400000));

      lines.push(buildEvent({
        'UID': `termdate-${organizationId}-${idx}@gsg-leave-system`,
        'DTSTAMP': nowIcal,
        'DTSTART;VALUE=DATE': startDate,
        'DTEND;VALUE=DATE': endDate,
        'SUMMARY': escapeICalText(td.description || td.type),
        'DESCRIPTION': escapeICalText(td.type),
        'CATEGORIES': 'Holiday,SchoolCalendar',
        'STATUS': 'CONFIRMED',
        'TRANSP': 'TRANSPARENT',
      }));
    });
  }

  // School term blocks
  if (schoolTerms && schoolTerms.length > 0) {
    schoolTerms.forEach((term) => {
      const termPeriods = [
        { name: 'Autumn', start: term.autumnStart, end: term.autumnEnd },
        { name: 'Spring', start: term.springStart, end: term.springEnd },
        { name: 'Summer', start: term.summerStart, end: term.summerEnd },
      ];

      termPeriods.forEach((period) => {
        if (period.start && period.end) {
          const startDate = formatICalDate(period.start);
          const endDate = formatICalDate(new Date(new Date(period.end).getTime() + 86400000));

          lines.push(buildEvent({
            'UID': `schoolterm-${organizationId}-${term.academicYear}-${period.name}@gsg-leave-system`,
            'DTSTAMP': nowIcal,
            'DTSTART;VALUE=DATE': startDate,
            'DTEND;VALUE=DATE': endDate,
            'SUMMARY': escapeICalText(`${period.name} Term (${term.academicYear})`),
            'DESCRIPTION': 'School term period',
            'CATEGORIES': 'SchoolTerm',
            'STATUS': 'CONFIRMED',
            'TRANSP': 'OPAQUE',
          }));
        }
      });
    });
  }

  // Approved leave
  if (approvedLeave && approvedLeave.length > 0) {
    approvedLeave.forEach((leave) => {
      if (leave.status === 'Approved') {
        const startDate = formatICalDate(leave.startDate);
        const endDate = formatICalDate(new Date(new Date(leave.endDate || leave.startDate).getTime() + 86400000));

        lines.push(buildEvent({
          'UID': `leave-${organizationId}-${leave.id}@gsg-leave-system`,
          'DTSTAMP': nowIcal,
          'DTSTART;VALUE=DATE': startDate,
          'DTEND;VALUE=DATE': endDate,
          'SUMMARY': escapeICalText(`${leave.employeeName} - ${leave.type}`),
          'DESCRIPTION': escapeICalText(`${leave.employeeName} on ${leave.type}`),
          'CATEGORIES': 'Leave,ApprovedLeave',
          'STATUS': 'CONFIRMED',
          'TRANSP': 'TRANSPARENT',
        }));
      }
    });
  }

  lines.push('END:VCALENDAR');

  // RFC 5545 requires CRLF line endings throughout
  return lines.join(CRLF) + CRLF;
};

/**
 * Generate calendar subscription URLs
 */
export const getCalendarSubscriptionUrls = (baseUrl, organizationId) => {
  const calendarUrl = `${baseUrl}/api/calendar?org=${organizationId}`;
  const webcalUrl = `webcal://${calendarUrl.replace('https://', '')}`;

  return {
    ics: calendarUrl,
    webcal: webcalUrl,
    google: `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(calendarUrl)}`,
    outlook: `https://outlook.live.com/calendar/0/addevent?url=${encodeURIComponent(calendarUrl)}`
  };
};

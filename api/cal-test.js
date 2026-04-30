/**
 * Minimal static iCalendar test endpoint
 * Tests if Outlook can subscribe to ANY calendar from this Vercel deployment
 */

export default function handler(req, res) {
  const CRLF = '\r\n';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sotara//GSG Leave System//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Test Calendar',
    'BEGIN:VEVENT',
    'UID:test-event-001@gsg-leave-system',
    'DTSTAMP:20260430T120000Z',
    'DTSTART;VALUE=DATE:20260601',
    'DTEND;VALUE=DATE:20260602',
    'SUMMARY:Test Event',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  const icsContent = lines.join(CRLF) + CRLF;

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store');
  return res.status(200).send(icsContent);
}

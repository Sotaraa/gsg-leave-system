/**
 * Token Utilities for Organization Staff Calendar Access
 * Generates and validates secure tokens for staff calendar subscriptions
 */

/**
 * Generate a cryptographically secure random token
 * @returns {string} 32-character alphanumeric token
 */
export const generateToken = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  const array = new Uint8Array(32);

  // Use crypto.getRandomValues for browser environments
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(array);
    for (let i = 0; i < array.length; i++) {
      token += chars[array[i] % chars.length];
    }
    return token;
  }

  // Fallback for Node.js environments
  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
};

/**
 * Format token for display (show first 8 and last 4 chars)
 * @param {string} token - Full token
 * @returns {string} Masked token for display
 */
export const maskToken = (token) => {
  if (!token || token.length < 12) return '••••••••';
  return `${token.substring(0, 8)}•••••••••••••••••••••••${token.substring(token.length - 4)}`;
};

/**
 * Get staff calendar URL from token
 * @param {string} organizationId - Organization ID
 * @param {string} token - Access token
 * @param {string} baseUrl - Base URL (e.g., https://gsg-leave-system.vercel.app)
 * @returns {object} URLs for different calendar apps
 */
export const getStaffCalendarUrls = (organizationId, token, baseUrl = '') => {
  const fullBaseUrl = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  const calendarUrl = `${fullBaseUrl}/api/staff-calendar?org=${organizationId}&token=${token}`;
  const webcalUrl = `webcal://${calendarUrl.replace('https://', '')}`;

  return {
    ics: calendarUrl,           // Direct .ics file download
    webcal: webcalUrl,          // Outlook/Apple Calendar subscription
    google: `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(calendarUrl)}`,
    outlook: `https://outlook.live.com/calendar/0/addevent?url=${encodeURIComponent(calendarUrl)}`
  };
};

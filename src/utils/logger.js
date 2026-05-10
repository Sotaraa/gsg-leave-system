/**
 * Centralised logger that suppresses noisy debug logs in production.
 *
 * - `log` and `info` → only emit in dev (Vite's `import.meta.env.DEV`)
 * - `warn` → always (still useful in production for diagnosing user issues)
 * - `error` → always (always go to console; consider adding Sentry later)
 *
 * Use this for any log line that contains PII (names, emails, departments,
 * org IDs, tokens). For pure technical errors, `console.error` is fine.
 */
const IS_DEV = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

export const logger = {
  log:   (...args) => { if (IS_DEV) console.log(...args); },
  info:  (...args) => { if (IS_DEV) console.info(...args); },
  warn:  (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

export default logger;

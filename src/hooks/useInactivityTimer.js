import { useEffect, useRef, useCallback } from 'react';

const DEFAULT_LIMIT_MS   = 10 * 60 * 1000;   // 10 minutes
const DEFAULT_WARNING_MS = 60 * 1000;        // show warning 60s before logout
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

/**
 * Logs the user out after a period of inactivity, with a configurable
 * warning fired before the actual logout.
 *
 * @param {object}   opts
 * @param {boolean}  opts.enabled   – only attach listeners when truthy
 * @param {Function} opts.onLogout  – called when the inactivity limit is hit
 * @param {Function} opts.onWarning – called WARNING_MS before logout (e.g. show a modal)
 * @param {number}   [opts.limitMs]    – ms of inactivity before logout (default 10min)
 * @param {number}   [opts.warningMs]  – ms before logout to fire onWarning (default 60s)
 *
 * @returns {{ resetTimer: Function }} – call resetTimer() to manually reset
 *                                       (e.g. when dismissing the warning modal)
 */
export const useInactivityTimer = ({
  enabled,
  onLogout,
  onWarning,
  limitMs = DEFAULT_LIMIT_MS,
  warningMs = DEFAULT_WARNING_MS,
}) => {
  const inactivityTimer = useRef(null);
  const warningTimer    = useRef(null);

  const resetTimer = useCallback(() => {
    if (!enabled) return;
    clearTimeout(inactivityTimer.current);
    clearTimeout(warningTimer.current);
    warningTimer.current    = setTimeout(() => onWarning?.(), limitMs - warningMs);
    inactivityTimer.current = setTimeout(() => onLogout?.(),  limitMs);
  }, [enabled, onLogout, onWarning, limitMs, warningMs]);

  useEffect(() => {
    if (!enabled) return;
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, resetTimer));
    resetTimer();
    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, resetTimer));
      clearTimeout(inactivityTimer.current);
      clearTimeout(warningTimer.current);
    };
  }, [enabled, resetTimer]);

  return { resetTimer };
};

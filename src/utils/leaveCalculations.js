import CONFIG from '../config.js';

/**
 * Pure leave / TOIL calculation helpers extracted from app.jsx so they can
 * be reused (and tested) in isolation.
 *
 * None of these read or write component state — every input is passed in.
 */

/**
 * Compute the current holiday year window from the org's settings.
 *
 * @param {object} settings  – { holidayYearStartMonth, holidayYearStartDay }
 * @returns {{ start: string, end: string, label: string }}
 *          start/end are ISO date strings (YYYY-MM-DD).
 */
export const computeHolidayYear = (settings = {}) => {
  const m = (settings.holidayYearStartMonth || 9) - 1;   // JS months are 0-based
  const d = settings.holidayYearStartDay   || 1;
  const now = new Date();
  let startYear = now.getFullYear();
  if (now < new Date(startYear, m, d)) startYear -= 1;
  const s = new Date(startYear, m, d);
  const e = new Date(startYear + 1, m, d);
  e.setDate(e.getDate() - 1);
  const fmt = (dt) => dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return {
    start: s.toISOString().split('T')[0],
    end:   e.toISOString().split('T')[0],
    label: `${fmt(s)} to ${fmt(e)}`,
  };
};

/**
 * Total leave days taken by an employee in the given holiday year.
 *
 * @param {object[]} requests        – all org requests
 * @param {string}   email           – employee email
 * @param {boolean}  isTermTime      – true to count termTimeWorkType, false for Annual Leave
 * @param {{start:string,end:string}} holidayYear
 */
export const getLeaveTaken = (requests, email, isTermTime, holidayYear) => {
  if (!email) return 0;
  return requests
    .filter(r =>
      r.employeeEmail === email &&
      r.status === 'Approved' &&
      (isTermTime ? r.type === CONFIG.termTimeWorkType : r.type === 'Annual Leave') &&
      r.startDate >= holidayYear.start &&
      r.startDate <= holidayYear.end
    )
    .reduce((t, r) => t + Number(r.daysCount || 0), 0);
};

/**
 * Compute TOIL accrued / used / balance for an employee in this holiday year.
 *
 * @param {object[]} requests
 * @param {string}   email
 * @param {number|null} staffTarget       – termTimeDaysTarget on staff record
 * @param {number|null} staffHoursPerDay  – hoursPerDay on staff record
 * @param {boolean}  isTermTime
 * @param {object}   settings  – org settings (hoursPerDay, termTimeDaysTarget)
 * @param {{start:string,end:string}} holidayYear
 */
export const getTOILBalance = (
  requests, email, staffTarget, staffHoursPerDay, isTermTime, settings, holidayYear
) => {
  const hpd = Number(staffHoursPerDay || settings?.hoursPerDay || CONFIG.defaultHoursPerDay);
  const baseTarget = isTermTime
    ? (Number((staffTarget != null && staffTarget > 0 ? staffTarget : null) ?? settings?.termTimeDaysTarget ?? 30) || 30)
    : 0;
  const empty = {
    accrued: 0, used: 0, credit: 0, balance: 0, toilBalance: 0,
    daysOwed: 0, target: baseTarget, effectiveTarget: baseTarget,
    termTimeLeaveTaken: 0, remainingToWork: baseTarget,
    hoursPerDay: hpd, accruedHours: 0, usedHours: 0, creditHours: 0,
    isTermTime,
  };
  if (!email || !holidayYear?.start) return empty;

  const approved = requests.filter(r =>
    r.employeeEmail === email &&
    r.status === 'Approved' &&
    r.startDate >= holidayYear.start &&
    r.startDate <= holidayYear.end
  );

  const accrued = isTermTime
    ? approved.filter(r => r.type === CONFIG.termTimeWorkType || r.type === CONFIG._legacyTermTimeWorkType)
              .reduce((t, r) => t + (Number(r.daysCount) || 0), 0)
    : approved.filter(r => r.type === CONFIG.extraHoursType)
              .reduce((t, r) => t + (Number(r.daysCount) || 0), 0);

  const used = approved
    .filter(r => r.type === CONFIG.toiLeaveType || r.approvalSubType === 'TOIL')
    .reduce((t, r) => t + (Number(r.daysCount) || 0), 0);

  const termTimeLeaveTaken = isTermTime
    ? approved.filter(r => r.type === CONFIG.termTimeLeaveType)
              .reduce((t, r) => t + (Number(r.daysCount) || 0), 0)
    : 0;

  const effectiveTarget = baseTarget + termTimeLeaveTaken;
  const credit   = accrued - used;
  const daysOwed = Math.max(0, used - accrued);
  const round1   = (n) => Math.round(n * 10) / 10;

  return {
    accrued, used, credit,
    toilBalance: credit,
    balance:     credit,
    daysOwed,
    target:          baseTarget,
    effectiveTarget,
    termTimeLeaveTaken,
    remainingToWork: isTermTime ? Math.max(0, effectiveTarget - accrued) : 0,
    hoursPerDay:   hpd,
    accruedHours:  round1(accrued * hpd),
    usedHours:     round1(used    * hpd),
    creditHours:   round1(credit  * hpd),
    isTermTime,
  };
};

/**
 * Status / colour for a single staff member's annual-leave usage.
 *
 * Returns { remaining, colorClass, textColor, statusText } for the dashboard.
 */
export const getAllowanceStats = (taken, allowance, isTermTime) => {
  const remaining = allowance - taken;
  let colorClass = 'bg-[#064e3b]';
  let textColor  = 'text-emerald-700';
  let statusText = isTermTime ? 'On Track' : 'Good Standing';

  if (!isTermTime) {
    if (remaining < 0) {
      colorClass = 'bg-red-800';
      textColor  = 'text-red-700 font-bold';
      statusText = 'OVER ALLOWANCE';
    } else if (taken / allowance >= 0.9) {
      colorClass = 'bg-red-600';
      textColor  = 'text-red-600';
      statusText = 'Critical';
    } else if (taken / allowance >= 0.75) {
      colorClass = 'bg-orange-500';
      textColor  = 'text-orange-600';
      statusText = 'Low';
    }
  } else {
    colorClass = 'bg-blue-600';
    textColor  = 'text-blue-700';
    if (remaining <= 0) {
      colorClass = 'bg-[#064e3b]';
      textColor  = 'text-emerald-700 font-bold';
      statusText = 'Target Met';
    }
  }
  return { remaining, colorClass, textColor, statusText };
};

/**
 * Compute the holiday-year start date for a given closing date.
 * Used by carry-forward calculations.
 */
export const getYearStartForClosingDate = (closingDateStr, settings, currentHolidayYearStart) => {
  if (!closingDateStr) return currentHolidayYearStart;
  const m = (settings.holidayYearStartMonth || 9) - 1;
  const d = settings.holidayYearStartDay   || 1;
  const closing = new Date(closingDateStr);
  let yr = closing.getFullYear();
  if (new Date(yr, m, d) > closing) yr -= 1;
  return `${yr}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

/**
 * Returns whether two date ranges overlap. Half-day-aware.
 *
 * @param {object[]} requests   – all requests (rejected ones already filtered out)
 * @param {string}   email
 * @param {string}   newStartStr ISO date
 * @param {string}   newEndStr   ISO date (use start if half-day)
 */
export const checkForOverlap = (requests, email, newStartStr, newEndStr) => {
  const newStart = new Date(newStartStr);
  const newEnd   = new Date(newEndStr);
  const existing = requests.filter(r => r.employeeEmail === email && r.status !== 'Rejected');
  return existing.some(r => {
    const rStart = new Date(r.startDate);
    const rEnd   = new Date(r.endDate || r.startDate);
    return (newStart <= rEnd && newEnd >= rStart);
  });
};

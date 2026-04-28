import React, { useState, useMemo } from 'react';
import {
  CalendarDays, Clock, Briefcase, Stethoscope, GraduationCap,
  Heart, ShieldCheck, BookOpen, TrendingDown, Info,
  AlertCircle, CheckCircle2, Ban, School, Coffee, CalendarClock
} from 'lucide-react';
import CONFIG from '../../config.js';
import { formatDateUK, calculateWorkingDays } from '../../utils/helpers.js';

/* ─── shared helpers (also imported in DeptHead/Admin) ──────────── */

export const isDeductible = (type) =>
  !CONFIG.nonDeductibleTypes.includes(type) &&
  type !== CONFIG._legacyProfDevType &&
  type !== CONFIG.toiLeaveType &&
  type !== CONFIG.termTimeLeaveType &&
  type !== CONFIG.extraHoursType;

export const TYPE_META = {
  'Annual Leave':           { icon: CalendarDays,   color: 'emerald', counts: true  },
  'Extra Hours Worked':     { icon: Clock,          color: 'indigo',  counts: false },
  'School Holiday Worked':  { icon: Briefcase,      color: 'blue',    counts: false },
  'Holiday Work (Accrued)': { icon: Briefcase,      color: 'blue',    counts: false },
  'Time Off in Lieu':       { icon: Coffee,         color: 'orange',  counts: false },
  'Term Time Leave':        { icon: School,         color: 'amber',   counts: false },
  'Sick Leave':             { icon: Stethoscope,    color: 'rose',    counts: false },
  'Medical Appt':           { icon: Heart,          color: 'pink',    counts: false },
  'CPD':                    { icon: GraduationCap,  color: 'violet',  counts: false },
  'Professional Dev':       { icon: GraduationCap,  color: 'violet',  counts: false },
  'Compassionate':          { icon: ShieldCheck,    color: 'sky',     counts: false },
  'Unpaid':                 { icon: Ban,            color: 'gray',    counts: false },
};

export const COLOR = {
  emerald: { bg:'bg-emerald-50', border:'border-emerald-200', text:'text-emerald-700', badge:'bg-emerald-100 text-emerald-700', bar:'bg-emerald-500', iconBg:'bg-emerald-100' },
  blue:    { bg:'bg-blue-50',    border:'border-blue-200',    text:'text-blue-700',    badge:'bg-blue-100 text-blue-700',       bar:'bg-blue-500',    iconBg:'bg-blue-100'    },
  indigo:  { bg:'bg-indigo-50',  border:'border-indigo-200',  text:'text-indigo-700',  badge:'bg-indigo-100 text-indigo-700',   bar:'bg-indigo-500',  iconBg:'bg-indigo-100'  },
  orange:  { bg:'bg-orange-50',  border:'border-orange-200',  text:'text-orange-700',  badge:'bg-orange-100 text-orange-700',   bar:'bg-orange-400',  iconBg:'bg-orange-100'  },
  amber:   { bg:'bg-amber-50',   border:'border-amber-200',   text:'text-amber-700',   badge:'bg-amber-100 text-amber-700',     bar:'bg-amber-400',   iconBg:'bg-amber-100'   },
  rose:    { bg:'bg-rose-50',    border:'border-rose-200',    text:'text-rose-700',    badge:'bg-rose-100 text-rose-700',       bar:'bg-rose-400',    iconBg:'bg-rose-100'    },
  pink:    { bg:'bg-pink-50',    border:'border-pink-200',    text:'text-pink-700',    badge:'bg-pink-100 text-pink-700',       bar:'bg-pink-400',    iconBg:'bg-pink-100'    },
  violet:  { bg:'bg-violet-50',  border:'border-violet-200',  text:'text-violet-700',  badge:'bg-violet-100 text-violet-700',   bar:'bg-violet-400',  iconBg:'bg-violet-100'  },
  sky:     { bg:'bg-sky-50',     border:'border-sky-200',     text:'text-sky-700',     badge:'bg-sky-100 text-sky-700',         bar:'bg-sky-400',     iconBg:'bg-sky-100'     },
  gray:    { bg:'bg-gray-50',    border:'border-gray-200',    text:'text-gray-500',    badge:'bg-gray-100 text-gray-500',       bar:'bg-gray-300',    iconBg:'bg-gray-100'    },
};

export const getMeta  = (type) => TYPE_META[type] ?? { icon: BookOpen, color: 'gray', counts: false };
export const getColor = (type) => COLOR[getMeta(type).color] ?? COLOR.gray;

export const TypeBadge = ({ type }) => {
  const meta = getMeta(type);
  const col  = getColor(type);
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${col.badge}`}>
      <Icon size={10} />{type}
    </span>
  );
};

export const ImpactLabel = ({ type }) => {
  if (type === CONFIG.termTimeLeaveType)
    return <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium"><School size={11}/>Adds to holiday work target</span>;
  if (type === CONFIG.termTimeWorkType || type === CONFIG._legacyTermTimeWorkType || type === CONFIG.extraHoursType)
    return <span className="inline-flex items-center gap-1 text-xs text-indigo-600 font-medium"><Clock size={11}/>Earns Time Off in Lieu credit</span>;
  return isDeductible(type)
    ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium"><TrendingDown size={11}/>Counts toward allowance</span>
    : <span className="inline-flex items-center gap-1 text-xs text-gray-400 font-medium"><Info size={11}/>Recorded only (no deduction)</span>;
};

export const TypeNote = ({ type, currentHolidayYear, startDate }) => {
  const nextYear = startDate && currentHolidayYear?.end && startDate > currentHolidayYear.end;
  return (
    <div className="space-y-1.5 mb-3">
      {type && (
        <div className={`rounded-lg px-3 py-2 flex items-start gap-2 text-xs ${
          type === CONFIG.termTimeLeaveType ? 'bg-amber-50 border border-amber-200'
          : type === CONFIG.toiLeaveType    ? 'bg-orange-50 border border-orange-100'
          : type === 'Unpaid'              ? 'bg-gray-50 border border-gray-200'
          : isDeductible(type)             ? 'bg-emerald-50 border border-emerald-100'
          :                                  'bg-blue-50 border border-blue-100'
        }`}>
          {type === CONFIG.termTimeLeaveType
            ? <><School size={13} className="text-amber-500 mt-0.5 flex-shrink-0"/>
                <span className="text-amber-700">
                  <strong>Term Time Leave</strong> is absence during the school term.
                  This will be added to your school holiday working target.
                  If your manager records it as Unpaid instead, it will be logged only with no change to your target.
                </span></>
            : type === CONFIG.toiLeaveType
            ? <><Coffee size={13} className="text-orange-500 mt-0.5 flex-shrink-0"/>
                <span className="text-orange-700">
                  <strong>Time Off in Lieu</strong> uses days you have earned through extra hours worked.
                  If you have not earned enough credit yet, your manager may adjust the approval.
                </span></>
            : type === CONFIG.extraHoursType
            ? <><Clock size={13} className="text-indigo-500 mt-0.5 flex-shrink-0"/>
                <span className="text-indigo-700">
                  <strong>Extra Hours Worked</strong> logs additional hours you have worked beyond your normal hours.
                  Once approved by your manager, these hours will build up your Time Off in Lieu credit.
                  Enter the number of hours below — they will be converted to days automatically.
                </span></>
            : type === 'Unpaid'
            ? <><Ban size={13} className="text-gray-400 mt-0.5 flex-shrink-0"/>
                <span className="text-gray-600">
                  <strong>Unpaid Leave</strong> is recorded for HR purposes only.
                  It does not reduce your leave allowance or holiday working target.
                </span></>
            : isDeductible(type)
            ? <><TrendingDown size={13} className="text-emerald-600 mt-0.5 flex-shrink-0"/>
                <span className="text-emerald-700"><strong>{type}</strong> will count toward your annual leave allowance.</span></>
            : <><Info size={13} className="text-blue-400 mt-0.5 flex-shrink-0"/>
                <span className="text-blue-700">
                  <strong>{type}</strong> is recorded for HR purposes only and does not reduce your leave allowance.
                </span></>
          }
        </div>
      )}
      {nextYear && (
        <div className="rounded-lg px-3 py-2 flex items-start gap-2 text-xs bg-indigo-50 border border-indigo-100">
          <CalendarDays size={13} className="text-indigo-500 mt-0.5 flex-shrink-0"/>
          <span className="text-indigo-700">
            This date falls in the <strong>next holiday year</strong> and will count against the next year allowance.
          </span>
        </div>
      )}
    </div>
  );
};

const statusStyle = {
  Approved: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  Rejected: 'bg-red-100 text-red-700 border border-red-200',
  Pending:  'bg-amber-100 text-amber-700 border border-amber-200',
};

/* ═══════════════════════════════════════════════════════════════════ */
const EmployeeView = ({
  user, requests, formData, setFormData, submitRequest,
  amITermTime, myStats, myDaysTaken, myAllowance, myTOILBalance,
  currentHolidayYear, myCarryForwardDays, termDates, myWorkingDays,
  systemSettings
}) => {
  const [historyFilter, setHistoryFilter] = useState('all');

  /* approved this year */
  const thisYearApproved = requests.filter(r =>
    r.employeeEmail === user.email &&
    r.status === 'Approved' &&
    currentHolidayYear &&
    r.startDate >= currentHolidayYear.start &&
    r.startDate <= currentHolidayYear.end
  );

  /* leave already booked for the NEXT holiday year */
  const nextYearBooked = requests.filter(r =>
    r.employeeEmail === user.email &&
    r.status === 'Approved' &&
    currentHolidayYear &&
    r.startDate > currentHolidayYear.end
  );
  const nextYearDays = nextYearBooked.reduce((t, r) => t + Number(r.daysCount || 0), 0);

  /* absences recorded only — exclude TOIL/work types shown in the balance cards */
  const recordedByType = thisYearApproved
    .filter(r =>
      !isDeductible(r.type) &&
      r.type !== CONFIG.termTimeLeaveType &&
      r.type !== CONFIG.termTimeWorkType &&
      r.type !== CONFIG._legacyTermTimeWorkType &&
      r.type !== CONFIG.extraHoursType &&
      r.type !== CONFIG.toiLeaveType
    )
    .reduce((acc, r) => {
      const key = r.type === CONFIG._legacyProfDevType ? 'CPD' : r.type;
      acc[key] = (acc[key] || 0) + Number(r.daysCount || 0);
      return acc;
    }, {});
  const recordedEntries = Object.entries(recordedByType).filter(([, d]) => d > 0);

  /* history */
  const myRequests  = requests.filter(r => r.employeeEmail === user.email);
  const filterTypes = [...new Set(myRequests.map(r => r.type))];
  const filtered    = historyFilter === 'all'     ? myRequests
                    : historyFilter === 'pending'  ? myRequests.filter(r => r.status === 'Pending')
                    : historyFilter === 'nextyear' ? nextYearBooked
                    :                               myRequests.filter(r => r.type === historyFilter);

  /* normalise TT balance defensively */
  const toil = myTOILBalance
    ? {
        ...myTOILBalance,
        credit:             myTOILBalance.credit ?? myTOILBalance.toilBalance ?? myTOILBalance.balance ?? 0,
        accrued:            Number(myTOILBalance.accrued)            || 0,
        used:               Number(myTOILBalance.used)               || 0,
        target:             Number(myTOILBalance.target)             || 30,
        effectiveTarget:    Number(myTOILBalance.effectiveTarget)    || Number(myTOILBalance.target) || 30,
        termTimeLeaveTaken: Number(myTOILBalance.termTimeLeaveTaken) || 0,
        hoursPerDay:        Number(myTOILBalance.hoursPerDay)        || 8,
        accruedHours:       Number(myTOILBalance.accruedHours)       || 0,
        usedHours:          Number(myTOILBalance.usedHours)          || 0,
        creditHours:        Number(myTOILBalance.creditHours)        || 0,
      }
    : null;

  const creditPct       = toil?.accrued > 0 ? Math.min(100, (toil.used    / toil.accrued)         * 100) : 0;
  const workProgressPct = toil?.effectiveTarget > 0 ? Math.min(100, (toil.accrued / toil.effectiveTarget) * 100) : 0;

  // For non-TT staff: approved extra hours build TOIL credit that adds directly to the leave balance.
  // TT staff keep their own separate school holiday balance — not merged here.
  const myToilCredit        = !amITermTime ? Math.max(0, toil?.credit ?? 0) : 0;
  const myEffectiveAllowance = myAllowance + myToilCredit;
  const allowancePct         = myEffectiveAllowance > 0 ? Math.min(100, (myDaysTaken / myEffectiveAllowance) * 100) : 0;

  /* ── BOOKING WARNING ─────────────────────────────────────── */
  const proposedDays = useMemo(() => {
    if (!formData.startDate) return 0;
    if (!formData.isHalfDay && !formData.endDate) return 0;
    return calculateWorkingDays(
      formData.startDate,
      formData.endDate || formData.startDate,
      formData.isHalfDay,
      termDates || [],
      myWorkingDays
    );
  }, [formData.startDate, formData.endDate, formData.isHalfDay, termDates, myWorkingDays]);

  const remaining          = myEffectiveAllowance - myDaysTaken;
  const projectedRemaining = isDeductible(formData.type) ? remaining - proposedDays : null;

  // Check if requested dates fall in term time or school holidays
  const termTimeWarning = useMemo(() => {
    if (!formData.startDate) return null;
    const start = formData.startDate;
    const end   = formData.endDate || formData.startDate;
    const tStarts = (termDates || []).filter(t => t.type === 'Term Start').map(t => t.date).sort();
    const tEnds   = (termDates || []).filter(t => t.type === 'Term End').map(t => t.date).sort();
    const tRanges = tStarts.map(s => { const e = tEnds.find(e => e >= s); return e ? {start: s, end: e} : null; }).filter(Boolean);
    if (tRanges.some(r => start <= r.end && end >= r.start)) return 'term';
    if ((termDates || []).some(t => t.type === 'School Holiday' && t.date >= start && t.date <= end)) return 'holiday';
    return null;
  }, [formData.startDate, formData.endDate, termDates]);

  const BookingWarning = () => {
    if (proposedDays <= 0 && !termTimeWarning) return null;

    /* Standard staff: Annual Leave exceeding allowance */
    if (!amITermTime && isDeductible(formData.type)) {
      if (projectedRemaining < 0) {
        return (
          <div className="mb-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 flex gap-2 items-start">
            <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0"/>
            <div className="text-xs text-red-700">
              <strong>You do not have enough leave.</strong> This request needs {proposedDays}d but you only have {remaining}d remaining.
              Submitting will put you {Math.abs(projectedRemaining)}d over your allowance.
            </div>
          </div>
        );
      }
      if (projectedRemaining <= 3 && projectedRemaining >= 0) {
        return (
          <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 flex gap-2 items-start">
            <AlertCircle size={14} className="text-amber-500 mt-0.5 flex-shrink-0"/>
            <p className="text-xs text-amber-700">
              You have <strong>{remaining}d</strong> remaining. This request uses <strong>{proposedDays}d</strong>, leaving you with <strong>{projectedRemaining}d</strong> after approval.
            </p>
          </div>
        );
      }
    }

    /* Any staff: TOIL exceeding credit */
    if (formData.type === CONFIG.toiLeaveType && toil) {
      if (proposedDays > toil.credit) {
        const shortfall = proposedDays - toil.credit;
        return (
          <div className="mb-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 flex gap-2 items-start">
            <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0"/>
            <div className="text-xs text-red-700">
              <strong>Insufficient credit.</strong> You have {toil.credit}d available but this request is for {proposedDays}d.
              {amITermTime && ` If approved, ${shortfall}d will be added to your working target.`}
            </div>
          </div>
        );
      }
    }

    /* Term time / school holiday warning */
    if (termTimeWarning === 'term') {
      return (
        <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 flex gap-2 items-start">
          <AlertCircle size={14} className="text-amber-500 mt-0.5 flex-shrink-0"/>
          <p className="text-xs text-amber-700">
            <strong>Term time dates.</strong> Your request falls during school term time.
            Your manager will be notified to arrange cover before approving.
          </p>
        </div>
      );
    }
    if (termTimeWarning === 'holiday') {
      return (
        <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 flex gap-2 items-start">
          <AlertCircle size={14} className="text-blue-500 mt-0.5 flex-shrink-0"/>
          <p className="text-xs text-blue-700">These dates fall during a recorded school holiday period.</p>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="grid-dashboard">

      {/* ══ LEFT COLUMN ════════════════════════════════════════════ */}
      <div className="space-y-4">

        {/* Holiday year label */}
        {currentHolidayYear && (
          <p className="text-xs text-gray-400 font-medium flex items-center gap-1.5">
            <CalendarDays size={13}/> Holiday year: <strong className="text-gray-600">{currentHolidayYear.label}</strong>
          </p>
        )}

        {/* ── STANDARD: ANNUAL LEAVE CARD ── */}
        {!amITermTime && (
          <div className={`card border-l-4 ${remaining < 0 ? 'border-red-400' : 'border-emerald-500'}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Annual Leave</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {myAllowance}d allowance{myToilCredit > 0 ? ` + ${myToilCredit}d extra hours = ${myEffectiveAllowance}d total` : ' for this year'}
                </p>
              </div>
              <div className={`p-2 rounded-lg ${remaining < 0 ? 'bg-red-100' : 'bg-emerald-100'}`}>
                <CalendarDays size={18} className={remaining < 0 ? 'text-red-500' : 'text-emerald-600'}/>
              </div>
            </div>
            <div className="flex items-end gap-2 mb-3">
              <span className={`text-5xl font-bold leading-none ${remaining < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {Math.abs(remaining)}
              </span>
              <span className="text-lg text-gray-400 mb-1">
                {remaining < 0 ? 'days over limit' : `of ${myEffectiveAllowance} days remaining`}
              </span>
            </div>
            <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all ${remaining < 0 ? 'bg-red-500' : remaining <= 3 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                style={{ width: `${100 - allowancePct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1.5">
              <span>{myDaysTaken}d annual leave used this year</span>
              <span>{remaining < 0 ? `${Math.abs(remaining)}d over` : `${remaining}d left`}</span>
            </div>
            {myCarryForwardDays > 0 && (
              <p className="mt-2 text-xs text-indigo-600 font-medium flex items-center gap-1">
                <CheckCircle2 size={11}/>Includes {myCarryForwardDays}d carried forward from last year
              </p>
            )}
            {myToilCredit > 0 && (
              <p className="mt-1.5 text-xs text-orange-600 font-medium flex items-center gap-1">
                <CheckCircle2 size={11}/>{myToilCredit}d added from approved extra hours worked
              </p>
            )}
            {remaining < 0 && (
              <div className="mt-2 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5">
                <AlertCircle size={12} className="text-red-500 mt-0.5 flex-shrink-0"/>
                <p className="text-xs text-red-600">
                  You have exceeded your leave allowance by {Math.abs(remaining)}d. Please speak to your manager.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── STANDARD STAFF: EXTRA HOURS INFO STRIP ─────────────────────────
             Shows a breakdown when there is any extra-hours activity.
             The TOIL credit is already merged into the annual leave balance above,
             so this is informational only — no separate balance to manage. ── */}
        {!amITermTime && toil && (toil.accrued > 0 || toil.used > 0) && (
          <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 flex items-start gap-3">
            <div className="bg-orange-100 p-2 rounded-lg flex-shrink-0">
              <Clock size={16} className="text-orange-600"/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-orange-700 uppercase tracking-wide mb-0.5">Extra Hours Worked</p>
              <p className="text-sm font-semibold text-orange-900">
                {toil.accrued}d{toil.accruedHours > 0 ? ` (${toil.accruedHours}h)` : ''} earned this year
                {toil.used > 0 ? `, ${toil.used}d taken as time off` : ''}
              </p>
              <p className="text-xs text-orange-600 mt-0.5">
                {toil.credit > 0
                  ? `${toil.credit}d credit included in your leave balance above. ${toil.hoursPerDay}h = 1 day.`
                  : toil.credit < 0
                  ? `You have taken ${Math.abs(toil.credit)}d more than earned. Please speak to your manager.`
                  : 'All earned hours have been used.'}
              </p>
            </div>
          </div>
        )}

        {/* ── NEXT YEAR PRE-BOOKED BANNER (standard staff) ── */}
        {!amITermTime && nextYearDays > 0 && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 flex items-start gap-3">
            <div className="bg-indigo-100 p-2 rounded-lg flex-shrink-0"><CalendarClock size={16} className="text-indigo-600"/></div>
            <div>
              <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide mb-0.5">Next Holiday Year</p>
              <p className="text-sm font-semibold text-indigo-900">{nextYearDays}d already booked</p>
              <p className="text-xs text-indigo-600 mt-0.5">
                This leave is approved and will count against the next holiday year allowance.
                Use the filter below to view those bookings.
              </p>
            </div>
          </div>
        )}

        {/* ── TERM-TIME: SCHOOL HOLIDAY BALANCE CARD ── */}
        {amITermTime && toil && (
          <>
            <div className={`card border-l-4 ${toil.credit < 0 ? 'border-red-400' : 'border-emerald-500'}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">School Holiday Balance</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Earned working school holidays and taken as Time Off in Lieu
                  </p>
                </div>
                <div className={`p-2 rounded-lg ${toil.credit < 0 ? 'bg-red-100' : 'bg-emerald-100'}`}>
                  <Coffee size={18} className={toil.credit < 0 ? 'text-red-500' : 'text-emerald-600'}/>
                </div>
              </div>

              <div className="flex items-end gap-2 mb-1">
                <span className={`text-5xl font-bold leading-none ${toil.credit < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {Math.abs(toil.credit)}
                </span>
                <div className="mb-1">
                  <div className="text-lg text-gray-400 leading-none">
                    {toil.credit < 0 ? 'days to work back' : toil.credit === 0 ? 'days (nothing yet)' : 'days available'}
                  </div>
                  {toil.hoursPerDay && Math.abs(toil.creditHours) > 0 && (
                    <div className="text-xs text-gray-400 mt-0.5">
                      = {Math.abs(toil.creditHours)}h &nbsp;·&nbsp; {toil.hoursPerDay}h per day
                    </div>
                  )}
                </div>
              </div>

              <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden mb-1">
                <div
                  className={`h-2.5 rounded-full transition-all ${toil.credit < 0 ? 'bg-red-400' : 'bg-emerald-500'}`}
                  style={{ width: `${creditPct}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{toil.accrued}d{toil.accruedHours > 0 ? ` (${toil.accruedHours}h)` : ''} earned this year</span>
                <span>{toil.used}d{toil.usedHours > 0 ? ` (${toil.usedHours}h)` : ''} taken as time off</span>
              </div>

              {toil.credit < 0 && (
                <div className="mt-2 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5">
                  <AlertCircle size={12} className="text-red-500 mt-0.5 flex-shrink-0"/>
                  <p className="text-xs text-red-600">
                    You have taken more time off than you have earned. {Math.abs(toil.credit)}d needs to be worked back during the next school holiday.
                  </p>
                </div>
              )}
              {toil.credit > 0 && (
                <div className="mt-2 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5">
                  <CheckCircle2 size={12} className="text-emerald-500 mt-0.5 flex-shrink-0"/>
                  <p className="text-xs text-emerald-600">
                    You have {toil.credit}d available to take as Time Off in Lieu.
                  </p>
                </div>
              )}
            </div>

            {/* School Holiday Working Progress */}
            <div className="card border-l-4 border-blue-400">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">School Holiday Working</p>
                  <p className="text-xs text-gray-500 mt-0.5">Days you are required to work during school holidays</p>
                </div>
                <div className="bg-blue-100 p-2 rounded-lg"><Briefcase size={18} className="text-blue-600"/></div>
              </div>

              <div className="flex items-end gap-2 mb-2">
                <span className="text-4xl font-bold text-gray-900 leading-none">{toil.accrued}</span>
                <div className="mb-0.5">
                  <div className="text-lg text-gray-400 leading-none">of {toil.effectiveTarget} days</div>
                  {toil.hoursPerDay && toil.accruedHours > 0 && (
                    <div className="text-xs text-gray-400 mt-0.5">{toil.accruedHours}h logged ({toil.hoursPerDay}h/day)</div>
                  )}
                </div>
              </div>

              <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-2.5 rounded-full transition-all ${toil.accrued >= toil.effectiveTarget ? 'bg-emerald-500' : 'bg-blue-400'}`}
                  style={{ width: `${workProgressPct}%` }}
                />
              </div>

              <p className={`text-xs mt-1.5 font-medium ${toil.remainingToWork > 0 ? 'text-gray-500' : 'text-emerald-600'}`}>
                {toil.remainingToWork > 0 ? `${toil.remainingToWork} more days still to log` : 'Working target met for this year'}
              </p>

              {toil.termTimeLeaveTaken > 0 && (
                <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5">
                  <School size={12} className="text-amber-500 mt-0.5 flex-shrink-0"/>
                  <p className="text-xs text-amber-700">
                    Your target includes <strong>{toil.termTimeLeaveTaken}d</strong> added from Term Time Leave absences
                    ({toil.target}d base plus {toil.termTimeLeaveTaken}d equals {toil.effectiveTarget}d total).
                  </p>
                </div>
              )}
            </div>

            {/* Next year pre-booked (TT) */}
            {nextYearDays > 0 && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 flex items-start gap-3">
                <div className="bg-indigo-100 p-2 rounded-lg flex-shrink-0"><CalendarClock size={16} className="text-indigo-600"/></div>
                <div>
                  <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide mb-0.5">Next Holiday Year</p>
                  <p className="text-sm font-semibold text-indigo-900">{nextYearDays}d already booked</p>
                  <p className="text-xs text-indigo-600 mt-0.5">
                    This leave is approved and will count against the next holiday year target.
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── OTHER RECORDED ABSENCES ── */}
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center gap-2">
            <BookOpen size={13} className="text-gray-400"/>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Other Absences This Year</span>
            <span className="ml-auto text-xs text-gray-400">Recorded only (no deduction)</span>
          </div>
          <div className="px-4 py-3">
            {recordedEntries.length > 0 ? (
              <div className="space-y-2 mb-3">
                {recordedEntries.map(([type, days]) => (
                  <div key={type} className="flex items-center justify-between">
                    <TypeBadge type={type}/>
                    <span className="text-sm font-semibold text-gray-700">{days}d</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic mb-3">None recorded yet this year</p>
            )}
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 flex gap-2">
              <Info size={13} className="text-blue-400 flex-shrink-0 mt-0.5"/>
              <p className="text-xs text-blue-600 leading-relaxed">
                Sick leave, medical appointments, CPD, compassionate leave and unpaid leave
                are recorded for HR purposes only. They do not reduce your annual leave allowance.
              </p>
            </div>
          </div>
        </div>

        {/* ── REQUEST FORM ── */}
        <div className="card">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <CalendarDays size={15} className="text-emerald-600"/>Request Absence
          </h3>
          <form onSubmit={submitRequest}>
            <div className={`grid ${!formData.isHalfDay ? 'grid-cols-2' : 'grid-cols-1'} gap-2 mb-3`}>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Start Date</label>
                <input type="date" required onChange={e => setFormData({ ...formData, startDate: e.target.value })}/>
              </div>
              {!formData.isHalfDay && (
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">End Date</label>
                  <input type="date" required onChange={e => setFormData({ ...formData, endDate: e.target.value })}/>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 mb-3">
              <input type="checkbox" className="w-4 h-4" onChange={e => setFormData({ ...formData, isHalfDay: e.target.checked })}/>
              <span className="text-sm text-gray-600">Half Day?</span>
            </div>
            <div className="mb-2">
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Absence Type</label>
              <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value, hoursWorked: '', sickReason: '' })}>
                {CONFIG.leaveTypes.filter(t => {
                  if (amITermTime) return t !== 'Annual Leave' && t !== CONFIG.extraHoursType;
                  return t !== CONFIG.termTimeWorkType && t !== CONFIG.termTimeLeaveType;
                }).map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            {/* Hours entry for Extra Hours Worked */}
            {formData.type === CONFIG.extraHoursType && (() => {
              const hpd = toil?.hoursPerDay || (systemSettings?.hoursPerDay) || 8;
              const hrs = Number(formData.hoursWorked);
              return (
                <div className="mb-3 p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <p className="text-xs font-semibold text-indigo-700 mb-1">Hours Worked</p>
                  <p className="text-xs text-indigo-500 mb-2">Enter the extra hours you worked — {hpd}h = 1 day credit.</p>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0.5" max="999" step="0.5" className="w-28"
                      placeholder={`e.g. ${hpd}`}
                      value={formData.hoursWorked || ''}
                      onChange={e => setFormData({ ...formData, hoursWorked: e.target.value })}
                    />
                    <span className="text-xs text-indigo-600 font-medium">
                      {hrs > 0 ? `= ${(hrs / hpd).toFixed(3).replace(/\.?0+$/, '')}d credit` : 'hours'}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Hours entry for Medical Appointments */}
            {formData.type === 'Medical Appt' && (() => {
              const hpd = systemSettings?.hoursPerDay || 8;
              const hrs = Number(formData.hoursWorked);
              return (
                <div className="mb-3 p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs font-semibold text-blue-700 mb-1">Time Duration (optional)</p>
                  <p className="text-xs text-blue-600 mb-2">Enter hours if tracking specific time — {hpd}h = 1 full day. Or use Half Day checkbox above.</p>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0.5" max="8" step="0.5" className="w-28"
                      placeholder={`e.g. 1, 2, ${hpd}`}
                      value={formData.hoursWorked || ''}
                      onChange={e => setFormData({ ...formData, hoursWorked: e.target.value })}
                    />
                    <span className="text-xs text-blue-600 font-medium">
                      {hrs > 0 ? `= ${(hrs / hpd).toFixed(3).replace(/\.?0+$/, '')}d` : 'hours'}
                    </span>
                  </div>
                </div>
              );
            })()}
            <TypeNote type={formData.type} currentHolidayYear={currentHolidayYear} startDate={formData.startDate}/>
            {(formData.type === 'Sick Leave' || formData.type === 'Medical Appt') && (
              <div className="mb-3">
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">
                  {formData.type === 'Medical Appt' ? 'Appointment Reason (optional)' : 'Sickness Reason (optional)'}
                </label>
                <input type="text" placeholder={formData.type === 'Medical Appt' ? 'Brief reason e.g. Dentist, eye test...' : 'Brief reason e.g. Flu, back pain...'}
                  maxLength={200}
                  value={formData.sickReason || ''}
                  onChange={e => setFormData({ ...formData, sickReason: e.target.value })}
                />
              </div>
            )}
            <BookingWarning />
            <button className="btn btn-primary w-full">Submit Request</button>
          </form>
        </div>
      </div>

      {/* RIGHT COLUMN: ABSENCE HISTORY */}
      <div className="card flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold flex items-center gap-2">
            <Clock size={15} className="text-gray-400"/>Absence History
          </h3>
          <span className="text-xs text-gray-400">{myRequests.length} record{myRequests.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 mb-3 px-1">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>Counts toward allowance
          </div>
          <div className="flex items-center gap-1.5 text-xs text-indigo-600">
            <span className="w-2 h-2 rounded-full bg-indigo-400"></span>Earns TOIL credit
          </div>
          <div className="flex items-center gap-1.5 text-xs text-amber-600">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>Adds to working target
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="w-2 h-2 rounded-full bg-gray-300"></span>Recorded only
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {['all', 'pending', ...(nextYearDays > 0 ? ['nextyear'] : []), ...filterTypes].map(f => (
            <button key={f} onClick={() => setHistoryFilter(f)}
              className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all border ${
                historyFilter === f ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              }`}>
              {f === 'all'      ? 'All'
               : f === 'pending'  ? 'Pending'
               : f === 'nextyear' ? `Next Year (${nextYearDays}d)`
               : f}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 space-y-2 -mx-4 px-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-300">
              <CalendarDays size={36} className="mb-2"/>
              <p className="text-sm text-gray-400">No records found</p>
            </div>
          ) : filtered.map(r => {
            const meta       = getMeta(r.type);
            const col        = getColor(r.type);
            const Icon       = meta.icon;
            const counts     = isDeductible(r.type);
            const isTTLeave  = r.type === CONFIG.termTimeLeaveType;
            const isNextYear = currentHolidayYear && r.startDate > currentHolidayYear.end;
            return (
              <div key={r.id} className={`rounded-xl border p-3 flex items-center gap-3 ${
                isNextYear   ? 'bg-indigo-50 border-indigo-200'
                : isTTLeave  ? 'bg-amber-50 border-amber-200'
                : counts     ? col.bg + ' ' + col.border
                :               'bg-white border-gray-100'
              }`}>
                <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
                  isNextYear ? 'bg-indigo-100' : isTTLeave ? 'bg-amber-100' : counts ? col.iconBg : 'bg-gray-100'
                }`}>
                  <Icon size={16} className={isNextYear ? 'text-indigo-600' : isTTLeave ? 'text-amber-600' : counts ? col.text : 'text-gray-400'}/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-semibold ${
                      isNextYear ? 'text-indigo-700' : isTTLeave ? 'text-amber-700' : counts ? col.text : 'text-gray-700'
                    }`}>{r.type}</span>
                    {isNextYear && <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-medium">Next year</span>}
                    {isTTLeave  && <span className="text-xs text-amber-600 italic">adds to working target</span>}
                    {!counts && !isTTLeave && !isNextYear && <span className="text-xs text-gray-400 italic">recorded only</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{formatDateUK(r.startDate)}, {isNaN(Number(r.daysCount)) ? '?' : r.daysCount}d{r.hoursWorked ? ` (${r.hoursWorked}h)` : ''}</p>
                  {r.sickReason && (r.type === 'Sick Leave' || r.type === 'Medical Appt') && (
                    <p className={`text-xs mt-0.5 ${r.type === 'Medical Appt' ? 'text-blue-600' : 'text-rose-500'}`}>
                      Reason: {r.sickReason}
                    </p>
                  )}
                </div>
                <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${statusStyle[r.status] ?? 'bg-gray-100 text-gray-500'}`}>
                  {r.status}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default EmployeeView;

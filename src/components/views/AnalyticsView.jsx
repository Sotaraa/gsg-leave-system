import React, { useState, useMemo } from 'react';
import {
  BarChart2, AlertTriangle, CheckCircle2, X, Activity,
  CalendarDays, Stethoscope, GraduationCap, Heart, ShieldCheck,
  Ban, Coffee, Briefcase, BookOpen, School, ChevronRight,
  AlertCircle, TrendingDown, User, Users, Building2, CalendarRange, Clock
} from 'lucide-react';
import { formatDateUK } from '../../utils/helpers.js';
import CONFIG from '../../config.js';
import { TypeBadge, getColor, getMeta } from './EmployeeView.jsx';

/* ── Bradford Factor band ─────────────────────────────────── */
const getBradfordBand = (score) => {
  if (score === 0)   return { label: 'None',   bg: 'bg-gray-100',    text: 'text-gray-500'    };
  if (score < 50)    return { label: 'Low',    bg: 'bg-emerald-100', text: 'text-emerald-700' };
  if (score < 125)   return { label: 'Medium', bg: 'bg-amber-100',   text: 'text-amber-700'   };
  return               { label: 'High',   bg: 'bg-red-100',     text: 'text-red-700'     };
};

/* ── Date helpers ─────────────────────────────────────────── */
const addDays = (dateStr, n) => {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
};
const addMonths = (dateStr, n) => {
  const d = new Date(dateStr + 'T12:00:00');
  d.setMonth(d.getMonth() + n);
  return d.toISOString().split('T')[0];
};
const getWeekStart = (dateStr) => {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
};
const weekLabel = (weekStart) => {
  const d = new Date(weekStart + 'T12:00:00');
  return `w/c ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
};

/* ══ Individual Analysis Modal ═══════════════════════════════ */
const PersonModal = ({ person, onClose }) => {
  const band      = getBradfordBand(person.bradford);
  const isNeg     = person.balanceStatus === 'negative';
  const isLow     = person.balanceStatus === 'low';
  const tBal      = person.toilBalance || {};
  const sortedReqs = [...person.userRequests].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const monthKeys  = Object.keys(person.monthlyBreakdown || {}).sort();

  /* Progress bar width for leave breakdown */
  const breakdownValues = Object.values(person.breakdown).filter(d => d > 0);
  const maxDays = breakdownValues.length > 0 ? Math.max(...breakdownValues) : 1;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className={`px-6 py-5 rounded-t-2xl flex items-start justify-between ${isNeg ? 'bg-red-600' : 'bg-emerald-700'}`}>
          <div>
            <h2 className="text-xl font-bold text-white">{person.name}</h2>
            <p className="text-white/80 text-sm mt-0.5">{person.department}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${person.isTermTime ? 'bg-blue-200 text-blue-900' : 'bg-white/20 text-white'}`}>
                {person.isTermTime ? 'Term Time Contract' : 'Standard Contract'}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${band.bg} ${band.text}`}>
                Bradford: {person.bradford} ({band.label})
              </span>
              {isNeg && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-200 text-red-900">
                  Over limit
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1 mt-1">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* ── Balance card ── */}
          {!person.isTermTime ? (
            <div className={`rounded-xl border-2 p-4 ${isNeg ? 'border-red-300 bg-red-50' : isLow ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Annual Leave Balance</p>
              <div className="flex items-end gap-3 mb-3">
                <span className={`text-4xl font-bold leading-none ${isNeg ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-emerald-700'}`}>
                  {Math.abs(person.remaining ?? 0)}d
                </span>
                <span className="text-gray-500 text-sm mb-1">
                  {isNeg ? 'over allowance' : 'remaining'} of {person.effectiveAllowance}d
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                <div
                  className={`h-3 rounded-full transition-all ${isNeg ? 'bg-red-500' : isLow ? 'bg-amber-400' : 'bg-emerald-500'}`}
                  style={{ width: `${person.effectiveAllowance > 0 ? Math.min(100, ((person.breakdown['Annual Leave'] || 0) / person.effectiveAllowance) * 100) : 0}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>{person.breakdown['Annual Leave'] || 0}d annual leave used</span>
                <span>{person.effectiveAllowance}d total{person.carryForwardDays > 0 ? ` (incl. ${person.carryForwardDays}d carried)` : ''}</span>
              </div>
              {isNeg && (
                <div className="mt-2 flex items-center gap-1.5">
                  <AlertTriangle size={12} className="text-red-500 flex-shrink-0"/>
                  <p className="text-xs text-red-600 font-medium">{person.name.split(' ')[0]} has exceeded their leave allowance by {Math.abs(person.remaining ?? 0)}d</p>
                </div>
              )}
            </div>
          ) : (
            <div className={`rounded-xl border-2 p-4 ${isNeg ? 'border-red-300 bg-red-50' : 'border-blue-200 bg-blue-50'}`}>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">School Holiday Working</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Working Progress</p>
                  <div className="flex items-end gap-1 mb-1">
                    <span className="text-3xl font-bold text-blue-700">{tBal.accrued || 0}d</span>
                    <span className="text-gray-500 mb-0.5 text-sm">of {tBal.effectiveTarget || 30}d</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="h-2 rounded-full bg-blue-500 transition-all" style={{ width: `${Math.min(100, ((tBal.accrued || 0) / (tBal.effectiveTarget || 30)) * 100)}%` }}/>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{Math.max(0, (tBal.effectiveTarget || 30) - (tBal.accrued || 0))}d still to work</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Credit Balance</p>
                  <div className="flex items-end gap-1">
                    <span className={`text-3xl font-bold ${isNeg ? 'text-red-600' : 'text-emerald-700'}`}>
                      {Math.abs(tBal.credit || 0)}d
                    </span>
                    <span className="text-gray-500 mb-0.5 text-sm">{isNeg ? 'owed back' : 'available'}</span>
                  </div>
                  {tBal.used > 0 && <p className="text-xs text-gray-500 mt-1">{tBal.used}d taken as TOIL</p>}
                </div>
              </div>
            </div>
          )}

          {/* ── Leave breakdown bars ── */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Leave Breakdown This Year</p>
            {Object.entries(person.breakdown).filter(([, d]) => d > 0).length === 0 ? (
              <p className="text-sm text-gray-400 italic">No leave recorded this year</p>
            ) : (
              <div className="space-y-2.5">
                {Object.entries(person.breakdown)
                  .filter(([, days]) => days > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, days]) => {
                    const col = getColor(type);
                    return (
                      <div key={type} className="flex items-center gap-3">
                        <div className="w-28 text-right text-xs text-gray-600 font-medium flex-shrink-0 truncate">{type}</div>
                        <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                          <div className={`h-6 rounded-full ${col.bar} transition-all`} style={{ width: `${(days / maxDays) * 100}%` }}/>
                          <span className="absolute inset-0 flex items-center px-2 text-xs font-bold text-white">
                            {days}d
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* ── Monthly activity ── */}
          {monthKeys.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Monthly Activity</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {monthKeys.map(month => {
                  const monthData  = person.monthlyBreakdown[month];
                  const totalDays  = Object.values(monthData).reduce((s, d) => s + d, 0);
                  const d          = new Date(month + '-01');
                  const label      = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
                  return (
                    <div key={month} className="bg-gray-50 rounded-lg p-2.5 border border-gray-200">
                      <p className="text-xs font-bold text-gray-600 mb-1">{label}</p>
                      <p className="text-xl font-bold text-gray-800">{totalDays}d</p>
                      <div className="space-y-0.5 mt-1">
                        {Object.entries(monthData).map(([t, d]) => (
                          <p key={t} className="text-[10px] text-gray-500">{t}: {d}d</p>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Bradford Factor explanation ── */}
          <div className={`rounded-xl p-4 border ${band.label === 'High' ? 'border-red-200 bg-red-50' : band.label === 'Medium' ? 'border-amber-100 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center gap-3 mb-2">
              <Activity size={15} className={band.label === 'High' ? 'text-red-500' : band.label === 'Medium' ? 'text-amber-500' : 'text-gray-400'}/>
              <p className="text-sm font-bold text-gray-700">Bradford Factor Score: {person.bradford}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${band.bg} ${band.text}`}>{band.label}</span>
            </div>
            <p className="text-xs text-gray-500 mb-2">
              Calculated as (number of sick spells)² x (total sick days). Measures the impact of short, frequent absences.
              {person.breakdown['Sick Leave'] > 0
                ? ` ${person.name.split(' ')[0]} has had sick leave recorded this year.`
                : ` No sick leave recorded this year.`}
            </p>
            <div className="flex flex-wrap gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>0 to 49: Low risk</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>50 to 124: Review suggested</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"></span>125 and above: Management action recommended</span>
            </div>
          </div>

          {/* ── Sick leave spells detail ── */}
          {(() => {
            const sickSpells = sortedReqs.filter(r => r.type === 'Sick Leave');
            if (sickSpells.length === 0) return null;
            return (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                  Sick Leave Spells ({sickSpells.length})
                </p>
                <div className="space-y-2">
                  {sickSpells.map((r, idx) => (
                    <div key={r.id} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-rose-700 w-4 flex-shrink-0">#{idx + 1}</span>
                        <span className="text-xs text-gray-600 flex-shrink-0">
                          {formatDateUK(r.startDate)}
                          {r.endDate && r.endDate !== r.startDate ? ` — ${formatDateUK(r.endDate)}` : ''}
                        </span>
                        <span className="ml-auto text-xs font-bold text-rose-700">{r.daysCount}d</span>
                      </div>
                      {r.sickReason && (
                        <p className="text-xs text-rose-600 mt-1 ml-7 italic">Reason: {r.sickReason}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ── Annual leave periods detail ── */}
          {(() => {
            const annualSpells = sortedReqs.filter(r => r.type === 'Annual Leave');
            if (annualSpells.length === 0) return null;
            return (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                  Holiday Periods ({annualSpells.length})
                </p>
                <div className="space-y-1.5">
                  {annualSpells.map(r => (
                    <div key={r.id} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 flex items-center gap-3">
                      <span className="text-xs text-gray-600 flex-shrink-0">
                        {formatDateUK(r.startDate)}
                        {r.endDate && r.endDate !== r.startDate ? ` — ${formatDateUK(r.endDate)}` : ''}
                      </span>
                      {r.isHalfDay && <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded font-medium">Half day</span>}
                      <span className="ml-auto text-xs font-bold text-emerald-700">{r.daysCount}d</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ── Full leave history ── */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
              All Leave This Year ({sortedReqs.length} record{sortedReqs.length !== 1 ? 's' : ''})
            </p>
            {sortedReqs.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No approved leave this year</p>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {sortedReqs.map(r => {
                  const col = getColor(r.type);
                  return (
                    <div key={r.id} className={`rounded-lg px-3 py-2 ${col.bg} border ${col.border}`}>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-20 flex-shrink-0">{formatDateUK(r.startDate)}</span>
                        <TypeBadge type={r.type}/>
                        <span className="text-xs font-semibold text-gray-700 ml-auto">{r.daysCount}d</span>
                      </div>
                      {r.sickReason && (
                        <p className="text-xs text-rose-500 mt-0.5 ml-1 italic">Reason: {r.sickReason}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ══ Upcoming Schedule Tab ════════════════════════════════════ */
const UpcomingSchedule = ({ requests, staffList, departments, isAdmin, myDept, termDates = [] }) => {
  const [schedView,   setSchedView]   = useState('all');  // 'all' | 'dept' | 'individual'
  const [schedRange,  setSchedRange]  = useState('1m');   // '2w' | '1m' | '3m' | 'all'
  const [schedPerson, setSchedPerson] = useState('');     // email
  const [schedDept,   setSchedDept]   = useState('');     // dept name

  const today = new Date().toISOString().split('T')[0];

  const rangeEnd = useMemo(() => {
    if (schedRange === '2w') return addDays(today, 14);
    if (schedRange === '1m') return addMonths(today, 1);
    if (schedRange === '3m') return addMonths(today, 3);
    return '9999-12-31';
  }, [schedRange, today]);

  /* Active (non-archived) staff visible to this user */
  const activeStaff = useMemo(() =>
    staffList
      .filter(s => !s.isArchived && (isAdmin || !myDept || s.department === myDept))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [staffList, isAdmin, myDept]
  );

  /* All upcoming approved absences within range for this user's scope */
  const baseUpcoming = useMemo(() => {
    return requests.filter(r => {
      if (r.status !== 'Approved') return false;
      const staff = staffList.find(s => s.email === r.employeeEmail);
      if (!staff || staff.isArchived) return false;
      if (!isAdmin && myDept && staff.department !== myDept) return false;
      const end = r.endDate || r.startDate;
      return end >= today && r.startDate <= rangeEnd;
    }).sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [requests, staffList, today, rangeEnd, isAdmin, myDept]);

  /* Filtered list based on sub-view selection */
  const filtered = useMemo(() => {
    if (schedView === 'dept' && schedDept) {
      return baseUpcoming.filter(r => {
        const staff = staffList.find(s => s.email === r.employeeEmail);
        return staff && staff.department === schedDept;
      });
    }
    if (schedView === 'individual' && schedPerson) {
      return baseUpcoming.filter(r => r.employeeEmail === schedPerson);
    }
    return baseUpcoming;
  }, [baseUpcoming, schedView, schedDept, schedPerson, staffList]);

  /* Bank holidays within range */
  const bankHolidays = useMemo(() =>
    termDates
      .filter(t => t.type === 'Bank Holiday' && t.date >= today && t.date <= rangeEnd)
      .sort((a, b) => a.date.localeCompare(b.date)),
    [termDates, today, rangeEnd]
  );

  /* Per-person upcoming booked days summary (All Staff view) */
  const upcomingSummary = useMemo(() => {
    const map = {};
    baseUpcoming.forEach(r => {
      const key = r.employeeEmail;
      if (!map[key]) {
        const staff = staffList.find(s => s.email === key);
        map[key] = { name: r.employeeName, dept: staff?.department || r.department || '', days: 0 };
      }
      map[key].days += Number(r.daysCount || 0);
    });
    return Object.values(map).sort((a, b) => b.days - a.days);
  }, [baseUpcoming, staffList]);

  /* Group by week — merging leave + bank holidays */
  const byWeek = useMemo(() => {
    const groups = {};
    filtered.forEach(r => {
      const ws = getWeekStart(r.startDate);
      if (!groups[ws]) groups[ws] = { leave: [], bankHols: [] };
      groups[ws].leave.push(r);
    });
    bankHolidays.forEach(bh => {
      const ws = getWeekStart(bh.date);
      if (!groups[ws]) groups[ws] = { leave: [], bankHols: [] };
      groups[ws].bankHols.push(bh);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered, bankHolidays]);

  /* Group by department for Dept view */
  const byDept = useMemo(() => {
    const groups = {};
    baseUpcoming.forEach(r => {
      const staff = staffList.find(s => s.email === r.employeeEmail);
      const dept = staff?.department || 'Unknown';
      if (!groups[dept]) groups[dept] = [];
      groups[dept].push(r);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [baseUpcoming, staffList]);

  const rangeLabel =
    schedRange === '2w' ? 'next 2 weeks' :
    schedRange === '1m' ? 'next month'   :
    schedRange === '3m' ? 'next 3 months' : 'all future dates';

  const visibleCount = schedView === 'dept' && !schedDept ? baseUpcoming.length : filtered.length;

  /* ── Bank holiday row renderer ── */
  const renderBankHolidayRow = (bh) => (
    <div key={`bh-${bh.id || bh.date}`} className="flex flex-wrap items-center gap-3 rounded-lg px-3 py-2.5 border bg-violet-50 border-violet-200">
      <div className="flex-shrink-0 min-w-[90px]">
        <div className="text-xs font-bold text-violet-700">{formatDateUK(bh.date)}</div>
      </div>
      <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-violet-200 text-violet-800 whitespace-nowrap">🏛 Bank Holiday</span>
      <div className="flex-1 text-sm font-semibold text-violet-700">{bh.description}</div>
      <span className="text-xs font-bold text-violet-500 bg-white/70 px-2 py-0.5 rounded-full whitespace-nowrap">All Staff</span>
    </div>
  );

  /* ── Individual absence row renderer ── */
  const renderRow = (r) => {
    const col = getColor(r.type);
    const isMultiDay = r.endDate && r.endDate !== r.startDate;
    return (
      <div key={r.id} className={`flex flex-wrap items-center gap-3 rounded-lg px-3 py-2.5 border ${col.bg} ${col.border}`}>
        <div className="flex-shrink-0 min-w-[90px]">
          <div className="text-xs font-bold text-gray-700">{formatDateUK(r.startDate)}</div>
          {isMultiDay && <div className="text-[10px] text-gray-400">→ {formatDateUK(r.endDate)}</div>}
        </div>
        <TypeBadge type={r.type} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-800 truncate">{r.employeeName}</div>
          <div className="text-xs text-gray-400">{r.department}</div>
        </div>
        <span className="text-xs font-bold text-gray-600 bg-white/70 px-2 py-0.5 rounded-full whitespace-nowrap">
          {r.daysCount}d
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-4">

      {/* ── Controls bar ── */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        {/* Sub-view tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { key: 'all',        label: 'All Staff',       Icon: Users     },
            { key: 'dept',       label: 'By Department',   Icon: Building2 },
            { key: 'individual', label: 'Individual',       Icon: User      },
          ].map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setSchedView(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                schedView === key
                  ? 'bg-white shadow text-emerald-700 font-semibold'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={13} />{label}
            </button>
          ))}
        </div>

        {/* Time range */}
        <select value={schedRange} onChange={e => setSchedRange(e.target.value)} className="text-sm">
          <option value="2w">Next 2 Weeks</option>
          <option value="1m">Next Month</option>
          <option value="3m">Next 3 Months</option>
          <option value="all">All Future</option>
        </select>
      </div>

      {/* ── Secondary filter ── */}
      {schedView === 'dept' && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-500 font-medium">Department:</span>
          <button
            onClick={() => setSchedDept('')}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${!schedDept ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >All</button>
          {departments.map(d => (
            <button
              key={d}
              onClick={() => setSchedDept(d === schedDept ? '' : d)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${schedDept === d ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >{d}</button>
          ))}
        </div>
      )}

      {schedView === 'individual' && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-500 font-medium">Staff member:</span>
          <select
            value={schedPerson}
            onChange={e => setSchedPerson(e.target.value)}
            className="text-sm"
          >
            <option value="">Select a staff member…</option>
            {activeStaff.map(s => (
              <option key={s.email} value={s.email}>{s.name} — {s.department}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── Result count ── */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <Clock size={12}/>
          <strong className="text-gray-600">{visibleCount}</strong> absence{visibleCount !== 1 ? 's' : ''} — {rangeLabel}
        </span>
        {bankHolidays.length > 0 && (
          <span className="flex items-center gap-1 text-violet-500 font-medium">
            <span className="w-2 h-2 rounded-full bg-violet-400 inline-block"/>
            {bankHolidays.length} bank holiday{bankHolidays.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── Upcoming bookings summary (All Staff view) ── */}
      {schedView === 'all' && upcomingSummary.length > 0 && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-2">Upcoming Booked Days — not yet taken</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
            {upcomingSummary.map(s => (
              <div key={s.name} className="bg-white rounded-lg px-3 py-2 border border-indigo-100 flex justify-between items-center gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800 truncate">{s.name.split(' ')[0]}</p>
                  <p className="text-[10px] text-gray-400 truncate">{s.dept}</p>
                </div>
                <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">{s.days}d</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Content ── */}

      {/* By Department view */}
      {schedView === 'dept' && (
        <div className="space-y-4">
          {(schedDept
            ? (filtered.length > 0 ? [[schedDept, filtered]] : [])
            : byDept
          ).map(([dept, deptReqs]) => (
            <div key={dept} className="card">
              <div className="flex items-center gap-2 mb-3">
                <Building2 size={15} className="text-emerald-600 flex-shrink-0"/>
                <h4 className="font-bold text-gray-700">{dept}</h4>
                <span className="ml-auto text-xs text-gray-400">{deptReqs.length} absence{deptReqs.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-1.5">
                {deptReqs.map(r => renderRow(r))}
              </div>
            </div>
          ))}
          {(schedDept ? filtered : baseUpcoming).length === 0 && (
            <div className="card text-center py-14 text-gray-400">
              <CalendarRange size={38} className="mx-auto mb-3 opacity-20"/>
              <p className="font-medium text-sm">No upcoming absences {schedDept ? `in ${schedDept}` : ''} for {rangeLabel}</p>
            </div>
          )}
        </div>
      )}

      {/* All Staff / Individual view — grouped by week */}
      {schedView !== 'dept' && (
        <div className="space-y-4">
          {schedView === 'individual' && !schedPerson ? (
            <div className="card text-center py-14 text-gray-400">
              <User size={38} className="mx-auto mb-3 opacity-20"/>
              <p className="font-medium text-sm">Select a staff member above to view their upcoming schedule</p>
            </div>
          ) : byWeek.length === 0 ? (
            <div className="card text-center py-14 text-gray-400">
              <CalendarRange size={38} className="mx-auto mb-3 opacity-20"/>
              <p className="font-medium text-sm">
                No upcoming absences
                {schedView === 'individual' && schedPerson
                  ? ` for ${activeStaff.find(s => s.email === schedPerson)?.name?.split(' ')[0] || 'this staff member'}`
                  : ''} for {rangeLabel}
              </p>
            </div>
          ) : (
            byWeek.map(([weekStart, { leave, bankHols }]) => (
              <div key={weekStart} className="card">
                <div className="flex items-center gap-2 mb-3">
                  <CalendarRange size={15} className="text-emerald-600 flex-shrink-0"/>
                  <h4 className="font-semibold text-gray-700 text-sm">{weekLabel(weekStart)}</h4>
                  <div className="ml-auto flex items-center gap-2">
                    {bankHols.length > 0 && (
                      <span className="text-xs text-violet-500 font-medium">{bankHols.length} bank holiday{bankHols.length !== 1 ? 's' : ''}</span>
                    )}
                    <span className="text-xs text-gray-400">{leave.length} absence{leave.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {bankHols.sort((a, b) => a.date.localeCompare(b.date)).map(bh => renderBankHolidayRow(bh))}
                  {leave.map(r => renderRow(r))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

/* ══ Main Analytics View ═════════════════════════════════════ */
const AnalyticsView = ({
  analyticsData, departments, isAdmin,
  selectedDeptFilter, setSelectedDeptFilter,
  currentHolidayYear,
  requests, staffList, myDept, termDates
}) => {
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [mainTab, setMainTab] = useState('analysis'); // 'analysis' | 'schedule'

  const standard      = analyticsData.individualData.filter(s => !s.isTermTime);
  const termTime      = analyticsData.individualData.filter(s => s.isTermTime);
  const negativeBalance = analyticsData.individualData.filter(s => s.balanceStatus === 'negative');
  const highBradford    = analyticsData.individualData.filter(s => s.bradford >= 125);
  const medBradford     = analyticsData.individualData.filter(s => s.bradford >= 50 && s.bradford < 125);

  /* KPI totals */
  const totalAnnualLeave = standard.reduce((sum, s) => sum + (s.breakdown['Annual Leave'] || 0), 0);
  const totalSick        = analyticsData.individualData.reduce((sum, s) => sum + (s.breakdown['Sick Leave'] || 0), 0);
  const totalCPD         = analyticsData.individualData.reduce((sum, s) => sum + ((s.breakdown['CPD'] || 0) + (s.breakdown['Professional Dev'] || 0)), 0);
  const totalMedical     = analyticsData.individualData.reduce((sum, s) => sum + (s.breakdown['Medical Appt'] || 0), 0);
  const totalCompassionate = analyticsData.individualData.reduce((sum, s) => sum + (s.breakdown['Compassionate'] || 0), 0);
  const totalUnpaid      = analyticsData.individualData.reduce((sum, s) => sum + (s.breakdown['Unpaid'] || 0), 0);
  const totalOther       = totalMedical + totalCompassionate + totalUnpaid;

  return (
    <div className="space-y-5">

      {/* ── Header + Main Tab Bar ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <BarChart2 size={20} className="text-emerald-600"/>Leave Analytics
          </h2>
          {currentHolidayYear && (
            <p className="text-xs text-gray-400 mt-0.5">Holiday year: {currentHolidayYear.label}</p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Main tab switcher */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setMainTab('analysis')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${mainTab === 'analysis' ? 'bg-white shadow text-emerald-700 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <BarChart2 size={13}/>Leave Analysis
            </button>
            <button
              onClick={() => setMainTab('schedule')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${mainTab === 'schedule' ? 'bg-white shadow text-emerald-700 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <CalendarRange size={13}/>Upcoming Schedule
            </button>
          </div>

          {/* Dept filter (only shown on analysis tab for admins) */}
          {isAdmin && mainTab === 'analysis' && (
            <select
              value={selectedDeptFilter}
              onChange={e => setSelectedDeptFilter(e.target.value)}
              className="text-sm"
            >
              <option value="All">All Departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* ══ UPCOMING SCHEDULE TAB ══ */}
      {mainTab === 'schedule' && (
        <UpcomingSchedule
          requests={requests || []}
          staffList={staffList || []}
          departments={departments}
          isAdmin={isAdmin}
          myDept={myDept}
          termDates={termDates || []}
        />
      )}

      {/* ══ LEAVE ANALYSIS TAB ══ */}
      {mainTab === 'analysis' && (
        <>
          {/* ── Alert banner ── */}
          {(negativeBalance.length > 0 || highBradford.length > 0) && (
            <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} className="text-red-500 flex-shrink-0"/>
                <p className="text-sm font-bold text-red-700">Attention Required</p>
              </div>
              {negativeBalance.length > 0 && (
                <p className="text-xs text-red-600 mb-1">
                  <strong>{negativeBalance.length} staff member{negativeBalance.length > 1 ? 's' : ''}</strong> {negativeBalance.length > 1 ? 'are' : 'is'} over their leave limit:
                  {' '}<span className="font-medium">{negativeBalance.map(s => s.name.split(' ')[0]).join(', ')}</span>
                </p>
              )}
              {highBradford.length > 0 && (
                <p className="text-xs text-red-600">
                  <strong>{highBradford.length} staff member{highBradford.length > 1 ? 's' : ''}</strong> {highBradford.length > 1 ? 'have' : 'has'} a high Bradford Factor score (125 and above):
                  {' '}<span className="font-medium">{highBradford.map(s => `${s.name.split(' ')[0]} (${s.bradford})`).join(', ')}</span>
                </p>
              )}
            </div>
          )}

          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="card border-t-4 border-emerald-500 py-3 px-4 text-center">
              <p className="text-4xl font-bold text-gray-800">{totalAnnualLeave}</p>
              <p className="text-xs font-semibold text-gray-600 mt-1">Holiday Days Taken</p>
              <p className="text-xs text-gray-400">Standard staff annual leave</p>
            </div>
            <div className="card border-t-4 border-rose-400 py-3 px-4 text-center">
              <p className="text-4xl font-bold text-gray-800">{totalSick}</p>
              <p className="text-xs font-semibold text-gray-600 mt-1">Sick Days Recorded</p>
              <p className="text-xs text-gray-400">All staff, this year</p>
            </div>
            <div className="card border-t-4 border-violet-400 py-3 px-4 text-center">
              <p className="text-4xl font-bold text-gray-800">{totalCPD}</p>
              <p className="text-xs font-semibold text-gray-600 mt-1">CPD Days</p>
              <p className="text-xs text-gray-400">Professional development</p>
            </div>
            <div className={`card border-t-4 py-3 px-4 text-center ${negativeBalance.length > 0 ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}>
              <p className={`text-4xl font-bold ${negativeBalance.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>{negativeBalance.length}</p>
              <p className={`text-xs font-semibold mt-1 ${negativeBalance.length > 0 ? 'text-red-600' : 'text-gray-600'}`}>Negative Balance</p>
              <p className="text-xs text-gray-400">Staff over their limit</p>
            </div>
          </div>

          {/* ── Non-deductible summary row ── */}
          {(totalOther > 0 || medBradford.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {totalOther > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-3">
                  <BookOpen size={16} className="text-blue-500 flex-shrink-0 mt-0.5"/>
                  <div className="text-xs text-blue-700">
                    <p className="font-semibold mb-1">Other HR Records This Year</p>
                    <div className="flex flex-wrap gap-3">
                      {totalMedical > 0 && <span>Medical Appts: <strong>{totalMedical}d</strong></span>}
                      {totalCompassionate > 0 && <span>Compassionate: <strong>{totalCompassionate}d</strong></span>}
                      {totalUnpaid > 0 && <span>Unpaid: <strong>{totalUnpaid}d</strong></span>}
                    </div>
                  </div>
                </div>
              )}
              {medBradford.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3">
                  <Activity size={16} className="text-amber-500 flex-shrink-0 mt-0.5"/>
                  <div className="text-xs text-amber-700">
                    <p className="font-semibold mb-1">Bradford Factor Review Recommended</p>
                    <p>{medBradford.map(s => `${s.name.split(' ')[0]} (${s.bradford})`).join(', ')}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Standard Staff Table ── */}
          {standard.length > 0 && (
            <div className="card">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-3 h-3 rounded-full bg-emerald-500 flex-shrink-0"></span>
                <h3 className="font-bold text-gray-700">Standard Contracts</h3>
                <span className="ml-auto text-xs text-gray-400">{standard.length} staff</span>
              </div>
              <p className="text-xs text-gray-400 mb-4">Holiday leave tracks against annual allowance. Click any row for full individual analysis.</p>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 mb-3 text-xs text-gray-500">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block"/><span>Taken (past leave)</span></span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-400 inline-block"/><span>Booked – upcoming (not yet taken)</span></span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-gray-200 border border-gray-300 inline-block"/><span>Free / unbooked remaining</span></span>
              </div>

              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th className="min-w-[240px]">Annual Leave Usage</th>
                      <th className="text-center">Sick</th>
                      <th className="text-center">CPD</th>
                      <th className="text-center">Other</th>
                      <th className="text-center">Bradford</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {standard.map(s => {
                      const isNeg    = s.balanceStatus === 'negative';
                      const isLow    = s.balanceStatus === 'low';
                      const taken    = s.annualLeaveTaken    ?? (s.breakdown['Annual Leave'] || 0);
                      const upcoming = s.annualLeaveUpcoming ?? 0;
                      const free     = Math.max(0, (s.remaining ?? 0));
                      const takenPct    = s.effectiveAllowance > 0 ? Math.min(100, (taken    / s.effectiveAllowance) * 100) : 0;
                      const upcomingPct = s.effectiveAllowance > 0 ? Math.min(100 - takenPct, (upcoming / s.effectiveAllowance) * 100) : 0;
                      const band     = getBradfordBand(s.bradford);
                      const otherDays = (s.breakdown['Medical Appt'] || 0) + (s.breakdown['Compassionate'] || 0) + (s.breakdown['Unpaid'] || 0);
                      const rowBg = isNeg ? 'bg-red-50' : upcoming > 0 ? 'bg-amber-50/40' : '';
                      return (
                        <tr
                          key={s.id}
                          onClick={() => setSelectedPerson(s)}
                          className={`cursor-pointer hover:bg-gray-50 transition-colors ${rowBg}`}
                        >
                          <td>
                            <div className="font-bold text-sm">{s.name}</div>
                            <div className="text-xs text-gray-400">{s.department}</div>
                            {isNeg && <div className="text-xs text-red-500 font-semibold">Over allowance</div>}
                            {upcoming > 0 && !isNeg && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block flex-shrink-0"/>
                                <span className="text-xs text-amber-600 font-semibold">{upcoming}d booked ahead</span>
                              </div>
                            )}
                          </td>
                          <td>
                            {/* Top label row */}
                            <div className="flex items-center justify-between text-xs mb-1 gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className={`font-medium flex-shrink-0 ${isNeg ? 'text-red-600' : 'text-gray-600'}`}>
                                  {taken}d taken
                                </span>
                                {upcoming > 0 && (
                                  <span className="font-semibold text-amber-600 flex-shrink-0 bg-amber-100 px-1.5 py-0.5 rounded-full">
                                    +{upcoming}d booked
                                  </span>
                                )}
                              </div>
                              <span className={`font-semibold flex-shrink-0 ${isNeg ? 'text-red-600' : upcoming > 0 ? 'text-amber-600' : isLow ? 'text-amber-600' : 'text-emerald-600'}`}>
                                {isNeg
                                  ? `${Math.abs(s.remaining ?? 0)}d over`
                                  : upcoming > 0
                                    ? `${free}d free / ${s.effectiveAllowance}d`
                                    : `${s.remaining ?? 0}d left / ${s.effectiveAllowance}d`
                                }
                              </span>
                            </div>
                            {/* 3-segment progress bar */}
                            <div className="w-full h-2.5 flex rounded-full overflow-hidden bg-gray-200">
                              {takenPct > 0 && (
                                <div
                                  className={`h-full transition-all flex-shrink-0 ${isNeg ? 'bg-red-500' : isLow && upcoming === 0 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                                  style={{ width: `${takenPct}%` }}
                                />
                              )}
                              {upcomingPct > 0 && (
                                <div
                                  className="h-full bg-amber-400 transition-all flex-shrink-0"
                                  style={{ width: `${upcomingPct}%` }}
                                />
                              )}
                            </div>
                            {/* Upcoming sub-label */}
                            {upcoming > 0 && (
                              <div className="text-[10px] text-amber-600 mt-0.5">
                                {taken}d taken · {upcoming}d booked · {free}d still free to book
                              </div>
                            )}
                          </td>
                          <td className="text-center">
                            {(s.breakdown['Sick Leave'] || 0) > 0
                              ? <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full text-xs font-semibold">{s.breakdown['Sick Leave']}d</span>
                              : <span className="text-gray-300 text-xs">-</span>}
                          </td>
                          <td className="text-center">
                            {((s.breakdown['CPD'] || 0) + (s.breakdown['Professional Dev'] || 0)) > 0
                              ? <span className="bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full text-xs font-semibold">{(s.breakdown['CPD'] || 0) + (s.breakdown['Professional Dev'] || 0)}d</span>
                              : <span className="text-gray-300 text-xs">-</span>}
                          </td>
                          <td className="text-center">
                            {otherDays > 0
                              ? <span className="bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full text-xs font-semibold">{otherDays}d</span>
                              : <span className="text-gray-300 text-xs">-</span>}
                          </td>
                          <td className="text-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${band.bg} ${band.text}`}>
                              {s.bradford}
                            </span>
                          </td>
                          <td className="text-right pr-2">
                            <ChevronRight size={14} className="text-gray-400 inline"/>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Term Time Staff Table ── */}
          {termTime.length > 0 && (
            <div className="card">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0"></span>
                <h3 className="font-bold text-gray-700">Term Time Contracts</h3>
                <span className="ml-auto text-xs text-gray-400">{termTime.length} staff</span>
              </div>
              <p className="text-xs text-gray-400 mb-4">Tracks school holiday working progress and credit balance. Click any row for full analysis.</p>

              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th className="min-w-[180px]">Holiday Working</th>
                      <th className="text-center">TOIL Taken</th>
                      <th className="text-center">Credit</th>
                      <th className="text-center">Sick</th>
                      <th className="text-center">Bradford</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {termTime.map(s => {
                      const isNeg       = s.balanceStatus === 'negative';
                      const tBal        = s.toilBalance || {};
                      const accrued     = tBal.accrued || 0;
                      const target      = tBal.effectiveTarget || 30;
                      const credit      = tBal.credit ?? 0;
                      const used        = tBal.used || 0;
                      const workPct     = target > 0 ? Math.min(100, (accrued / target) * 100) : 0;
                      const band        = getBradfordBand(s.bradford);
                      return (
                        <tr
                          key={s.id}
                          onClick={() => setSelectedPerson(s)}
                          className={`cursor-pointer hover:bg-gray-50 transition-colors ${isNeg ? 'bg-red-50' : ''}`}
                        >
                          <td>
                            <div className="font-bold text-sm">{s.name}</div>
                            <div className="text-xs text-gray-400">{s.department}</div>
                            {isNeg && <div className="text-xs text-red-500 font-semibold">Over credit</div>}
                          </td>
                          <td>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-gray-600">{accrued}d worked</span>
                              <span className={`font-semibold ${accrued >= target ? 'text-emerald-600' : 'text-blue-600'}`}>of {target}d target</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                              <div
                                className={`h-2.5 rounded-full transition-all ${accrued >= target ? 'bg-emerald-500' : 'bg-blue-400'}`}
                                style={{ width: `${workPct}%` }}
                              />
                            </div>
                          </td>
                          <td className="text-center">
                            {used > 0
                              ? <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-xs font-semibold">{used}d</span>
                              : <span className="text-gray-300 text-xs">-</span>}
                          </td>
                          <td className="text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isNeg ? 'bg-red-100 text-red-700' : credit > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                              {isNeg ? `${Math.abs(credit)}d owed` : credit > 0 ? `+${credit}d` : '0'}
                            </span>
                          </td>
                          <td className="text-center">
                            {(s.breakdown['Sick Leave'] || 0) > 0
                              ? <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full text-xs font-semibold">{s.breakdown['Sick Leave']}d</span>
                              : <span className="text-gray-300 text-xs">-</span>}
                          </td>
                          <td className="text-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${band.bg} ${band.text}`}>
                              {s.bradford}
                            </span>
                          </td>
                          <td className="text-right pr-2">
                            <ChevronRight size={14} className="text-gray-400 inline"/>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {analyticsData.individualData.length === 0 && (
            <div className="card text-center py-16 text-gray-400">
              <BarChart2 size={40} className="mx-auto mb-3 opacity-20"/>
              <p className="font-medium">No staff data for this filter</p>
            </div>
          )}
        </>
      )}

      {/* ── Individual analysis popup ── */}
      {selectedPerson && (
        <PersonModal person={selectedPerson} onClose={() => setSelectedPerson(null)} />
      )}
    </div>
  );
};

export default AnalyticsView;

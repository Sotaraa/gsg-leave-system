import React, { useState, useMemo } from 'react';
import { AlertCircle } from 'lucide-react';
import CONFIG from '../../config.js';
import { formatDateUK, calculateWorkingDays, getTermForDate } from '../../utils/helpers.js';
import { isDeductible, TypeNote, TypeBadge, getColor } from './EmployeeView.jsx';

const DeptHeadView = ({
  requests, staffList, myDept, isAdmin,
  handleApproval, handleManualAdd, manualLeave, setManualLeave, handleStaffSelect,
  getLeaveTaken, getTOILBalance, updateStaffTarget, currentHolidayYear,
  pendingApprovalId, setPendingApprovalId, termDates, schoolTerms, systemSettings
}) => {
  const [targetEdits, setTargetEdits] = useState({});

  const selectedManualStaff = staffList.find(s => s.id === manualLeave.employeeId);

  /* Count approved leave for a staff member after the current year ends (pre-booked next year) */
  const getNextYearBooked = (email) =>
    requests
      .filter(r => r.employeeEmail === email && r.status === 'Approved' && currentHolidayYear && r.startDate > currentHolidayYear.end)
      .reduce((t, r) => t + (Number(r.daysCount) || 0), 0);

  const myTeam = staffList.filter(s => !s.isArchived && (isAdmin || s.department === myDept));

  /* ── BOOKING WARNING for record form ──────────────────────────── */
  const proposedDays = useMemo(() => {
    if (!manualLeave.startDate) return 0;
    if (!manualLeave.isHalfDay && !manualLeave.endDate) return 0;
    const staffPattern = selectedManualStaff?.workingDays?.length ? selectedManualStaff.workingDays : [1, 2, 3, 4, 5];
    return calculateWorkingDays(
      manualLeave.startDate,
      manualLeave.endDate || manualLeave.startDate,
      manualLeave.isHalfDay,
      termDates || [],
      staffPattern
    );
  }, [manualLeave.startDate, manualLeave.endDate, manualLeave.isHalfDay, termDates, selectedManualStaff]);

  /* Current balance of the selected staff member */
  const selectedBalance = useMemo(() => {
    if (!selectedManualStaff || !currentHolidayYear) return null;
    if (selectedManualStaff.isTermTime) {
      const toil = getTOILBalance(selectedManualStaff.email, selectedManualStaff.termTimeDaysTarget, selectedManualStaff.hoursPerDay, true);
      return { isTermTime: true, credit: toil.credit ?? 0, accrued: toil.accrued || 0, effectiveTarget: toil.effectiveTarget || 30 };
    }
    const taken       = getLeaveTaken(selectedManualStaff.email, false);
    const baseEff     = (selectedManualStaff.allowance || 0) + (selectedManualStaff.carryForwardDays || 0);
    const toil        = getTOILBalance(selectedManualStaff.email, 0, selectedManualStaff.hoursPerDay, false);
    const toilCredit  = Math.max(0, toil.credit ?? 0);
    const effective   = baseEff + toilCredit; // approved extra hours add to total available leave
    return { isTermTime: false, remaining: effective - taken, effective, toilCredit, baseAllowance: baseEff };
  }, [selectedManualStaff, currentHolidayYear, getTOILBalance, getLeaveTaken]);

  const RecordWarning = () => {
    if (!selectedBalance || proposedDays <= 0) return null;
    if (!selectedManualStaff) return null;

    if (!selectedBalance.isTermTime && isDeductible(manualLeave.type)) {
      const afterBooking = selectedBalance.remaining - proposedDays;
      if (afterBooking < 0) {
        return (
          <div className="mb-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex gap-2 items-start">
            <AlertCircle size={13} className="text-red-500 mt-0.5 flex-shrink-0"/>
            <p className="text-xs text-red-700">
              <strong>{selectedManualStaff.name}</strong> only has <strong>{selectedBalance.remaining}d</strong> remaining.
              This request is for <strong>{proposedDays}d</strong>, leaving them <strong>{Math.abs(afterBooking)}d over</strong> their allowance.
            </p>
          </div>
        );
      }
      if (afterBooking <= 3 && afterBooking >= 0) {
        return (
          <div className="mb-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex gap-2 items-start">
            <AlertCircle size={13} className="text-amber-500 mt-0.5 flex-shrink-0"/>
            <p className="text-xs text-amber-700">
              <strong>{selectedManualStaff.name}</strong> has <strong>{selectedBalance.remaining}d</strong> remaining.
              This request uses <strong>{proposedDays}d</strong>, leaving <strong>{afterBooking}d</strong> after recording.
            </p>
          </div>
        );
      }
    }

    if (manualLeave.type === CONFIG.toiLeaveType) {
      const credit = selectedBalance.isTermTime ? selectedBalance.credit : (selectedBalance.toilCredit ?? 0);
      if (proposedDays > credit) {
        return (
          <div className="mb-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex gap-2 items-start">
            <AlertCircle size={13} className="text-red-500 mt-0.5 flex-shrink-0"/>
            <p className="text-xs text-red-700">
              <strong>{selectedManualStaff.name}</strong> has <strong>{credit}d</strong> TOIL credit.
              This request is for <strong>{proposedDays}d</strong>
              {selectedBalance.isTermTime ? ` — approving will add ${proposedDays - credit}d to their working target.` : ' — they do not have enough credit.'}
            </p>
          </div>
        );
      }
    }

    return null;
  };

  return (
    <div className="grid-dashboard">
      <div>

        {/* ── PENDING APPROVALS ── */}
        <div className="card mb-6">
          <h3 className="font-bold mb-4">Pending Approvals</h3>
          {requests.filter(r => r.status === 'Pending' && (isAdmin || r.department === myDept)).length === 0 && (
            <p className="text-sm text-gray-400">No pending requests at the moment.</p>
          )}
          {requests
            .filter(r => r.status === 'Pending' && (isAdmin || r.department === myDept))
            .map(r => {
              const staffMember      = staffList.find(s => s.email === r.employeeEmail);
              const isTermTimePerson = staffMember?.isTermTime;
              const isTOI            = r.type === CONFIG.toiLeaveType;
              const isTTLeave        = r.type === CONFIG.termTimeLeaveType;
              const isExtraHours     = r.type === CONFIG.extraHoursType;

              /* Check balance to flag negative/low */
              let balanceNote = null;
              if (staffMember && !isTermTimePerson && isDeductible(r.type) && currentHolidayYear) {
                const taken = getLeaveTaken(r.employeeEmail, false);
                const effective = (staffMember.allowance || 0) + (staffMember.carryForwardDays || 0);
                const afterApproval = effective - taken - Number(r.daysCount || 0);
                if (afterApproval < 0) {
                  balanceNote = (
                    <div className="mt-1.5 bg-red-50 border border-red-200 rounded px-2 py-1.5">
                      <p className="text-xs text-red-700">
                        Approving this will put {r.employeeName.split(' ')[0]} {Math.abs(afterApproval)}d <strong>over their allowance</strong>. They currently have {effective - taken}d remaining.
                      </p>
                    </div>
                  );
                } else if (afterApproval <= 2) {
                  balanceNote = (
                    <div className="mt-1.5 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                      <p className="text-xs text-amber-700">
                        After approval, {r.employeeName.split(' ')[0]} will have only <strong>{afterApproval}d</strong> remaining.
                      </p>
                    </div>
                  );
                }
              }

              const termName = schoolTerms?.length ? getTermForDate(r.startDate, schoolTerms) : null;
              const hasCalendar = schoolTerms?.length > 0;
              return (
                <div key={r.id} className="p-3 bg-gray-50 rounded mb-3 border">
                  <div className="mb-2">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="font-bold text-sm">{r.employeeName}</p>
                      {isTermTimePerson && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold">Term Time Staff</span>
                      )}
                      {hasCalendar && (
                        termName
                          ? <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded font-semibold">{termName} Term</span>
                          : <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-semibold">School Holiday</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {r.type}, {isNaN(Number(r.daysCount)) ? '?' : r.daysCount}d{r.hoursWorked ? ` (${r.hoursWorked}h)` : ''}, {formatDateUK(r.startDate)}
                    </p>
                    {r.sickReason && (r.type === 'Sick Leave' || r.type === 'Medical Appt') && (
                      <p className={`text-xs mt-0.5 ${r.type === 'Medical Appt' ? 'text-blue-600' : 'text-rose-500'}`}>
                        Reason: {r.sickReason}
                      </p>
                    )}
                    {isTOI && (
                      <div className="mt-1.5 bg-orange-50 border border-orange-200 rounded px-2 py-1.5">
                        <p className="text-xs text-orange-700">
                          {isTermTimePerson
                            ? `Approving this will use ${r.daysCount}d from their school holiday credit. If they have not earned enough yet, the shortfall will be added to their working target.`
                            : `Approving this will use ${r.daysCount}d from their TOIL credit earned through extra hours worked.`}
                        </p>
                      </div>
                    )}
                    {isExtraHours && (
                      <div className="mt-1.5 bg-indigo-50 border border-indigo-200 rounded px-2 py-1.5">
                        <p className="text-xs text-indigo-700">
                          Approving this will add {r.daysCount}d ({r.hoursWorked ? `${r.hoursWorked}h` : 'hours-based'}) to their Time Off in Lieu credit.
                        </p>
                      </div>
                    )}
                    {isTTLeave && (
                      <div className="mt-1.5 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                        <p className="text-xs text-amber-700">
                          Approving this will add {r.daysCount}d to their school holiday working target.
                          To record it without affecting the target, reject and re-record as Unpaid instead.
                        </p>
                      </div>
                    )}
                    {balanceNote}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleApproval(r.id, 'Approved')} className="btn bg-emerald-100 text-emerald-700 text-xs">Approve</button>
                    <button onClick={() => handleApproval(r.id, 'Rejected')} className="btn bg-red-50 text-red-600 text-xs">Reject</button>
                  </div>
                </div>
              );
            })}
        </div>

        {/* ── RECORD TEAM ABSENCE ── */}
        <div className="card">
          <h3 className="font-bold mb-4">Record Team Absence</h3>
          <form onSubmit={handleManualAdd}>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Staff Member</label>
            <select className="mb-3 w-full" onChange={handleStaffSelect}>
              <option value="">Select Staff...</option>
              {myTeam.map(s => (
                <option key={s.id} value={s.id}>{s.name}{s.isTermTime ? ' (Term Time)' : ''}</option>
              ))}
            </select>

            {/* Current balance indicator */}
            {selectedBalance && (
              <div className={`mb-3 rounded-lg px-3 py-2 text-xs flex items-center gap-2 ${
                (!selectedBalance.isTermTime && selectedBalance.remaining < 0) ||
                (selectedBalance.isTermTime && selectedBalance.credit < 0)
                  ? 'bg-red-50 border border-red-200 text-red-700'
                  : (!selectedBalance.isTermTime && selectedBalance.remaining <= 3) ||
                    (selectedBalance.isTermTime && selectedBalance.credit <= 2 && selectedBalance.credit >= 0)
                  ? 'bg-amber-50 border border-amber-200 text-amber-700'
                  : 'bg-gray-50 border border-gray-200 text-gray-600'
              }`}>
                {selectedBalance.isTermTime ? (
                  <span>
                    School holiday credit: <strong className={selectedBalance.credit < 0 ? 'text-red-700' : 'text-emerald-700'}>{selectedBalance.credit}d</strong>
                    {' '} ({selectedBalance.accrued}d worked of {selectedBalance.effectiveTarget}d target)
                  </span>
                ) : (
                  <span>
                    Leave balance: <strong className={selectedBalance.remaining < 0 ? 'text-red-700' : 'text-emerald-700'}>{selectedBalance.remaining}d remaining</strong>
                    {' '}of {selectedBalance.effective}d total
                    {selectedBalance.toilCredit > 0 && <> &nbsp;·&nbsp; incl. <strong className="text-orange-600">{selectedBalance.toilCredit}d</strong> from extra hours</>}
                  </span>
                )}
              </div>
            )}

            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Dates</label>
            <div className="flex gap-2 mb-2">
              <input type="date" required onChange={e => setManualLeave({ ...manualLeave, startDate: e.target.value })} />
              <input type="date" required onChange={e => setManualLeave({ ...manualLeave, endDate: e.target.value })} />
            </div>
            <div className="flex items-center gap-2 mb-3">
              <input type="checkbox" className="w-4 h-4" checked={manualLeave.isHalfDay} onChange={e => setManualLeave({ ...manualLeave, isHalfDay: e.target.checked })} />
              <span className="text-sm text-gray-600">Half Day?</span>
            </div>

            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Absence Type</label>
            <select className="mb-2 w-full" value={manualLeave.type} onChange={e => setManualLeave({ ...manualLeave, type: e.target.value })}>
              {CONFIG.leaveTypes.filter(t => {
                if (selectedManualStaff?.isTermTime) return t !== 'Annual Leave' && t !== CONFIG.extraHoursType;
                return t !== CONFIG.termTimeWorkType && t !== CONFIG.termTimeLeaveType;
              }).map(t => <option key={t}>{t}</option>)}
            </select>

            <TypeNote type={manualLeave.type} currentHolidayYear={currentHolidayYear} startDate={manualLeave.startDate}/>
            {/* Hours entry for TOIL accrual types (School Holiday Worked / Extra Hours Worked) */}
            {(manualLeave.type === CONFIG.termTimeWorkType || manualLeave.type === CONFIG.extraHoursType) && (() => {
              const hpd = Number(selectedManualStaff?.hoursPerDay || systemSettings?.hoursPerDay || CONFIG.defaultHoursPerDay);
              const hrs = Number(manualLeave.hoursWorked);
              return (
                <div className="mb-2 p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <p className="text-xs font-semibold text-indigo-700 mb-1">Log Hours Worked (optional)</p>
                  <p className="text-xs text-indigo-500 mb-2">Enter hours instead of a full day count — useful for partial days. {hpd}h = 1 day {selectedManualStaff?.hoursPerDay ? '(per staff contract)' : '(system default)'}.</p>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0.5" max="999" step="0.5" className="w-28"
                      placeholder={`e.g. ${hpd * 2}`}
                      value={manualLeave.hoursWorked || ''}
                      onChange={e => setManualLeave({ ...manualLeave, hoursWorked: e.target.value })}
                    />
                    <span className="text-xs text-indigo-600 font-medium">
                      {hrs > 0 ? `= ${(hrs / hpd).toFixed(3).replace(/\.?0+$/, '')}d credited` : 'hours'}
                    </span>
                  </div>
                  {hrs > 0 && <p className="text-[10px] text-indigo-400 mt-1">Date field is still used as the work date for record-keeping.</p>}
                </div>
              );
            })()}

            {/* Hours entry for Medical Appointments */}
            {manualLeave.type === 'Medical Appt' && (() => {
              const hpd = Number(selectedManualStaff?.hoursPerDay || systemSettings?.hoursPerDay || CONFIG.defaultHoursPerDay);
              const hrs = Number(manualLeave.hoursWorked);
              return (
                <div className="mb-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs font-semibold text-blue-700 mb-1">Appointment Duration (optional)</p>
                  <p className="text-xs text-blue-600 mb-2">Log specific hours for the appointment, or use Half Day checkbox. {hpd}h = 1 full day.</p>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0.5" max="8" step="0.5" className="w-28"
                      placeholder={`e.g. 1, 2, ${hpd}`}
                      value={manualLeave.hoursWorked || ''}
                      onChange={e => setManualLeave({ ...manualLeave, hoursWorked: e.target.value })}
                    />
                    <span className="text-xs text-blue-600 font-medium">
                      {hrs > 0 ? `= ${(hrs / hpd).toFixed(3).replace(/\.?0+$/, '')}d` : 'hours'}
                    </span>
                  </div>
                </div>
              );
            })()}
            {(manualLeave.type === 'Sick Leave' || manualLeave.type === 'Medical Appt') && (
              <div className="mb-2">
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">
                  {manualLeave.type === 'Medical Appt' ? 'Appointment Reason (optional)' : 'Sickness Reason (optional)'}
                </label>
                <input type="text" placeholder={manualLeave.type === 'Medical Appt' ? 'e.g. Dentist, eye test, doctor...' : 'e.g. Flu, back pain, migraine...'}
                  maxLength={200}
                  value={manualLeave.sickReason || ''}
                  onChange={e => setManualLeave({ ...manualLeave, sickReason: e.target.value })}
                />
              </div>
            )}
            <RecordWarning />

            {manualLeave.startDate && currentHolidayYear?.end && manualLeave.startDate > currentHolidayYear.end && (
              <p className="text-xs text-indigo-700 mb-2 bg-indigo-50 p-2 rounded border border-indigo-200">
                This date falls in the next holiday year and will count against the new year allowance.
              </p>
            )}

            {/* Silent email toggle */}
            <label className={`flex items-center gap-2 mt-3 mb-2 px-3 py-2 rounded-lg border cursor-pointer select-none transition-colors ${manualLeave.silentEmail ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
              <input
                type="checkbox"
                className="w-4 h-4 accent-amber-500"
                checked={manualLeave.silentEmail || false}
                onChange={e => setManualLeave({ ...manualLeave, silentEmail: e.target.checked })}
              />
              <span className={`text-xs font-medium ${manualLeave.silentEmail ? 'text-amber-700' : 'text-gray-500'}`}>
                {manualLeave.silentEmail ? 'Silent — no email notification will be sent' : 'Send email notification'}
              </span>
            </label>
            <button className="btn btn-primary w-full mt-1">Record Absence</button>
          </form>
        </div>
      </div>

      {/* ── TEAM OVERVIEW ── */}
      <div className="card overflow-x-auto">
        <h3 className="font-bold mb-1">Team Overview</h3>
        <p className="text-xs text-gray-400 mb-4">
          Standard staff show their annual leave allowance.
          Term Time staff show school holiday working progress.
          Rows highlighted in red are over their limit.
        </p>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Contract</th>
              <th title="Holiday allowance for standard staff, or school holiday working target for term time staff">
                Allowance / Target
              </th>
              <th title="Annual leave used (standard staff) or time off taken plus balance (term time staff)">
                Used / Worked
              </th>
              <th title="Days remaining for standard staff, or school holiday credit balance for term time staff">
                Remaining / Balance
              </th>
              <th title="Leave already approved for the next holiday year">
                Next Year
              </th>
            </tr>
          </thead>
          <tbody>
            {myTeam.map(s => {
              const nextYearDays = getNextYearBooked(s.email);

              /* ── TERM-TIME ROW ── */
              if (s.isTermTime) {
                const toil = getTOILBalance(s.email, s.termTimeDaysTarget);
                const credit          = toil.credit ?? toil.toilBalance ?? toil.balance ?? 0;
                const accrued         = Number(toil.accrued)         || 0;
                const used            = Number(toil.used)            || 0;
                const effectiveTarget = Number(toil.effectiveTarget) || Number(toil.target) || 30;
                const ttLeave         = Number(toil.termTimeLeaveTaken) || 0;
                const remainingToWork = Number(toil.remainingToWork) ?? Math.max(0, effectiveTarget - accrued);
                const isNegative      = credit < 0;

                const editVal      = targetEdits[s.id];
                const displayTarget = editVal !== undefined ? editVal : (s.termTimeDaysTarget || toil.target);
                const isDirty       = editVal !== undefined && Number(editVal) !== (s.termTimeDaysTarget || toil.target);

                return (
                  <tr key={s.id} className={isNegative ? 'bg-red-50' : ''}>
                    <td>
                      <div className="font-bold">{s.name}</div>
                      <div className="text-xs text-gray-400">{s.department}</div>
                      {isNegative && <div className="text-xs text-red-500 font-semibold mt-0.5">Over credit</div>}
                    </td>
                    <td><span className="badge bg-blue-100 text-blue-700 text-xs">Term Time</span></td>

                    {/* Allowance / Target */}
                    <td className="text-sm">
                      <div className="flex items-center gap-1 mb-1">
                        <input
                          type="number" min="1" max="365"
                          title="Set school holiday working target for this person"
                          className="w-14 text-xs border rounded px-1 py-0.5 text-center"
                          value={displayTarget}
                          onChange={e => setTargetEdits(prev => ({ ...prev, [s.id]: Number(e.target.value) }))}
                        />
                        <span className="text-gray-400 text-xs">days</span>
                        {isDirty && (
                          <button
                            onClick={() => {
                              updateStaffTarget(s.id, editVal);
                              setTargetEdits(prev => { const n = { ...prev }; delete n[s.id]; return n; });
                            }}
                            className="text-xs bg-emerald-600 text-white rounded px-1.5 py-0.5 hover:bg-emerald-700"
                          >Save</button>
                        )}
                      </div>
                      <div className="w-full bg-gray-200 h-1.5 rounded-full">
                        <div
                          className={`h-1.5 rounded-full ${accrued >= effectiveTarget ? 'bg-emerald-500' : 'bg-blue-400'}`}
                          style={{ width: `${effectiveTarget ? Math.min(100, (accrued / effectiveTarget) * 100) : 0}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                        <span className="text-xs text-gray-400">{accrued}d worked</span>
                        {ttLeave > 0 && (
                          <span className="text-xs text-amber-600" title="Target includes days added from Term Time Leave absences">
                            (incl. {ttLeave}d TT leave)
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Used / Worked */}
                    <td className="text-sm">
                      <div className="text-gray-700">{used}d time off taken</div>
                      {isNegative && (
                        <div className="text-xs text-red-500 font-semibold">{Math.abs(credit)}d overdrawn</div>
                      )}
                    </td>

                    {/* Remaining / Balance */}
                    <td className="text-sm">
                      <div className={`font-bold ${isNegative ? 'text-red-600' : credit > 0 ? 'text-emerald-700' : 'text-gray-400'}`}>
                        {isNegative ? `${Math.abs(credit)}d owed back` : credit > 0 ? `${credit}d credit` : 'No credit'}
                      </div>
                      {remainingToWork > 0 && (
                        <div className="text-xs text-blue-500 font-normal">{remainingToWork}d still to work</div>
                      )}
                    </td>

                    {/* Next Year */}
                    <td className="text-sm">
                      {nextYearDays > 0
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">{nextYearDays}d booked</span>
                        : <span className="text-gray-300 text-xs">None</span>
                      }
                    </td>
                  </tr>
                );
              }

              /* ── STANDARD ROW ── */
              const taken        = getLeaveTaken(s.email, false);
              const baseEff      = (s.allowance || 0) + (s.carryForwardDays || 0);
              const rowToil      = getTOILBalance(s.email, 0, s.hoursPerDay, false);
              const rowToilCredit = Math.max(0, rowToil?.credit ?? 0);
              const effective    = baseEff + rowToilCredit;
              const remaining    = effective - taken;
              const isNegative   = remaining < 0;
              const isLow        = remaining >= 0 && remaining <= 3;

              return (
                <tr key={s.id} className={isNegative ? 'bg-red-50' : ''}>
                  <td>
                    <div className="font-bold">{s.name}</div>
                    <div className="text-xs text-gray-400">{s.department}</div>
                    {isNegative && <div className="text-xs text-red-500 font-semibold mt-0.5">Over allowance</div>}
                  </td>
                  <td><span className="badge bg-gray-100 text-xs">Standard</span></td>
                  <td className="text-sm">
                    {effective}d
                    {s.carryForwardDays > 0 && (
                      <span className="text-xs text-indigo-500 ml-1">(+{s.carryForwardDays}d carry)</span>
                    )}
                    {rowToilCredit > 0 && (
                      <span className="text-xs text-orange-500 ml-1">(+{rowToilCredit}d TOIL)</span>
                    )}
                  </td>
                  <td className="text-sm">{taken}d used</td>
                  <td className={`font-bold text-sm ${isNegative ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-emerald-700'}`}>
                    {isNegative ? `${Math.abs(remaining)}d over` : `${remaining}d left`}
                  </td>
                  <td className="text-sm">
                    {nextYearDays > 0
                      ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">{nextYearDays}d booked</span>
                      : <span className="text-gray-300 text-xs">None</span>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DeptHeadView;

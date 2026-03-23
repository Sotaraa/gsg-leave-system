import React, { useState } from 'react';
import { Trash2, Edit2, Archive, RotateCcw, Download } from 'lucide-react';
import CONFIG from '../../config.js';
import { formatDateUK } from '../../utils/helpers.js';
import { TypeNote } from './EmployeeView.jsx';

const AdminView = ({
  staffList, requests, departments, termDates, announcements,
  newStaff, setNewStaff, adminEditId, setAdminEditId,
  saveStaff, handleManualAdd, manualLeave, setManualLeave, handleStaffSelect,
  deleteRequest, handleApproval, getTOILBalance,
  newDeptName, setNewDeptName, addDepartment, deleteDepartment,
  newTermDate, setNewTermDate, addTermDate, deleteTermDate, importBankHolidays,
  newAnnouncement, setNewAnnouncement, postAnnouncement, deleteAnnouncement,
  showArchived, setShowArchived, prepareEdit, toggleArchiveStaff, permanentlyDeleteStaff,
  searchResults, searchDirectory, selectDirectoryUser,
  systemSettings, updateSystemSettings,
  currentHolidayYear, calculateCarryForwardData, applyCarryForward, getYearStartForClosingDate,
  exportStaffCSV, exportRequestsCSV
}) => {
  const [carryForwardPreview, setCarryForwardPreview] = useState(null);
  const [closingDate, setClosingDate] = useState(currentHolidayYear?.end || '');

  const handleCalculateCarryForward = () => {
    const yearStart = getYearStartForClosingDate(closingDate);
    setCarryForwardPreview(calculateCarryForwardData(yearStart, closingDate));
  };

  const handleApplyCarryForward = async () => {
    const success = await applyCarryForward(carryForwardPreview, closingDate);
    if (success) setCarryForwardPreview(null);
  };

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const fmtDate = (iso) => {
    if (!iso) return 'Not set';
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  /* Only Dept Heads and Admins can be assigned as approvers */
  const eligibleApprovers = staffList.filter(s =>
    !s.isArchived &&
    s.email !== newStaff.email &&
    (s.role === 'Dept Head' || s.role === 'Admin')
  );

  return (
  <div className="grid-dashboard">
    <div>

      {/* ── ADD / EDIT STAFF ── */}
      <div id="admin-form" className={`card ${adminEditId ? 'bg-yellow-50' : ''}`}>
        <h3 className="font-bold mb-4">{adminEditId ? 'Edit Staff Member' : 'Add Staff Member'}</h3>
        <div className="mb-4">
          <input placeholder="Search Office 365 Directory..." onChange={e => searchDirectory(e.target.value)} className="w-full" />
          {searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map(u => (
                <div key={u.id} onClick={() => selectDirectoryUser(u)} className="search-result-item">{u.displayName} ({u.mail})</div>
              ))}
            </div>
          )}
        </div>
        <form onSubmit={saveStaff}>
          <input placeholder="Full Name" value={newStaff.name} onChange={e => setNewStaff({ ...newStaff, name: e.target.value })} />
          <input placeholder="Email Address" value={newStaff.email} onChange={e => setNewStaff({ ...newStaff, email: e.target.value })} />
          <div className="grid grid-cols-2 gap-2 mb-2">
            <select value={newStaff.department} onChange={e => setNewStaff({ ...newStaff, department: e.target.value })}>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={newStaff.role} onChange={e => setNewStaff({ ...newStaff, role: e.target.value })}>
              {CONFIG.roles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <input type="checkbox" className="w-4 h-4" checked={newStaff.isTermTime} onChange={e => setNewStaff({ ...newStaff, isTermTime: e.target.checked })} />
            <span className="text-sm">Term Time contract?</span>
          </div>
          <input type="number" placeholder="Annual Leave Allowance (days)" value={newStaff.allowance} onChange={e => setNewStaff({ ...newStaff, allowance: e.target.value })} />
          {newStaff.isTermTime ? (
            <div className="mb-2">
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">
                School Holiday Working Target (days)
              </label>
              <p className="text-xs text-gray-400 mb-1">
                How many days this person must work during school holidays this year.
                Leave as 0 to use the school-wide default ({systemSettings?.termTimeDaysTarget ?? 30}d).
              </p>
              <input
                type="number" min="0"
                placeholder={`Default: ${systemSettings?.termTimeDaysTarget ?? 30}`}
                value={newStaff.termTimeDaysTarget ?? 0}
                onChange={e => setNewStaff({ ...newStaff, termTimeDaysTarget: Number(e.target.value) })}
              />
            </div>
          ) : (
            <div className="mb-2">
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Carry Forward Days</label>
              <input
                type="number" min="0" placeholder="0"
                value={newStaff.carryForwardDays ?? 0}
                onChange={e => setNewStaff({ ...newStaff, carryForwardDays: Number(e.target.value) })}
              />
            </div>
          )}
          <div className="mb-2">
            <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Approver</label>
            <p className="text-xs text-gray-400 mb-1">Who approves this person's leave requests? Only Dept Heads and Admins can be approvers.</p>
            <select value={newStaff.approverEmail} onChange={e => setNewStaff({ ...newStaff, approverEmail: e.target.value })}>
              <option value="">No specific approver set</option>
              {eligibleApprovers.map(s => (
                <option key={s.id} value={s.email}>{s.name} ({s.role}, {s.department})</option>
              ))}
            </select>
            {eligibleApprovers.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">No Dept Heads or Admins found. Add one first.</p>
            )}
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1">Save</button>
            {adminEditId && (
              <button type="button" onClick={() => {
                setAdminEditId(null);
                setNewStaff({ name: '', email: '', department: departments[0], role: 'Staff', allowance: systemSettings?.defaultAllowance ?? 20, isTermTime: false, approverEmail: '', carryForwardDays: 0, termTimeDaysTarget: 0 });
              }} className="btn btn-danger">Cancel</button>
            )}
          </div>
        </form>
      </div>

      {/* ── RECORD ABSENCE ── */}
      <div className="card">
        <h3 className="font-bold mb-4">Record Absence (Admin)</h3>
        <form onSubmit={handleManualAdd}>
          <select className="mb-2 w-full" onChange={handleStaffSelect}>
            <option value="">Select Staff Member...</option>
            {staffList.filter(s => !s.isArchived).map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.department}){s.isTermTime ? ' TT' : ''}</option>
            ))}
          </select>
          <div className="flex gap-2 mb-2">
            <input type="date" required onChange={e => setManualLeave({ ...manualLeave, startDate: e.target.value })} />
            <input type="date" required onChange={e => setManualLeave({ ...manualLeave, endDate: e.target.value })} />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <input type="checkbox" className="w-4 h-4" checked={manualLeave.isHalfDay} onChange={e => setManualLeave({ ...manualLeave, isHalfDay: e.target.checked })} />
            <span className="text-sm">Half Day?</span>
          </div>
          <select className="mb-2 w-full" value={manualLeave.type} onChange={e => setManualLeave({ ...manualLeave, type: e.target.value, approvalSubType: '' })}>
            {CONFIG.leaveTypes.filter(t => {
              const s = staffList.find(x => x.id === manualLeave.employeeId);
              if (s?.isTermTime) return t !== 'Annual Leave';
              return t !== CONFIG.toiLeaveType && t !== CONFIG.termTimeWorkType && t !== CONFIG.termTimeLeaveType;
            }).map(t => <option key={t}>{t}</option>)}
          </select>
          <TypeNote type={manualLeave.type} currentHolidayYear={currentHolidayYear} startDate={manualLeave.startDate}/>
          {manualLeave.startDate && currentHolidayYear?.end && manualLeave.startDate > currentHolidayYear.end && (
            <p className="text-xs text-indigo-700 mb-2 bg-indigo-50 p-2 rounded border border-indigo-200">
              This date falls in the next holiday year (after {fmtDate(currentHolidayYear.end)}). It will be recorded against the new year's allowance.
            </p>
          )}
          <button className="btn btn-primary w-full mt-2">Record</button>
        </form>
      </div>

      {/* ── MANAGE ALL REQUESTS ── */}
      <div className="card">
        <h3 className="font-bold mb-4">Manage All Requests</h3>
        <div className="overflow-y-auto max-h-96 space-y-2">
          {requests.length === 0 && <p className="text-sm text-gray-400">No requests on record.</p>}
          {requests.map(r => {
            const isTTStaff = staffList.find(s => s.email === r.employeeEmail)?.isTermTime;
            const isTOI = r.type === CONFIG.toiLeaveType;
            return (
              <div key={r.id} className={`p-2 border rounded text-sm ${r.status === 'Pending' ? 'bg-amber-50 border-amber-200' : 'hover:bg-gray-50'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold">{r.employeeName}</span>
                    {isTTStaff && <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold">TT</span>}
                    <span className="text-gray-500 ml-1">({r.type})</span><br />
                    <span className="text-xs text-gray-400">{formatDateUK(r.startDate)}, {r.daysCount}d, {r.status}</span>
                    {isTOI && r.status === 'Pending' && (
                      <p className="text-xs text-orange-600 mt-0.5">Approving uses {r.daysCount}d from their school holiday credit. Any shortfall adds to their working target.</p>
                    )}
                    {r.type === CONFIG.termTimeLeaveType && r.status === 'Pending' && (
                      <p className="text-xs text-amber-600 mt-0.5">Approving adds {r.daysCount}d to their school holiday working target.</p>
                    )}
                  </div>
                  <button onClick={() => deleteRequest(r.id)} className="text-red-400 hover:text-red-600 p-1 flex-shrink-0"><Trash2 size={14} /></button>
                </div>
                {r.status === 'Pending' && (
                  <div className="flex gap-2 mt-2 pt-2 border-t border-gray-200">
                    <button onClick={() => handleApproval(r.id, 'Approved')} className="btn bg-emerald-100 text-emerald-700 text-xs">Approve</button>
                    <button onClick={() => handleApproval(r.id, 'Rejected')} className="btn bg-red-50 text-red-600 text-xs">Reject</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── DATA BACKUP ── (standalone card, always visible) */}
      <div className="card border-2 border-emerald-200">
        <h3 className="font-bold mb-1 flex items-center gap-2">
          <Download size={16} className="text-emerald-600"/>Data Backup
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Download a copy of your data as a spreadsheet. Open in Excel or Google Sheets to keep a local backup or share with your payroll team.
        </p>
        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={exportStaffCSV}
            className="btn bg-emerald-700 text-white w-full justify-center flex items-center gap-2"
          >
            <Download size={14}/>Export Staff Directory
          </button>
          <button
            onClick={exportRequestsCSV}
            className="btn bg-blue-700 text-white w-full justify-center flex items-center gap-2"
          >
            <Download size={14}/>Export All Leave Records
          </button>
        </div>
        <div className="mt-3 text-xs text-gray-400 space-y-0.5">
          <p>Staff export includes name, email, department, role, contract type, allowance and approver.</p>
          <p>Leave export includes every request across all staff and all years.</p>
        </div>
      </div>

      {/* ── SCHOOL SETTINGS ── */}
      <div className="card">
        <h3 className="font-bold mb-4">School Settings</h3>

        <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-200">
          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Default Holiday Allowance</p>
          <p className="text-xs text-gray-500 mb-2">Used when adding new staff. Existing staff are not affected.</p>
          <div className="flex items-center gap-3">
            <input
              type="number" min="1" max="365" className="w-24"
              value={systemSettings?.defaultAllowance ?? 20}
              onChange={e => updateSystemSettings({ defaultAllowance: Number(e.target.value) })}
            />
            <span className="text-sm text-gray-600">days per year</span>
          </div>
        </div>

        <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
          <p className="text-xs font-bold text-blue-500 uppercase mb-1">Term Time School Holiday Working Target</p>
          <p className="text-xs text-gray-500 mb-2">
            How many days a term-time employee must work during school holidays each year.
            Each day worked builds credit that can later be taken as Time Off in Lieu.
            Any approved Term Time Leave (absence during term) is added on top of this target.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number" min="1" max="365" className="w-24"
              value={systemSettings?.termTimeDaysTarget ?? 30}
              onChange={e => updateSystemSettings({ termTimeDaysTarget: Number(e.target.value) })}
            />
            <span className="text-sm text-gray-600">days required per year</span>
          </div>
        </div>

        <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
          <p className="text-xs font-bold text-blue-500 uppercase mb-1">Holiday Year Settings</p>
          {currentHolidayYear && (
            <p className="text-xs text-blue-600 mb-2 font-medium">Current year: {currentHolidayYear.label}</p>
          )}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Year Start Month</label>
              <select
                value={systemSettings?.holidayYearStartMonth || 9}
                onChange={e => updateSystemSettings({ holidayYearStartMonth: Number(e.target.value) })}
              >
                {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Year Start Day</label>
              <input
                type="number" min="1" max="28"
                value={systemSettings?.holidayYearStartDay || 1}
                onChange={e => updateSystemSettings({ holidayYearStartDay: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Max Carry Forward Days</label>
              <input
                type="number" min="0" max="30" className="w-20"
                value={systemSettings?.maxCarryForwardDays ?? 5}
                onChange={e => updateSystemSettings({ maxCarryForwardDays: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-center gap-2 mt-4">
              <input
                type="checkbox" className="w-4 h-4"
                checked={systemSettings?.carryForwardEnabled ?? true}
                onChange={e => updateSystemSettings({ carryForwardEnabled: e.target.checked })}
              />
              <span className="text-sm text-gray-600">Enable Carry Forward</span>
            </div>
          </div>
        </div>

        {/* RESET HOLIDAY YEAR */}
        <div className="mb-6 border-2 border-emerald-200 rounded-lg overflow-hidden">
          <div className="bg-emerald-700 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-white font-bold text-sm">Reset Holiday Year</p>
              <p className="text-emerald-200 text-xs mt-0.5">
                Carry forward unused leave and start the new holiday year
              </p>
            </div>
            {systemSettings?.lastYearResetDate && (
              <div className="text-right">
                <p className="text-emerald-200 text-xs">Last reset</p>
                <p className="text-white text-xs font-semibold">{fmtDate(systemSettings.lastYearResetDate)}</p>
                {systemSettings?.lastYearResetClosingDate && (
                  <p className="text-emerald-300 text-xs">Year closed: {fmtDate(systemSettings.lastYearResetClosingDate)}</p>
                )}
              </div>
            )}
          </div>

          <div className="p-4 bg-emerald-50">
            {!carryForwardPreview && (
              <>
                <p className="text-xs text-gray-600 mb-3">
                  Set the last day of the holiday year you are closing.
                  This defaults to <strong>31 August</strong>. Change it if your year ends on a different date.
                </p>
                <div className="flex items-end gap-3 mb-4">
                  <div className="flex-1">
                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Year End Date</label>
                    <input
                      type="date"
                      value={closingDate}
                      onChange={e => setClosingDate(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div className="text-xs text-gray-400 mb-2 whitespace-nowrap">
                    Max carry forward: <strong>{systemSettings?.maxCarryForwardDays ?? 5}d</strong>
                  </div>
                </div>
                {!(systemSettings?.carryForwardEnabled ?? true) && (
                  <p className="text-xs text-orange-600 mb-3 bg-orange-50 p-2 rounded border border-orange-200">
                    Carry forward is currently turned off so all staff will carry 0 days.
                    Turn it on in Holiday Year Settings above if needed.
                  </p>
                )}
                <button
                  onClick={handleCalculateCarryForward}
                  disabled={!closingDate}
                  className="btn bg-emerald-700 text-white w-full justify-center text-sm disabled:opacity-50"
                >
                  Preview Carry Forward and Reset
                </button>
              </>
            )}

            {carryForwardPreview && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-gray-700">
                    Review carry forward for year ending <span className="text-emerald-700">{fmtDate(closingDate)}</span>
                  </p>
                  <p className="text-xs text-gray-400">You can adjust amounts before confirming</p>
                </div>
                <div className="overflow-y-auto max-h-64 mb-3 rounded border border-gray-200 bg-white">
                  <table className="data-table text-xs">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Dept</th>
                        <th title="Base allowance plus previous carry forward">Allowance</th>
                        <th>Used</th>
                        <th>Unused</th>
                        <th title="Leave already approved in the new year">Pre-booked</th>
                        <th title="Days carried into the new year (editable)">Carry Fwd</th>
                      </tr>
                    </thead>
                    <tbody>
                      {carryForwardPreview.map(row => (
                        <tr key={row.staffId}>
                          <td className="font-bold">{row.name}</td>
                          <td className="text-gray-400">{row.department}</td>
                          <td>{row.effectiveAllowance}d</td>
                          <td>{row.taken}d</td>
                          <td className={row.unused > 0 ? 'text-emerald-700 font-semibold' : 'text-gray-400'}>
                            {row.unused}d
                          </td>
                          <td className={row.preBooked > 0 ? 'text-blue-600 font-semibold' : 'text-gray-300'}>
                            {row.preBooked > 0 ? `${row.preBooked}d` : 'None'}
                          </td>
                          <td>
                            <input
                              type="number" min="0"
                              max={systemSettings?.maxCarryForwardDays ?? 5}
                              value={row.carryForward}
                              className="w-14 text-xs"
                              onChange={e => setCarryForwardPreview(prev =>
                                prev.map(r => r.staffId === row.staffId
                                  ? { ...r, carryForward: Math.max(0, Number(e.target.value)) }
                                  : r
                                )
                              )}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-500 mb-1">
                  {carryForwardPreview.filter(r => r.carryForward > 0).length} of {carryForwardPreview.length} staff will carry days forward.
                  Total: <strong>{carryForwardPreview.reduce((s, r) => s + r.carryForward, 0)} days</strong>
                </p>
                {carryForwardPreview.some(r => r.preBooked > 0) && (
                  <p className="text-xs text-blue-600 mb-3 bg-blue-50 p-2 rounded border border-blue-200">
                    <strong>{carryForwardPreview.filter(r => r.preBooked > 0).length} staff</strong> already have leave booked in the new year
                    ({carryForwardPreview.reduce((s, r) => s + r.preBooked, 0)}d total). These days will count against their new allowance and carry forward.
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleApplyCarryForward}
                    className="btn bg-emerald-700 text-white flex-1 justify-center text-sm"
                  >
                    Confirm and Start New Year
                  </button>
                  <button
                    onClick={() => setCarryForwardPreview(null)}
                    className="btn bg-gray-100 text-gray-600 text-sm"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mb-6">
          <p className="text-xs font-bold text-gray-400 uppercase mb-2">Departments</p>
          <div className="flex gap-2 mb-2">
            <input placeholder="New department name..." value={newDeptName} onChange={e => setNewDeptName(e.target.value)} />
            <button onClick={addDepartment} className="btn bg-gray-800 text-white">Add</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {departments.map(d => (
              <span key={d} className="bg-gray-100 px-2 py-1 rounded text-xs flex items-center gap-2">
                {d} {!CONFIG.defaultDepartments.includes(d) && <button onClick={() => deleteDepartment(d)} className="text-red-500">x</button>}
              </span>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <p className="text-xs font-bold text-gray-400 uppercase mb-2">Custom Dates</p>
          <div className="space-y-2 mb-2">
            <input placeholder="Description..." value={newTermDate.description} onChange={e => setNewTermDate({ ...newTermDate, description: e.target.value })} />
            <div className="flex gap-2">
              <input type="date" value={newTermDate.date} onChange={e => setNewTermDate({ ...newTermDate, date: e.target.value })} />
              <button onClick={addTermDate} className="btn bg-gray-800 text-white">Add</button>
            </div>
          </div>
          <div className="max-h-32 overflow-y-auto">
            {termDates.filter(t => t.type !== 'Bank Holiday').map(t => (
              <div key={t.id} className="flex justify-between text-sm py-1 border-b border-gray-100">
                <span>{t.description} ({formatDateUK(t.date)})</span>
                <button onClick={() => deleteTermDate(t.id)} className="text-red-500">x</button>
              </div>
            ))}
          </div>
          <button onClick={importBankHolidays} className="w-full mt-2 btn bg-indigo-50 text-indigo-700 text-xs justify-center">Auto-Import UK Bank Holidays</button>
        </div>

        <div>
          <p className="text-xs font-bold text-gray-400 uppercase mb-2">Announcements</p>
          <form onSubmit={postAnnouncement} className="space-y-2">
            <textarea placeholder="Write your message here..." className="w-full border border-gray-300 rounded p-2" value={newAnnouncement.message} onChange={e => setNewAnnouncement({ ...newAnnouncement, message: e.target.value })}></textarea>
            <div className="flex gap-2 items-center">
              <input type="date" value={newAnnouncement.expiry} onChange={e => setNewAnnouncement({ ...newAnnouncement, expiry: e.target.value })} />
              <button type="submit" className="btn bg-blue-600 text-white">Post</button>
            </div>
          </form>
          <div className="mt-3 space-y-1">
            {announcements.map(a => (
              <div key={a.id} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded">
                <span>{a.message}</span>
                <button onClick={() => deleteAnnouncement(a.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>

    {/* ── STAFF DIRECTORY ── */}
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold">Staff Directory</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500">Show Archived</span>
          <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} className="w-4 h-4" />
        </div>
      </div>

      {showArchived && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 font-medium">
          Archived staff can be permanently deleted. This cannot be undone.
        </div>
      )}

      <table className="data-table">
        <thead><tr><th>Name</th><th>Role</th><th className="text-right">Actions</th></tr></thead>
        <tbody>
          {staffList.filter(s => showArchived ? s.isArchived : !s.isArchived).map(s => (
            <tr key={s.id} className={s.isArchived ? 'opacity-60 bg-red-50' : ''}>
              <td>
                <div className="font-bold">{s.name}</div>
                <div className="text-xs text-gray-500">{s.email}</div>
                {s.approverEmail && (
                  <div className="text-xs text-indigo-600 mt-0.5">
                    Approver: {staffList.find(a => a.email === s.approverEmail)?.name || s.approverEmail}
                  </div>
                )}
                {s.isArchived && <div className="text-xs text-red-500 font-semibold mt-0.5">ARCHIVED</div>}
              </td>
              <td><span className="badge bg-gray-100">{s.role}</span></td>
              <td className="text-right">
                <div className="flex justify-end gap-2">
                  {!s.isArchived && (
                    <button onClick={() => prepareEdit(s)} className="text-gray-400 hover:text-emerald-600" title="Edit">
                      <Edit2 size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => toggleArchiveStaff(s.id, s.isArchived)}
                    className="text-gray-400 hover:text-orange-600"
                    title={s.isArchived ? 'Restore user' : 'Archive user'}
                  >
                    {s.isArchived ? <RotateCcw size={16} /> : <Archive size={16} />}
                  </button>
                  {s.isArchived && (
                    <button
                      onClick={() => permanentlyDeleteStaff(s.id, s.name)}
                      className="text-red-400 hover:text-red-700"
                      title="Permanently delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
  );
};

export default AdminView;

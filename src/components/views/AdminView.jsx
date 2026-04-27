import React, { useState } from 'react';
import { Trash2, Edit2, Archive, RotateCcw, Download, Upload, AlertCircle, CheckCircle2,
         Users, ClipboardList, Settings as SettingsIcon, Database } from 'lucide-react';
import CONFIG from '../../config.js';
import { formatDateUK, getTermForDate } from '../../utils/helpers.js';
import { TypeNote } from './EmployeeView.jsx';

const AdminView = ({
  staffList, requests, departments, termDates, announcements,
  newStaff, setNewStaff, adminEditId, setAdminEditId,
  saveStaff, handleManualAdd, manualLeave, setManualLeave, handleStaffSelect,
  deleteRequest, handleApproval, getTOILBalance,
  newDeptName, setNewDeptName, addDepartment, deleteDepartment,
  newTermDate, setNewTermDate, addTermDate, deleteTermDate, importBankHolidays,
  schoolTerms, newSchoolTerm, setNewSchoolTerm, addSchoolTerm, deleteSchoolTerm,
  newAnnouncement, setNewAnnouncement, postAnnouncement, deleteAnnouncement,
  showArchived, setShowArchived, prepareEdit, toggleArchiveStaff, permanentlyDeleteStaff,
  searchResults, searchDirectory, selectDirectoryUser,
  systemSettings, updateSystemSettings,
  currentHolidayYear, calculateCarryForwardData, applyCarryForward, getYearStartForClosingDate,
  exportStaffCSV, exportRequestsCSV,
  handleBulkImport, handleDeleteSilentImports, silentImportCount
}) => {
  const [adminTab, setAdminTab] = useState('staff');
  const [carryForwardPreview, setCarryForwardPreview] = useState(null);
  const [closingDate, setClosingDate] = useState(currentHolidayYear?.end || '');

  const [csvText, setCsvText] = useState('');
  const [importPreview, setImportPreview] = useState([]);
  const [importResults, setImportResults] = useState(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleCsvFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(ev.target.result);
    reader.readAsText(file);
  };

  const normaliseDate = (d) => {
    if (!d) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    return d;
  };

  const parseImportCsv = () => {
    const lines = csvText.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) return alert('CSV needs a header row plus at least one data row.');
    const parsed = lines.slice(1).map(line => {
      const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
      const [email, type, rawStart, rawEnd, daysCount] = parts;
      const startDate = normaliseDate(rawStart);
      const endDate   = normaliseDate(rawEnd) || startDate;
      const staff = staffList.find(s => s.email?.toLowerCase() === email?.toLowerCase());
      let error = null;
      if (!email) error = 'Missing email';
      else if (!staff) error = 'Staff not found in system';
      else if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) error = 'Invalid start date — use YYYY-MM-DD or DD/MM/YYYY';
      else if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) error = 'Invalid end date — use YYYY-MM-DD or DD/MM/YYYY';
      return { email, staffName: staff?.name || '', type: type || 'Annual Leave', startDate, endDate, daysCount: daysCount || '', error };
    });
    setImportPreview(parsed);
    setImportResults(null);
  };

  const doImport = async () => {
    const valid = importPreview.filter(r => !r.error);
    if (!valid.length) return;
    setIsImporting(true);
    const results = await handleBulkImport(valid);
    setImportResults(results);
    setIsImporting(false);
    if (results.imported > 0) { setCsvText(''); setImportPreview([]); }
  };

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

  const eligibleApprovers = staffList.filter(s =>
    !s.isArchived && s.email !== newStaff.email && (s.role === 'Dept Head' || s.role === 'Admin')
  );

  const TABS = [
    { key: 'staff',    label: 'Manage Staff',  Icon: Users         },
    { key: 'requests', label: 'Requests',       Icon: ClipboardList },
    { key: 'settings', label: 'Settings',       Icon: SettingsIcon  },
    { key: 'data',     label: 'Data & Import',  Icon: Database      },
  ];

  /* pending request count badge */
  const pendingCount = requests.filter(r => r.status === 'Pending').length;

  return (
  <div className="space-y-5">

    {/* ── Tab Bar ── */}
    <div className="flex flex-wrap gap-1 bg-gray-100 rounded-xl p-1.5">
      {TABS.map(({ key, label, Icon }) => (
        <button key={key} onClick={() => setAdminTab(key)}
          className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-1 justify-center sm:flex-none ${
            adminTab === key ? 'bg-white shadow text-emerald-700 font-semibold' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Icon size={14}/>{label}
          {key === 'requests' && pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
              {pendingCount}
            </span>
          )}
        </button>
      ))}
    </div>

    {/* ════ STAFF TAB ════ */}
    {adminTab === 'staff' && (
      <div className="grid-dashboard">
        <div>
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
                  <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">School Holiday Working Target (days)</label>
                  <p className="text-xs text-gray-400 mb-1">How many days this person must work during school holidays this year. Leave as 0 to use the school-wide default ({systemSettings?.termTimeDaysTarget ?? 30}d).</p>
                  <input type="number" min="0" placeholder={`Default: ${systemSettings?.termTimeDaysTarget ?? 30}`} value={newStaff.termTimeDaysTarget ?? 0} onChange={e => setNewStaff({ ...newStaff, termTimeDaysTarget: Number(e.target.value) })} />
                </div>
              ) : (
                <div className="mb-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Carry Forward Days</label>
                  <input type="number" min="0" placeholder="0" value={newStaff.carryForwardDays ?? 0} onChange={e => setNewStaff({ ...newStaff, carryForwardDays: Number(e.target.value) })} />
                </div>
              )}
              <div className="mb-2">
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Hours per Working Day</label>
                <p className="text-xs text-gray-400 mb-1">How many hours equal one working day for this person — used to convert extra hours worked into TOIL days. Leave blank to use the system default ({systemSettings?.hoursPerDay ?? CONFIG.defaultHoursPerDay}h).</p>
                <div className="flex items-center gap-2">
                  <input type="number" min="1" max="24" step="0.5" className="w-24"
                    placeholder={`Default: ${systemSettings?.hoursPerDay ?? CONFIG.defaultHoursPerDay}`}
                    value={newStaff.hoursPerDay ?? ''}
                    onChange={e => setNewStaff({ ...newStaff, hoursPerDay: e.target.value !== '' ? Number(e.target.value) : null })}
                  />
                  <span className="text-xs text-gray-500">hours = 1 day</span>
                </div>
              </div>
              <div className="mb-2">
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Working Days</label>
                <p className="text-xs text-gray-400 mb-1">Select the days this person works. Leave all selected for the standard Mon–Fri week.</p>
                <div className="flex gap-1">
                  {[{ label: 'Mon', val: 1 }, { label: 'Tue', val: 2 }, { label: 'Wed', val: 3 }, { label: 'Thu', val: 4 }, { label: 'Fri', val: 5 }].map(({ label, val }) => {
                    const currentDays = newStaff.workingDays?.length ? newStaff.workingDays : [1, 2, 3, 4, 5];
                    const isActive = currentDays.includes(val);
                    return (
                      <button key={val} type="button"
                        className={`flex-1 py-1.5 text-xs font-semibold rounded border transition-colors ${isActive ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-400 border-gray-300 hover:border-indigo-400'}`}
                        onClick={() => {
                          const next = isActive ? currentDays.filter(d => d !== val) : [...currentDays, val].sort((a, b) => a - b);
                          setNewStaff({ ...newStaff, workingDays: next });
                        }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
                {(newStaff.workingDays?.length > 0 && newStaff.workingDays?.length < 5) && (
                  <p className="text-xs text-amber-600 mt-1">Part-time: {newStaff.workingDays.length} day{newStaff.workingDays.length !== 1 ? 's' : ''} per week. Leave calculations will reflect this pattern.</p>
                )}
              </div>
              <div className="mb-2">
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Approver</label>
                <p className="text-xs text-gray-400 mb-1">Who approves this staff member leave requests? Only Dept Heads and Admins can be approvers.</p>
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
                    setNewStaff({ name: '', email: '', department: departments[0], role: 'Staff', allowance: systemSettings?.defaultAllowance ?? 20, isTermTime: false, approverEmail: '', carryForwardDays: 0, termTimeDaysTarget: 0, workingDays: [], hoursPerDay: null });
                  }} className="btn btn-danger">Cancel</button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Staff Directory */}
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
                      <button onClick={() => toggleArchiveStaff(s.id, s.isArchived)} className="text-gray-400 hover:text-orange-600" title={s.isArchived ? 'Restore user' : 'Archive user'}>
                        {s.isArchived ? <RotateCcw size={16} /> : <Archive size={16} />}
                      </button>
                      {s.isArchived && (
                        <button onClick={() => permanentlyDeleteStaff(s.id, s.name)} className="text-red-400 hover:text-red-700" title="Permanently delete">
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
    )}

    {/* ════ REQUESTS TAB ════ */}
    {adminTab === 'requests' && (
      <div className="grid-dashboard">
        <div>
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
                  if (s?.isTermTime) return t !== 'Annual Leave' && t !== CONFIG.extraHoursType;
                  return t !== CONFIG.termTimeWorkType && t !== CONFIG.termTimeLeaveType;
                }).map(t => <option key={t}>{t}</option>)}
              </select>
              <TypeNote type={manualLeave.type} currentHolidayYear={currentHolidayYear} startDate={manualLeave.startDate}/>
              {/* Hours entry for TOIL accrual types (School Holiday Worked / Extra Hours Worked) */}
              {(manualLeave.type === CONFIG.termTimeWorkType || manualLeave.type === CONFIG.extraHoursType) && (() => {
                const selStaff = staffList.find(s => s.id === manualLeave.employeeId);
                const hpd = Number(selStaff?.hoursPerDay || systemSettings?.hoursPerDay || CONFIG.defaultHoursPerDay);
                const hrs = Number(manualLeave.hoursWorked);
                return (
                  <div className="mb-2 p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <p className="text-xs font-semibold text-indigo-700 mb-1">Log Hours Worked (optional)</p>
                    <p className="text-xs text-indigo-500 mb-2">Enter hours instead of a full day count — useful for partial days. {hpd}h = 1 day {selStaff?.hoursPerDay ? '(per staff contract)' : '(system default)'}.</p>
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
              {manualLeave.type === 'Sick Leave' && (
                <div className="mb-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Sickness Reason (optional)</label>
                  <input type="text" placeholder="e.g. Flu, back pain, migraine..."
                    maxLength={200}
                    value={manualLeave.sickReason || ''}
                    onChange={e => setManualLeave({ ...manualLeave, sickReason: e.target.value })}
                  />
                </div>
              )}
              {manualLeave.startDate && currentHolidayYear?.end && manualLeave.startDate > currentHolidayYear.end && (
                <p className="text-xs text-indigo-700 mb-2 bg-indigo-50 p-2 rounded border border-indigo-200">
                  This date falls in the next holiday year (after {fmtDate(currentHolidayYear.end)}). It will be recorded against the new year allowance.
                </p>
              )}
              <label className={`flex items-center gap-2 mt-3 mb-2 px-3 py-2 rounded-lg border cursor-pointer select-none transition-colors ${manualLeave.silentEmail ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
                <input type="checkbox" className="w-4 h-4 accent-amber-500" checked={manualLeave.silentEmail || false} onChange={e => setManualLeave({ ...manualLeave, silentEmail: e.target.checked })} />
                <span className={`text-xs font-medium ${manualLeave.silentEmail ? 'text-amber-700' : 'text-gray-500'}`}>
                  {manualLeave.silentEmail ? 'Silent — no email notification will be sent' : 'Send email notification'}
                </span>
              </label>
              <button className="btn btn-primary w-full mt-1">Record</button>
            </form>
          </div>
        </div>

        <div className="card">
          <h3 className="font-bold mb-4">
            Manage All Requests
            {pendingCount > 0 && (
              <span className="ml-2 bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">{pendingCount} pending</span>
            )}
          </h3>
          <div className="overflow-y-auto max-h-[600px] space-y-2">
            {requests.length === 0 && <p className="text-sm text-gray-400">No requests on record.</p>}
            {requests.map(r => {
              const isTTStaff = staffList.find(s => s.email === r.employeeEmail)?.isTermTime;
              const isTOI = r.type === CONFIG.toiLeaveType;
              const termName = schoolTerms?.length ? getTermForDate(r.startDate, schoolTerms) : null;
              const hasCalendar = schoolTerms?.length > 0;
              return (
                <div key={r.id} className={`p-2 border rounded text-sm ${r.status === 'Pending' ? 'bg-amber-50 border-amber-200' : 'hover:bg-gray-50'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold">{r.employeeName}</span>
                      {isTTStaff && <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold">TT</span>}
                      {hasCalendar && (
                        termName
                          ? <span className="ml-1 text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded font-semibold">{termName} Term</span>
                          : <span className="ml-1 text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-semibold">School Holiday</span>
                      )}
                      <span className="text-gray-500 ml-1">({r.type})</span><br />
                      <span className="text-xs text-gray-400">{formatDateUK(r.startDate)}, {r.daysCount}d, {r.status}</span>
                      {r.sickReason && <p className="text-xs text-rose-500 mt-0.5">Reason: {r.sickReason}</p>}
                      {isTOI && r.status === 'Pending' && (
                        <p className="text-xs text-orange-600 mt-0.5">Approving uses {r.daysCount}d from their school holiday credit.</p>
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
      </div>
    )}

    {/* ════ SETTINGS TAB ════ */}
    {adminTab === 'settings' && (
      <div className="grid-dashboard">
        <div>
          <div className="card">
            <h3 className="font-bold mb-4">Holiday Year &amp; Allowance</h3>

            <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-200">
              <p className="text-xs font-bold text-gray-400 uppercase mb-1">Default Holiday Allowance</p>
              <p className="text-xs text-gray-500 mb-2">Used when adding new staff. Existing staff are not affected.</p>
              <div className="flex items-center gap-3">
                <input type="number" min="1" max="365" className="w-24" value={systemSettings?.defaultAllowance ?? 20} onChange={e => updateSystemSettings({ defaultAllowance: Number(e.target.value) })} />
                <span className="text-sm text-gray-600">days per year</span>
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
                  <select value={systemSettings?.holidayYearStartMonth || 9} onChange={e => updateSystemSettings({ holidayYearStartMonth: Number(e.target.value) })}>
                    {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Year Start Day</label>
                  <input type="number" min="1" max="28" value={systemSettings?.holidayYearStartDay || 1} onChange={e => updateSystemSettings({ holidayYearStartDay: Number(e.target.value) })} />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Max Carry Forward Days</label>
                  <input type="number" min="0" max="30" className="w-20" value={systemSettings?.maxCarryForwardDays ?? 5} onChange={e => updateSystemSettings({ maxCarryForwardDays: Number(e.target.value) })} />
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <input type="checkbox" className="w-4 h-4" checked={systemSettings?.carryForwardEnabled ?? true} onChange={e => updateSystemSettings({ carryForwardEnabled: e.target.checked })} />
                  <span className="text-sm text-gray-600">Enable Carry Forward</span>
                </div>
              </div>
            </div>

            {/* Reset Holiday Year */}
            <div className="border-2 border-emerald-200 rounded-lg overflow-hidden">
              <div className="bg-emerald-700 px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-white font-bold text-sm">Reset Holiday Year</p>
                  <p className="text-emerald-200 text-xs mt-0.5">Carry forward unused leave and start the new holiday year</p>
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
                    <p className="text-xs text-gray-600 mb-3">Set the last day of the holiday year you are closing. This defaults to <strong>31 August</strong>.</p>
                    <div className="flex items-end gap-3 mb-4">
                      <div className="flex-1">
                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Year End Date</label>
                        <input type="date" value={closingDate} onChange={e => setClosingDate(e.target.value)} className="w-full" />
                      </div>
                      <div className="text-xs text-gray-400 mb-2 whitespace-nowrap">Max carry forward: <strong>{systemSettings?.maxCarryForwardDays ?? 5}d</strong></div>
                    </div>
                    {!(systemSettings?.carryForwardEnabled ?? true) && (
                      <p className="text-xs text-orange-600 mb-3 bg-orange-50 p-2 rounded border border-orange-200">Carry forward is currently turned off so all staff will carry 0 days.</p>
                    )}
                    <button onClick={handleCalculateCarryForward} disabled={!closingDate} className="btn bg-emerald-700 text-white w-full justify-center text-sm disabled:opacity-50">Preview Carry Forward and Reset</button>
                  </>
                )}
                {carryForwardPreview && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-gray-700">Review carry forward for year ending <span className="text-emerald-700">{fmtDate(closingDate)}</span></p>
                      <p className="text-xs text-gray-400">You can adjust amounts before confirming</p>
                    </div>
                    <div className="overflow-y-auto max-h-64 mb-3 rounded border border-gray-200 bg-white">
                      <table className="data-table text-xs">
                        <thead>
                          <tr>
                            <th>Name</th><th>Dept</th>
                            <th title="Base allowance plus previous carry forward">Allowance</th>
                            <th>Used</th><th>Unused</th>
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
                              <td className={row.unused > 0 ? 'text-emerald-700 font-semibold' : 'text-gray-400'}>{row.unused}d</td>
                              <td className={row.preBooked > 0 ? 'text-blue-600 font-semibold' : 'text-gray-300'}>{row.preBooked > 0 ? `${row.preBooked}d` : 'None'}</td>
                              <td>
                                <input type="number" min="0" max={systemSettings?.maxCarryForwardDays ?? 5}
                                  value={row.carryForward} className="w-14 text-xs"
                                  onChange={e => setCarryForwardPreview(prev => prev.map(r => r.staffId === row.staffId ? { ...r, carryForward: Math.max(0, Number(e.target.value)) } : r))}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-gray-500 mb-1">{carryForwardPreview.filter(r => r.carryForward > 0).length} of {carryForwardPreview.length} staff will carry days forward. Total: <strong>{carryForwardPreview.reduce((s, r) => s + r.carryForward, 0)} days</strong></p>
                    {carryForwardPreview.some(r => r.preBooked > 0) && (
                      <p className="text-xs text-blue-600 mb-3 bg-blue-50 p-2 rounded border border-blue-200">
                        <strong>{carryForwardPreview.filter(r => r.preBooked > 0).length} staff</strong> already have leave booked in the new year ({carryForwardPreview.reduce((s, r) => s + r.preBooked, 0)}d total).
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button onClick={handleApplyCarryForward} className="btn bg-emerald-700 text-white flex-1 justify-center text-sm">Confirm and Start New Year</button>
                      <button onClick={() => setCarryForwardPreview(null)} className="btn bg-gray-100 text-gray-600 text-sm">Back</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="card">
            <h3 className="font-bold mb-4">Configuration</h3>

            <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
              <p className="text-xs font-bold text-blue-500 uppercase mb-1">Term Time School Holiday Working Target</p>
              <p className="text-xs text-gray-500 mb-2">How many days a term-time employee must work during school holidays each year. Each day worked builds credit that can later be taken as Time Off in Lieu.</p>
              <div className="flex items-center gap-3">
                <input type="number" min="1" max="365" className="w-24" value={systemSettings?.termTimeDaysTarget ?? 30} onChange={e => updateSystemSettings({ termTimeDaysTarget: Number(e.target.value) })} />
                <span className="text-sm text-gray-600">days required per year</span>
              </div>
            </div>

            <div className="mb-5 p-3 bg-indigo-50 rounded border border-indigo-200">
              <p className="text-xs font-bold text-indigo-600 uppercase mb-1">TOIL Hours per Working Day</p>
              <p className="text-xs text-gray-500 mb-2">Default number of hours that make up one working day. Used to convert hours worked into days when logging TOIL accrual. Can be overridden per staff member on their profile.</p>
              <div className="flex items-center gap-3">
                <input type="number" min="1" max="24" step="0.5" className="w-24" value={systemSettings?.hoursPerDay ?? CONFIG.defaultHoursPerDay} onChange={e => updateSystemSettings({ hoursPerDay: Number(e.target.value) })} />
                <span className="text-sm text-gray-600">hours = 1 day</span>
              </div>
            </div>

            <div className="mb-5">
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

            {/* ── SCHOOL TERMS ─────────────────────────────────────────── */}
            <div className="mb-5">
              <p className="text-xs font-bold text-gray-400 uppercase mb-1">School Terms</p>
              <p className="text-xs text-gray-400 mb-3">
                Define the three school terms for each academic year. Days outside these ranges are automatically treated as school holidays.
              </p>

              {/* Add term year form */}
              <div className="space-y-3 mb-3 p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-xs font-semibold text-green-800">Add Academic Year</p>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Academic Year label (auto-filled)</label>
                  <input
                    placeholder="e.g. 2025-2026"
                    value={newSchoolTerm.academicYear}
                    onChange={e => setNewSchoolTerm({ ...newSchoolTerm, academicYear: e.target.value })}
                  />
                </div>
                {[
                  { key: 'autumn', label: 'Autumn Term', color: 'text-orange-700', halfColor: 'text-orange-500' },
                  { key: 'spring', label: 'Spring Term', color: 'text-blue-700',   halfColor: 'text-blue-500'   },
                  { key: 'summer', label: 'Summer Term', color: 'text-green-700',  halfColor: 'text-green-500'  },
                ].map(({ key, label, color, halfColor }) => (
                  <div key={key} className="space-y-1.5">
                    <label className={`text-xs font-semibold ${color} block`}>{label}</label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="date"
                        value={newSchoolTerm[`${key}Start`]}
                        onChange={e => {
                          const val = e.target.value;
                          const update = { ...newSchoolTerm, [`${key}Start`]: val };
                          // Auto-fill academic year from autumn start date
                          if (key === 'autumn' && val) {
                            const y = val.substring(0, 4);
                            if (!newSchoolTerm.academicYear) update.academicYear = `${y}-${Number(y) + 1}`;
                          }
                          setNewSchoolTerm(update);
                        }}
                      />
                      <span className="text-xs text-gray-400">to</span>
                      <input
                        type="date"
                        value={newSchoolTerm[`${key}End`]}
                        onChange={e => setNewSchoolTerm({ ...newSchoolTerm, [`${key}End`]: e.target.value })}
                      />
                    </div>
                    <div className="flex gap-2 items-center pl-2">
                      <span className={`text-[10px] font-medium ${halfColor} w-20 flex-shrink-0`}>Half-term:</span>
                      <input
                        type="date"
                        value={newSchoolTerm[`${key}HalfTermStart`]}
                        onChange={e => setNewSchoolTerm({ ...newSchoolTerm, [`${key}HalfTermStart`]: e.target.value })}
                      />
                      <span className="text-xs text-gray-400">to</span>
                      <input
                        type="date"
                        value={newSchoolTerm[`${key}HalfTermEnd`]}
                        onChange={e => setNewSchoolTerm({ ...newSchoolTerm, [`${key}HalfTermEnd`]: e.target.value })}
                      />
                    </div>
                  </div>
                ))}
                <button
                  onClick={addSchoolTerm}
                  disabled={!newSchoolTerm.autumnStart}
                  className="w-full btn bg-green-700 text-white justify-center disabled:opacity-40"
                >
                  Add School Year
                </button>
              </div>

              {/* Existing school terms list */}
              {schoolTerms.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-2 text-center">No school years configured yet</p>
              ) : (
                <div className="space-y-2">
                  {schoolTerms.map(term => (
                    <div key={term.id} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
                        <span className="text-xs font-bold text-gray-700">{term.academicYear}</span>
                        <button onClick={() => deleteSchoolTerm(term.id)} className="text-red-400 hover:text-red-600"><Trash2 size={13} /></button>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {[
                          { key: 'autumn', label: 'Autumn', dot: 'bg-orange-400', halfDot: 'bg-orange-200' },
                          { key: 'spring', label: 'Spring', dot: 'bg-blue-400',   halfDot: 'bg-blue-200'   },
                          { key: 'summer', label: 'Summer', dot: 'bg-green-400',  halfDot: 'bg-green-200'  },
                        ].map(({ key, label, dot, halfDot }) => (
                          (term[`${key}Start`] || term[`${key}End`]) ? (
                            <React.Fragment key={key}>
                              <div className="flex items-center gap-2 px-3 py-1.5">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`}></span>
                                <span className="text-xs font-medium text-gray-600 w-14">{label}</span>
                                <span className="text-xs text-gray-500">{formatDateUK(term[`${key}Start`])}</span>
                                <span className="text-xs text-gray-400">–</span>
                                <span className="text-xs text-gray-500">{formatDateUK(term[`${key}End`])}</span>
                              </div>
                              {(term[`${key}HalfTermStart`] || term[`${key}HalfTermEnd`]) && (
                                <div className="flex items-center gap-2 px-3 py-1 bg-amber-50">
                                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${halfDot}`}></span>
                                  <span className="text-[10px] text-amber-600 w-14">Half-term</span>
                                  <span className="text-[10px] text-amber-700">{formatDateUK(term[`${key}HalfTermStart`])}</span>
                                  <span className="text-[10px] text-amber-400">–</span>
                                  <span className="text-[10px] text-amber-700">{formatDateUK(term[`${key}HalfTermEnd`])}</span>
                                </div>
                              )}
                            </React.Fragment>
                          ) : null
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── INSET DAYS ───────────────────────────────────────────── */}
            <div className="mb-5">
              <p className="text-xs font-bold text-gray-400 uppercase mb-1">INSET Days &amp; Bank Holidays</p>
              <p className="text-xs text-gray-400 mb-3">Add individual INSET days (teacher training days within term time). Bank holidays are imported separately below.</p>

              <div className="space-y-2 mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <select value={newTermDate.type} onChange={e => setNewTermDate({ ...newTermDate, type: e.target.value })}>
                  <option value="INSET Day">INSET Day</option>
                  <option value="Bank Holiday">Bank Holiday</option>
                </select>
                <input placeholder="Description (e.g. Staff Training Day)" value={newTermDate.description} onChange={e => setNewTermDate({ ...newTermDate, description: e.target.value })} />
                <div className="flex gap-2">
                  <input type="date" value={newTermDate.date} onChange={e => setNewTermDate({ ...newTermDate, date: e.target.value })} />
                  <button onClick={addTermDate} className="btn bg-gray-800 text-white flex-shrink-0">Add</button>
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-2 mb-2">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">INSET Day</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">Bank Holiday</span>
              </div>

              {/* INSET + Bank Holiday list */}
              <div className="max-h-48 overflow-y-auto space-y-1">
                {termDates
                  .filter(t => t.type === 'INSET Day' || t.type === 'Bank Holiday')
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map(t => {
                    const style = t.type === 'INSET Day'
                      ? { bg: 'bg-violet-50', border: 'border-violet-200', dot: 'bg-violet-400' }
                      : { bg: 'bg-indigo-50', border: 'border-indigo-200', dot: 'bg-indigo-400' };
                    return (
                      <div key={t.id} className={`flex items-center gap-2 px-2 py-1.5 rounded border ${style.bg} ${style.border}`}>
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`}></span>
                        <span className="text-xs font-medium text-gray-700 flex-1">{t.description}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">{formatDateUK(t.date)}</span>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">{t.type}</span>
                        <button onClick={() => deleteTermDate(t.id)} className="text-red-400 hover:text-red-600 flex-shrink-0"><Trash2 size={12} /></button>
                      </div>
                    );
                  })}
                {termDates.filter(t => t.type === 'INSET Day' || t.type === 'Bank Holiday').length === 0 && (
                  <p className="text-xs text-gray-400 italic py-2 text-center">No INSET days or bank holidays added yet</p>
                )}
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
      </div>
    )}

    {/* ════ DATA TAB ════ */}
    {adminTab === 'data' && (
      <div className="grid-dashboard">
        <div className="card border-2 border-emerald-200">
          <h3 className="font-bold mb-1 flex items-center gap-2">
            <Download size={16} className="text-emerald-600"/>Data Backup
          </h3>
          <p className="text-xs text-gray-500 mb-4">Download a copy of your data as a spreadsheet. Open in Excel or Google Sheets to keep a local backup or share with your payroll team.</p>
          <div className="grid grid-cols-1 gap-2">
            <button onClick={exportStaffCSV} className="btn bg-emerald-700 text-white w-full justify-center flex items-center gap-2">
              <Download size={14}/>Export Staff Directory
            </button>
            <button onClick={exportRequestsCSV} className="btn bg-blue-700 text-white w-full justify-center flex items-center gap-2">
              <Download size={14}/>Export All Leave Records
            </button>
          </div>
          <div className="mt-3 text-xs text-gray-400 space-y-0.5">
            <p>Staff export includes name, email, department, role, contract type, allowance and approver.</p>
            <p>Leave export includes every request across all staff and all years.</p>
          </div>
        </div>

        <div className="card">
          <h3 className="font-bold mb-1 flex items-center gap-2">
            <Upload size={16} className="text-emerald-600"/>Silent Bulk Import
          </h3>
          <p className="text-xs text-gray-400 mb-4">Import leave records directly as <strong>Approved</strong> with <strong>no email notifications</strong> sent to anyone. Ideal for backfilling data from spreadsheets or historical records.</p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-xs text-blue-800">
            <p className="font-semibold mb-1">CSV format — one row per leave period:</p>
            <code className="block font-mono bg-white/70 rounded p-2 mt-1 leading-relaxed whitespace-pre">
{`email,type,startDate,endDate,daysCount
firstname.lastname@gardenerschools.com,Annual Leave,2025-09-05,2025-09-05,1
firstname.lastname@gardenerschools.com,Annual Leave,2025-11-05,2025-11-06,2`}
            </code>
            <p className="mt-2">Dates can be <strong>YYYY-MM-DD</strong> or <strong>DD/MM/YYYY</strong> — both accepted. <strong>daysCount</strong> is optional — omit and it will be calculated automatically.</p>
            <p className="mt-1">Leave types: <em>Annual Leave, Sick Leave, CPD, Medical Appt, Compassionate, Unpaid, Time Off in Lieu</em></p>
          </div>

          <div className="mb-3">
            <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Upload CSV file</label>
            <input type="file" accept=".csv,.txt" onChange={handleCsvFileUpload} className="text-sm text-gray-600"/>
          </div>

          <div className="mb-3">
            <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Or paste CSV directly</label>
            <textarea
              value={csvText}
              onChange={e => { setCsvText(e.target.value); setImportPreview([]); setImportResults(null); }}
              className="w-full font-mono text-xs h-28 border border-gray-300 rounded p-2 resize-y"
              placeholder={`email,type,startDate,endDate,daysCount\nfirstname.lastname@gardenerschools.com,Annual Leave,2025-09-05,2025-09-05,1`}
            />
          </div>

          <button onClick={parseImportCsv} disabled={!csvText.trim()} className="btn bg-gray-600 text-white mb-4 disabled:opacity-40">Preview Import</button>

          {importPreview.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-600 mb-2">
                {importPreview.filter(r => !r.error).length} ready &nbsp;·&nbsp;
                {importPreview.filter(r => r.error).length} with errors
              </p>
              <div className="overflow-x-auto rounded border border-gray-200">
                <table className="data-table text-xs">
                  <thead>
                    <tr><th>Staff</th><th>Type</th><th>Start</th><th>End</th><th className="text-center">Days</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {importPreview.map((row, i) => (
                      <tr key={i} className={row.error ? 'bg-red-50' : 'bg-emerald-50'}>
                        <td>
                          <div className="font-semibold">{row.staffName || '—'}</div>
                          <div className="text-gray-400">{row.email}</div>
                        </td>
                        <td>{row.type}</td>
                        <td className="font-mono">{row.startDate}</td>
                        <td className="font-mono">{row.endDate}</td>
                        <td className="text-center">{row.daysCount || <span className="text-gray-400 italic">auto</span>}</td>
                        <td>
                          {row.error
                            ? <span className="flex items-center gap-1 text-red-600 font-semibold"><AlertCircle size={11}/>{row.error}</span>
                            : <span className="flex items-center gap-1 text-emerald-600 font-semibold"><CheckCircle2 size={11}/>Ready</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {importPreview.some(r => !r.error) && (
                <button onClick={doImport} disabled={isImporting} className="btn bg-emerald-600 text-white mt-3 disabled:opacity-50">
                  {isImporting ? 'Importing...' : `Import ${importPreview.filter(r => !r.error).length} Records Silently (No Emails)`}
                </button>
              )}
            </div>
          )}

          {importResults && (
            <div className={`p-3 rounded-lg border text-sm ${importResults.imported > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
              <p className="font-semibold">
                {importResults.imported > 0
                  ? `${importResults.imported} record${importResults.imported !== 1 ? 's' : ''} imported successfully`
                  : 'No records imported'}
                {importResults.skipped > 0 ? ` — ${importResults.skipped} skipped` : ''}
              </p>
              {importResults.errors.map((e, i) => (
                <p key={i} className="text-xs mt-1 text-red-600">{e}</p>
              ))}
            </div>
          )}

          {silentImportCount > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-600">{silentImportCount} silently imported record{silentImportCount !== 1 ? 's' : ''} in the system</p>
                <p className="text-xs text-gray-400">Delete all records that were added via silent import</p>
              </div>
              <button onClick={handleDeleteSilentImports} className="btn bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 text-xs flex items-center gap-1.5">
                <Trash2 size={13}/> Rollback All Silent Imports
              </button>
            </div>
          )}
        </div>
      </div>
    )}

  </div>
  );
};

export default AdminView;

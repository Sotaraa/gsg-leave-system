import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Megaphone, Maximize2, Minimize2 } from 'lucide-react';
import { logoutEntra } from './services/entraAuth';

import CONFIG from './config.js';
import { generateUKBankHolidays, calculateWorkingDays, formatDateUK, sendEmail } from './utils/helpers.js';
import { logger } from './utils/logger.js';
import { useAuth } from './services/auth.js';
import { setSupabaseSession, supabase } from './supabase.js';
import * as supabaseApi from './services/supabaseApi.js';
import {
  sendApprovalNotification,
  sendRejectionNotification,
  sendSubmissionNotification
} from './services/emailNotifications.js';
import { logEmail } from './services/emailLog.js';
import { logAction } from './services/actionLog.js';
import { resolveRecipients } from './services/notificationRecipients.js';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { OrganizationProvider } from './contexts/OrganizationContext.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import Sidebar from './components/Sidebar.jsx';
import Notifications from './components/Notifications.jsx';
import EmployeeView from './components/views/EmployeeView.jsx';
import DeptHeadView from './components/views/DeptHeadView.jsx';
import AdminView from './components/views/AdminView.jsx';
import CalendarView from './components/views/CalendarView.jsx';
import AnalyticsView from './components/views/AnalyticsView.jsx';
import OnboardingAdmin from './components/OnboardingAdmin.jsx';
import { useInactivityTimer } from './hooks/useInactivityTimer.js';
import { useOrgData } from './hooks/useOrgData.js';
import { useConfirm } from './hooks/useConfirm.jsx';
import PwaBanner from './components/PwaBanner.jsx';
import {
  buildOfflineSnapshotHtml, downloadSnapshotHtml,
  buildOrgBackup, downloadBackupJson,
} from './services/offlineSnapshot.js';
import {
  computeHolidayYear,
  getLeaveTaken as calcLeaveTaken,
  getTOILBalance as calcTOILBalance,
  getAllowanceStats as calcAllowanceStats,
  getYearStartForClosingDate as calcYearStartForClosingDate,
  checkForOverlap as calcOverlap,
} from './utils/leaveCalculations.js';

const App = () => {
  const { user: authUser, loading: authLoading, supabaseSession } = useAuth();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState('employee');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [myRole, setMyRole] = useState('Staff');
  const [myDept, setMyDept] = useState('');
  const [myAllowance, setMyAllowance] = useState(CONFIG.defaultAllowance);
  const [amITermTime, setAmITermTime] = useState(false);
  const [myWorkingDays, setMyWorkingDays] = useState([1, 2, 3, 4, 5]);
  const [graphToken, setGraphToken] = useState(null);

  // ── God mode: super admin can switch into any organisation ───────────────
  const [activeOrgId, setActiveOrgId] = useState(null);   // null = use effectiveOrgId
  const [allOrgs, setAllOrgs] = useState([]);
  const isSuperAdmin = user?.email?.toLowerCase() === 'info@sotara.co.uk';
  const effectiveOrgId = (isSuperAdmin && activeOrgId) ? activeOrgId : (user?.organization || activeOrgId);

  // Org-scoped data (staff, requests, depts, term dates, school terms,
  // announcements, settings) is loaded + kept fresh by useOrgData.
  const {
    staffList,      setStaffList,
    requests,       setRequests,
    departments,    setDepartments,
    termDates,      setTermDates,
    schoolTerms,    setSchoolTerms,
    announcements,  setAnnouncements,
    systemSettings, setSystemSettings,
    isLoading: orgDataLoading,
  } = useOrgData(user, (isSuperAdmin && activeOrgId) ? activeOrgId : (user?.organization || activeOrgId));

  const [notifications, setNotifications] = useState([]);
  const [bankHolidays, setBankHolidays] = useState([]);
  const [pendingApprovalId, setPendingApprovalId] = useState(null);

  const [loginError, setLoginError] = useState('');
  const [adminEditId, setAdminEditId] = useState(null);
  const [calDate, setCalDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [calViewMode, setCalViewMode] = useState('Month');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('All');
  const [showArchived, setShowArchived] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  
  // New state for Calendar expansion
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);

  const [formData, setFormData] = useState({ startDate: '', endDate: '', type: 'Annual Leave', isHalfDay: false, hoursWorked: '', sickReason: '' });
  const [newStaff, setNewStaff] = useState({ name: '', email: '', department: CONFIG.defaultDepartments[0], role: 'Staff', allowance: CONFIG.defaultAllowance, isTermTime: false, approverEmail: '', carryForwardDays: 0, termTimeDaysTarget: 0, workingDays: [], hoursPerDay: null });
  const [manualLeave, setManualLeave] = useState({ employeeId: '', type: CONFIG.leaveTypes[0], startDate: '', endDate: '', isHalfDay: false, approvalSubType: '', silentEmail: false, hoursWorked: '', sickReason: '' });
  const [newDeptName, setNewDeptName] = useState('');
  const [newTermDate, setNewTermDate] = useState({ description: '', date: '', type: 'INSET Day' });
  const [newSchoolTerm, setNewSchoolTerm] = useState({ academicYear: '', autumnStart: '', autumnEnd: '', autumnHalfTermStart: '', autumnHalfTermEnd: '', springStart: '', springEnd: '', springHalfTermStart: '', springHalfTermEnd: '', summerStart: '', summerEnd: '', summerHalfTermStart: '', summerHalfTermEnd: '' });
  const [newAnnouncement, setNewAnnouncement] = useState({ message: '', expiry: '' });

  // ─── LOGOUT ──────────────────────────────────────────────────────────────
  const handleLogout = useCallback(async () => {
    setShowInactivityWarning(false);
    const authMethod = localStorage.getItem('GSG_AUTH_METHOD');
    localStorage.removeItem('SUPABASE_SESSION');
    localStorage.removeItem('GSG_USER_EMAIL');
    localStorage.removeItem('GSG_USER_NAME');
    localStorage.removeItem('GSG_AUTH_METHOD');

    if (authMethod === 'entra') {
      try { await logoutEntra(); }
      catch (err) { console.error('Entra logout error:', err); }
    }
    try { await import('./supabase.js').then(m => m.supabase.auth.signOut()); }
    catch (err) { console.warn('Supabase signOut error (non-critical):', err); }

    setGraphToken(null);
    setUser(null);
    window.location.reload();
  }, []);

  // ─── INACTIVITY LOGOUT ───────────────────────────────────────────────────
  useInactivityTimer({
    enabled: !!user,
    onLogout: handleLogout,
    onWarning: () => setShowInactivityWarning(true),
  });

  // ─── INIT ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const currentYear = new Date().getFullYear();
    setBankHolidays([...generateUKBankHolidays(currentYear), ...generateUKBankHolidays(currentYear + 1)]);
  }, []);

  // Honour PWA manifest shortcuts (?view=admin, ?view=dept-head, etc.)
  // so long-pressing the installed app icon lands users in the right tab.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedView = params.get('view');
    if (requestedView && ['employee', 'dept-head', 'admin', 'calendar', 'analytics'].includes(requestedView)) {
      setView(requestedView);
      // Clean up the URL so refreshes don't snap users back here
      params.delete('view');
      params.delete('source');
      const cleaned = params.toString();
      window.history.replaceState({}, '', cleaned ? `?${cleaned}` : window.location.pathname);
    }
  }, []);

  useEffect(() => {
    setUser(authUser);
    // Wire up the Graph API token so email notifications work in all send paths
    if (authUser?.azureToken) {
      setGraphToken(authUser.azureToken);
    }
    if (!authLoading) {
      setIsLoading(false);
    }
  }, [authUser, authLoading]);

  // ─── SUPABASE AUTH INTEGRATION ─────────────────────────────────────────────
  // Upgrade Supabase client from anon key to authenticated JWT
  useEffect(() => {
    if (supabaseSession) {
      console.log('🔐 App.jsx: Upgrading Supabase client to JWT authentication');
      setSupabaseSession(supabaseSession);
    }
  }, [supabaseSession]);

  // Load all orgs for super admin org switcher
  useEffect(() => {
    if (!isSuperAdmin) return;
    supabase.from('organizations').select('id, name').order('name').then(({ data }) => {
      if (data) setAllOrgs(data);
    });
  }, [isSuperAdmin]);

  // ─── PERSONAL PROFILE DERIVATION ─────────────────────────────────────────
  // Derive role/dept/allowance/etc from the current user's row in staffList.
  // Skipped in God Mode so super admin keeps their own profile.
  useEffect(() => {
    if (!user) return;
    const godMode = isSuperAdmin && activeOrgId;
    if (godMode) return;

    const profile = staffList.find(s => s.email?.toLowerCase() === user.email?.toLowerCase());
    const isSuper = CONFIG.superAdmins.some(a => a.toLowerCase() === user.email?.toLowerCase());
    if (isSuper) setMyRole('Admin');
    else if (profile) setMyRole(profile.role);
    else setMyRole('Staff');

    if (profile) {
      setMyDept(profile.department || '');
      setMyAllowance((Number(profile.allowance) || CONFIG.defaultAllowance) + (profile.carryForwardDays || 0));
      setAmITermTime(profile.isTermTime || false);
      setMyWorkingDays(profile.workingDays?.length ? profile.workingDays : [1, 2, 3, 4, 5]);
      if (profile.isTermTime) setFormData(p => ({ ...p, type: CONFIG.termTimeWorkType }));
      else setFormData(p => ({ ...p, type: 'Annual Leave' }));
    }
  }, [staffList, user, isSuperAdmin, activeOrgId]);

  useEffect(() => {
    setIsLoading(orgDataLoading);
  }, [orgDataLoading]);

  const addNotification = (msg) => {
    const id = Date.now();
    setNotifications(p => [...p, { id, msg }]);
    setTimeout(() => setNotifications(p => p.filter(n => n.id !== id)), 4000);
  };

  // Reusable destructive-action confirmation (modal with optional typed phrase)
  const { ask: askConfirm, modal: confirmModal } = useConfirm();

  // ─── OFFLINE SNAPSHOT (Sotara super admin only) ──────────────────────────
  // Generates a self-contained HTML report of the active org so it can be
  // emailed to the client during downtime / outage. Uses whatever data is
  // currently loaded — useOrgData has already fetched everything on entry.
  const generateOfflineSnapshot = () => {
    if (!isSuperAdmin || !activeOrgId) return;
    const org = allOrgs.find(o => o.id === activeOrgId);
    if (!org) {
      addNotification('Could not find organisation data');
      return;
    }
    try {
      const html = buildOfflineSnapshotHtml({
        organization: org,
        staffList,
        requests,
        termDates,
        holidayYear: currentHolidayYear,
        generatedBy: user?.email,
      });
      downloadSnapshotHtml(html, org.id);
      addNotification(`Snapshot downloaded for ${org.name}`);
    } catch (err) {
      console.error('Snapshot generation failed:', err);
      addNotification('Failed to generate snapshot');
    }
  };

  // Pulls a complete JSON dump of the active org direct from Supabase
  // (every table, including archived staff and full history).
  const generateOrgBackup = async () => {
    if (!isSuperAdmin || !activeOrgId) return;
    const org = allOrgs.find(o => o.id === activeOrgId);
    if (!org) {
      addNotification('Could not find organisation data');
      return;
    }
    addNotification(`Building backup for ${org.name}…`);
    try {
      const backup = await buildOrgBackup(supabase, org.id, user?.email);
      downloadBackupJson(backup, org.id);
      const c = backup.counts;
      addNotification(
        `Backup downloaded — ${c.staff} staff, ${c.requests} requests${backup.errors.length ? ` (${backup.errors.length} table error)` : ''}`
      );
    } catch (err) {
      console.error('Backup generation failed:', err);
      addNotification('Failed to generate backup');
    }
  };

  // Email recipient helpers live in services/notificationRecipients.js

  const currentHolidayYear = useMemo(
    () => computeHolidayYear(systemSettings),
    [systemSettings.holidayYearStartMonth, systemSettings.holidayYearStartDay]
  );

  const getLeaveTaken = useCallback(
    (email, isTT) => calcLeaveTaken(requests, email, isTT, currentHolidayYear),
    [requests, currentHolidayYear]
  );

  const getTOILBalance = useCallback(
    (email, staffTarget, staffHoursPerDay, isTermTime = true) =>
      calcTOILBalance(requests, email, staffTarget, staffHoursPerDay, isTermTime, systemSettings, currentHolidayYear),
    [requests, currentHolidayYear, systemSettings]
  );

  const updateStaffTarget = async (staffId, days) => {
    try {
      await supabaseApi.staffApi.updateStaffTarget(staffId, days, effectiveOrgId);
    } catch (err) {
      console.error('Error updating staff target:', err);
      addNotification("Error updating target");
    }
  };

  const updateSystemSettings = async (updates) => {
    try {
      await supabaseApi.settingsApi.updateSettings(updates, effectiveOrgId);
      setSystemSettings(prev => ({ ...prev, ...updates }));
      logAction({
        organizationId: effectiveOrgId,
        performedBy:    user.email,
        actionType:     'UPDATE_SETTINGS',
        entityType:     'settings',
        entityDescription: `Updated: ${Object.keys(updates).join(', ')}`,
        details: updates,
      });
      addNotification("Settings Saved");
    } catch (err) {
      console.error('Error saving settings:', err);
      addNotification("Error saving settings");
    }
  };

  const getYearStartForClosingDate = useCallback(
    (closingDateStr) => calcYearStartForClosingDate(closingDateStr, systemSettings, currentHolidayYear.start),
    [systemSettings.holidayYearStartMonth, systemSettings.holidayYearStartDay, currentHolidayYear.start]
  );

  const calculateCarryForwardData = useCallback((yearStart, yearEnd) => {
    const maxCarry = systemSettings.maxCarryForwardDays ?? 5;
    return staffList
      .filter(s => !s.isArchived && !s.isTermTime)
      .map(s => {
        const effectiveAllowance = (s.allowance || 0) + (s.carryForwardDays || 0);
        const taken = requests
          .filter(r =>
            r.employeeEmail === s.email &&
            r.status === 'Approved' &&
            r.type === 'Annual Leave' &&
            r.startDate >= yearStart &&
            r.startDate <= yearEnd
          )
          .reduce((t, r) => t + Number(r.daysCount || 0), 0);
        const preBooked = requests
          .filter(r =>
            r.employeeEmail === s.email &&
            r.status === 'Approved' &&
            r.type === 'Annual Leave' &&
            r.startDate > yearEnd
          )
          .reduce((t, r) => t + Number(r.daysCount || 0), 0);
        const unused = Math.max(0, effectiveAllowance - taken);
        const carryForward = (systemSettings.carryForwardEnabled ?? true) ? Math.min(unused, maxCarry) : 0;
        return { staffId: s.id, name: s.name, department: s.department, effectiveAllowance, taken, unused, preBooked, carryForward };
      });
  }, [staffList, requests, systemSettings.maxCarryForwardDays, systemSettings.carryForwardEnabled]);

  const applyCarryForward = async (carryData, closingDateStr) => {
    try {
      const resetDate = new Date().toISOString().split('T')[0];
      await supabaseApi.staffApi.applyCarryForward(carryData, effectiveOrgId);
      await supabaseApi.settingsApi.updateSettings({
        lastYearResetDate: resetDate,
        lastYearResetClosingDate: closingDateStr || resetDate
      }, effectiveOrgId);
      logAction({
        organizationId: effectiveOrgId,
        performedBy:    user.email,
        actionType:     'CARRY_FORWARD_RESET',
        entityType:     'settings',
        entityDescription: `Holiday year reset — carry forward applied for ${carryData.length} staff`,
        details: {
          closingDate: closingDateStr,
          staffCount:  carryData.length,
          totalCarried: carryData.reduce((sum, s) => sum + (s.carryForward || 0), 0),
        },
      });
      addNotification(`Holiday year reset. Carry forward applied for ${carryData.length} staff.`);
      return true;
    } catch (error) {
      console.error('Error applying carry forward:', error);
      addNotification("Error applying carry forward");
      return false;
    }
  };

  const getAllowanceStats = calcAllowanceStats;

  const checkForOverlap = (email, startStr, endStr) => calcOverlap(requests, email, startStr, endStr);


  const submitRequest = async (e) => {
    e.preventDefault();
    if (amITermTime && formData.type === 'Annual Leave') return alert("Term Time Contract: You cannot request Annual Leave.");
    if (!confirm("Confirm Request?")) return;
    const endStr = formData.isHalfDay ? formData.startDate : formData.endDate;
    if (checkForOverlap(user.email, formData.startDate, endStr)) return alert("Duplicate Booking: Record exists.");
    const myHpd = Number(myProfile?.hoursPerDay || systemSettings?.hoursPerDay || CONFIG.defaultHoursPerDay);
    const hoursVal = Number(formData.hoursWorked);
    const useHoursMode = formData.type === CONFIG.extraHoursType && hoursVal > 0;
    const days = useHoursMode
      ? Math.round((hoursVal / myHpd) * 1000) / 1000
      : calculateWorkingDays(formData.startDate, formData.endDate, formData.isHalfDay, termDates, myWorkingDays);
    if (isNaN(days) || days <= 0 && !['Sick Leave', 'Compassionate', 'Medical Appt', CONFIG.extraHoursType].includes(formData.type)) {
      if (isNaN(days)) return alert("Invalid entry. Please check the hours or dates entered.");
      return alert("Selected dates are weekends or Bank Holidays.");
    }
    
    // SAVE TO SUPABASE
    const { hoursWorked: _hw, sickReason: _sr, ...formFields } = formData;
    try {
      await supabaseApi.requestsApi.submitRequest({
        ...formFields,
        employeeName: user.displayName || user.name,
        employeeEmail: user.email,
        department: myDept,
        status: 'Pending',
        daysCount: days,
        submittedAt: new Date().toISOString(),
        ...(useHoursMode ? { hoursWorked: hoursVal, hoursPerDay: myHpd } : {}),
        ...(formData.type === 'Sick Leave' && formData.sickReason ? { sickReason: formData.sickReason } : {})
      }, effectiveOrgId);
      addNotification("Request Submitted");
    } catch (error) {
      console.error('Error submitting request:', error);
      addNotification("Error submitting request");
      return;
    }

    const { recipients } = resolveRecipients(staffList, myProfile, myDept, user.email);

    let balanceSummaryRows = [];
    if (!amITermTime && formData.type === 'Annual Leave') {
      const carryDays    = Number(myProfile?.carryForwardDays || 0);
      const yearStart    = currentHolidayYear?.start || '';
      const yearEnd      = currentHolidayYear?.end   || '';
      const daysTaken    = requests
        .filter(r => r.employeeEmail === user.email && r.status === 'Approved' && r.type === 'Annual Leave' && r.startDate >= yearStart && r.startDate <= yearEnd)
        .reduce((sum, r) => sum + Number(r.daysCount || 0), 0);
      const remainingNow  = myAllowance - daysTaken;
      const balanceAfter  = remainingNow - days;
      balanceSummaryRows = [
        { isSection: true, label: 'Leave Balance Overview' },
        { label: 'Total Allowance', value: `${myAllowance} days${carryDays > 0 ? ` (incl. ${carryDays}d carried forward)` : ''}` },
        { label: 'Taken This Year', value: `${daysTaken} days` },
        { label: 'Remaining Now', value: `${remainingNow} days` },
        { label: 'Balance if Approved', value: balanceAfter >= 0 ? `${balanceAfter} days remaining` : `${Math.abs(balanceAfter)} days over entitlement`, highlight: balanceAfter < 0 ? 'red' : balanceAfter <= 3 ? 'amber' : '' },
      ];
    }

    const tStarts = termDates.filter(t => t.type === 'Term Start').map(t => t.date).sort();
    const tEnds   = termDates.filter(t => t.type === 'Term End').map(t => t.date).sort();
    const tRanges = tStarts.map(s => { const e = tEnds.find(e => e >= s); return e ? { start: s, end: e } : null; }).filter(Boolean);
    const reqStart = formData.startDate;
    const reqEnd   = endStr;
    const isInTermTime     = tRanges.some(r => reqStart <= r.end && reqEnd >= r.start);
    const isInSchoolHoliday = termDates.some(t => t.type === 'School Holiday' && t.date >= reqStart && t.date <= reqEnd);
    const termFlagRows = [
      ...(isInTermTime     ? [{ label: 'Term Time Alert',   value: 'This request falls during school term time — please check cover arrangements before approving.', highlight: 'amber' }] : []),
      ...(isInSchoolHoliday ? [{ label: 'School Holiday',  value: 'This request overlaps a recorded school holiday period.', highlight: 'amber' }] : []),
    ];

    const emailSubject = `New Leave Request: ${user.displayName}`;
    if (!graphToken) {
      console.warn('No graph token — email notification skipped');
      addNotification("Request submitted (email notification unavailable — please notify your manager)");
      logEmail({ organizationId: effectiveOrgId, triggeredBy: user.email, recipients: [], subject: emailSubject, context: 'submission', status: 'no_token' });
    } else if (recipients.length === 0) {
      console.warn('No recipients found for dept:', myDept, '— email notification skipped');
      addNotification("Request submitted (no approver found — please contact your manager)");
      logEmail({ organizationId: effectiveOrgId, triggeredBy: user.email, recipients: [], subject: emailSubject, context: 'submission', status: 'no_recipients' });
    } else {
      const emailSent = await sendEmail(graphToken, recipients,
        emailSubject,
        '🗓️ New Leave Request',
        '#064e3b',
        [
          { label: 'Employee', value: user.displayName },
          { label: 'Department', value: myDept },
          { label: 'Leave Type', value: formData.type },
          { label: 'Start Date', value: formatDateUK(formData.startDate) },
          { label: 'End Date', value: formData.isHalfDay ? 'Half Day' : formatDateUK(formData.endDate) },
          { label: 'Days', value: `${days} day(s)` },
          { label: 'Status', value: 'Pending Approval' },
          ...termFlagRows,
          ...balanceSummaryRows
        ],
        'Please review this request.'
      );
      if (emailSent) {
        addNotification(`Notification sent to ${recipients.length} approver${recipients.length > 1 ? 's' : ''}`);
        logEmail({ organizationId: effectiveOrgId, triggeredBy: user.email, recipients, subject: emailSubject, context: 'submission', status: 'sent' });
      } else {
        addNotification("Request submitted (email notification failed — please notify your manager)");
        logEmail({ organizationId: effectiveOrgId, triggeredBy: user.email, recipients, subject: emailSubject, context: 'submission', status: 'failed' });
      }
    }
  };

  const handleApproval = async (id, status, approvalSubType = null, rejectionReason = null) => {
    try {
      const reqForApproval = requests.find(r => r.id === id);
      if (!reqForApproval) {
        console.error('Request not found:', id);
        return;
      }

      if (status === 'Approved' && reqForApproval?.type === CONFIG.toiLeaveType && !approvalSubType) {
        approvalSubType = 'TOIL';
      }

      // Update in Supabase
      if (status === 'Approved') {
        await supabaseApi.requestsApi.approveRequest(
          id,
          approvalSubType,
          effectiveOrgId,
          user.azureToken,
          reqForApproval.employeeEmail,
          reqForApproval.employeeName,
          reqForApproval.type
        );

      } else if (status === 'Rejected') {

        await supabaseApi.requestsApi.rejectRequest(
          id,
          rejectionReason || 'Request not approved',
          effectiveOrgId,
          user.azureToken,
          reqForApproval.employeeEmail,
          reqForApproval.employeeName,
          reqForApproval.type
        );
      }

      setPendingApprovalId(null);
      const emailSent = user.azureToken ? ' & email sent' : '';
      const calendarSent = status === 'Approved' && user.azureToken ? ' & calendar updated' : '';
      addNotification(`Request ${status}${emailSent}${calendarSent}`);

      // Calculate balance for display (legacy logic kept for backwards compatibility)
      const req = reqForApproval;
      const color = status === 'Approved' ? '#047857' : '#b91c1c';
      const emoji = status === 'Approved' ? '✅' : '❌';

      const approvalLabel = approvalSubType === 'TOIL' ? 'Time Off in Lieu'
        : approvalSubType === 'DaysOwed' ? 'Days to Work Back'
        : approvalSubType === 'Unpaid' ? 'Unpaid Leave'
        : null;

      let empBalanceRows = [];
      if (status === 'Approved' && req.type === 'Annual Leave') {
        const empProfile = staffList.find(s => s.email?.toLowerCase() === req.employeeEmail?.toLowerCase());
        if (empProfile && !empProfile.isTermTime) {
          const baseAllowance    = Number(empProfile.allowance ?? systemSettings?.defaultAllowance ?? CONFIG.defaultAllowance);
          const carryDays        = Number(empProfile.carryForwardDays || 0);
          const totalAllowance   = baseAllowance + carryDays;
          const yearStart        = currentHolidayYear?.start || '';
          const yearEnd          = currentHolidayYear?.end   || '';
          const daysTakenPrev    = requests
            .filter(r => r.employeeEmail === req.employeeEmail && r.status === 'Approved' && r.type === 'Annual Leave' && r.startDate >= yearStart && r.startDate <= yearEnd && r.id !== id)
            .reduce((sum, r) => sum + Number(r.daysCount || 0), 0);
          const totalUsed  = daysTakenPrev + Number(req.daysCount || 0);
          const newBalance = totalAllowance - totalUsed;
          empBalanceRows = [
            { isSection: true, label: 'Your Updated Leave Balance' },
            { label: 'Total Allowance', value: `${totalAllowance} days${carryDays > 0 ? ` (incl. ${carryDays}d carried forward)` : ''}` },
            { label: 'Days Used (incl. this)', value: `${totalUsed} days` },
            { label: 'Remaining Balance', value: newBalance >= 0 ? `${newBalance} days remaining` : `${Math.abs(newBalance)} days over entitlement`, highlight: newBalance < 0 ? 'red' : newBalance <= 3 ? 'amber' : '' },
          ];
        }
      }

      // Audit log
      logAction({
        organizationId: effectiveOrgId,
        performedBy:    user.email,
        actionType:     status === 'Approved' ? 'APPROVE_REQUEST' : 'REJECT_REQUEST',
        entityType:     'request',
        entityId:       id,
        entityDescription: `${req.type} for ${req.employeeName} (${formatDateUK(req.startDate)}${req.endDate && req.endDate !== req.startDate ? ' – ' + formatDateUK(req.endDate) : ''})`,
        details: {
          employeeEmail: req.employeeEmail,
          leaveType:     req.type,
          days:          req.daysCount,
          ...(approvalSubType   ? { approvalSubType }   : {}),
          ...(rejectionReason   ? { rejectionReason }   : {}),
        },
      });
      logger.log(`Request ${status}: ${req.employeeName} (${req.type}) - Email: ${user.azureToken ? 'sent' : 'no token'}`);
    } catch (error) {
      console.error('❌ Error processing approval:', error);
      addNotification(`Error: ${error.message}`);
    }
  };

  const deleteRequest = (id) => {
    const req = requests.find(r => r.id === id);
    askConfirm({
      title: 'Delete leave request',
      message: req
        ? `Delete the ${req.type} request for ${req.employeeName} (${formatDateUK(req.startDate)})?`
        : 'Delete this leave request?',
      warningPoints: [
        'This will remove the record permanently.',
        'Notification emails will be sent to the employee, the original approver, and you.',
      ],
      confirmLabel: 'Delete request',
      onConfirm: async () => {
        try {
          await supabaseApi.requestsApi.deleteRequest(id, effectiveOrgId);
          logAction({
            organizationId: effectiveOrgId,
            performedBy:    user.email,
            actionType:     'DELETE_REQUEST',
            entityType:     'request',
            entityId:       id,
            entityDescription: req ? `${req.type} for ${req.employeeName} (${formatDateUK(req.startDate)})` : id,
            details: req ? { employeeEmail: req.employeeEmail, leaveType: req.type, days: req.daysCount, status: req.status } : {},
          });
          addNotification("Deleted");
          if (req) {
            const { recipients: approvalRecipients } = resolveRecipients(staffList, staffList.find(s => s.email?.toLowerCase() === req.employeeEmail?.toLowerCase()), req.department, user.email);
            const allRecipients = [...new Set([req.employeeEmail, user.email, ...approvalRecipients])];
            await sendEmail(graphToken, allRecipients,
              `Leave Record Deleted: ${req.employeeName}`,
              '🗑️ Leave Record Deleted',
              '#6b7280',
              [
                { label: 'Employee', value: req.employeeName },
                { label: 'Leave Type', value: req.type },
                { label: 'Start Date', value: formatDateUK(req.startDate) },
                { label: 'End Date', value: formatDateUK(req.endDate) },
                { label: 'Days', value: `${req.daysCount} day(s)` },
                { label: 'Deleted By', value: user.displayName }
              ],
              'This leave record has been removed from LeaveHub.'
            );
          }
        } catch (error) {
          console.error('Error deleting request:', error);
          addNotification("Error deleting request");
        }
      },
    });
  };

  const saveStaff = async (e) => {
    e.preventDefault();
    try {
      const data = { ...newStaff, allowance: Number(newStaff.allowance) };
      if (adminEditId) {
        await supabaseApi.staffApi.updateStaff(adminEditId, data, effectiveOrgId);
        logAction({
          organizationId: effectiveOrgId,
          performedBy:    user.email,
          actionType:     'EDIT_STAFF',
          entityType:     'staff',
          entityId:       adminEditId,
          entityDescription: data.name,
          details: { role: data.role, department: data.department, allowance: data.allowance, isTermTime: data.isTermTime },
        });
      } else {
        await supabaseApi.staffApi.addStaff({ ...data, isArchived: false }, effectiveOrgId);
        logAction({
          organizationId: effectiveOrgId,
          performedBy:    user.email,
          actionType:     'ADD_STAFF',
          entityType:     'staff',
          entityDescription: data.name,
          details: { email: data.email, role: data.role, department: data.department, allowance: data.allowance },
        });
      }
      addNotification("Staff Saved");
      setNewStaff({ name: '', email: '', department: departments[0], role: 'Staff', allowance: systemSettings.defaultAllowance, isTermTime: false, approverEmail: '', carryForwardDays: 0, termTimeDaysTarget: 0, workingDays: [], hoursPerDay: null });
      setAdminEditId(null);
    } catch (error) {
      console.error('Error saving staff:', error);
      addNotification("Error saving staff");
    }
  };

  const handleManualAdd = async (e) => {
    e.preventDefault();
    try {
      const staff = staffList.find(s => s.id === manualLeave.employeeId);
      if (!staff) return alert("Select staff");
      if (staff.isTermTime && manualLeave.type === 'Annual Leave') return alert("Action Blocked: Term Time contract.");
      const endStr = manualLeave.isHalfDay ? manualLeave.startDate : manualLeave.endDate;
      if (checkForOverlap(staff.email, manualLeave.startDate, endStr)) return alert("Duplicate Booking.");
      if (!confirm("Confirm adding this record?")) return;
      const staffWorkPattern = staff.workingDays?.length ? staff.workingDays : [1, 2, 3, 4, 5];
      const hpd = Number(staff.hoursPerDay || systemSettings?.hoursPerDay || CONFIG.defaultHoursPerDay);
      const hoursEntered = Number(manualLeave.hoursWorked);
      const useHoursMode = (manualLeave.type === CONFIG.termTimeWorkType || manualLeave.type === CONFIG.extraHoursType) && hoursEntered > 0;
      const days = useHoursMode
        ? Math.round((hoursEntered / hpd) * 1000) / 1000
        : calculateWorkingDays(manualLeave.startDate, manualLeave.endDate, manualLeave.isHalfDay, termDates, staffWorkPattern);
      if (isNaN(days) || days < 0) return alert("Invalid days count. Please check the dates and hours entered.");
      const manualRecord = {
        employeeName: staff.name,
        employeeEmail: staff.email,
        department: staff.department,
        type: manualLeave.type,
        startDate: manualLeave.startDate,
        endDate: manualLeave.endDate,
        isHalfDay: manualLeave.isHalfDay,
        status: 'Approved',
        daysCount: days,
        submittedAt: new Date().toISOString(),
        importedSilently: manualLeave.silentEmail,
        ...(useHoursMode ? { hoursWorked: hoursEntered, hoursPerDay: hpd } : {}),
        ...(manualLeave.sickReason && manualLeave.type === 'Sick Leave' ? { sickReason: manualLeave.sickReason } : {})
      };
      if (manualLeave.approvalSubType) manualRecord.approvalSubType = manualLeave.approvalSubType;

      await supabaseApi.requestsApi.submitRequest(manualRecord, effectiveOrgId);
      logAction({
        organizationId: effectiveOrgId,
        performedBy:    user.email,
        actionType:     'MANUAL_LEAVE_ADD',
        entityType:     'request',
        entityDescription: `${manualLeave.type} for ${staff.name} (${formatDateUK(manualLeave.startDate)})`,
        details: { employeeEmail: staff.email, leaveType: manualLeave.type, days, silentEmail: manualLeave.silentEmail },
      });
      addNotification("Absence Recorded");

      if (!manualLeave.silentEmail) {
        // Send to: employee, admin who recorded it, and assigned approver (or department heads if no approver)
        const assignedApprover = staff.approverEmail && !isEmailArchived(staff.approverEmail) ? staff.approverEmail : null;
        const baseRecipients = getNotificationRecipients(staff.department);
        const approvalRecipients = assignedApprover ? [assignedApprover] : baseRecipients;
        const allRecipients = [...new Set([staff.email, user.email, ...approvalRecipients])];
        const activeRecipients = allRecipients.filter(email => !isEmailArchived(email));
        await sendEmail(graphToken, activeRecipients,
          `Absence Recorded: ${staff.name}`,
          '📋 Absence Manually Recorded',
          '#1d4ed8',
          [
            { label: 'Employee', value: staff.name },
            { label: 'Department', value: staff.department },
            { label: 'Leave Type', value: manualLeave.type },
            { label: 'Start Date', value: formatDateUK(manualLeave.startDate) },
            { label: 'End Date', value: manualLeave.isHalfDay ? 'Half Day' : formatDateUK(manualLeave.endDate) },
            { label: 'Days', value: useHoursMode ? `${days} day(s) (${hoursEntered}h @ ${hpd}h/day)` : `${days} day(s)` },
            { label: 'Recorded By', value: user.displayName }
          ],
          'This absence has been manually recorded in LeaveHub by an administrator.'
        );
      }
      setManualLeave(p => ({ ...p, silentEmail: false, hoursWorked: '', sickReason: '' }));
    } catch (error) {
      console.error('Error recording absence:', error);
      addNotification("Error recording absence");
    }
  };

  const handleDeleteSilentImports = () => {
    const silentRecords = requests.filter(r => r.importedSilently === true);
    if (!silentRecords.length) {
      addNotification('No silently-imported records to delete');
      return;
    }
    askConfirm({
      title: 'Rollback silent imports',
      message: `You are about to permanently delete ${silentRecords.length} silently-imported record${silentRecords.length !== 1 ? 's' : ''}.`,
      warningPoints: [
        'This action <strong>cannot be undone</strong>.',
        'It only removes records flagged <em>importedSilently</em> — manual entries and live submissions are unaffected.',
        'Deleted records will not appear in any reports or balances.',
      ],
      confirmLabel: `Delete ${silentRecords.length} record${silentRecords.length !== 1 ? 's' : ''}`,
      requirePhrase: `DELETE ${silentRecords.length}`,
      onConfirm: async () => {
        try {
          await supabaseApi.requestsApi.deleteSilentImports(effectiveOrgId);
          logAction({
            organizationId: effectiveOrgId,
            performedBy:    user.email,
            actionType:     'ROLLBACK_SILENT_IMPORTS',
            entityType:     'request',
            entityDescription: `${silentRecords.length} silently-imported records deleted`,
            details: { count: silentRecords.length },
          });
          addNotification(`${silentRecords.length} imported record${silentRecords.length !== 1 ? 's' : ''} deleted`);
        } catch (error) {
          console.error('Error deleting silent imports:', error);
          addNotification("Error deleting silent imports");
        }
      },
    });
  };

  const handleBulkImport = async (records) => {
    const results = { imported: 0, skipped: 0, errors: [] };
    for (const rec of records) {
      try {
        const staff = staffList.find(s => s.email?.toLowerCase() === rec.email?.toLowerCase());
        if (!staff) { results.errors.push(`${rec.email}: not found in staff list`); results.skipped++; continue; }
        const endDate = rec.endDate || rec.startDate;
        if (checkForOverlap(staff.email, rec.startDate, endDate)) {
          results.errors.push(`${staff.name} (${rec.startDate}): overlaps an existing record — skipped`);
          results.skipped++; continue;
        }
        const days = rec.daysCount ? Number(rec.daysCount)
          : calculateWorkingDays(rec.startDate, endDate, false, termDates);
        if (days <= 0) {
          results.errors.push(`${staff.name} (${rec.startDate}): 0 working days — is this a weekend or bank holiday?`);
          results.skipped++; continue;
        }
        await supabaseApi.requestsApi.submitRequest({
          employeeName: staff.name,
          employeeEmail: staff.email,
          department: staff.department,
          type: rec.type || 'Annual Leave',
          startDate: rec.startDate,
          endDate,
          isHalfDay: false,
          status: 'Approved',
          daysCount: days,
          importedSilently: true
        }, effectiveOrgId);
        results.imported++;
      } catch (err) {
        results.errors.push(`${rec.email} (${rec.startDate}): ${err.message}`);
        results.skipped++;
      }
    }
    if (results.imported > 0) {
      logAction({
        organizationId: effectiveOrgId,
        performedBy:    user.email,
        actionType:     'BULK_IMPORT',
        entityType:     'request',
        entityDescription: `${results.imported} records imported (${results.skipped} skipped)`,
        details: { imported: results.imported, skipped: results.skipped, errors: results.errors.slice(0, 10) },
      });
    }
    return results;
  };

  const handleStaffSelect = (e) => {
    const staffId = e.target.value;
    const staff = staffList.find(s => s.id === staffId);
    const defaultType = staff?.isTermTime ? CONFIG.termTimeWorkType : 'Annual Leave';
    setManualLeave({ ...manualLeave, employeeId: staffId, type: defaultType, approvalSubType: '', hoursWorked: '', sickReason: '' });
  };

  const searchDirectory = async (query) => {
    if (!query || query.length < 2) return;
    setIsSearching(true);
    try {
      // Always acquire a fresh token scoped to People.Read so we don't rely
      // on a cached token that may be missing this scope.
      let token = graphToken;
      try {
        const { getMsalInstance } = await import('./services/entraAuth.js');
        const msalInstance = getMsalInstance();
        const accounts = msalInstance?.getAllAccounts() || [];
        if (accounts.length > 0) {
          const tokenResponse = await msalInstance.acquireTokenSilent({
            scopes: ['People.Read', 'User.Read'],
            account: accounts[0],
          });
          token = tokenResponse.accessToken;
        }
      } catch (tokenErr) {
        console.warn('Could not acquire People.Read token silently:', tokenErr.message);
      }

      if (!token) { setIsSearching(false); return alert("Please re-login to search directory"); }

      // /me/people — searches GAL with People.Read, no admin consent needed
      const peopleRes = await fetch(
        `https://graph.microsoft.com/v1.0/me/people?$search="${encodeURIComponent(query)}"&$select=displayName,scoredEmailAddresses,department,jobTitle&$top=8`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const peopleData = await peopleRes.json();
      const people = (peopleData.value || [])
        .filter(p => p.scoredEmailAddresses?.[0]?.address)
        .map(p => ({
          displayName: p.displayName,
          mail: p.scoredEmailAddresses[0].address,
          department: p.department || '',
          jobTitle: p.jobTitle || '',
        }));

      if (people.length > 0) {
        setSearchResults(people);
      } else {
        // Fallback: /users $search with ConsistencyLevel header
        const usersRes = await fetch(
          `https://graph.microsoft.com/v1.0/users?$search="displayName:${encodeURIComponent(query)}"&$select=displayName,mail,department,jobTitle&$top=8`,
          { headers: { Authorization: `Bearer ${token}`, ConsistencyLevel: 'eventual' } }
        );
        const usersData = await usersRes.json();
        setSearchResults(usersData.value || []);
      }
    } catch { setSearchResults([]); }
    setIsSearching(false);
  };

  const selectDirectoryUser = (u) => {
    setNewStaff({ ...newStaff, name: u.displayName, email: u.mail || '', department: u.department || departments[0] });
    setSearchResults([]);
  };

  const toggleArchiveStaff = (id, currentStatus) => {
    askConfirm({
      title: currentStatus ? 'Restore staff member' : 'Archive staff member',
      message: currentStatus
        ? 'They will appear in the active staff list and can submit requests again.'
        : 'They will be hidden from the active list. Their leave history is kept and they can be restored later.',
      confirmLabel: currentStatus ? 'Restore' : 'Archive',
      onConfirm: async () => {
        try {
          await supabaseApi.staffApi.toggleArchiveStaff(id, !currentStatus, effectiveOrgId);
          const staffMember = staffList.find(s => s.id === id);
          logAction({
            organizationId: effectiveOrgId,
            performedBy:    user.email,
            actionType:     currentStatus ? 'RESTORE_STAFF' : 'ARCHIVE_STAFF',
            entityType:     'staff',
            entityId:       id,
            entityDescription: staffMember?.name || id,
            details: { previousStatus: currentStatus ? 'archived' : 'active' },
          });
          addNotification(currentStatus ? "User Restored" : "User Archived");
        } catch (error) {
          console.error('Error toggling archive status:', error);
          addNotification("Error updating user");
        }
      },
    });
  };

  const permanentlyDeleteStaff = (id, name) => {
    askConfirm({
      title: 'Permanently delete staff member',
      message: `You are about to remove ${name} from the system completely.`,
      warningPoints: [
        'This action <strong>cannot be undone</strong>.',
        'Their leave records will be orphaned (they will still appear in reports as historical data).',
        'Consider <strong>archiving</strong> instead — it hides the user but keeps everything reversible.',
      ],
      confirmLabel: 'Permanently delete',
      requirePhrase: `DELETE ${name}`,
      onConfirm: async () => {
        try {
          await supabaseApi.staffApi.deleteStaff(id, effectiveOrgId);
          logAction({
            organizationId: effectiveOrgId,
            performedBy:    user.email,
            actionType:     'DELETE_STAFF',
            entityType:     'staff',
            entityId:       id,
            entityDescription: name,
            details: { note: 'Permanent deletion — requires typed phrase confirmation' },
          });
          addNotification(`${name} permanently deleted`);
        } catch (error) {
          console.error('Error deleting staff:', error);
          addNotification("Error deleting user");
        }
      },
    });
  };

  const prepareEdit = (staff) => {
    setNewStaff({
      name: staff.name, email: staff.email, department: staff.department,
      role: staff.role, allowance: staff.allowance, isTermTime: staff.isTermTime || false,
      approverEmail: staff.approverEmail || '', carryForwardDays: staff.carryForwardDays || 0,
      termTimeDaysTarget: staff.termTimeDaysTarget || 0, workingDays: staff.workingDays || [], hoursPerDay: staff.hoursPerDay || null
    });
    setAdminEditId(staff.id);
    document.querySelector('#admin-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const addDepartment = async () => {
    if (!newDeptName) return;
    try {
      await supabaseApi.departmentsApi.addDepartment(newDeptName, effectiveOrgId);
      logAction({
        organizationId: effectiveOrgId,
        performedBy:    user.email,
        actionType:     'ADD_DEPARTMENT',
        entityType:     'department',
        entityDescription: newDeptName,
      });
      addNotification("Department Added");
      setNewDeptName('');
    } catch (error) {
      console.error('Error adding department:', error);
      addNotification("Error adding department");
    }
  };

  const deleteDepartment = (deptId, name) => {
    if (CONFIG.defaultDepartments.includes(name)) return alert("Cannot delete default.");
    const inUse = staffList.filter(s => !s.isArchived && s.department === name).length;
    askConfirm({
      title: 'Delete department',
      message: `Remove "${name}" from the department list?`,
      warningPoints: inUse > 0
        ? [`<strong>${inUse} active staff</strong> are currently assigned to this department. Their assignment will remain but the department won't appear in dropdowns until re-added.`]
        : ['No active staff are assigned to this department.'],
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          await supabaseApi.departmentsApi.deleteDepartment(deptId, effectiveOrgId);
          logAction({
            organizationId: effectiveOrgId,
            performedBy:    user.email,
            actionType:     'DELETE_DEPARTMENT',
            entityType:     'department',
            entityId:       deptId,
            entityDescription: name,
            details: { staffAffected: staffList.filter(s => !s.isArchived && s.department === name).length },
          });
          addNotification("Department Deleted");
        } catch (error) {
          console.error('Error deleting department:', error);
          addNotification("Error deleting department");
        }
      },
    });
  };

  const addTermDate = async () => {
    if (!newTermDate.date || !newTermDate.description) return;
    try {
      const created = await supabaseApi.termDatesApi.addTermDate(newTermDate, effectiveOrgId);
      logAction({
        organizationId: effectiveOrgId,
        performedBy:    user.email,
        actionType:     'ADD_TERM_DATE',
        entityType:     'term_date',
        entityId:       created?.id,
        entityDescription: `${newTermDate.type}: ${newTermDate.description} (${formatDateUK(newTermDate.date)})`,
        details: { type: newTermDate.type, date: newTermDate.date },
      });
      addNotification("Date Added");
      setNewTermDate({ description: '', date: '', type: 'Term Start' });

    } catch (error) {
      console.error('Error adding term date:', error);
      addNotification("Error adding date");
    }
  };

  const deleteTermDate = (id) => {
    const holiday = termDates.find(t => t.id === id);
    askConfirm({
      title: 'Delete term date',
      message: holiday
        ? `Remove "${holiday.description}" (${formatDateUK(holiday.date)}) from the calendar?`
        : 'Remove this entry from the calendar?',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          await supabaseApi.termDatesApi.deleteTermDate(id, effectiveOrgId);
          logAction({
            organizationId: effectiveOrgId,
            performedBy:    user.email,
            actionType:     'DELETE_TERM_DATE',
            entityType:     'term_date',
            entityId:       id,
            entityDescription: holiday ? `${holiday.type}: ${holiday.description} (${formatDateUK(holiday.date)})` : id,
            details: holiday ? { type: holiday.type, date: holiday.date } : {},
          });
          addNotification("Deleted");
        } catch (error) {
          console.error('Error deleting term date:', error);
          addNotification("Error deleting date");
        }
      },
    });
  };

  const addSchoolTerm = async () => {
    if (!newSchoolTerm.autumnStart) return;
    try {
      const year = newSchoolTerm.autumnStart.substring(0, 4);
      const label = newSchoolTerm.academicYear || `${year}-${Number(year) + 1}`;
      await supabaseApi.schoolTermsApi.addSchoolTerm({ ...newSchoolTerm, academicYear: label }, effectiveOrgId);
      logAction({
        organizationId: effectiveOrgId,
        performedBy:    user.email,
        actionType:     'ADD_SCHOOL_TERM',
        entityType:     'school_term',
        entityDescription: `Academic year ${label}`,
        details: { academicYear: label, autumnStart: newSchoolTerm.autumnStart },
      });
      addNotification("School term added");
      setNewSchoolTerm({ academicYear: '', autumnStart: '', autumnEnd: '', autumnHalfTermStart: '', autumnHalfTermEnd: '', springStart: '', springEnd: '', springHalfTermStart: '', springHalfTermEnd: '', summerStart: '', summerEnd: '', summerHalfTermStart: '', summerHalfTermEnd: '' });
    } catch (error) {
      console.error('Error adding school term:', error);
      addNotification("Error adding school term");
    }
  };

  const deleteSchoolTerm = (id) => {
    const term = schoolTerms.find(t => t.id === id);
    askConfirm({
      title: 'Delete school year',
      message: term
        ? `Delete the entire ${term.academicYear} school year setup (autumn, spring, summer terms + half-term breaks)?`
        : "Delete this school year's term dates?",
      warningPoints: [
        'Term-time leave calculations for affected staff may change.',
        'Existing leave requests will not be deleted.',
      ],
      confirmLabel: 'Delete year',
      requirePhrase: term?.academicYear ? `DELETE ${term.academicYear}` : null,
      onConfirm: async () => {
        try {
          await supabaseApi.schoolTermsApi.deleteSchoolTerm(id, effectiveOrgId);
          logAction({
            organizationId: effectiveOrgId,
            performedBy:    user.email,
            actionType:     'DELETE_SCHOOL_TERM',
            entityType:     'school_term',
            entityId:       id,
            entityDescription: term ? `Academic year ${term.academicYear}` : id,
            details: term ? { academicYear: term.academicYear } : {},
          });
          addNotification("School term deleted");
        } catch (error) {
          console.error('Error deleting school term:', error);
          addNotification("Error deleting school term");
        }
      },
    });
  };

  const importBankHolidays = async () => {
    if (!confirm("Import UK Holidays?")) return;
    try {
      const hols = generateUKBankHolidays(2025).concat(generateUKBankHolidays(2026));
      await supabaseApi.termDatesApi.importBankHolidays(hols, effectiveOrgId);
      logAction({
        organizationId: effectiveOrgId,
        performedBy:    user.email,
        actionType:     'IMPORT_BANK_HOLIDAYS',
        entityType:     'term_date',
        entityDescription: `${hols.length} UK bank holidays imported (2025–2026)`,
        details: { count: hols.length, years: [2025, 2026] },
      });
      addNotification("Holidays Imported");
    } catch (error) {
      console.error('Error importing holidays:', error);
      addNotification("Error importing holidays");
    }
  };

  const postAnnouncement = async (e) => {
    e.preventDefault();
    if (!newAnnouncement.message) return;
    try {
      await supabaseApi.announcementsApi.addAnnouncement(
        newAnnouncement.message,
        newAnnouncement.expiry,
        effectiveOrgId
      );
      logAction({
        organizationId: effectiveOrgId,
        performedBy:    user.email,
        actionType:     'POST_ANNOUNCEMENT',
        entityType:     'announcement',
        entityDescription: newAnnouncement.message.substring(0, 100),
        details: { expiry: newAnnouncement.expiry || null },
      });
      addNotification("Posted");
      setNewAnnouncement({ message: '', expiry: '' });
    } catch (error) {
      console.error('Error posting announcement:', error);
      addNotification("Error posting announcement");
    }
  };

  const deleteAnnouncement = (id) => {
    const ann = announcements.find(a => a.id === id);
    askConfirm({
      title: 'Delete announcement',
      message: ann?.message ? `Remove this announcement: "${ann.message.substring(0, 80)}${ann.message.length > 80 ? '…' : ''}"?` : 'Remove this announcement?',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          await supabaseApi.announcementsApi.deleteAnnouncement(id, effectiveOrgId);
          logAction({
            organizationId: effectiveOrgId,
            performedBy:    user.email,
            actionType:     'DELETE_ANNOUNCEMENT',
            entityType:     'announcement',
            entityId:       id,
            entityDescription: ann?.message ? ann.message.substring(0, 100) : id,
          });
          addNotification("Announcement deleted");
        } catch (error) {
          console.error('Error deleting announcement:', error);
          addNotification("Error deleting announcement");
        }
      },
    });
  };

  const exportCSV = (filename, headers, rows) => {
    const escape = (v) => {
      const s = String(v ?? '');
      return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })),
      download: filename
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  };

  const exportStaffCSV = () => {
    exportCSV(
      `gsg-staff-${new Date().toISOString().split('T')[0]}.csv`,
      ['Name', 'Email', 'Department', 'Role', 'Contract Type', 'Annual Allowance', 'Carry Forward Days', 'Holiday Work Target', 'Approver Email'],
      staffList.filter(s => !s.isArchived).map(s => [
        s.name, s.email, s.department, s.role,
        s.isTermTime ? 'Term Time' : 'Standard',
        s.allowance || 0,
        s.carryForwardDays || 0,
        s.isTermTime ? (s.termTimeDaysTarget || systemSettings?.termTimeDaysTarget || 30) : 'N/A',
        s.approverEmail || ''
      ])
    );
    addNotification('Staff directory exported');
  };

  const exportRequestsCSV = () => {
    exportCSV(
      `gsg-leave-requests-${new Date().toISOString().split('T')[0]}.csv`,
      ['Employee Name', 'Email', 'Department', 'Leave Type', 'Start Date', 'End Date', 'Days', 'Half Day', 'Status', 'Submitted Date'],
      requests.map(r => [
        r.employeeName, r.employeeEmail, r.department,
        r.type, r.startDate, r.endDate || r.startDate,
        r.daysCount, r.isHalfDay ? 'Yes' : 'No',
        r.status, r.submittedAt ? r.submittedAt.split('T')[0] : ''
      ])
    );
    addNotification('Leave requests exported');
  };

  const analyticsData = useMemo(() => {
    const effectiveRoleForAnalytics = (isSuperAdmin && activeOrgId) ? 'Admin' : myRole;
    const isAdmin = effectiveRoleForAnalytics === 'Admin';
    const canManage = effectiveRoleForAnalytics === 'Dept Head' || isAdmin;
    if (!canManage) return null;
    const tally = {};
    CONFIG.leaveTypes.forEach(t => tally[t] = 0);
    const filteredReqs = requests.filter(r =>
      r.status === 'Approved' &&
      r.startDate >= currentHolidayYear.start &&
      r.startDate <= currentHolidayYear.end &&
      (isAdmin ? (selectedDeptFilter === 'All' || r.department === selectedDeptFilter) : r.department === myDept)
    );
    filteredReqs.forEach(r => {
      const key = r.type === CONFIG._legacyProfDevType ? 'CPD' : r.type;
      if (tally[key] !== undefined) tally[key] += Number(r.daysCount);
      else if (tally[r.type] !== undefined) tally[r.type] += Number(r.daysCount);
    });
    const visibleStaff = staffList.filter(s => !s.isArchived && (isAdmin ? (selectedDeptFilter === 'All' || s.department === selectedDeptFilter) : s.department === myDept));
    const individualData = visibleStaff.map(s => {
      const breakdown = {};
      CONFIG.leaveTypes.forEach(t => breakdown[t] = 0);
      let total = 0, sickSpells = 0, sickDays = 0;
      const userRequests = requests.filter(r =>
        r.employeeEmail === s.email &&
        r.status === 'Approved' &&
        r.startDate >= currentHolidayYear.start &&
        r.startDate <= currentHolidayYear.end
      );
      const monthlyBreakdown = {};
      userRequests.forEach(r => {
        const typeKey = r.type === CONFIG._legacyProfDevType ? 'CPD' : r.type;
        if (breakdown[typeKey] !== undefined) breakdown[typeKey] += Number(r.daysCount);
        else if (breakdown[r.type] !== undefined) breakdown[r.type] += Number(r.daysCount);
        if (s.isTermTime) { if (r.type === CONFIG.termTimeWorkType || r.type === CONFIG._legacyTermTimeWorkType) total += Number(r.daysCount); }
        else { if (r.type === 'Annual Leave') total += Number(r.daysCount); }
        if (r.type === 'Sick Leave') { sickSpells += 1; sickDays += Number(r.daysCount); }
        const month = r.startDate?.substring(0, 7);
        if (month) {
          if (!monthlyBreakdown[month]) monthlyBreakdown[month] = {};
          monthlyBreakdown[month][typeKey] = (monthlyBreakdown[month][typeKey] || 0) + Number(r.daysCount || 0);
        }
      });
      const baseEffectiveAllowance = (s.allowance || 0) + (s.carryForwardDays || 0);
      let remaining = null, balanceStatus = 'ok', toilBalance = null, effectiveAllowance = baseEffectiveAllowance;
      if (!s.isTermTime) {
        const annualTaken = breakdown['Annual Leave'] || 0;
        const extraAccrued    = breakdown[CONFIG.extraHoursType] || 0;
        const toilUsed        = breakdown[CONFIG.toiLeaveType]   || 0;
        const staffToilCredit = Math.max(0, extraAccrued - toilUsed);
        effectiveAllowance    = baseEffectiveAllowance + staffToilCredit;
        remaining = effectiveAllowance - annualTaken;
        balanceStatus = remaining < 0 ? 'negative' : remaining <= 3 ? 'low' : 'ok';
      } else {
        const baseTarget = Number(s.termTimeDaysTarget) || Number(systemSettings?.termTimeDaysTarget) || 30;
        const accrued    = (breakdown[CONFIG.termTimeWorkType] || 0) + (breakdown[CONFIG._legacyTermTimeWorkType] || 0);
        const toilUsed   = breakdown[CONFIG.toiLeaveType] || 0;
        const ttLeave    = breakdown[CONFIG.termTimeLeaveType] || 0;
        const effectiveTarget = baseTarget + ttLeave;
        const credit     = accrued - toilUsed;
        remaining        = credit;
        balanceStatus    = credit < 0 ? 'negative' : 'ok';
        toilBalance      = { accrued, used: toilUsed, credit, effectiveTarget, target: baseTarget, termTimeLeaveTaken: ttLeave, remainingToWork: Math.max(0, effectiveTarget - accrued) };
      }
      const todayStr = new Date().toISOString().split('T')[0];
      const annualLeaveTaken    = userRequests.filter(r => r.type === 'Annual Leave' && (r.endDate || r.startDate) < todayStr).reduce((t, r) => t + Number(r.daysCount || 0), 0);
      const annualLeaveUpcoming = userRequests.filter(r => r.type === 'Annual Leave' && r.startDate >= todayStr).reduce((t, r) => t + Number(r.daysCount || 0), 0);
      return { ...s, effectiveAllowance, breakdown, total, bradford: (sickSpells * sickSpells) * sickDays, userRequests, monthlyBreakdown, remaining, balanceStatus, toilBalance, annualLeaveTaken, annualLeaveUpcoming };
    });
    return { tally, individualData, yearLabel: currentHolidayYear.label };
  }, [requests, staffList, selectedDeptFilter, myRole, myDept, currentHolidayYear, systemSettings, isSuperAdmin, activeOrgId]);

  if (isLoading) return (
    <div className="h-screen flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <PwaBanner />
      <div className="w-10 h-10 border-4 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
      <p className="text-slate-500 font-medium text-sm">Loading…</p>
    </div>
  );
  if (!user) return (
    <>
      <PwaBanner />
      <LoginScreen error={loginError} />
    </>
  );

  // When super admin has switched into a client org, force Admin role for that session
  const effectiveRole = (isSuperAdmin && activeOrgId) ? 'Admin' : myRole;
  const isAdmin = effectiveRole === 'Admin';
  const canManage = effectiveRole === 'Dept Head' || isAdmin;
  const myProfile = staffList.find(s => s.email?.toLowerCase() === user?.email?.toLowerCase());
  const myCarryForwardDays = myProfile?.carryForwardDays || 0;
  const myTOILBalance = getTOILBalance(user?.email, myProfile?.termTimeDaysTarget, myProfile?.hoursPerDay, amITermTime);
  const myDaysTaken = amITermTime ? 0 : getLeaveTaken(user?.email, false);
  const myStats = getAllowanceStats(myDaysTaken, myAllowance, false);
  const activeAnnouncement = announcements[0];

  return (
    <ErrorBoundary>
      <OrganizationProvider user={user}>
        <div className="app-container">

        <PwaBanner />

        {showInactivityWarning && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
            background: '#b45309', color: 'white', padding: '12px 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
          }}>
            <span style={{ fontWeight: 600, fontSize: '14px' }}>
              ⚠️ You will be logged out in 1 minute due to inactivity. Move your mouse or click anywhere to stay logged in.
            </span>
            <button onClick={resetInactivityTimer} style={{
              background: 'white', color: '#b45309', border: 'none',
              borderRadius: '6px', padding: '6px 16px', fontWeight: 700,
              cursor: 'pointer', fontSize: '13px'
            }}>
              Stay Logged In
            </button>
          </div>
        )}

        {/* Onboarding Admin Page - Master admin only */}
        {showOnboarding && (
          <>
            <button
              onClick={() => setShowOnboarding(false)}
              style={{
                position: 'fixed',
                top: '20px',
                right: '20px',
                zIndex: 10000,
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '8px 16px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}
            >
              ✕ Close
            </button>
            <OnboardingAdmin user={user} onSuccess={() => setShowOnboarding(false)} />
          </>
        )}

        {!showOnboarding && (
          <>
        <Sidebar
          view={view}
          setView={setView}
          myRole={isSuperAdmin && activeOrgId ? 'Admin' : myRole}
          userEmail={user?.email}
          onLogout={handleLogout}
          allOrgs={allOrgs}
          activeOrgId={activeOrgId}
          setActiveOrgId={setActiveOrgId}
          onShowOnboarding={() => {
            if (user?.email?.toLowerCase() === 'info@sotara.co.uk') {
              setShowOnboarding(true);
            } else {
              alert('Only info@sotara.co.uk can create organizations');
            }
          }}
        />
        <div className="main-content" style={{ paddingTop: showInactivityWarning ? '60px' : undefined }}>
          {/* God mode banner — shown when super admin is viewing a client org */}
          {isSuperAdmin && activeOrgId && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'linear-gradient(90deg, #78350f 0%, #92400e 100%)',
              color: '#FEF3C7',
              padding: '8px 16px',
              marginBottom: 16,
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              border: '1px solid rgba(251,191,36,0.4)',
              boxShadow: '0 2px 8px rgba(251,191,36,0.2)',
            }}>
              <span style={{ fontSize: 16 }}>🛡️</span>
              God Mode — Viewing <strong style={{ color: '#FCD34D' }}>{allOrgs.find(o => o.id === activeOrgId)?.name || activeOrgId}</strong> as Admin
              <button
                onClick={generateOfflineSnapshot}
                title="Self-contained HTML report — email to client during downtime"
                style={{
                  marginLeft: 'auto',
                  background: 'rgba(251,191,36,0.2)',
                  border: '1px solid rgba(251,191,36,0.4)',
                  color: '#FCD34D',
                  borderRadius: 6,
                  padding: '2px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  letterSpacing: '0.5px',
                }}
              >
                📥 Snapshot
              </button>
              <button
                onClick={generateOrgBackup}
                title="Full JSON data backup — every table for this org, for safekeeping or restore"
                style={{
                  background: 'rgba(251,191,36,0.2)',
                  border: '1px solid rgba(251,191,36,0.4)',
                  color: '#FCD34D',
                  borderRadius: 6,
                  padding: '2px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  letterSpacing: '0.5px',
                }}
              >
                💾 Backup
              </button>
              <button
                onClick={() => setActiveOrgId(null)}
                style={{
                  background: 'rgba(251,191,36,0.2)',
                  border: '1px solid rgba(251,191,36,0.4)',
                  color: '#FCD34D',
                  borderRadius: 6,
                  padding: '2px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  letterSpacing: '0.5px',
                }}
              >
                ✕ Exit
              </button>
            </div>
          )}
          {activeAnnouncement && (
            <div className="announcement-banner mb-6">
              <Megaphone size={20} />
              <div><p className="font-bold text-sm">NOTICE</p><p className="text-sm">{activeAnnouncement.message}</p></div>
            </div>
          )}
          <Notifications notifications={notifications} />
          {view === 'employee' && (
            <EmployeeView user={user} requests={requests} formData={formData} setFormData={setFormData}
              submitRequest={submitRequest} amITermTime={amITermTime} myStats={myStats}
              myDaysTaken={myDaysTaken} myAllowance={myAllowance} myTOILBalance={myTOILBalance}
              currentHolidayYear={currentHolidayYear} myCarryForwardDays={myCarryForwardDays}
              termDates={termDates} myWorkingDays={myWorkingDays} systemSettings={systemSettings} />
          )}
          {view === 'dept-head' && canManage && (
            <DeptHeadView requests={requests} staffList={staffList} myDept={myDept} isAdmin={isAdmin}
              handleApproval={handleApproval} handleManualAdd={handleManualAdd}
              manualLeave={manualLeave} setManualLeave={setManualLeave}
              handleStaffSelect={handleStaffSelect} getLeaveTaken={getLeaveTaken}
              getTOILBalance={getTOILBalance} updateStaffTarget={updateStaffTarget}
              currentHolidayYear={currentHolidayYear} termDates={termDates}
              schoolTerms={schoolTerms}
              pendingApprovalId={pendingApprovalId} setPendingApprovalId={setPendingApprovalId}
              systemSettings={systemSettings} />
          )}
          {view === 'admin' && isAdmin && (
            <AdminView staffList={staffList} requests={requests} departments={departments}
              termDates={termDates} announcements={announcements}
              newStaff={newStaff} setNewStaff={setNewStaff}
              adminEditId={adminEditId} setAdminEditId={setAdminEditId}
              saveStaff={saveStaff} handleManualAdd={handleManualAdd}
              manualLeave={manualLeave} setManualLeave={setManualLeave}
              handleStaffSelect={handleStaffSelect} deleteRequest={deleteRequest}
              handleApproval={handleApproval} getTOILBalance={getTOILBalance}
              newDeptName={newDeptName} setNewDeptName={setNewDeptName}
              addDepartment={addDepartment} deleteDepartment={deleteDepartment}
              newTermDate={newTermDate} setNewTermDate={setNewTermDate}
              addTermDate={addTermDate} deleteTermDate={deleteTermDate}
              schoolTerms={schoolTerms} newSchoolTerm={newSchoolTerm}
              setNewSchoolTerm={setNewSchoolTerm} addSchoolTerm={addSchoolTerm}
              deleteSchoolTerm={deleteSchoolTerm}
              importBankHolidays={importBankHolidays} newAnnouncement={newAnnouncement}
              setNewAnnouncement={setNewAnnouncement} postAnnouncement={postAnnouncement}
              deleteAnnouncement={deleteAnnouncement} showArchived={showArchived}
              setShowArchived={setShowArchived} prepareEdit={prepareEdit}
              toggleArchiveStaff={toggleArchiveStaff}
              permanentlyDeleteStaff={permanentlyDeleteStaff}
              organizationId={user?.organization}
              organizationName={user?.organizationName}
              searchResults={searchResults}
              searchDirectory={searchDirectory} selectDirectoryUser={selectDirectoryUser}
              systemSettings={systemSettings} updateSystemSettings={updateSystemSettings}
              currentHolidayYear={currentHolidayYear}
              calculateCarryForwardData={calculateCarryForwardData}
              applyCarryForward={applyCarryForward}
              getYearStartForClosingDate={getYearStartForClosingDate}
              exportStaffCSV={exportStaffCSV}
              exportRequestsCSV={exportRequestsCSV}
              handleBulkImport={handleBulkImport}
              handleDeleteSilentImports={handleDeleteSilentImports}
              silentImportCount={requests.filter(r => r.importedSilently === true).length}
              supabase={supabase}
              user={user} />
          )}
          {view === 'calendar' && (
            <div className={isCalendarExpanded ? "fixed inset-0 z-[100] bg-white p-4 overflow-auto" : "relative"}>
              <div className="flex justify-end mb-2">
                <button 
                  onClick={() => setIsCalendarExpanded(!isCalendarExpanded)}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 rounded-lg hover:bg-emerald-200 transition-colors shadow-sm"
                  title={isCalendarExpanded ? "Close Full Screen" : "Pop Out Calendar"}
                >
                  {isCalendarExpanded ? (
                    <><Minimize2 size={16} /> Exit Full Screen</>
                  ) : (
                    <><Maximize2 size={16} /> Pop Out Full Screen</>
                  )}
                </button>
              </div>
              <CalendarView calDate={calDate} setCalDate={setCalDate}
                calViewMode={calViewMode} setCalViewMode={setCalViewMode}
                selectedDate={selectedDate} setSelectedDate={setSelectedDate}
                requests={requests} staffList={staffList} termDates={termDates}
                schoolTerms={schoolTerms} bankHolidays={bankHolidays}
                isAdmin={isAdmin} user={user} deleteRequest={deleteRequest}
                myRole={effectiveRole} myDept={myDept} />
            </div>
          )}
          {view === 'analytics' && canManage && analyticsData && (
            <AnalyticsView analyticsData={analyticsData} departments={departments}
              isAdmin={isAdmin} selectedDeptFilter={selectedDeptFilter}
              setSelectedDeptFilter={setSelectedDeptFilter}
              currentHolidayYear={currentHolidayYear}
              requests={requests} staffList={staffList} myDept={myDept}
              termDates={termDates} />
          )}
        </div>
          </>
        )}
      </div>
      {/* Reusable destructive-action confirmation modal — rendered last so it
          overlays everything else. Triggered via askConfirm({...}). */}
      {confirmModal}
      </OrganizationProvider>
    </ErrorBoundary>
  );
};

export default App;

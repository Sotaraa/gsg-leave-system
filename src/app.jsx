import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { db } from './firebase.js';
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc,
  query, where, getDocs, writeBatch, setDoc
} from 'firebase/firestore';
import { Megaphone, Maximize2, Minimize2 } from 'lucide-react';
import { logoutEntra } from './services/entraAuth';

import CONFIG from './config.js';
import { generateUKBankHolidays, calculateWorkingDays, formatDateUK, sendEmail } from './utils/helpers.js';
import { useAuth } from './services/auth.js';
import { api } from './services/api.js';
import { supabase } from './supabase.js';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import Sidebar from './components/Sidebar.jsx';
import Notifications from './components/Notifications.jsx';
import EmployeeView from './components/views/EmployeeView.jsx';
import DeptHeadView from './components/views/DeptHeadView.jsx';
import AdminView from './components/views/AdminView.jsx';
import CalendarView from './components/views/CalendarView.jsx';
import AnalyticsView from './components/views/AnalyticsView.jsx';

const subCol = (name) => collection(db, 'artifacts', 'gardener-schools-leave-v1', 'public', 'data', name);

const INACTIVITY_LIMIT_MS = 10 * 60 * 1000;
const WARNING_BEFORE_MS = 60 * 1000;

const App = () => {
  const { user: authUser, loading: authLoading } = useAuth();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState('employee');
  const [myRole, setMyRole] = useState('Staff');
  const [myDept, setMyDept] = useState('');
  const [myAllowance, setMyAllowance] = useState(CONFIG.defaultAllowance);
  const [amITermTime, setAmITermTime] = useState(false);
  const [myWorkingDays, setMyWorkingDays] = useState([1, 2, 3, 4, 5]);
  const [graphToken, setGraphToken] = useState(null);

  const [staffList, setStaffList] = useState([]);
  const [requests, setRequests] = useState([]);
  const [departments, setDepartments] = useState(CONFIG.defaultDepartments);
  const [termDates, setTermDates] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [bankHolidays, setBankHolidays] = useState([]);

  const [systemSettings, setSystemSettings] = useState({ defaultAllowance: CONFIG.defaultAllowance });
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
  const [schoolTerms, setSchoolTerms] = useState([]);
  const [newSchoolTerm, setNewSchoolTerm] = useState({ academicYear: '', autumnStart: '', autumnEnd: '', autumnHalfTermStart: '', autumnHalfTermEnd: '', springStart: '', springEnd: '', springHalfTermStart: '', springHalfTermEnd: '', summerStart: '', summerEnd: '', summerHalfTermStart: '', summerHalfTermEnd: '' });
  const [newAnnouncement, setNewAnnouncement] = useState({ message: '', expiry: '' });

  // ─── INACTIVITY LOGOUT ────────────────────────────────────────────────────
  const inactivityTimer = useRef(null);
  const warningTimer = useRef(null);

  const handleLogout = useCallback(async () => {
    setShowInactivityWarning(false);
    const authMethod = localStorage.getItem('GSG_AUTH_METHOD');

    // Clear auth localStorage
    localStorage.removeItem('GSG_USER_EMAIL');
    localStorage.removeItem('GSG_USER_NAME');
    localStorage.removeItem('GSG_AUTH_METHOD');

    // Logout from Entra if logged in via Entra
    if (authMethod === 'entra') {
      try {
        await logoutEntra();
      } catch (err) {
        console.error('Entra logout error:', err);
      }
    }

    setGraphToken(null);
    setUser(null);
    window.location.reload();
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (!user) return;
    setShowInactivityWarning(false);
    clearTimeout(inactivityTimer.current);
    clearTimeout(warningTimer.current);
    warningTimer.current = setTimeout(() => setShowInactivityWarning(true), INACTIVITY_LIMIT_MS - WARNING_BEFORE_MS);
    inactivityTimer.current = setTimeout(() => handleLogout(), INACTIVITY_LIMIT_MS);
  }, [user, handleLogout]);

  useEffect(() => {
    if (!user) return;
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(e => window.addEventListener(e, resetInactivityTimer));
    resetInactivityTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetInactivityTimer));
      clearTimeout(inactivityTimer.current);
      clearTimeout(warningTimer.current);
    };
  }, [user, resetInactivityTimer]);

  // ─── INIT ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const currentYear = new Date().getFullYear();
    setBankHolidays([...generateUKBankHolidays(currentYear), ...generateUKBankHolidays(currentYear + 1)]);
  }, []);

  useEffect(() => {
    setUser(authUser);
    if (!authLoading) {
      setIsLoading(false);
    }
  }, [authUser, authLoading]);

  useEffect(() => {
    if (!user) return;
    const unsubStaff = onSnapshot(subCol('staff'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setStaffList(list);
      const profile = list.find(s => s.email?.toLowerCase() === user.email?.toLowerCase());
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
      setIsLoading(false);
    }, (err) => { console.error(err); setIsLoading(false); });

    const unsubReqs = onSnapshot(subCol('requests'), (snap) => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || '')));
    });

    const unsubDepts = onSnapshot(subCol('departments'), (snap) => {
      const custom = snap.docs.map(d => d.data().name);
      setDepartments([...new Set([...CONFIG.defaultDepartments, ...custom])].sort());
    });

    const unsubDates = onSnapshot(subCol('termDates'), (snap) => setTermDates(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubSchoolTerms = onSnapshot(subCol('schoolTerms'), (snap) => setSchoolTerms(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.academicYear || '').localeCompare(b.academicYear || ''))));
    const unsubAnnounce = onSnapshot(subCol('announcements'), (snap) => setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubSettings = onSnapshot(
      doc(db, 'artifacts', 'gardener-schools-leave-v1', 'public', 'data', 'settings', 'global'),
      (snap) => { if (snap.exists()) setSystemSettings(prev => ({ ...prev, ...snap.data() })); }
    );

    return () => { unsubStaff(); unsubReqs(); unsubDepts(); unsubDates(); unsubSchoolTerms(); unsubAnnounce(); unsubSettings(); };
  }, [user]);

  const addNotification = (msg) => {
    const id = Date.now();
    setNotifications(p => [...p, { id, msg }]);
    setTimeout(() => setNotifications(p => p.filter(n => n.id !== id)), 4000);
  };

  // ─── EMAIL HELPERS ────────────────────────────────────────────────────────
  const getDeptHeadEmails = (dept) =>
    staffList
      .filter(s => s.role === 'Dept Head' && s.department === dept && !s.isArchived)
      .map(s => s.email);

  const getAdminEmailsForDept = (dept) => {
    const adminInDept = staffList
      .filter(s => !s.isArchived && (
        CONFIG.superAdmins.some(a => a.toLowerCase() === s.email?.toLowerCase()) ||
        s.role === 'Admin'
      ) && s.department === dept)
      .map(s => s.email);
    return adminInDept;
  };

  const getNotificationRecipients = (dept) => {
    const deptHeads = getDeptHeadEmails(dept);
    const adminsInDept = getAdminEmailsForDept(dept);
    return [...new Set([...deptHeads, ...adminsInDept])];
  };

  const isEmailArchived = (email) => {
    const staff = staffList.find(s => s.email?.toLowerCase() === email?.toLowerCase());
    return staff ? staff.isArchived : false;
  };

  const currentHolidayYear = useMemo(() => {
    const m = (systemSettings.holidayYearStartMonth || 9) - 1; 
    const d = systemSettings.holidayYearStartDay || 1;
    const now = new Date();
    let startYear = now.getFullYear();
    if (now < new Date(startYear, m, d)) startYear -= 1;
    const s = new Date(startYear, m, d);
    const e = new Date(startYear + 1, m, d);
    e.setDate(e.getDate() - 1); 
    const fmt = (dt) => dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return {
      start: s.toISOString().split('T')[0],
      end: e.toISOString().split('T')[0],
      label: `${fmt(s)} to ${fmt(e)}`
    };
  }, [systemSettings.holidayYearStartMonth, systemSettings.holidayYearStartDay]);

  const getLeaveTaken = useCallback((email, isTT) => {
    if (!email) return 0;
    return requests.filter(r =>
      r.employeeEmail === email &&
      r.status === 'Approved' &&
      (isTT ? r.type === CONFIG.termTimeWorkType : r.type === 'Annual Leave') &&
      r.startDate >= currentHolidayYear.start &&
      r.startDate <= currentHolidayYear.end
    ).reduce((t, r) => t + Number(r.daysCount || 0), 0);
  }, [requests, currentHolidayYear]);

  const getTOILBalance = useCallback((email, staffTarget, staffHoursPerDay, isTermTime = true) => {
    const hpd = Number(staffHoursPerDay || systemSettings?.hoursPerDay || CONFIG.defaultHoursPerDay);
    const baseTarget = isTermTime
      ? (Number((staffTarget != null && staffTarget > 0 ? staffTarget : null) ?? systemSettings?.termTimeDaysTarget ?? 30) || 30)
      : 0;
    const empty = { accrued: 0, used: 0, credit: 0, balance: 0, toilBalance: 0, daysOwed: 0, target: baseTarget, effectiveTarget: baseTarget, termTimeLeaveTaken: 0, remainingToWork: baseTarget, hoursPerDay: hpd, accruedHours: 0, usedHours: 0, creditHours: 0, isTermTime };
    if (!email || !currentHolidayYear?.start) return empty;
    const approved = requests.filter(r =>
      r.employeeEmail === email &&
      r.status === 'Approved' &&
      r.startDate >= currentHolidayYear.start &&
      r.startDate <= currentHolidayYear.end
    );
    const accrued = isTermTime
      ? approved.filter(r => r.type === CONFIG.termTimeWorkType || r.type === CONFIG._legacyTermTimeWorkType).reduce((t, r) => t + (Number(r.daysCount) || 0), 0)
      : approved.filter(r => r.type === CONFIG.extraHoursType).reduce((t, r) => t + (Number(r.daysCount) || 0), 0);
    const used = approved
      .filter(r => r.type === CONFIG.toiLeaveType || r.approvalSubType === 'TOIL')
      .reduce((t, r) => t + (Number(r.daysCount) || 0), 0);
    const termTimeLeaveTaken = isTermTime
      ? approved.filter(r => r.type === CONFIG.termTimeLeaveType).reduce((t, r) => t + (Number(r.daysCount) || 0), 0)
      : 0;
    const effectiveTarget = baseTarget + termTimeLeaveTaken;  
    const credit   = accrued - used;                          
    const daysOwed = Math.max(0, used - accrued);             
    const round1 = (n) => Math.round(n * 10) / 10;
    return {
      accrued,
      used,
      credit,
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
  }, [requests, currentHolidayYear, systemSettings]);

  const updateStaffTarget = async (staffId, days) => {
    await updateDoc(doc(db, 'artifacts', 'gardener-schools-leave-v1', 'public', 'data', 'staff', staffId), { termTimeDaysTarget: days });
  };

  const updateSystemSettings = async (updates) => {
    await setDoc(
      doc(db, 'artifacts', 'gardener-schools-leave-v1', 'public', 'data', 'settings', 'global'),
      updates,
      { merge: true }
    );
    addNotification("Settings Saved");
  };

  const getYearStartForClosingDate = useCallback((closingDateStr) => {
    if (!closingDateStr) return currentHolidayYear.start;
    const m = (systemSettings.holidayYearStartMonth || 9) - 1; 
    const d = systemSettings.holidayYearStartDay || 1;
    const closing = new Date(closingDateStr);
    let yr = closing.getFullYear();
    if (new Date(yr, m, d) > closing) yr -= 1;
    return `${yr}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }, [systemSettings.holidayYearStartMonth, systemSettings.holidayYearStartDay, currentHolidayYear.start]);

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
    const resetDate = new Date().toISOString().split('T')[0];
    const batch = writeBatch(db);
    carryData.forEach(({ staffId, carryForward }) => {
      batch.update(
        doc(db, 'artifacts', 'gardener-schools-leave-v1', 'public', 'data', 'staff', staffId),
        { carryForwardDays: carryForward }
      );
    });
    await batch.commit();
    await setDoc(
      doc(db, 'artifacts', 'gardener-schools-leave-v1', 'public', 'data', 'settings', 'global'),
      { lastYearResetDate: resetDate, lastYearResetClosingDate: closingDateStr || resetDate },
      { merge: true }
    );
    addNotification(`Holiday year reset. Carry forward applied for ${carryData.length} staff.`);
    return true;
  };

  const getAllowanceStats = (taken, allowance, isTermTime) => {
    const remaining = allowance - taken;
    let colorClass = 'bg-[#064e3b]', textColor = 'text-emerald-700', statusText = isTermTime ? 'On Track' : 'Good Standing';
    if (!isTermTime) {
      if (remaining < 0) { colorClass = 'bg-red-800'; textColor = 'text-red-700 font-bold'; statusText = 'OVER ALLOWANCE'; }
      else if (taken / allowance >= 0.9) { colorClass = 'bg-red-600'; textColor = 'text-red-600'; statusText = 'Critical'; }
      else if (taken / allowance >= 0.75) { colorClass = 'bg-orange-500'; textColor = 'text-orange-600'; statusText = 'Low'; }
    } else {
      colorClass = 'bg-blue-600'; textColor = 'text-blue-700';
      if (remaining <= 0) { colorClass = 'bg-[#064e3b]'; textColor = 'text-emerald-700 font-bold'; statusText = 'Target Met'; }
    }
    return { remaining, colorClass, textColor, statusText };
  };

  const checkForOverlap = (email, startStr, endStr) => {
    const newStart = new Date(startStr);
    const newEnd = new Date(endStr);
    const existing = requests.filter(r => r.employeeEmail === email && r.status !== 'Rejected');
    return existing.some(r => {
      const rStart = new Date(r.startDate);
      const rEnd = new Date(r.endDate || r.startDate);
      return (newStart <= rEnd && newEnd >= rStart);
    });
  };

  // Placeholder - login is now handled by Supabase in LoginScreen.jsx
  const handleLogin = async () => {
    // This is deprecated - use Supabase auth via LoginScreen instead
  };

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
    
    // SAVE TO FIREBASE
    const { hoursWorked: _hw, sickReason: _sr, ...formFields } = formData;
    await addDoc(subCol('requests'), {
      ...formFields,
      employeeName: user.displayName || user.name,
      employeeEmail: user.email,
      department: myDept,
      status: 'Pending',
      daysCount: days,
      submittedAt: new Date().toISOString(),
      ...(useHoursMode ? { hoursWorked: hoursVal, hoursPerDay: myHpd } : {}),
      ...(formData.type === 'Sick Leave' && formData.sickReason ? { sickReason: formData.sickReason } : {})
    });
    addNotification("Request Submitted");

    const assignedApprover = myProfile?.approverEmail && !isEmailArchived(myProfile.approverEmail) ? myProfile.approverEmail : null;
    const baseRecipients = getNotificationRecipients(myDept);
    const recipients = [...new Set([...baseRecipients, ...(assignedApprover ? [assignedApprover] : [])])];

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

    await sendEmail(graphToken, recipients,
      `New Leave Request: ${user.displayName}`,
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
  };

  const handleApproval = async (id, status, approvalSubType = null) => {
    const reqForApproval = requests.find(r => r.id === id);
    if (status === 'Approved' && reqForApproval?.type === CONFIG.toiLeaveType && !approvalSubType) {
      approvalSubType = 'TOIL';
    }
    const updateData = { status };
    if (approvalSubType) updateData.approvalSubType = approvalSubType;
    await updateDoc(doc(db, 'artifacts', 'gardener-schools-leave-v1', 'public', 'data', 'requests', id), updateData);
    setPendingApprovalId(null);
    addNotification(`Request ${status}`);
    const req = requests.find(r => r.id === id);
    if (req) {
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

      if (!isEmailArchived(req.employeeEmail)) {
        await sendEmail(graphToken, [req.employeeEmail],
          `Your Leave Request has been ${status}`,
          `${emoji} Leave Request ${status}`,
          color,
          [
            { label: 'Employee', value: req.employeeName },
            { label: 'Leave Type', value: req.type },
            ...(approvalLabel ? [{ label: 'Approval Type', value: approvalLabel }] : []),
            { label: 'Start Date', value: formatDateUK(req.startDate) },
            { label: 'End Date', value: formatDateUK(req.endDate) },
            { label: 'Days', value: `${req.daysCount} day(s)` },
            { label: 'Status', value: status },
            ...empBalanceRows
          ],
          status === 'Approved'
            ? 'Your leave has been approved. Please ensure your work is covered during your absence.'
            : 'Your leave request was not approved. Please speak to your manager for more information.'
        );
      }

      const deptRecipients = getNotificationRecipients(req.department);
      await sendEmail(graphToken, deptRecipients,
        `Leave ${status}: ${req.employeeName}`,
        `${emoji} Leave Request ${status}`,
        color,
        [
          { label: 'Employee', value: req.employeeName },
          { label: 'Department', value: req.department },
          { label: 'Leave Type', value: req.type },
          ...(approvalLabel ? [{ label: 'Approval Type', value: approvalLabel }] : []),
          { label: 'Start Date', value: formatDateUK(req.startDate) },
          { label: 'End Date', value: formatDateUK(req.endDate) },
          { label: 'Days', value: `${req.daysCount} day(s)` },
          { label: 'Decision By', value: user.displayName },
          { label: 'Status', value: status },
          ...empBalanceRows
        ],
        'This is a record of the leave decision made in the GSG HR Portal.'
      );
    }
  };

  const deleteRequest = async (id) => {
    if (confirm("Delete this request?")) {
      const req = requests.find(r => r.id === id);
      await deleteDoc(doc(db, 'artifacts', 'gardener-schools-leave-v1', 'public', 'data', 'requests', id));
      addNotification("Deleted");
      if (req) {
        const allRecipients = [...new Set([req.employeeEmail, ...getNotificationRecipients(req.department)])];
        const activeRecipients = allRecipients.filter(email => !isEmailArchived(email));
        await sendEmail(graphToken, activeRecipients,
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
          'This leave record has been removed from the GSG HR Portal.'
        );
      }
    }
  };

  const saveStaff = async (e) => {
    e.preventDefault();
    const data = { ...newStaff, allowance: Number(newStaff.allowance) };
    if (adminEditId) {
      await updateDoc(doc(db, 'artifacts', 'gardener-schools-leave-v1', 'public', 'data', 'staff', adminEditId), data);
    } else {
      await addDoc(subCol('staff'), { ...data, isArchived: false });
    }
    addNotification("Staff Saved");
    setNewStaff({ name: '', email: '', department: departments[0], role: 'Staff', allowance: systemSettings.defaultAllowance, isTermTime: false, approverEmail: '', carryForwardDays: 0, termTimeDaysTarget: 0, workingDays: [], hoursPerDay: null });
    setAdminEditId(null);
  };

  const handleManualAdd = async (e) => {
    e.preventDefault();
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
      employeeName: staff.name, // Ensure full name is preserved
      employeeEmail: staff.email, 
      department: staff.department,
      type: manualLeave.type, startDate: manualLeave.startDate, endDate: manualLeave.endDate,
      isHalfDay: manualLeave.isHalfDay,
      status: 'Approved', daysCount: days, submittedAt: new Date().toISOString(),
      ...(useHoursMode ? { hoursWorked: hoursEntered, hoursPerDay: hpd } : {}),
      ...(manualLeave.sickReason && manualLeave.type === 'Sick Leave' ? { sickReason: manualLeave.sickReason } : {})
    };
    if (manualLeave.approvalSubType) manualRecord.approvalSubType = manualLeave.approvalSubType;
    await addDoc(subCol('requests'), manualRecord);
    addNotification("Absence Recorded");

    if (!manualLeave.silentEmail) {
      const allRecipients = [...new Set([staff.email, ...getNotificationRecipients(staff.department)])];
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
        'This absence has been manually recorded in the GSG HR Portal by an administrator.'
      );
    }
    setManualLeave(p => ({ ...p, silentEmail: false, hoursWorked: '', sickReason: '' })); 
  };

  const handleDeleteSilentImports = async () => {
    const silentRecords = requests.filter(r => r.importedSilently === true);
    if (!silentRecords.length) return alert('No silently imported records found to delete.');
    if (!confirm(`This will permanently delete all ${silentRecords.length} silently imported record${silentRecords.length !== 1 ? 's' : ''}. This cannot be undone — continue?`)) return;
    const batch = writeBatch(db);
    silentRecords.forEach(r => {
      batch.delete(doc(db, 'artifacts', 'gardener-schools-leave-v1', 'public', 'data', 'requests', r.id));
    });
    await batch.commit();
    addNotification(`${silentRecords.length} imported record${silentRecords.length !== 1 ? 's' : ''} deleted`);
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
        await addDoc(subCol('requests'), {
          employeeName: staff.name, employeeEmail: staff.email, department: staff.department,
          type: rec.type || 'Annual Leave', startDate: rec.startDate, endDate,
          isHalfDay: false, status: 'Approved', daysCount: days,
          submittedAt: new Date().toISOString(), importedSilently: true
        });
        results.imported++;
      } catch (err) {
        results.errors.push(`${rec.email} (${rec.startDate}): ${err.message}`);
        results.skipped++;
      }
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
    if (!query || query.length < 3) return;
    if (!graphToken) return alert("Please re-login to search directory");
    setIsSearching(true);
    try {
      const response = await fetch(`https://graph.microsoft.com/v1.0/users?$filter=startswith(displayName,'${query}')&$select=displayName,mail,department,jobTitle&$top=5`, { headers: { Authorization: `Bearer ${graphToken}` } });
      const data = await response.json();
      setSearchResults(data.value || []);
    } catch { setSearchResults([]); }
    setIsSearching(false);
  };

  const selectDirectoryUser = (u) => {
    setNewStaff({ ...newStaff, name: u.displayName, email: u.mail || '', department: u.department || departments[0] });
    setSearchResults([]);
  };

  const toggleArchiveStaff = async (id, currentStatus) => {
    if (confirm(currentStatus ? "Restore this user?" : "Archive this user?")) {
      await updateDoc(doc(db, 'artifacts', 'gardener-schools-leave-v1', 'public', 'data', 'staff', id), { isArchived: !currentStatus });
      addNotification(currentStatus ? "User Restored" : "User Archived");
    }
  };

  const permanentlyDeleteStaff = async (id, name) => {
    if (!confirm(`⚠️ PERMANENTLY DELETE ${name}?\n\nThis will remove them from the system completely. This cannot be undone.\n\nAre you absolutely sure?`)) return;
    await deleteDoc(doc(db, 'artifacts', 'gardener-schools-leave-v1', 'public', 'data', 'staff', id));
    addNotification(`${name} permanently deleted`);
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
    await addDoc(subCol('departments'), { name: newDeptName });
    addNotification("Department Added");
    setNewDeptName('');
  };

  const deleteDepartment = async (name) => {
    if (CONFIG.defaultDepartments.includes(name)) return alert("Cannot delete default.");
    if (confirm(`Delete ${name}?`)) {
      const snap = await getDocs(query(subCol('departments'), where('name', '==', name)));
      snap.forEach(d => deleteDoc(d.ref));
      addNotification("Department Deleted");
    }
  };

  const addTermDate = async () => {
    if (!newTermDate.date || !newTermDate.description) return;
    await addDoc(subCol('termDates'), newTermDate);
    addNotification("Date Added");
    setNewTermDate({ description: '', date: '', type: 'Term Start' });
  };

  const deleteTermDate = async (id) => {
    if (confirm("Delete date?")) {
      await deleteDoc(doc(db, 'artifacts', 'gardener-schools-leave-v1', 'public', 'data', 'termDates', id));
      addNotification("Deleted");
    }
  };

  const addSchoolTerm = async () => {
    if (!newSchoolTerm.autumnStart) return;
    const year = newSchoolTerm.autumnStart.substring(0, 4);
    const label = newSchoolTerm.academicYear || `${year}-${Number(year) + 1}`;
    await addDoc(subCol('schoolTerms'), { ...newSchoolTerm, academicYear: label });
    addNotification("School term added");
    setNewSchoolTerm({ academicYear: '', autumnStart: '', autumnEnd: '', autumnHalfTermStart: '', autumnHalfTermEnd: '', springStart: '', springEnd: '', springHalfTermStart: '', springHalfTermEnd: '', summerStart: '', summerEnd: '', summerHalfTermStart: '', summerHalfTermEnd: '' });
  };

  const deleteSchoolTerm = async (id) => {
    if (confirm("Delete this school year's term dates?")) {
      await deleteDoc(doc(db, 'artifacts', 'gardener-schools-leave-v1', 'public', 'data', 'schoolTerms', id));
      addNotification("School term deleted");
    }
  };

  const importBankHolidays = async () => {
    if (!confirm("Import UK Holidays?")) return;
    const hols = generateUKBankHolidays(2025).concat(generateUKBankHolidays(2026));
    const batch = writeBatch(db);
    hols.forEach(h => batch.set(doc(subCol('termDates')), h));
    await batch.commit();
    addNotification("Holidays Imported");
  };

  const postAnnouncement = async (e) => {
    e.preventDefault();
    if (!newAnnouncement.message) return;
    await addDoc(subCol('announcements'), { ...newAnnouncement, date: new Date().toISOString() });
    addNotification("Posted");
    setNewAnnouncement({ message: '', expiry: '' });
  };

  const deleteAnnouncement = async (id) => {
    if (confirm("Delete?")) {
      await deleteDoc(doc(db, 'artifacts', 'gardener-schools-leave-v1', 'public', 'data', 'announcements', id));
    }
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
    const isAdmin = myRole === 'Admin';
    const canManage = myRole === 'Dept Head' || isAdmin;
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
  }, [requests, staffList, selectedDeptFilter, myRole, myDept, currentHolidayYear, systemSettings]);

  if (isLoading) return <div className="h-screen flex items-center justify-center text-emerald-800 font-bold">Connecting...</div>;
  if (!user) return <LoginScreen onLogin={handleLogin} error={loginError} />;

  const isAdmin = myRole === 'Admin';
  const canManage = myRole === 'Dept Head' || isAdmin;
  const myProfile = staffList.find(s => s.email?.toLowerCase() === user?.email?.toLowerCase());
  const myCarryForwardDays = myProfile?.carryForwardDays || 0;
  const myTOILBalance = getTOILBalance(user?.email, myProfile?.termTimeDaysTarget, myProfile?.hoursPerDay, amITermTime);
  const myDaysTaken = amITermTime ? 0 : getLeaveTaken(user?.email, false);
  const myStats = getAllowanceStats(myDaysTaken, myAllowance, false);
  const activeAnnouncement = announcements[0];

  return (
    <ErrorBoundary>
      <div className="app-container">

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

        <Sidebar view={view} setView={setView} myRole={myRole} />
        <div className="main-content" style={{ paddingTop: showInactivityWarning ? '60px' : undefined }}>
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
              silentImportCount={requests.filter(r => r.importedSilently === true).length} />
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
                myRole={myRole} myDept={myDept} />
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
      </div>
    </ErrorBoundary>
  );
};

export default App;

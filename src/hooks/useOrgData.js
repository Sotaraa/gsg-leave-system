import { useState, useEffect } from 'react';
import * as supabaseApi from '../services/supabaseApi.js';
import CONFIG from '../config.js';
import { logger } from '../utils/logger.js';

/**
 * Loads ALL organisation-scoped data (staff, requests, departments, term
 * dates, school terms, announcements, settings) for the given org and
 * keeps it fresh via Supabase real-time listeners.
 *
 * Call once at the top of <App>. The hook owns the data state — the
 * caller derives anything personal (e.g. `myRole`, `myDept`) from
 * `staffList` separately.
 *
 * Switching `effectiveOrgId` (e.g. when a super admin enters God Mode)
 * automatically tears down listeners and reloads everything for the new
 * org.
 *
 * @param {object|null} user
 * @param {string|null} effectiveOrgId
 * @returns {{
 *   staffList:       object[],
 *   requests:        object[],
 *   departments:     string[],
 *   termDates:       object[],
 *   schoolTerms:     object[],
 *   announcements:   object[],
 *   systemSettings:  object,
 *   isLoading:       boolean,
 * }}
 */
export const useOrgData = (user, effectiveOrgId) => {
  const [staffList,      setStaffList]      = useState([]);
  const [requests,       setRequests]       = useState([]);
  const [departments,    setDepartments]    = useState(CONFIG.defaultDepartments);
  const [termDates,      setTermDates]      = useState([]);
  const [schoolTerms,    setSchoolTerms]    = useState([]);
  const [announcements,  setAnnouncements]  = useState([]);
  const [systemSettings, setSystemSettings] = useState({ defaultAllowance: CONFIG.defaultAllowance });
  const [isLoading,      setIsLoading]      = useState(true);

  useEffect(() => {
    if (!user) return;
    const orgId = effectiveOrgId || user.organization;
    if (!orgId) return;

    const subscriptions = [];
    let isUnmounting = false;

    (async () => {
      try {
        logger.log(`Loading data for organization: ${orgId}`);

        const [
          staffData, requestsData, deptsData,
          termDatesData, schoolTermsData, announcementsData, settingsData,
        ] = await Promise.all([
          supabaseApi.staffApi.getStaffList(orgId),
          supabaseApi.requestsApi.getAllRequests(orgId),
          supabaseApi.departmentsApi.getDepartments(orgId),
          supabaseApi.termDatesApi.getTermDates(orgId),
          supabaseApi.schoolTermsApi.getSchoolTerms(orgId),
          supabaseApi.announcementsApi.getAnnouncements(orgId),
          supabaseApi.settingsApi.getSettings(orgId),
        ]);

        if (isUnmounting) return;

        setStaffList(staffData.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
        setRequests(requestsData.sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || '')));
        setDepartments([...new Set([...CONFIG.defaultDepartments, ...deptsData.map(d => d.name)])].sort());
        setTermDates(termDatesData);
        setSchoolTerms(schoolTermsData.sort((a, b) => (a.academicYear || '').localeCompare(b.academicYear || '')));
        setAnnouncements(announcementsData);
        setSystemSettings(prev => ({ ...prev, ...settingsData }));
        setIsLoading(false);
        logger.log(`Data loaded for ${orgId}`);

        // Real-time listeners — every org-scoped table is wired up so the UI
        // updates instantly when data changes (no manual refresh needed).
        const realtimeSubs = supabaseApi.setupRealtimeListeners(orgId, {
          onStaffChange: async () => {
            const updated = await supabaseApi.staffApi.getStaffList(orgId);
            if (!isUnmounting) setStaffList(updated.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
          },
          onRequestsChange: async () => {
            const updated = await supabaseApi.requestsApi.getAllRequests(orgId);
            if (!isUnmounting) setRequests(updated.sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || '')));
          },
          onDepartmentsChange: async () => {
            const updated = await supabaseApi.departmentsApi.getDepartments(orgId);
            if (!isUnmounting) {
              setDepartments([...new Set([...CONFIG.defaultDepartments, ...updated.map(d => d.name)])].sort());
            }
          },
          onTermDatesChange: async () => {
            const updated = await supabaseApi.termDatesApi.getTermDates(orgId);
            if (!isUnmounting) setTermDates(updated);
          },
          onSchoolTermsChange: async () => {
            const updated = await supabaseApi.schoolTermsApi.getSchoolTerms(orgId);
            if (!isUnmounting) {
              setSchoolTerms(updated.sort((a, b) => (a.academicYear || '').localeCompare(b.academicYear || '')));
            }
          },
          onAnnouncementsChange: async () => {
            const updated = await supabaseApi.announcementsApi.getAnnouncements(orgId);
            if (!isUnmounting) setAnnouncements(updated);
          },
          onSettingsChange: async () => {
            const updated = await supabaseApi.settingsApi.getSettings(orgId);
            if (!isUnmounting) setSystemSettings(prev => ({ ...prev, ...updated }));
          },
        });
        subscriptions.push(...realtimeSubs);
      } catch (error) {
        console.error('Error loading organization data:', error);
        setIsLoading(false);
      }
    })();

    return () => {
      isUnmounting = true;
      supabaseApi.cleanupRealtimeListeners(subscriptions);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, effectiveOrgId]);

  return {
    staffList, setStaffList,
    requests, setRequests,
    departments, setDepartments,
    termDates, setTermDates,
    schoolTerms, setSchoolTerms,
    announcements, setAnnouncements,
    systemSettings, setSystemSettings,
    isLoading, setIsLoading,
  };
};

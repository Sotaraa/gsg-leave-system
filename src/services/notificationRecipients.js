import CONFIG from '../config.js';

/**
 * Resolve who should receive the "new leave request" notification.
 *
 * Order of preference:
 *   1. The submitter's assigned approverEmail (if set and not archived)
 *   2. Dept Heads in the submitter's department
 *   3. Admins in the submitter's department
 *   4. Fallback: ALL admins / super-admins in the org
 *
 * The submitter is always filtered out of the final list to avoid
 * self-notification.
 */

const isSuperAdminEmail = (email) =>
  CONFIG.superAdmins.some(a => a.toLowerCase() === email?.toLowerCase());

export const getDeptHeadEmails = (staffList, dept) =>
  staffList
    .filter(s => s.role === 'Dept Head' && s.department === dept && !s.isArchived)
    .map(s => s.email);

export const getAdminEmailsForDept = (staffList, dept) =>
  staffList
    .filter(s =>
      !s.isArchived &&
      (isSuperAdminEmail(s.email) || s.role === 'Admin') &&
      s.department === dept
    )
    .map(s => s.email);

export const getAllAdminEmails = (staffList) =>
  staffList
    .filter(s =>
      !s.isArchived &&
      (isSuperAdminEmail(s.email) || s.role === 'Admin')
    )
    .map(s => s.email);

export const isEmailArchived = (staffList, email) => {
  const staff = staffList.find(s => s.email?.toLowerCase() === email?.toLowerCase());
  return staff ? staff.isArchived : false;
};

/**
 * Returns the deduplicated list of dept-specific recipients;
 * falls back to all org admins when none are found.
 */
export const getNotificationRecipients = (staffList, dept) => {
  const deptHeads    = getDeptHeadEmails(staffList, dept);
  const adminsInDept = getAdminEmailsForDept(staffList, dept);
  const primary = [...new Set([...deptHeads, ...adminsInDept])];
  return primary.length > 0 ? primary : getAllAdminEmails(staffList);
};

/**
 * Decide who should receive a leave-request notification given the
 * submitter's profile and department. Excludes the submitter themselves.
 *
 * @param {object[]} staffList
 * @param {object|null} submitterProfile  staff record of the submitter (may be null)
 * @param {string} submitterDept
 * @param {string} submitterEmail
 * @returns {{ recipients: string[], assignedApprover: string|null }}
 */
export const resolveRecipients = (staffList, submitterProfile, submitterDept, submitterEmail) => {
  const approverEmail = submitterProfile?.approverEmail;
  const assignedApprover =
    approverEmail && !isEmailArchived(staffList, approverEmail) ? approverEmail : null;

  const raw = assignedApprover ? [assignedApprover] : getNotificationRecipients(staffList, submitterDept);
  const recipients = raw.filter(e => e?.toLowerCase() !== submitterEmail?.toLowerCase());
  return { recipients, assignedApprover };
};

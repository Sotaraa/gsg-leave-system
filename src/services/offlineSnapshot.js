/**
 * Offline Snapshot Generator
 *
 * Produces a single self-contained HTML file that summarises an
 * organisation's leave data — designed to be emailed to a client during
 * service downtime (e.g. internet outage at the school).
 *
 * The generated file:
 *   - Has no external dependencies (CSS, JS, fonts, images all inline)
 *   - Opens in any browser on any device
 *   - Prints cleanly to A4
 *   - Carries an obvious "snapshot — not live" warning so it isn't
 *     confused with the real-time app
 *
 * Sotara super admin only (call site enforces this).
 */

import CONFIG from '../config.js';

// ─── helpers ───────────────────────────────────────────────────────────────
const fmtDate    = (iso) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
const fmtDay     = (iso) => iso ? new Date(iso).toLocaleDateString('en-GB', { weekday: 'short' }) : '';
const fmtDateTime = (d)  => d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const escapeHtml = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const todayISO = () => new Date().toISOString().split('T')[0];
const addDays = (iso, days) => {
  const d = new Date(iso); d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

// ─── data shaping ──────────────────────────────────────────────────────────
const isCurrentlyOn = (req, today) => {
  const start = req.startDate;
  const end   = req.endDate || req.startDate;
  return req.status === 'Approved' && start <= today && today <= end;
};

const isInRange = (req, fromISO, toISO) => {
  const start = req.startDate;
  if (!start) return false;
  return req.status === 'Approved' && start >= fromISO && start <= toISO;
};

// ─── section renderers ────────────────────────────────────────────────────
const renderHeader = (org, generatedAt, generatedBy) => `
<header class="header">
  <h1>${escapeHtml(org.name)} — Leave Snapshot</h1>
  <div class="meta">
    Generated <strong>${escapeHtml(fmtDateTime(generatedAt))}</strong>
    by ${escapeHtml(generatedBy || 'Sotara support')}
  </div>
  <div class="warning">
    <strong>This is a static snapshot</strong> — it will not update automatically.
    For live data, sign in to LeaveHub once your service is restored.
  </div>
</header>`;

const renderStats = ({ staff, pending, currentlyOn, thisWeek }) => `
<section class="stats">
  <div class="stat"><div class="stat-num">${staff}</div><div class="stat-label">Active staff</div></div>
  <div class="stat"><div class="stat-num">${pending}</div><div class="stat-label">Pending approvals</div></div>
  <div class="stat"><div class="stat-num">${currentlyOn}</div><div class="stat-label">On leave today</div></div>
  <div class="stat"><div class="stat-num">${thisWeek}</div><div class="stat-label">Off this week</div></div>
</section>`;

const renderPending = (pending) => {
  if (pending.length === 0) {
    return `<section><h2>Pending approvals</h2><p class="empty">Nothing waiting for approval.</p></section>`;
  }
  const rows = pending.map(r => `
    <tr>
      <td>${escapeHtml(r.employeeName)}</td>
      <td>${escapeHtml(r.department || '')}</td>
      <td>${escapeHtml(r.type)}</td>
      <td>${escapeHtml(fmtDate(r.startDate))}</td>
      <td>${escapeHtml(r.isHalfDay ? 'Half day' : fmtDate(r.endDate || r.startDate))}</td>
      <td class="num">${escapeHtml(String(r.daysCount ?? ''))}</td>
      <td>${escapeHtml(fmtDate(r.submittedAt))}</td>
    </tr>`).join('');
  return `<section>
    <h2>Pending approvals (${pending.length})</h2>
    <table>
      <thead><tr><th>Employee</th><th>Dept</th><th>Type</th><th>Start</th><th>End</th><th>Days</th><th>Submitted</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
};

const renderCurrentlyOn = (current) => {
  if (current.length === 0) {
    return `<section><h2>Currently on leave</h2><p class="empty">Nobody is on leave today.</p></section>`;
  }
  const rows = current.map(r => `
    <tr>
      <td>${escapeHtml(r.employeeName)}</td>
      <td>${escapeHtml(r.department || '')}</td>
      <td>${escapeHtml(r.type)}</td>
      <td>${escapeHtml(fmtDate(r.startDate))} → ${escapeHtml(fmtDate(r.endDate || r.startDate))}</td>
    </tr>`).join('');
  return `<section>
    <h2>Currently on leave (${current.length})</h2>
    <table>
      <thead><tr><th>Employee</th><th>Dept</th><th>Type</th><th>Period</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
};

const renderUpcoming = (upcoming) => {
  if (upcoming.length === 0) {
    return `<section><h2>Upcoming leave (next 4 weeks)</h2><p class="empty">No upcoming leave booked.</p></section>`;
  }
  const rows = upcoming.map(r => `
    <tr>
      <td>${escapeHtml(fmtDay(r.startDate))} ${escapeHtml(fmtDate(r.startDate))}</td>
      <td>${escapeHtml(r.employeeName)}</td>
      <td>${escapeHtml(r.department || '')}</td>
      <td>${escapeHtml(r.type)}</td>
      <td>${escapeHtml(r.isHalfDay ? 'Half day' : fmtDate(r.endDate || r.startDate))}</td>
      <td class="num">${escapeHtml(String(r.daysCount ?? ''))}</td>
    </tr>`).join('');
  return `<section>
    <h2>Upcoming leave (next 4 weeks)</h2>
    <table>
      <thead><tr><th>Start</th><th>Employee</th><th>Dept</th><th>Type</th><th>End</th><th>Days</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
};

const renderStaffRegister = (staff, requests, holidayYear, settings) => {
  const isSuper = (e) => CONFIG.superAdmins.some(a => a.toLowerCase() === e?.toLowerCase());
  const rows = staff
    .filter(s => !s.isArchived)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    .map(s => {
      const role = isSuper(s.email) ? 'Admin' : (s.role || 'Staff');
      const allowance = (Number(s.allowance) || 0) + (Number(s.carryForwardDays) || 0);
      // Annual leave taken in current holiday year
      const taken = requests.filter(r =>
        r.employeeEmail === s.email &&
        r.status === 'Approved' &&
        r.type === 'Annual Leave' &&
        r.startDate >= holidayYear.start &&
        r.startDate <= holidayYear.end
      ).reduce((t, r) => t + Number(r.daysCount || 0), 0);
      const remaining = s.isTermTime ? '—' : (allowance - taken);
      const sickDays = requests.filter(r =>
        r.employeeEmail === s.email &&
        r.status === 'Approved' &&
        r.type === 'Sick Leave' &&
        r.startDate >= holidayYear.start &&
        r.startDate <= holidayYear.end
      ).reduce((t, r) => t + Number(r.daysCount || 0), 0);
      return `
        <tr>
          <td>${escapeHtml(s.name)}</td>
          <td>${escapeHtml(s.email)}</td>
          <td>${escapeHtml(s.department || '')}</td>
          <td>${escapeHtml(role)}</td>
          <td>${s.isTermTime ? 'Term-time' : 'Standard'}</td>
          <td class="num">${s.isTermTime ? '—' : allowance}</td>
          <td class="num">${s.isTermTime ? '—' : taken}</td>
          <td class="num"><strong>${remaining}</strong></td>
          <td class="num">${sickDays || ''}</td>
          <td>${escapeHtml(s.approverEmail || '')}</td>
        </tr>`;
    }).join('');
  return `<section>
    <h2>Staff register (${staff.filter(s => !s.isArchived).length})</h2>
    <p class="hint">Annual leave figures are for ${escapeHtml(holidayYear.label)}.</p>
    <table>
      <thead>
        <tr>
          <th>Name</th><th>Email</th><th>Dept</th><th>Role</th><th>Contract</th>
          <th>Allow.</th><th>Taken</th><th>Remain.</th><th>Sick</th><th>Approver</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
};

const renderTermDates = (termDates) => {
  const today = todayISO();
  const upcoming = termDates
    .filter(t => t.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 30);
  if (upcoming.length === 0) {
    return `<section><h2>Bank holidays & term dates</h2><p class="empty">No upcoming entries.</p></section>`;
  }
  const rows = upcoming.map(t => `
    <tr>
      <td>${escapeHtml(fmtDate(t.date))}</td>
      <td>${escapeHtml(t.description)}</td>
      <td>${escapeHtml(t.type)}</td>
    </tr>`).join('');
  return `<section>
    <h2>Bank holidays & term dates (next 30)</h2>
    <table>
      <thead><tr><th>Date</th><th>Description</th><th>Type</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
};

// ─── main entry ───────────────────────────────────────────────────────────
/**
 * Build a full HTML snapshot string.
 *
 * @param {object} input
 * @param {object} input.organization     – { id, name }
 * @param {object[]} input.staffList
 * @param {object[]} input.requests
 * @param {object[]} input.termDates
 * @param {object}   input.systemSettings
 * @param {object}   input.holidayYear    – { start, end, label }
 * @param {string}   [input.generatedBy]  – e.g. 'info@sotara.co.uk'
 * @returns {string} self-contained HTML
 */
export const buildOfflineSnapshotHtml = ({
  organization,
  staffList = [],
  requests = [],
  termDates = [],
  holidayYear,
  generatedBy,
}) => {
  const today = todayISO();
  const fourWeeks = addDays(today, 28);

  const pending     = requests.filter(r => r.status === 'Pending')
                              .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
  const currentlyOn = requests.filter(r => isCurrentlyOn(r, today))
                              .sort((a, b) => (a.employeeName || '').localeCompare(b.employeeName || ''));
  const upcoming    = requests.filter(r => isInRange(r, today, fourWeeks))
                              .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
  const thisWeekEnd = addDays(today, 7);
  const thisWeek    = requests.filter(r => isInRange(r, today, thisWeekEnd)).length;

  const stats = {
    staff: staffList.filter(s => !s.isArchived).length,
    pending: pending.length,
    currentlyOn: currentlyOn.length,
    thisWeek,
  };

  const generatedAt = new Date();

  const css = `
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
           color: #111; margin: 0; padding: 24px; background: #f5f6f7; line-height: 1.45; }
    .page { max-width: 1100px; margin: 0 auto; background: #fff; padding: 32px;
            border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .header h1 { margin: 0 0 6px 0; font-size: 22px; }
    .header .meta { color: #555; font-size: 12px; margin-bottom: 14px; }
    .warning { background: #fef3c7; border: 1px solid #fcd34d; color: #78350f;
               padding: 10px 14px; border-radius: 6px; font-size: 13px; margin-bottom: 24px; }
    h2 { font-size: 16px; margin: 28px 0 10px 0; color: #064e3b;
         border-bottom: 2px solid #d1fae5; padding-bottom: 6px; }
    .empty { color: #6b7280; font-style: italic; font-size: 13px; }
    .hint  { color: #6b7280; font-size: 11px; margin: -4px 0 8px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #ecfdf5; color: #065f46; text-align: left; padding: 8px 10px;
         font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;
         border-bottom: 1px solid #d1fae5; }
    td { padding: 7px 10px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
    tr:nth-child(even) td { background: #fafbfc; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0 8px 0; }
    .stat { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;
            padding: 14px 12px; text-align: center; }
    .stat-num { font-size: 28px; font-weight: 700; color: #064e3b; line-height: 1; }
    .stat-label { font-size: 11px; color: #6b7280; margin-top: 4px;
                  text-transform: uppercase; letter-spacing: 0.5px; }
    footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb;
             font-size: 11px; color: #9ca3af; text-align: center; }
    @media print {
      body { background: #fff; padding: 0; }
      .page { box-shadow: none; padding: 16px; max-width: none; }
      h2 { page-break-after: avoid; }
      tr  { page-break-inside: avoid; }
      .stats { page-break-after: avoid; }
    }
    @media (max-width: 700px) {
      .stats { grid-template-columns: repeat(2, 1fr); }
      table { font-size: 11px; }
      td, th { padding: 6px 6px; }
    }
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(organization.name)} — Leave Snapshot ${escapeHtml(today)}</title>
  <style>${css}</style>
</head>
<body>
  <div class="page">
    ${renderHeader(organization, generatedAt, generatedBy)}
    ${renderStats(stats)}
    ${renderPending(pending)}
    ${renderCurrentlyOn(currentlyOn)}
    ${renderUpcoming(upcoming)}
    ${renderStaffRegister(staffList, requests, holidayYear, {})}
    ${renderTermDates(termDates)}
    <footer>
      Sotara LeaveHub &middot; Offline snapshot &middot; Generated by Sotara support &middot;
      For real-time data and to make changes, sign in at leavehub.sotara.co.uk
    </footer>
  </div>
</body>
</html>`;
};

/**
 * Trigger a browser download of the snapshot HTML.
 *
 * @param {string} html      – output of buildOfflineSnapshotHtml()
 * @param {string} orgId     – used for filename
 */
export const downloadSnapshotHtml = (html, orgId) => {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const date = todayISO();
  a.href = url;
  a.download = `${orgId}-leave-snapshot-${date}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after a tick so download dialog has time to grab the URL
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

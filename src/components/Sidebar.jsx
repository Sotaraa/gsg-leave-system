import React from 'react';
import { User, CheckSquare, Calendar, BarChart2, Settings, LogOut, Lock, ShieldAlert, Globe } from 'lucide-react';
import SotaraLogo from './SotaraLogo.jsx';

const Sidebar = ({ view, setView, myRole, onShowOnboarding, onLogout, userEmail, allOrgs, activeOrgId, setActiveOrgId }) => {
  const isAdmin      = myRole === 'Admin';
  const canManage    = myRole === 'Dept Head' || isAdmin;
  const isMasterAdmin = userEmail?.toLowerCase() === 'info@sotara.co.uk';

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      localStorage.removeItem('GSG_USER_EMAIL');
      localStorage.removeItem('GSG_USER_NAME');
      localStorage.removeItem('GSG_AUTH_METHOD');
      window.location.href = '/';
    }
  };

  const pages = [
    { key: 'employee',  label: 'My Dashboard', Icon: User,      always: true,    desc: 'Submit & track your leave' },
    { key: 'dept-head', label: 'Approvals',     Icon: CheckSquare, show: canManage, desc: 'Review team requests' },
    { key: 'calendar',  label: 'Calendar',      Icon: Calendar,  always: true,    desc: 'All leave & holidays' },
    { key: 'analytics', label: 'Analytics',     Icon: BarChart2, show: canManage, desc: 'Reports & insights' },
    { key: 'admin',     label: 'Admin',          Icon: Settings,  show: isAdmin,   desc: 'Staff, settings & data' },
  ];

  const activeDesc = pages.find(p => p.key === view)?.desc || '';

  return (
    <div className="sidebar">

      {/* ── Logo header ── */}
      <div className="sidebar-header" style={{
        height: 'auto',
        padding: '18px 18px 14px',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 0,
        borderBottom: '1px solid rgba(45,196,212,0.15)',
      }}>
        <SotaraLogo width={164} variant="teal" subtitle="LeaveHub" />
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(45,196,212,0.12)', width: '100%' }}>
          <span style={{
            display: 'inline-block',
            background: 'rgba(45,196,212,0.15)',
            color: '#2DC4D4',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.8px',
            padding: '2px 8px',
            borderRadius: 20,
            textTransform: 'uppercase',
          }}>{myRole}</span>
          <p style={{ color: 'rgba(180,220,230,0.5)', fontSize: 11, marginTop: 4 }}>{activeDesc}</p>
        </div>
      </div>

      {/* ── God Mode Org Switcher (super admin only) ── */}
      {isMasterAdmin && (
        <div style={{
          margin: '10px 12px',
          padding: '10px 12px',
          background: 'rgba(251,191,36,0.12)',
          border: '1px solid rgba(251,191,36,0.35)',
          borderRadius: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <ShieldAlert size={13} style={{ color: '#FCD34D', flexShrink: 0 }} />
            <span style={{ color: '#FCD34D', fontSize: 10, fontWeight: 800, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
              God Mode
            </span>
          </div>

          <select
            value={activeOrgId || ''}
            onChange={e => setActiveOrgId(e.target.value || null)}
            style={{
              width: '100%',
              background: 'rgba(10,40,71,0.8)',
              color: activeOrgId ? '#FCD34D' : 'rgba(180,220,230,0.5)',
              border: '1px solid rgba(251,191,36,0.4)',
              borderRadius: 6,
              padding: '5px 8px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="">— Sotara (own org) —</option>
            {(allOrgs || []).map(org => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>

          {activeOrgId && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
              <Globe size={10} style={{ color: '#FCD34D' }} />
              <span style={{ color: '#FCD34D', fontSize: 9, fontWeight: 700, opacity: 0.8 }}>
                Viewing as Admin
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Nav items ── */}
      <div className="sidebar-menu">
        {pages.map(({ key, label, Icon, always, show }) => {
          if (!always && !show) return null;
          return (
            <div
              key={key}
              className={`nav-item ${view === key ? 'active' : ''}`}
              onClick={() => setView(key)}
            >
              <Icon size={17} />
              {label}
            </div>
          );
        })}

        {isMasterAdmin && (
          <div
            className="nav-item"
            onClick={onShowOnboarding}
            style={{ color: '#2DC4D4', marginTop: 8, borderTop: '1px solid rgba(45,196,212,0.12)', paddingTop: 12 }}
          >
            <Lock size={17} /> Organizations
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="sidebar-footer">
        <div className="nav-item" onClick={handleLogout} style={{ color: 'rgba(255,120,120,0.8)', cursor: 'pointer' }}>
          <LogOut size={17} /> Sign Out
        </div>
      </div>
    </div>
  );
};

export default Sidebar;

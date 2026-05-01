import React from 'react';
import { User, CheckSquare, Calendar, BarChart2, Settings, LogOut, Lock } from 'lucide-react';
import SotaraLogo from './SotaraLogo.jsx';

const Sidebar = ({ view, setView, myRole, onShowOnboarding, onLogout, userEmail }) => {
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

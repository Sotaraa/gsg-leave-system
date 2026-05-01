import React from 'react';
import { User, CheckSquare, Calendar, BarChart2, Settings, LogOut, Lock } from 'lucide-react';
import LeaveHubLogo from './LeaveHubLogo.jsx';

const Sidebar = ({ view, setView, myRole, onShowOnboarding, onLogout, userEmail }) => {
  const isAdmin = myRole === 'Admin';
  const canManage = myRole === 'Dept Head' || isAdmin;
  const isMasterAdmin = userEmail?.toLowerCase() === 'info@sotara.co.uk';

  const handleLogout = () => {
    if (onLogout) {
      onLogout(); // Use proper logout from app.jsx (clears MSAL + localStorage)
    } else {
      // Fallback: clear storage and reload
      localStorage.removeItem('GSG_USER_EMAIL');
      localStorage.removeItem('GSG_USER_NAME');
      localStorage.removeItem('GSG_AUTH_METHOD');
      window.location.href = '/';
    }
  };

  const getPageDescription = () => {
    const descriptions = {
      employee: 'Submit and track your leave requests',
      'dept-head': 'Review and approve leave requests',
      calendar: 'View all leave dates and holidays',
      analytics: 'View department and leave analytics',
      admin: 'Manage staff, settings, and system data'
    };
    return descriptions[view] || '';
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header" style={{ height: 'auto', padding: '16px 20px 12px', flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
        <LeaveHubLogo width={170} />
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: '8px', width: '100%' }}>
          <p className="text-xs font-semibold" style={{ color: 'rgba(180,210,255,0.9)', letterSpacing: '0.5px' }}>{myRole}</p>
          <p className="text-xs" style={{ color: 'rgba(180,210,255,0.6)', marginTop: '2px' }}>{getPageDescription()}</p>
        </div>
      </div>
      <div className="sidebar-menu">
        <div className={`nav-item ${view === 'employee' ? 'active' : ''}`} onClick={() => setView('employee')}>
          <User size={18} /> My Dashboard
        </div>
        {canManage && (
          <div className={`nav-item ${view === 'dept-head' ? 'active' : ''}`} onClick={() => setView('dept-head')}>
            <CheckSquare size={18} /> Approvals
          </div>
        )}
        <div className={`nav-item ${view === 'calendar' ? 'active' : ''}`} onClick={() => setView('calendar')}>
          <Calendar size={18} /> Calendar
        </div>
        {canManage && (
          <div className={`nav-item ${view === 'analytics' ? 'active' : ''}`} onClick={() => setView('analytics')}>
            <BarChart2 size={18} /> Analytics
          </div>
        )}
        {isAdmin && (
          <div className={`nav-item ${view === 'admin' ? 'active' : ''}`} onClick={() => setView('admin')}>
            <Settings size={18} /> Admin
          </div>
        )}
        {isMasterAdmin && (
          <div className="nav-item text-yellow-300 hover:text-yellow-200" onClick={onShowOnboarding} style={{ cursor: 'pointer' }}>
            <Lock size={18} /> Organizations
          </div>
        )}
      </div>
      <div className="sidebar-footer">
        <div className="nav-item text-red-300" onClick={handleLogout} style={{ cursor: 'pointer' }}>
          <LogOut size={18} /> Sign Out
        </div>
      </div>
    </div>
  );
};

export default Sidebar;

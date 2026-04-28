import React from 'react';
import { User, CheckSquare, Calendar, BarChart2, Settings, LogOut, Sparkles, Lock } from 'lucide-react';

const Sidebar = ({ view, setView, myRole, onShowOnboarding }) => {
  const isAdmin = myRole === 'Admin';
  const canManage = myRole === 'Dept Head' || isAdmin;

  const handleLogout = () => {
    localStorage.removeItem('GSG_USER_EMAIL');
    window.location.href = '/';
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div>
          <h2 className="font-bold flex items-center gap-2"><Sparkles size={20} /> Sotara LeaveHub</h2>
          <p className="text-xs text-blue-200 mt-1">{myRole}</p>
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
          <>
            <div className={`nav-item ${view === 'admin' ? 'active' : ''}`} onClick={() => setView('admin')}>
              <Settings size={18} /> Admin
            </div>
            <div className="nav-item text-yellow-300 hover:text-yellow-200" onClick={onShowOnboarding} style={{ cursor: 'pointer' }}>
              <Lock size={18} /> Organizations
            </div>
          </>
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

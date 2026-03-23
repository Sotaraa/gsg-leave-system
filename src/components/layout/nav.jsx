import React from 'react';

// Use 'export default' so app.jsx can find it
export default function Nav({ currentView, setView, userRole }) {
  return (
    <nav className="bg-white border-b border-slate-200 px-8 py-4">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-8">
          <h1 className="text-xl font-bold text-slate-900">GSG Leave System</h1>
          
          <div className="flex gap-4">
            <button 
              onClick={() => setView('employee')}
              className={`px-3 py-2 rounded-md text-sm font-medium ${currentView === 'employee' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              My Portal
            </button>

            {/* Manager and Admin Tabs logic */}
            {(userRole === 'Manager' || userRole === 'Admin') && (
              <button 
                onClick={() => setView('dept-head')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${currentView === 'dept-head' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Department
              </button>
            )}

            {userRole === 'Admin' && (
              <button 
                onClick={() => setView('admin')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${currentView === 'admin' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Admin
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

import React from 'react';

export default function AdminPortal() {
  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border-t-4 border-red-600">
      <h2 className="text-xl font-bold text-slate-800">System Admin</h2>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="p-4 bg-slate-50 rounded">Total Staff: 42</div>
        <div className="p-4 bg-slate-50 rounded">Active Requests: 3</div>
      </div>
    </div>
  );
}

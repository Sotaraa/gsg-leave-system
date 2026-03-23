// src/portals/employee.jsx
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Clock, PlusCircle } from 'lucide-react';
import RequestForm from './request-form'; // <--- Import the new form

export default function EmployeePortal({ currentUser }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false); // <--- State for Modal

  useEffect(() => {
    if (currentUser?.email) loadHistory();
  }, [currentUser]);

  const loadHistory = async () => {
    const data = await api.getMyRequests(currentUser.email);
    setRequests(data);
    setLoading(false);
  };

  return (
    <div className="space-y-8 relative">
      
      {/* The Modal (Only shows when state is true) */}
      {isModalOpen && (
        <RequestForm 
          userEmail={currentUser.email}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            loadHistory(); // Refresh the table automatically
            // Ideally, show a toast notification here
          }}
        />
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Allowance</h2>
          <p className="text-3xl font-bold text-indigo-600 mt-2">{currentUser.allowance} Days</p>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Pending</h2>
          <p className="text-3xl font-bold text-amber-500 mt-2">
            {requests.filter(r => r.status === 'Pending').length}
          </p>
        </div>

        {/* The Button - Now wired up! */}
        <button 
            onClick={() => setIsModalOpen(true)}
            className="w-full bg-slate-900 text-white rounded-xl font-bold text-lg hover:bg-slate-800 transition-all shadow-lg flex flex-col items-center justify-center gap-2 py-4"
        >
            <PlusCircle size={24} /> New Request
        </button>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100"><h3 className="font-bold text-slate-800">History</h3></div>
        
        {loading ? <div className="p-10 text-center text-slate-400">Loading...</div> : 
        requests.length === 0 ? <div className="p-10 text-center text-slate-400">No requests found.</div> :
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                    <tr>
                        <th className="px-6 py-3">Type</th>
                        <th className="px-6 py-3">Start Date</th>
                        <th className="px-6 py-3">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {requests.map(req => (
                        <tr key={req.id}>
                            <td className="px-6 py-4 font-medium">{req.type}</td>
                            <td className="px-6 py-4 text-slate-500">{req.startDate}</td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                    req.status === 'Approved' ? 'bg-green-100 text-green-700' : 
                                    req.status === 'Rejected' ? 'bg-red-100 text-red-700' : 
                                    'bg-amber-100 text-amber-700'
                                }`}>
                                    {req.status}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        }
      </div>
    </div>
  );
}

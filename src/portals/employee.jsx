// src/portals/employee.jsx
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Clock, PlusCircle, Calendar } from 'lucide-react';
import RequestForm from './request-form'; 

export default function EmployeePortal({ currentUser }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
      
      {isModalOpen && (
        <RequestForm 
          userEmail={currentUser.email}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            loadHistory();
            setIsModalOpen(false); // Close modal on success
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
                        <th className="px-6 py-3">Dates</th>
                        <th className="px-6 py-3 text-center">Days</th>
                        <th className="px-6 py-3">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {requests.map(req => (
                        <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4">
                              <span className="font-medium text-slate-900">{req.type}</span>
                              {req.isHalfDay && <span className="ml-2 text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded uppercase font-bold">Half Day</span>}
                            </td>
                            <td className="px-6 py-4 text-slate-500">
                              <div className="flex items-center gap-1">
                                <Calendar size={12} />
                                {req.startDate}
                                {req.endDate && req.endDate !== req.startDate && ` → ${req.endDate}`}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center font-bold text-slate-700">
                              {req.daysCount}
                            </td>
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

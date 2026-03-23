import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Check, X, User, Calendar, ShieldCheck } from 'lucide-react';

export default function ManagerPortal({ currentUser }) {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only load if user has a department
    if (currentUser?.department) {
      loadTeamRequests();
    }
  }, [currentUser]);

  const loadTeamRequests = async () => {
    const data = await api.getPendingApprovals(currentUser.department);
    setPendingRequests(data);
    setLoading(false);
  };

  const handleDecision = async (id, status) => {
    // 1. Optimistic UI Update (Remove from list instantly)
    setPendingRequests(prev => prev.filter(req => req.id !== id));

    try {
      // 2. Send to API
      await api.updateRequestStatus(id, status, `Processed by ${currentUser.displayName}`);
    } catch (error) {
      alert("Error updating request");
      loadTeamRequests(); // Revert on error
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
          <ShieldCheck className="text-indigo-600" /> 
          {currentUser.department} Team Approvals
        </h2>
      </div>

      {loading ? (
        <div className="p-10 text-center text-slate-400">Loading...</div>
      ) : pendingRequests.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-300 text-center">
          <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="text-green-500" size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-800">All Caught Up!</h3>
          <p className="text-slate-500">No pending requests for your team.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {pendingRequests.map((req) => (
            <div key={req.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-start">
                <div>
                   <div className="flex items-center gap-2 mb-2">
                     <span className="font-bold text-slate-900">{req.employeeName || req.employeeEmail}</span>
                     <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500 font-bold uppercase">{req.type}</span>
                   </div>
                   <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Calendar size={14} /> {req.startDate}
                   </div>
                   {req.comments && <p className="text-sm text-slate-500 mt-2 italic">"{req.comments}"</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleDecision(req.id, 'Rejected')} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><X /></button>
                  <button onClick={() => handleDecision(req.id, 'Approved')} className="p-2 bg-slate-900 text-white hover:bg-slate-800 rounded-lg shadow-lg transition-colors"><Check /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

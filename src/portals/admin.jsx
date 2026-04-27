import React from 'react';
import CONFIG from '../../config.js'; // Adjust path if necessary

export default function AdminView({ 
  staffList, 
  manualLeave, 
  setManualLeave, 
  handleManualAdd, 
  handleStaffSelect 
}) {
  
  // Logic to determine if we should show the half-day checkbox
  // We want it for Annual Leave AND Work types now
  const showHalfDayOption = 
    manualLeave.type === 'Annual Leave' || 
    manualLeave.type === CONFIG.termTimeWorkType || 
    manualLeave.type === CONFIG.extraHoursType;

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border-t-4 border-red-600">
      <h2 className="text-xl font-bold text-slate-800 mb-4">System Admin - Manual Entry</h2>
      
      <form onSubmit={handleManualAdd} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Select Staff</label>
          <select 
            className="mt-1 block w-full border rounded-md p-2"
            value={manualLeave.employeeId}
            onChange={handleStaffSelect}
            required
          >
            <option value="">-- Select Employee --</option>
            {staffList.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.department})</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Leave/Work Type</label>
            <select 
              className="mt-1 block w-full border rounded-md p-2"
              value={manualLeave.type}
              onChange={(e) => setManualLeave({...manualLeave, type: e.target.value})}
            >
              {CONFIG.leaveTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Start Date</label>
            <input 
              type="date" 
              className="mt-1 block w-full border rounded-md p-2"
              value={manualLeave.startDate}
              onChange={(e) => setManualLeave({...manualLeave, startDate: e.target.value})}
              required
            />
          </div>
        </div>

        {!manualLeave.isHalfDay && (
          <div>
            <label className="block text-sm font-medium text-gray-700">End Date</label>
            <input 
              type="date" 
              className="mt-1 block w-full border rounded-md p-2"
              value={manualLeave.endDate}
              onChange={(e) => setManualLeave({...manualLeave, endDate: e.target.value})}
              required={!manualLeave.isHalfDay}
            />
          </div>
        )}

        {/* AMENDED: Half Day Toggle for Work Types */}
        {showHalfDayOption && (
          <div className="flex items-center space-x-2 p-2 bg-blue-50 rounded">
            <input 
              type="checkbox"
              id="adminHalfDay"
              checked={manualLeave.isHalfDay}
              onChange={(e) => setManualLeave({...manualLeave, isHalfDay: e.target.checked})}
              className="h-4 w-4 text-red-600"
            />
            <label htmlFor="adminHalfDay" className="text-sm font-semibold text-blue-800">
              Register as Half Day (0.5)
            </label>
          </div>
        )}

        <button 
          type="submit"
          className="w-full bg-red-600 text-white font-bold py-2 rounded hover:bg-red-700 transition"
        >
          Add Record to System
        </button>
      </form>

      <div className="mt-8 grid grid-cols-2 gap-4">
        <div className="p-4 bg-slate-50 rounded border border-slate-200">
          <p className="text-sm text-slate-500">Total Staff</p>
          <p className="text-2xl font-bold text-slate-800">{staffList.filter(s => !s.isArchived).length}</p>
        </div>
        <div className="p-4 bg-slate-50 rounded border border-slate-200">
          <p className="text-sm text-slate-500">Active Requests</p>
          <p className="text-2xl font-bold text-slate-800">3</p> 
        </div>
      </div>
    </div>
  );
}

{/* Toggle for Half Day */}
{(formData.type === 'Annual Leave' || formData.type === 'School Holiday Worked' || formData.type === 'Extra Hours') && (
  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 my-4">
    <input 
      type="checkbox"
      id="halfDay"
      checked={formData.isHalfDay}
      onChange={(e) => setFormData({...formData, isHalfDay: e.target.checked})}
      className="w-4 h-4 text-indigo-600 rounded"
    />
    <label htmlFor="halfDay" className="text-sm font-bold text-slate-700 cursor-pointer">
      Register as Half Day (0.5 units)
    </label>
  </div>
)}

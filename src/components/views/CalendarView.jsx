import React from 'react';
import { Calendar, ChevronLeft, ChevronRight, Info, Trash2, Clock, X } from 'lucide-react';
import CONFIG from '../../config.js';
import { formatDateUK, getTermForDate } from '../../utils/helpers.js';

const CalendarView = ({
  calDate, setCalDate, calViewMode, setCalViewMode,
  selectedDate, setSelectedDate, requests, staffList,
  termDates, schoolTerms, bankHolidays, isAdmin, user, deleteRequest
}) => {
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => { 
    let day = new Date(year, month, 1).getDay(); 
    return day === 0 ? 6 : day - 1; 
  };
  const getStartOfWeek = (date) => { 
    const d = new Date(date); 
    const day = d.getDay(); 
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
    return new Date(d.setDate(diff)); 
  };

  const isNonWorkingDay = (dateStr) => {
    const dow = new Date(dateStr + 'T12:00:00').getDay();
    if (dow === 0 || dow === 6) return true;
    if (bankHolidays.some(h => h.date === dateStr)) return true;
    return termDates.some(t => t.type === 'Bank Holiday' && t.date === dateStr);
  };

  const insetDays = new Set(termDates.filter(t => t.type === 'INSET Day').map(t => t.date));
  const useNewTerms = schoolTerms && schoolTerms.length > 0;
  const legacyTermStarts = termDates.filter(t => t.type === 'Term Start').map(t => t.date).sort();
  const legacyTermEnds = termDates.filter(t => t.type === 'Term End').map(t => t.date).sort();
  const legacyTermRanges = legacyTermStarts.map(start => {
    const end = legacyTermEnds.find(e => e >= start);
    return end ? { start, end } : null;
  }).filter(Boolean);
  const firstNewTermDate = useNewTerms ? schoolTerms.map(t => t.autumnStart || t.springStart || t.summerStart).filter(Boolean).sort()[0] : null;

  const getDayCategory = (dateStr) => {
    const dow = new Date(dateStr + 'T12:00:00').getDay();
    if (bankHolidays.some(h => h.date === dateStr)) return 'bank';
    if (termDates.some(t => t.type === 'Bank Holiday' && t.date === dateStr)) return 'bank';
    if (insetDays.has(dateStr)) return 'inset';
    if (useNewTerms) {
      const term = getTermForDate(dateStr, schoolTerms);
      if (term) return 'term';
      if (dow !== 0 && dow !== 6 && firstNewTermDate && dateStr >= firstNewTermDate) return 'holiday';
    } else {
      if (legacyTermRanges.some(r => dateStr >= r.start && dateStr <= r.end)) return 'term';
      if (termDates.some(t => t.type === 'School Holiday' && t.date === dateStr)) return 'holiday';
    }
    return 'normal';
  };

  const dayCategoryStyle = {
    term: { backgroundColor: '#dbeafe', borderColor: '#93c5fd' },
    holiday: { backgroundColor: '#fef3c7', borderColor: '#fcd34d' },
    bank: { backgroundColor: '#f3e8ff', borderColor: '#d8b4fe' },
    inset: { backgroundColor: '#ede9fe', borderColor: '#c4b5fd' },
    normal: {},
  };

  return (
    <div className="grid-dashboard relative">
      <div className="card h-full flex flex-col col-span-2">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Calendar size={20} /> {calDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </h3>
          <div className="flex gap-1">
            <button onClick={() => setCalDate(new Date(new Date(calDate).setMonth(calDate.getMonth() - 1)))} className="p-1 rounded hover:bg-gray-100"><ChevronLeft size={18} /></button>
            <button onClick={() => setCalDate(new Date(new Date(calDate).setMonth(calDate.getMonth() + 1)))} className="p-1 rounded hover:bg-gray-100"><ChevronRight size={18} /></button>
            <button onClick={() => setCalDate(new Date())} className="ml-2 px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300">Today</button>
          </div>
          <select value={calViewMode} onChange={e => setCalViewMode(e.target.value)} className="p-1 border rounded text-xs">
            <option value="Month">Month View</option>
            <option value="Week">Week View</option>
          </select>
        </div>

        {calViewMode === 'Month' ? (
          <div className="flex-1">
            <div className="cal-header">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="cal-grid">
              {Array.from({ length: getFirstDayOfMonth(calDate.getFullYear(), calDate.getMonth()) }).map((_, i) => (
                <div key={`empty-${i}`} className="cal-day opacity-50 bg-gray-50/50"></div>
              ))}
              {Array.from({ length: getDaysInMonth(calDate.getFullYear(), calDate.getMonth()) }).map((_, i) => {
                const day = i + 1;
                const dateStr = new Date(calDate.getFullYear(), calDate.getMonth(), day, 12).toISOString().split('T')[0];
                const isToday = new Date().toISOString().split('T')[0] === dateStr;
                const isSelected = selectedDate === dateStr;
                
                const dayRequests = requests.filter(r => {
                  const staff = staffList.find(s => s.email === r.employeeEmail);
                  return !staff?.isArchived && r.status === 'Approved' && r.startDate <= dateStr && (r.endDate || r.startDate) >= dateStr;
                });

                const bankHols = bankHolidays.filter(h => h.date === dateStr);
                const dayTerms = termDates.filter(t => t.date === dateStr && t.type !== 'Bank Holiday');
                const cat = getDayCategory(dateStr);

                return (
                  <div 
                    key={day} 
                    onClick={() => setSelectedDate(dateStr)} 
                    style={dayCategoryStyle[cat] || {}} 
                    className={`cal-day relative cursor-pointer transition-all min-h-[100px] 
                      ${isToday ? 'today ring-inset ring-2 ring-emerald-500' : ''} 
                      ${isSelected ? 'ring-2 ring-indigo-600 z-30 shadow-xl bg-white scale-[1.02]' : 'hover:bg-white/80 hover:z-20 hover:shadow-md'}
                    `}
                  >
                    <div className="text-right font-bold text-gray-400 text-xs mb-1">{day}</div>
                    <div className="flex flex-col gap-0.5 overflow-hidden">
                      {bankHols.map((h, idx) => <div key={`h-${idx}`} className="cal-event bank truncate">{h.description}</div>)}
                      {dayTerms.map((t, idx) => <div key={`t-${idx}`} className="cal-event inset truncate">{t.description}</div>)}
                      {dayRequests.slice(0, 2).map((r, idx) => (
                        <div key={`r-${idx}`} className={`cal-event text-[9px] truncate px-1 py-0.5 rounded shadow-sm text-white ${r.type === CONFIG.termTimeWorkType ? 'bg-indigo-600' : 'bg-emerald-600'}`}>
                          {r.employeeName}
                        </div>
                      ))}
                    </div>
                    {/* CRITICAL FIX: Changed from div to button, added e.preventDefault and explicit z-index */}
                    {dayRequests.length > 2 && (
                      <button 
                        type="button"
                        onClick={(e) => { 
                          e.preventDefault();
                          e.stopPropagation(); 
                          setSelectedDate(dateStr); 
                        }}
                        className="absolute bottom-1 right-1 text-[9px] font-bold text-indigo-700 bg-indigo-50 rounded px-1.5 py-0.5 text-center border border-indigo-200 hover:bg-indigo-600 hover:text-white transition-colors z-50 shadow-sm cursor-pointer"
                      >
                        +{dayRequests.length - 2} More
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 italic">
             Week View Logic is currently under maintenance.
          </div>
        )}

        {/* --- FULL SCREEN DRILL DOWN MODAL --- */}
        {selectedDate && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
              
              {/* Modal Header */}
              <div className="flex justify-between items-center p-5 sm:px-6 border-b border-slate-100 bg-slate-50/80">
                <div>
                  <h4 className="font-extrabold text-slate-800 text-lg flex items-center gap-2">
                    <Info size={20} className="text-indigo-600" /> 
                    Personnel & Events
                  </h4>
                  <p className="text-sm text-slate-500 font-medium mt-0.5">{formatDateUK(selectedDate)}</p>
                </div>
                <button 
                  onClick={() => setSelectedDate(null)} 
                  className="flex items-center gap-2 px-4 py-2 bg-white text-slate-600 border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-100 hover:text-slate-900 shadow-sm transition-all"
                >
                  <X size={16} /> Close
                </button>
              </div>
              
              {/* Modal Scrollable Content */}
              <div className="p-5 sm:p-6 overflow-y-auto flex-1 bg-slate-50/30">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Bank Holidays & Terms */}
                  {bankHolidays.filter(h => h.date === selectedDate).map((h, i) => (
                    <div key={`bh-${i}`} className="flex items-center gap-4 p-4 bg-purple-50 border border-purple-100 rounded-xl shadow-sm">
                      <div className="w-1.5 h-12 rounded-full shrink-0 bg-purple-500"></div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-purple-900 truncate">{h.description}</p>
                        <p className="text-xs text-purple-600 font-semibold uppercase tracking-wider">Public Holiday</p>
                      </div>
                    </div>
                  ))}

                  {/* Staff Requests */}
                  {requests.filter(r => r.status === 'Approved' && r.startDate <= selectedDate && (r.endDate || r.startDate) >= selectedDate)
                    .map((r, idx) => (
                    <div key={idx} className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                      <div className={`w-1.5 h-12 rounded-full shrink-0 ${r.type === CONFIG.termTimeWorkType ? 'bg-indigo-500' : 'bg-emerald-500'}`}></div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 truncate">{r.employeeName}</p>
                        <p className="text-xs text-slate-500 font-semibold">{r.department}</p>
                        <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-bold">{r.type}</p>
                      </div>
                      {isAdmin && (
                        <button 
                          onClick={() => deleteRequest(r.id)} 
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Request"
                        >
                          <Trash2 size={18}/>
                        </button>
                      )}
                    </div>
                  ))}

                  {/* Empty State */}
                  {requests.filter(r => r.status === 'Approved' && r.startDate <= selectedDate && (r.endDate || r.startDate) >= selectedDate).length === 0 && bankHolidays.filter(h => h.date === selectedDate).length === 0 && (
                    <div className="col-span-full py-10 text-center text-slate-400 font-medium bg-white rounded-xl border border-dashed border-slate-300">
                      <Calendar size={32} className="mx-auto mb-3 text-slate-300" />
                      No leave, events, or work records for this date.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarView;

import React from 'react';
import { Calendar, ChevronLeft, ChevronRight, Info, Trash2 } from 'lucide-react';
import CONFIG from '../../config.js';
import { formatDateUK } from '../../utils/helpers.js';

const CalendarView = ({
  calDate, setCalDate, calViewMode, setCalViewMode,
  selectedDate, setSelectedDate, requests, staffList,
  termDates, bankHolidays, isAdmin, user, deleteRequest
}) => {
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => { let day = new Date(year, month, 1).getDay(); return day === 0 ? 6 : day - 1; };
  const getStartOfWeek = (date) => { const d = new Date(date); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); return new Date(d.setDate(diff)); };

  /* Returns true if the date is a weekend or a bank holiday — leave entries should not appear on these days */
  const isNonWorkingDay = (dateStr) => {
    const dow = new Date(dateStr + 'T12:00:00').getDay(); // 0=Sun, 6=Sat
    if (dow === 0 || dow === 6) return true;
    if (bankHolidays.some(h => h.date === dateStr)) return true;
    if (termDates.some(t => t.type === 'Bank Holiday' && t.date === dateStr)) return true;
    return false;
  };

  return (
    <div className="grid-dashboard">
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
          <div className="flex gap-2 text-xs font-medium items-center">
            <select value={calViewMode} onChange={e => setCalViewMode(e.target.value)} className="mr-2">
              <option value="Month">Month View</option>
              <option value="Week">Week View</option>
            </select>
          </div>
        </div>

        {calViewMode === 'Month' ? (
          <>
            <div className="cal-header">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="cal-grid">
              {Array.from({ length: getFirstDayOfMonth(calDate.getFullYear(), calDate.getMonth()) }).map((_, i) => (
                <div key={`empty-${i}`} className="cal-day"></div>
              ))}
              {Array.from({ length: getDaysInMonth(calDate.getFullYear(), calDate.getMonth()) }).map((_, i) => {
                const day = i + 1;
                const dateStr = new Date(calDate.getFullYear(), calDate.getMonth(), day, 12).toISOString().split('T')[0];
                const isToday = new Date().toISOString().split('T')[0] === dateStr;
                const isSelected = selectedDate === dateStr;
                const bankHols = bankHolidays.filter(h => h.date === dateStr);
                const dayRequests = isNonWorkingDay(dateStr) ? [] : requests.filter(r => {
                  const staff = staffList.find(s => s.email === r.employeeEmail);
                  if (staff && staff.isArchived) return false;
                  return r.status === 'Approved' && r.startDate <= dateStr && (r.endDate || r.startDate) >= dateStr;
                });
                const dayTerms = termDates.filter(t => t.date === dateStr && t.type !== 'Bank Holiday');
                return (
                  <div key={day} onClick={() => setSelectedDate(dateStr)} className={`cal-day ${isToday ? 'today' : ''} ${isSelected ? 'ring-2 ring-emerald-600' : ''}`}>
                    <div className="text-right font-medium text-gray-500 mb-1">{day}</div>
                    <div className="flex flex-col gap-1 overflow-hidden">
                      {bankHols.map((h, idx) => <div key={`h-${idx}`} className="cal-event bank">{h.description}</div>)}
                      {dayTerms.map((t, idx) => <div key={`t-${idx}`} className="cal-event inset">{t.description}</div>)}
                      {dayRequests.slice(0, 3).map((r, idx) => <div key={`r-${idx}`} className={`cal-event ${r.type === CONFIG.termTimeWorkType ? 'bg-indigo-600' : 'bg-emerald-600'}`}>{r.employeeName?.split(' ')[0]}</div>)}
                      {dayRequests.length > 3 && <div className="text-[10px] text-gray-400 text-center">+{dayRequests.length - 3} more</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="cal-header">
              {Array.from({ length: 7 }).map((_, i) => {
                const startOfWeek = getStartOfWeek(calDate);
                const d = new Date(startOfWeek);
                d.setDate(d.getDate() + i);
                return <div key={i}>{d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}</div>;
              })}
            </div>
            <div className="cal-grid weekly">
              {Array.from({ length: 7 }).map((_, i) => {
                const startOfWeek = getStartOfWeek(calDate);
                const d = new Date(startOfWeek);
                d.setDate(d.getDate() + i);
                const dateStr = d.toISOString().split('T')[0];
                const dayRequests = isNonWorkingDay(dateStr) ? [] : requests.filter(r => {
                  const staff = staffList.find(s => s.email === r.employeeEmail);
                  if (staff && staff.isArchived) return false;
                  return r.status === 'Approved' && r.startDate <= dateStr && (r.endDate || r.startDate) >= dateStr;
                });
                const dayTerms = termDates.filter(t => t.date === dateStr);
                return (
                  <div key={i} className="cal-day weekly-day">
                    {dayTerms.map((t, idx) => <div key={`term-${idx}`} className={`cal-event ${t.type === 'Bank Holiday' ? 'bank' : 'inset'}`}>{t.description}</div>)}
                    {dayRequests.map((r, idx) => <div key={`req-${idx}`} className={`cal-event ${r.type === CONFIG.termTimeWorkType ? 'bg-indigo-600' : 'bg-emerald-600'}`}>{r.employeeName} <span style={{ fontSize: '0.6rem', opacity: 0.8 }}>({r.type})</span></div>)}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {selectedDate && calViewMode === 'Month' && (
          <div className="mt-6 p-4 bg-gray-50 border rounded-lg">
            <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><Info size={16} /> Details for {formatDateUK(selectedDate)}</h4>
            <div className="space-y-2">
              {bankHolidays.filter(h => h.date === selectedDate).map((h, i) => (
                <div key={`bh-${i}`} className="flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                  <span className="font-bold text-gray-700">{h.description}</span>
                  <span className="text-gray-500 text-xs">(Bank Holiday)</span>
                </div>
              ))}
              {termDates.filter(t => t.date === selectedDate).map((t, idx) => (
                <div key={`det-term-${idx}`} className="flex items-center gap-2 text-sm">
                  <span className={`w-2 h-2 rounded-full ${t.type === 'Bank Holiday' ? 'bg-purple-600' : 'bg-yellow-500'}`}></span>
                  <span className="font-bold text-gray-700">{t.description}</span>
                  <span className="text-gray-500 text-xs">({t.type})</span>
                </div>
              ))}
              {(!isNonWorkingDay(selectedDate) ? requests.filter(r => {
                const staff = staffList.find(s => s.email === r.employeeEmail);
                if (staff && staff.isArchived) return false;
                return r.status === 'Approved' && r.startDate <= selectedDate && (r.endDate || r.startDate) >= selectedDate;
              }) : []).map((r, idx) => (
                <div key={`det-req-${idx}`} className="flex items-center gap-2 text-sm p-2 bg-white border rounded">
                  <div className={`w-2 h-2 rounded-full ${r.type === CONFIG.termTimeWorkType ? 'bg-indigo-600' : 'bg-emerald-600'}`}></div>
                  <span className="font-bold text-gray-800">{r.employeeName}</span>
                  <span className="text-gray-500 text-xs">({r.department})</span>
                  <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded bg-gray-100">{r.type}</span>
                  {(isAdmin || (r.employeeEmail === user.email && r.status === 'Pending')) && (
                    <button onClick={e => { e.stopPropagation(); deleteRequest(r.id); }} className="text-gray-300 hover:text-red-500 ml-2"><Trash2 size={14} /></button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarView;

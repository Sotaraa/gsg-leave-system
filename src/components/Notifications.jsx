import React from 'react';
import { Check } from 'lucide-react';

const Notifications = ({ notifications }) => (
  <div className="fixed top-5 right-5 z-50 space-y-2">
    {notifications.map(n => (
      <div key={n.id} className="bg-emerald-800 text-white px-6 py-3 rounded shadow-lg flex items-center gap-3">
        <Check size={16} /> {n.msg}
      </div>
    ))}
  </div>
);

export default Notifications;

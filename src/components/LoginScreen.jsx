import React from 'react';
import { GraduationCap, LogIn } from 'lucide-react';
import CONFIG from '../config.js';

const LoginScreen = ({ onLogin, error }) => (
  <div className="h-screen flex items-center justify-center bg-gray-100">
    <div className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-md text-center border-t-8 border-emerald-800">
      <div className="mb-6 flex justify-center text-emerald-800">
        <GraduationCap size={64} />
      </div>
      <h1 className="text-2xl font-bold text-gray-800 mb-1">{CONFIG.schoolName}</h1>
      <p className="text-gray-500 uppercase text-xs font-bold mb-8">HR Management Portal</p>
      <button onClick={onLogin} className="w-full bg-emerald-800 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 flex items-center justify-center gap-2">
        <LogIn size={18} /> Sign in with Office 365
      </button>
      {error && <div className="mt-6 p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">{error}</div>}
      <div className="mt-8 pt-6 border-t border-gray-100 text-xs text-gray-400">Secure Corporate Access • v49.0</div>
    </div>
  </div>
);

export default LoginScreen;

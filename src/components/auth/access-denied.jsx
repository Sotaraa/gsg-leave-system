import React from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

const AccessDenied = ({ setView }) => {
    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
            <div className="bg-red-50 p-6 rounded-full text-red-600 mb-6 animate-bounce-short">
                <ShieldAlert size={64} />
            </div>
            <h2 className="text-3xl font-black text-slate-800 mb-2">Access Restricted</h2>
            <p className="text-slate-500 max-w-md mb-8 font-medium">
                Your GSG staff profile does not have the required permissions to access this portal. 
                Please contact the IT Estates Team if you believe this is an error.
            </p>
            <button 
                onClick={() => setView('employee')}
                className="flex items-center gap-2 bg-slate-800 text-white px-6 py-3 rounded-2xl font-black hover:bg-slate-900 transition-all"
            >
                <ArrowLeft size={18} /> Return to My Portal
            </button>
        </div>
    );
};

export default AccessDenied;

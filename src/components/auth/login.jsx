import React from 'react';
import { GraduationCap, LogIn } from 'lucide-react';
import { auth } from '../../services/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const Login = () => {
    const handleLogin = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("GSG Auth Error:", error);
        }
    };

    return (
        <div className="min-h-screen bg-emerald-900 flex items-center justify-center p-4">
            <div className="bg-white max-w-md w-full rounded-[3rem] p-10 shadow-2xl text-center">
                <div className="bg-emerald-100 w-20 h-20 rounded-3xl flex items-center justify-center text-emerald-800 mx-auto mb-6">
                    <GraduationCap size={40} />
                </div>
                <h1 className="text-2xl font-black text-slate-800 mb-2">GSG Leave System</h1>
                <p className="text-slate-500 font-bold text-sm mb-10 uppercase tracking-widest">Internal Access Only</p>
                
                <button 
                    onClick={handleLogin}
                    className="w-full bg-slate-900 text-white flex items-center justify-center gap-3 py-4 rounded-2xl font-black hover:bg-black transition-all shadow-xl shadow-emerald-100"
                >
                    <LogIn size={20} /> Sign in with School Email
                </button>
                
                <p className="mt-8 text-[10px] text-slate-400 font-bold leading-relaxed">
                    By signing in, you agree to the Gardener Schools Group Acceptable Use Policy and Data Protection standards.
                </p>
            </div>
        </div>
    );
};

export default Login;

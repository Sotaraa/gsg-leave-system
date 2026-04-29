import React, { useState } from 'react';
import { Sparkles, Shield } from 'lucide-react';
import { loginWithEntra } from '../services/entraAuth';

const LoginScreen = ({ onLogin, error }) => {
  const [entraLoading, setEntraLoading] = useState(false);
  const [entraError, setEntraError] = useState('');

  const handleEntraLogin = async () => {
    console.log('🔵 Microsoft login button clicked');
    setEntraLoading(true);
    setEntraError('');
    try {
      const result = await loginWithEntra();
      if (result.success) {
        // loginRedirect navigates away — user will be redirected to Microsoft login
        // On return, main.jsx handleRedirectPromise() processes the response
        console.log('✅ Redirecting to Microsoft login...');
      } else {
        console.error('❌ Entra login failed:', result.error);
        setEntraError(`Login failed: ${result.error || 'Unknown error'}`);
        setEntraLoading(false);
      }
    } catch (err) {
      console.error('❌ Entra login error:', err);
      setEntraError(`Error: ${err.message || err}`);
      setEntraLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background blobs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div className="absolute top-40 right-10 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-blob animation-delay-4000"></div>

      <div className="relative z-10 max-w-md w-full">
        {/* Glassmorphism Card */}
        <div className="backdrop-blur-xl bg-white/30 rounded-3xl p-8 shadow-2xl border border-white/40">

          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-blue-600 rounded-2xl blur opacity-75"></div>
              <div className="relative bg-gradient-to-br from-blue-500 to-blue-700 w-16 h-16 rounded-2xl flex items-center justify-center">
                <Sparkles className="text-white" size={32} />
              </div>
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-slate-900 mb-2">Sotara LeaveHub</h1>
            <p className="text-slate-600 font-semibold text-sm">Manage your time with ease</p>
          </div>

          {/* Microsoft Sign-In Button */}
          <button
            type="button"
            onClick={handleEntraLogin}
            disabled={entraLoading}
            className="w-full bg-white hover:bg-gray-50 text-slate-900 font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-all duration-300 shadow-md hover:shadow-lg hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200 cursor-pointer"
          >
            {entraLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                <span>Connecting to Microsoft...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6v-11.4H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z" fill="#0078D4"/>
                </svg>
                <span>Sign in with Microsoft</span>
              </>
            )}
          </button>

          {/* Security note */}
          <div className="mt-6 flex items-start gap-2 text-xs text-slate-500">
            <Shield size={14} className="mt-0.5 flex-shrink-0 text-blue-400" />
            <p>
              Sign in using your organisation's Microsoft 365 account.
              Your credentials are verified securely by Microsoft.
            </p>
          </div>

          {/* Error Messages */}
          {(error || entraError) && (
            <div className="mt-4 p-3 bg-red-50/80 border border-red-200/50 text-red-700 text-sm rounded-lg">
              {error || entraError}
            </div>
          )}

          {/* Footer */}
          <p className="mt-6 text-center text-[10px] text-slate-500 leading-relaxed">
            By signing in, you agree to our terms and data protection policy
          </p>
        </div>

        {/* Bottom text */}
        <p className="text-center text-slate-600 text-sm font-medium mt-6">
          Powered by <span className="text-blue-600 font-bold">Sotara</span>
        </p>
      </div>

      <style jsx>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob { animation: blob 7s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
      `}</style>
    </div>
  );
};

export default LoginScreen;

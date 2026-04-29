import React, { useState, useEffect } from 'react';
import { LogIn, Sparkles, Loader, AlertCircle } from 'lucide-react';
import { loginWithEntra } from '../services/entraAuth';
import { supabase } from '../supabase';

const LoginScreen = ({ onLogin, error }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [entraLoading, setEntraLoading] = useState(false);
  const [entraError, setEntraError] = useState('');
  const [detectedOrg, setDetectedOrg] = useState(null);

  /**
   * Detect organization by email domain (SECURITY: Don't expose org list)
   * If found, show confirmation badge
   * If not found, don't show selector - user must use correct domain
   */
  const detectOrganization = async (emailAddress) => {
    if (!emailAddress || !emailAddress.includes('@')) {
      setDetectedOrg(null);
      return;
    }

    try {
      const emailDomain = '@' + emailAddress.split('@')[1];
      console.log(`🔍 Detecting organization for domain: ${emailDomain}`);

      // Check if organization exists for this domain
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id, name, domain')
        .eq('domain', emailDomain)
        .single();

      if (org && !orgError) {
        console.log(`✅ Organization detected: ${org.name}`);
        setDetectedOrg(org);
      } else {
        console.log(`ℹ️ No organization found for domain ${emailDomain}`);
        setDetectedOrg(null);
      }
    } catch (err) {
      console.error('❌ Error detecting organization:', err);
      setDetectedOrg(null);
    }
  };

  // Detect organization when email changes
  useEffect(() => {
    if (email && email.length > 5) {
      detectOrganization(email);
    } else {
      setDetectedOrg(null);
    }
  }, [email]);

  const handleEntraLogin = async () => {
    console.log('🔵 Microsoft login button clicked');
    setEntraLoading(true);
    setEntraError('');
    try {
      console.log('📍 Calling loginWithEntra()...');
      const result = await loginWithEntra();
      console.log('📍 loginWithEntra result:', result);

      if (result.success) {
        console.log('✅ Login redirect initiated - user will be redirected to Microsoft login');
        // loginRedirect doesn't return, it navigates away
        // After user logs in, they'll be redirected back to this app
      } else {
        console.error('❌ Entra login failed:', result.error);
        setEntraError(`Login failed: ${result.error || 'Unknown error'}`);
        setEntraLoading(false);
      }
    } catch (err) {
      console.error("❌ Entra login error:", err);
      setEntraError(`Error: ${err.message || err}`);
      setEntraLoading(false);
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setEntraError('');

    try {
      // SECURITY: Verify user belongs to a known organization OR is a legacy GSG user
      const emailDomain = '@' + email.split('@')[1];

      // Check 1: Does domain match a known organization?
      const { data: org } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('domain', emailDomain)
        .single();

      if (org) {
        // ✅ Known organization - allow login
        localStorage.setItem('GSG_USER_EMAIL', email);
        localStorage.setItem('GSG_USER_ORGANIZATION_ID', org.id);
        localStorage.setItem('GSG_AUTH_METHOD', 'email');
        window.location.reload();
        return;
      }

      // Check 2: Is this a legacy GSG user in the requests table?
      const { data: legacyUser } = await supabase
        .from('requests')
        .select('employeeemail')
        .eq('employeeemail', email)
        .limit(1);

      if (legacyUser && legacyUser.length > 0) {
        // ✅ Known legacy GSG user - allow login
        localStorage.setItem('GSG_USER_EMAIL', email);
        localStorage.setItem('GSG_AUTH_METHOD', 'email');
        window.location.reload();
        return;
      }

      // 🚫 SECURITY: Email not in any organization or legacy system
      setEntraError('Access denied. Your email is not registered with any organization. Please contact your administrator.');
      setLoading(false);

    } catch (err) {
      console.error("Login Error:", err);
      setEntraError('Login failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background blobs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div className="absolute top-40 right-10 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>

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
            <p className="text-xs text-slate-500 mt-2">Multi-tenant enterprise platform</p>
          </div>

          {/* Microsoft Sign-In Button */}
          <button
            type="button"
            onClick={handleEntraLogin}
            disabled={entraLoading}
            className="w-full bg-white hover:bg-gray-50 text-slate-900 font-bold py-3 rounded-xl flex items-center justify-center gap-3 transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200 cursor-pointer z-20 relative"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6v-11.4H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z" fill="#0078D4"/>
            </svg>
            {entraLoading ? 'Connecting...' : 'Sign in with Microsoft'}
          </button>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent to-slate-300"></div>
            <span className="text-xs text-slate-500 font-medium">OR</span>
            <div className="flex-1 h-px bg-gradient-to-l from-transparent to-slate-300"></div>
          </div>

          {/* Email Login Form */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="relative">
              <input
                type="email"
                placeholder="your.email@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 backdrop-blur-md bg-white/40 border border-white/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900 placeholder-slate-500 transition-all"
                required
              />
            </div>

            {/* Organization Match Badge - don't reveal org name for security */}
            {detectedOrg && (
              <div className="p-3 bg-green-50/80 border border-green-200/50 rounded-lg flex items-center gap-2">
                <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                <span className="text-sm text-green-700">
                  Domain recognized. Click Sign In to continue.
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogIn size={20} />
              {loading ? 'Signing in...' : 'Sign In with Email'}
            </button>
          </form>

          {/* Error Messages */}
          {error && (
            <div className="mt-6 p-3 bg-red-50/80 border border-red-200/50 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}
          {entraError && (
            <div className="mt-4 p-3 bg-red-50/80 border border-red-200/50 text-red-700 text-sm rounded-lg">
              <strong>Microsoft Login Error:</strong> {entraError}
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
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
      `}</style>
    </div>
  );
};

export default LoginScreen;

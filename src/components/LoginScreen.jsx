import React, { useState, useEffect } from 'react';
import { Shield, AlertCircle, CheckCircle, ChevronRight } from 'lucide-react';
import { loginWithEntra } from '../services/entraAuth';
import { supabase } from '../supabase';
import LeaveHubLogo from './LeaveHubLogo.jsx';

const LoginScreen = ({ error }) => {
  const [email, setEmail] = useState('');
  const [entraLoading, setEntraLoading] = useState(false);
  const [entraError, setEntraError] = useState('');
  const [detectedOrg, setDetectedOrg] = useState(null);
  const [checking, setChecking] = useState(false);

  // Detect organization by email domain (debounced)
  useEffect(() => {
    if (!email.includes('@') || email.split('@')[1]?.length < 3) {
      setDetectedOrg(null);
      return;
    }
    setChecking(true);
    const timer = setTimeout(async () => {
      try {
        const domain = '@' + email.split('@')[1];
        const { data: org } = await supabase
          .from('organizations')
          .select('id, name, ssoconfigured')
          .eq('domain', domain)
          .single();
        setDetectedOrg(org || null);
      } catch {
        setDetectedOrg(null);
      } finally {
        setChecking(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [email]);

  const handleMicrosoftLogin = async () => {
    setEntraLoading(true);
    setEntraError('');
    try {
      const result = await loginWithEntra();
      if (!result.success) {
        setEntraError(result.error || 'Microsoft login failed. Please try again.');
        setEntraLoading(false);
      }
      // On success, the page redirects to Microsoft — no further action needed here
    } catch (err) {
      setEntraError(err.message || 'Unexpected error during sign in.');
      setEntraLoading(false);
    }
  };

  const handleEmailContinue = async (e) => {
    e.preventDefault();
    if (!email || !detectedOrg) return;
    // Domain is recognised — proceed with Microsoft login for this org
    await handleMicrosoftLogin();
  };

  const displayError = error || entraError;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #001f4d 0%, #0052a3 50%, #003d7a 100%)' }}
    >
      {/* Background geometric shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div style={{
          position: 'absolute', top: '-10%', right: '-5%',
          width: 420, height: 420, borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)'
        }} />
        <div style={{
          position: 'absolute', bottom: '-15%', left: '-8%',
          width: 520, height: 520, borderRadius: '50%',
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)'
        }} />
        <div style={{
          position: 'absolute', top: '30%', left: '-12%',
          width: 280, height: 280, borderRadius: '50%',
          background: 'rgba(74,158,219,0.08)'
        }} />
      </div>

      <div className="relative z-10 w-full" style={{ maxWidth: 420 }}>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.07)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 24,
          padding: '40px 36px 32px',
          boxShadow: '0 32px 64px rgba(0,0,0,0.4)'
        }}>

          {/* Logo */}
          <div className="flex justify-center mb-8">
            <LeaveHubLogo width={200} variant="light" />
          </div>

          {/* Tagline */}
          <p style={{ color: 'rgba(180,210,255,0.7)', fontSize: 13, textAlign: 'center', marginBottom: 32, letterSpacing: '0.3px' }}>
            Staff leave management — secure, simple, multi-tenant
          </p>

          {/* Microsoft Sign-In (Primary) */}
          <button
            type="button"
            onClick={handleMicrosoftLogin}
            disabled={entraLoading}
            style={{
              width: '100%',
              background: entraLoading ? 'rgba(255,255,255,0.1)' : 'white',
              color: entraLoading ? 'rgba(255,255,255,0.5)' : '#1a1a2e',
              border: 'none',
              borderRadius: 12,
              padding: '14px 20px',
              fontSize: 15,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              cursor: entraLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
              marginBottom: 16,
            }}
          >
            {entraLoading ? (
              <>
                <div style={{
                  width: 18, height: 18,
                  border: '2px solid rgba(255,255,255,0.4)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }} />
                <span>Connecting to Microsoft...</span>
              </>
            ) : (
              <>
                {/* Microsoft Logo */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6v-11.4H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z" fill="#0052a3"/>
                </svg>
                <span>Sign in with Microsoft 365</span>
              </>
            )}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
            <span style={{ color: 'rgba(180,210,255,0.5)', fontSize: 11, fontWeight: 600, letterSpacing: '0.5px' }}>OR ENTER YOUR EMAIL</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
          </div>

          {/* Email field */}
          <form onSubmit={handleEmailContinue}>
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <input
                type="email"
                placeholder="you@yourorganisation.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 10,
                  padding: '12px 16px',
                  fontSize: 14,
                  color: 'white',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(74,158,219,0.7)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
              />
            </div>

            {/* Org Detection Feedback */}
            {email.includes('@') && (
              <div style={{ marginBottom: 12, minHeight: 28 }}>
                {checking ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(180,210,255,0.6)', fontSize: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid rgba(180,210,255,0.4)', borderTopColor: '#4A9EDB', animation: 'spin 0.8s linear infinite' }} />
                    Checking organisation...
                  </div>
                ) : detectedOrg ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6ee7b7', fontSize: 12 }}>
                    <CheckCircle size={13} />
                    <strong>{detectedOrg.name}</strong> recognised — continue with Microsoft
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,180,180,0.8)', fontSize: 12 }}>
                    <AlertCircle size={13} />
                    Domain not registered. Contact your administrator.
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={!detectedOrg || entraLoading}
              style={{
                width: '100%',
                background: detectedOrg && !entraLoading ? 'rgba(74,158,219,0.25)' : 'rgba(255,255,255,0.05)',
                color: detectedOrg && !entraLoading ? '#7ec8f0' : 'rgba(255,255,255,0.3)',
                border: `1px solid ${detectedOrg && !entraLoading ? 'rgba(74,158,219,0.4)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 10,
                padding: '12px 20px',
                fontSize: 14,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: detectedOrg && !entraLoading ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
              }}
            >
              Continue <ChevronRight size={15} />
            </button>
          </form>

          {/* Error */}
          {displayError && (
            <div style={{
              marginTop: 16, padding: '10px 14px',
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 8, color: '#fca5a5', fontSize: 13,
              display: 'flex', alignItems: 'flex-start', gap: 8
            }}>
              <AlertCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
              {displayError}
            </div>
          )}

          {/* Security note */}
          <div style={{ marginTop: 20, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <Shield size={12} style={{ color: 'rgba(74,158,219,0.6)', marginTop: 1, flexShrink: 0 }} />
            <p style={{ color: 'rgba(180,210,255,0.45)', fontSize: 11, lineHeight: 1.5 }}>
              All sign-ins are verified through your organisation's Microsoft 365 tenant.
              No passwords are stored by LeaveHub.
            </p>
          </div>
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', color: 'rgba(180,210,255,0.4)', fontSize: 11, marginTop: 20 }}>
          Powered by <span style={{ color: 'rgba(180,210,255,0.7)', fontWeight: 700 }}>Sotara</span>
          &nbsp;·&nbsp; By signing in you accept our <span style={{ color: 'rgba(180,210,255,0.6)', textDecoration: 'underline', cursor: 'pointer' }}>terms &amp; privacy policy</span>
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: rgba(180,210,255,0.35); }
      `}</style>
    </div>
  );
};

export default LoginScreen;

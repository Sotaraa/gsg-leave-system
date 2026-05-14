import React, { useState, useEffect } from 'react';
import { Shield, AlertCircle, CheckCircle, ChevronRight, Zap } from 'lucide-react';
import { loginWithEntra } from '../services/entraAuth';
import { supabase } from '../supabase';
import SotaraLogo from './SotaraLogo.jsx';

/**
 * Login screen — pulled into SOTARA's brand hero treatment.
 *
 * Visual language matches sotara.co.uk:
 *   - Deep #050b14 background
 *   - Three floating blurred colour-blobs (teal, indigo, dark teal)
 *   - Subtle dot-grid overlay at 3% opacity
 *   - Eyebrow pill above the headline
 *   - Gradient hero text (teal-400 → emerald-300 → cyan-400)
 *   - Glass-morphism card with backdrop blur
 *   - Teal-500 CTA with glow hover
 */
const LoginScreen = ({ error }) => {
  const [email,        setEmail]        = useState('');
  const [entraLoading, setEntraLoading] = useState(false);
  const [entraError,   setEntraError]   = useState('');
  const [detectedOrg,  setDetectedOrg]  = useState(null);
  const [checking,     setChecking]     = useState(false);

  // Detect organisation by email domain (debounced)
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
    } catch (err) {
      setEntraError(err.message || 'Unexpected error during sign in.');
      setEntraLoading(false);
    }
  };

  const handleEmailContinue = async (e) => {
    e.preventDefault();
    if (!email || !detectedOrg) return;
    await handleMicrosoftLogin();
  };

  const displayError = error || entraError;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden"
      style={{ background: '#050b14' }}
    >
      {/* ── Decorative noise + dot grid (3% opacity, matches SOTARA hero) ── */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.18) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          opacity: 0.03,
        }}
      />

      {/* ── Floating colour-blobs (teal, indigo, dark teal) ── */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute animate-blob-a" style={{
          top: '-12%', left: '-10%', width: 640, height: 640,
          borderRadius: '50%',
          background: 'rgba(20,184,166,0.13)',
          filter: 'blur(90px)',
        }}/>
        <div className="absolute animate-blob-b" style={{
          top: '8%', right: '-12%', width: 520, height: 520,
          borderRadius: '50%',
          background: 'rgba(99,102,241,0.10)',
          filter: 'blur(80px)',
        }}/>
        <div className="absolute animate-blob-c" style={{
          bottom: '-8%', left: '50%', transform: 'translateX(-50%)',
          width: 700, height: 280,
          borderRadius: '50%',
          background: 'rgba(13,148,136,0.09)',
          filter: 'blur(70px)',
        }}/>
      </div>

      {/* ── HERO: eyebrow pill + gradient headline ── */}
      <div className="relative z-10 w-full max-w-3xl text-center mb-10">
        <span className="pill-eyebrow mb-6">
          <Zap size={11} fill="currentColor" />
          UK-Based SaaS · Built for Modern Schools
        </span>
        <h1
          className="font-black tracking-tight leading-[1.04] mt-6"
          style={{ fontSize: 'clamp(2.25rem, 6vw, 4.25rem)' }}
        >
          <span className="block text-white">Smarter leave,</span>
          <span className="block text-gradient-sotara">simply delivered.</span>
        </h1>
        <p className="text-gray-400 text-base md:text-lg mt-5 max-w-xl mx-auto leading-relaxed">
          Sign in with Microsoft 365 to manage staff leave, approvals and term-time targets in one place.
        </p>
      </div>

      {/* ── LOGIN CARD: glassmorphism ── */}
      <div className="relative z-10 w-full" style={{ maxWidth: 440 }}>
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 20,
          padding: '32px 32px 28px',
          boxShadow: '0 32px 64px rgba(0,0,0,0.5)',
        }}>

          {/* Logo (smaller — hero takes precedence) */}
          <div className="flex justify-center mb-5">
            <SotaraLogo width={180} variant="teal" subtitle="LeaveHub" />
          </div>

          {/* Microsoft Sign-In (Primary CTA with SOTARA glow) */}
          <button
            type="button"
            onClick={handleMicrosoftLogin}
            disabled={entraLoading}
            className="group w-full"
            style={{
              background: entraLoading ? 'rgba(255,255,255,0.08)' : '#14B8A6',
              color: entraLoading ? 'rgba(255,255,255,0.5)' : 'white',
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
              transition: 'all 0.25s ease',
              boxShadow: entraLoading
                ? 'none'
                : '0 4px 14px rgba(20,184,166,0.30)',
              marginBottom: 16,
            }}
            onMouseEnter={e => {
              if (entraLoading) return;
              e.currentTarget.style.background = '#2DD4BF';
              e.currentTarget.style.boxShadow  = '0 0 48px rgba(20,184,166,0.38)';
              e.currentTarget.style.transform  = 'translateY(-2px)';
            }}
            onMouseLeave={e => {
              if (entraLoading) return;
              e.currentTarget.style.background = '#14B8A6';
              e.currentTarget.style.boxShadow  = '0 4px 14px rgba(20,184,166,0.30)';
              e.currentTarget.style.transform  = 'translateY(0)';
            }}
          >
            {entraLoading ? (
              <>
                <div style={{
                  width: 18, height: 18,
                  border: '2px solid rgba(255,255,255,0.35)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}/>
                <span>Connecting to Microsoft…</span>
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6v-11.4H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z" fill="white"/>
                </svg>
                <span>Sign in with Microsoft 365</span>
              </>
            )}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.10)' }}/>
            <span style={{
              color: 'rgba(209,213,219,0.45)',
              fontSize: 10, fontWeight: 700,
              letterSpacing: '0.18em', textTransform: 'uppercase',
            }}>
              or enter your email
            </span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.10)' }}/>
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
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10,
                  padding: '12px 16px',
                  fontSize: 14,
                  color: 'white',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'all 0.2s',
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'rgba(20,184,166,0.60)';
                  e.target.style.boxShadow   = '0 0 0 3px rgba(20,184,166,0.15)';
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'rgba(255,255,255,0.12)';
                  e.target.style.boxShadow   = 'none';
                }}
              />
            </div>

            {/* Org detection feedback */}
            {email.includes('@') && (
              <div style={{ marginBottom: 12, minHeight: 28 }}>
                {checking ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(209,213,219,0.55)', fontSize: 12 }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%',
                      border: '1.5px solid rgba(255,255,255,0.30)',
                      borderTopColor: '#2DD4BF',
                      animation: 'spin 0.8s linear infinite',
                    }}/>
                    Checking organisation…
                  </div>
                ) : detectedOrg ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6EE7B7', fontSize: 12 }}>
                    <CheckCircle size={13}/>
                    <strong>{detectedOrg.name}</strong>&nbsp;recognised — continue with Microsoft
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(252,165,165,0.85)', fontSize: 12 }}>
                    <AlertCircle size={13}/>
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
                background: detectedOrg && !entraLoading ? 'rgba(20,184,166,0.18)' : 'rgba(255,255,255,0.04)',
                color: detectedOrg && !entraLoading ? '#6EE7B7' : 'rgba(255,255,255,0.30)',
                border: `1px solid ${detectedOrg && !entraLoading ? 'rgba(20,184,166,0.40)' : 'rgba(255,255,255,0.08)'}`,
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
              Continue <ChevronRight size={15}/>
            </button>
          </form>

          {/* Error */}
          {displayError && (
            <div style={{
              marginTop: 16, padding: '10px 14px',
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 10, color: '#fca5a5', fontSize: 13,
              display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              <AlertCircle size={14} style={{ marginTop: 1, flexShrink: 0 }}/>
              {displayError}
            </div>
          )}

          {/* Security note */}
          <div style={{ marginTop: 20, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <Shield size={12} style={{ color: 'rgba(45,212,191,0.55)', marginTop: 1, flexShrink: 0 }}/>
            <p style={{ color: 'rgba(209,213,219,0.45)', fontSize: 11, lineHeight: 1.5 }}>
              All sign-ins are verified through your organisation's Microsoft 365 tenant.
              No passwords are stored by LeaveHub.
            </p>
          </div>
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', color: 'rgba(209,213,219,0.40)', fontSize: 11, marginTop: 20 }}>
          Powered by{' '}
          <span style={{ color: '#2DD4BF', fontWeight: 700 }}>SOTARA</span>
          &nbsp;·&nbsp; By signing in you accept our{' '}
          <span style={{ color: 'rgba(209,213,219,0.65)', textDecoration: 'underline', cursor: 'pointer' }}>
            terms &amp; privacy policy
          </span>
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes blob-a { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(40px,30px) scale(1.05); } }
        @keyframes blob-b { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-30px,40px) scale(0.95); } }
        @keyframes blob-c { 0%,100% { transform: translateX(-50%) scale(1); } 50% { transform: translateX(-50%) scale(1.1); } }
        .animate-blob-a { animation: blob-a 18s ease-in-out infinite; }
        .animate-blob-b { animation: blob-b 22s ease-in-out infinite; }
        .animate-blob-c { animation: blob-c 26s ease-in-out infinite; }
        input::placeholder { color: rgba(209,213,219,0.35); }
      `}</style>
    </div>
  );
};

export default LoginScreen;

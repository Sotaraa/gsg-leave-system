import React from 'react';
import { Download, RefreshCw, WifiOff, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { usePwaInstall, useOnlineStatus } from '../hooks/usePwa.js';

/**
 * Three-purpose banner stack rendered above the main app shell:
 *
 *   1. Offline indicator   – shows when navigator is offline
 *   2. Install prompt      – shows when `beforeinstallprompt` has fired
 *      and the user hasn't dismissed it
 *   3. Update notification – shows when vite-plugin-pwa has fetched a
 *      new service worker; clicking reloads to apply it
 *
 * All three are unobtrusive (top-of-page, dismissible) and never block
 * interaction with the underlying app.
 */
const PwaBanner = () => {
  const isOnline = useOnlineStatus();
  const { canInstall, promptInstall, dismiss: dismissInstall } = usePwaInstall();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Check for updates every 30 minutes while the app is open
      if (r) setInterval(() => r.update(), 30 * 60 * 1000);
    },
    onRegisterError(err) {
      console.warn('SW registration failed:', err);
    },
  });

  return (
    <div className="fixed top-0 left-0 right-0 z-[300] pointer-events-none">
      <div className="max-w-3xl mx-auto px-3 pt-2 space-y-2">
        {/* ── Offline ─────────────────────────────────────────────────── */}
        {!isOnline && (
          <div className="pointer-events-auto flex items-center gap-2 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg shadow-md px-4 py-2 text-sm">
            <WifiOff size={16} className="shrink-0" />
            <span className="flex-1">
              <strong>You're offline.</strong> Cached data is still visible — changes will sync when you reconnect.
            </span>
          </div>
        )}

        {/* ── Update available ────────────────────────────────────────── */}
        {needRefresh && (
          <div className="pointer-events-auto flex items-center gap-2 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg shadow-md px-4 py-2 text-sm">
            <RefreshCw size={16} className="shrink-0" />
            <span className="flex-1">
              A new version of LeaveHub is ready.
            </span>
            <button
              onClick={() => updateServiceWorker(true)}
              className="px-3 py-1 rounded bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
            >
              Reload
            </button>
            <button
              onClick={() => setNeedRefresh(false)}
              className="text-emerald-700/70 hover:text-emerald-900"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* ── Install prompt ──────────────────────────────────────────── */}
        {canInstall && (
          <div className="pointer-events-auto flex items-center gap-2 bg-indigo-50 border border-indigo-300 text-indigo-900 rounded-lg shadow-md px-4 py-2 text-sm">
            <Download size={16} className="shrink-0" />
            <span className="flex-1">
              <strong>Install LeaveHub</strong> for one-tap access and a faster experience.
            </span>
            <button
              onClick={promptInstall}
              className="px-3 py-1 rounded bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
            >
              Install
            </button>
            <button
              onClick={dismissInstall}
              className="text-indigo-700/70 hover:text-indigo-900"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PwaBanner;

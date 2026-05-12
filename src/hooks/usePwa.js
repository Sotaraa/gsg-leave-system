import { useEffect, useState } from 'react';

/**
 * PWA install + online status hooks.
 *
 * Why both in one file: they're tiny, related, and only used together
 * by the PwaBanner component. Keeping them co-located avoids splitting
 * trivial logic across multiple files.
 */

// ─── Online / offline status ───────────────────────────────────────────────
/**
 * Returns true when the browser believes it has network connectivity.
 * Updates instantly on `online`/`offline` events.
 */
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const goOnline  = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return isOnline;
};

// ─── PWA install prompt ────────────────────────────────────────────────────
/**
 * Captures the `beforeinstallprompt` event so we can offer an install
 * button at a moment that makes sense (e.g. after the user signs in).
 *
 * Returns:
 *   canInstall  – true if the browser supports install and the user hasn't
 *                 dismissed it yet
 *   isInstalled – true if the app is already running as an installed PWA
 *   promptInstall() – call from a click handler to show the native prompt
 *   dismiss()   – hide the prompt for this session
 */
export const usePwaInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled,    setIsInstalled]    = useState(false);
  const [dismissed,      setDismissed]      = useState(
    () => sessionStorage.getItem('pwa-install-dismissed') === '1'
  );

  useEffect(() => {
    // Detect if already running as installed PWA (standalone display mode)
    const checkStandalone = () => {
      const standalone =
        window.matchMedia?.('(display-mode: standalone)').matches ||
        // iOS Safari
        window.navigator.standalone === true;
      setIsInstalled(standalone);
    };
    checkStandalone();

    const onBeforeInstall = (e) => {
      // Chrome fires this when the app meets install criteria
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (choice.outcome !== 'accepted') {
      // User dismissed — don't pester them again this session
      sessionStorage.setItem('pwa-install-dismissed', '1');
      setDismissed(true);
    }
    return choice.outcome === 'accepted';
  };

  const dismiss = () => {
    sessionStorage.setItem('pwa-install-dismissed', '1');
    setDismissed(true);
  };

  return {
    canInstall: !!deferredPrompt && !dismissed && !isInstalled,
    isInstalled,
    promptInstall,
    dismiss,
  };
};

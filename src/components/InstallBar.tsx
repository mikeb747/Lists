import React, { useState, useEffect } from 'react';
import { usePlanner } from '../context/PlannerContext';

export const InstallBar: React.FC = () => {
  const { settings, confirmAction } = usePlanner();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    try {
      const dismissed = localStorage.getItem('lists_install_banner_dismissed') === 'true';
      setIsDismissed(dismissed);
    } catch (_) {}

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (isStandalone || isDismissed || !deferredPrompt) {
    return null;
  }

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        setDeferredPrompt(null);
      } catch (err) {
        console.warn('Install error:', err);
      }
    } else {
      const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
      if (isIOS) {
        confirmAction({
          title: 'Install on iOS',
          message:
            "To install Lists on your iPhone or iPad, tap the Share icon ⎋ in Safari, then choose 'Add to Home Screen'.",
          okLabel: 'Got it',
          onConfirm: () => {},
        });
      }
    }
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem('lists_install_banner_dismissed', 'true');
    } catch (_) {}
    setIsDismissed(true);
  };

  const appName = settings.appName || 'Lists';

  return (
    <div id="install-bar" className="install-bar">
      <div className="install-card">
        <div className="install-card-info">
          <span className="install-card-title">Install {appName} App</span>
          <span className="install-card-desc">Quick access from your desktop or home screen</span>
        </div>
        <div className="install-card-actions">
          <button
            type="button"
            id="install-app-btn"
            className="install-action-btn"
            onClick={handleInstallClick}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7ZM5 18v2h14v-2H5Z" />
            </svg>
            <span>Install</span>
          </button>
          <button
            type="button"
            id="btn-dismiss-install"
            className="install-dismiss-btn"
            aria-label="Dismiss install banner"
            onClick={handleDismiss}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                fill="currentColor"
                d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41Z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

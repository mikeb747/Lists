import React, { useRef, useState, useEffect } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { ThemeType, TaskColorMode } from '../../types';
import { playReminderChime } from '../../services/audio';

const COLOR_SWATCHES = [
  { id: 'purple', name: 'Purple (Iris)', color: '#6750a4' },
  { id: 'indigo', name: 'Indigo (Royal)', color: '#4f46e5' },
  { id: 'blue', name: 'Blue (Ocean)', color: '#0061a4' },
  { id: 'sky', name: 'Sky (Azure)', color: '#0284c7' },
  { id: 'cyan', name: 'Cyan (Aquamarine)', color: '#0891b2' },
  { id: 'teal', name: 'Teal (Emerald)', color: '#006a60' },
  { id: 'mint', name: 'Mint (Spearmint)', color: '#059669' },
  { id: 'green', name: 'Green (Botanical)', color: '#386a20' },
  { id: 'lime', name: 'Lime (Citrus)', color: '#65a30d' },
  { id: 'amber', name: 'Amber (Gold)', color: '#d97706' },
  { id: 'orange', name: 'Orange (Sunset)', color: '#8b5000' },
  { id: 'deeporange', name: 'Coral (Terracotta)', color: '#c2410c' },
  { id: 'red', name: 'Red (Crimson)', color: '#b91c1c' },
  { id: 'rose', name: 'Rose (Berry)', color: '#984061' },
  { id: 'pink', name: 'Pink (Blossom)', color: '#db2777' },
  { id: 'slate', name: 'Slate (Charcoal)', color: '#475569' },
];

export const SettingsSheet: React.FC = () => {
  const {
    settingsSheetOpen,
    closeSettingsSheet,
    settings,
    updateSettings,
    openAppNameDialog,
    tasks,
    cloudUser,
    syncStatus,
    syncStatusMsg,
    lastCloudTaskCount,
    connectCloud,
    disconnectCloud,
    pushAllToCloudAction,
    overwriteCloudAction,
    pullCloudAction,
    exportLocalBackup,
    importLocalBackup,
    showToast,
  } = usePlanner();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notifPerm, setNotifPerm] = useState<string>('default');
  const [isInstalled, setIsInstalled] = useState<boolean>(false);

  useEffect(() => {
    if ('Notification' in window) {
      setNotifPerm(Notification.permission);
    }
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(Boolean(isStandalone));
  }, [settingsSheetOpen]);

  if (!settingsSheetOpen) return null;

  const handleThemeChange = (val: ThemeType) => {
    updateSettings({ theme: val });
  };

  const handleColorChange = (col: string) => {
    updateSettings({ colorTheme: col });
  };

  const handleCardColorModeChange = (mode: TaskColorMode) => {
    updateSettings({ taskColorMode: mode });
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importLocalBackup(file);
    }
  };

  const handleRequestNotif = async () => {
    if (!('Notification' in window)) {
      showToast('Notifications are not supported in this browser');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotifPerm(perm);
      if (perm === 'granted') {
        showToast('Notifications enabled!');
      }
    } catch {
      setNotifPerm(Notification.permission);
    }
  };

  const handleTestNotification = async () => {
    playReminderChime();
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(`Test Alert • ${settings.appName || 'Lists'}`, {
          body: 'Notifications and sound chime are working properly!',
          icon: './icons/icon-512.png',
        });
      } else {
        const perm = await Notification.requestPermission();
        setNotifPerm(perm);
        if (perm === 'granted') {
          new Notification(`Test Alert • ${settings.appName || 'Lists'}`, {
            body: 'Notifications are enabled!',
            icon: './icons/icon-512.png',
          });
        }
      }
    }
    showToast('Chime played and test alert triggered!');
  };

  const handleInstallClick = () => {
    const installBtn = document.getElementById('install-app-btn');
    if (installBtn) {
      installBtn.click();
    } else {
      showToast('Install prompt can be triggered via browser menu');
    }
  };

  const activeTheme = settings.theme || 'system';
  const activeColor = settings.colorTheme || 'purple';
  const activeTaskColorMode = settings.taskColorMode || 'both';

  const t1 = Number(settings.tabDragHoldMs) || 400;
  const t2 = Number(settings.tabOptionsHoldMs) || 1000;

  let notifStatusText = 'Permission not yet granted';
  if (!('Notification' in window)) {
    notifStatusText = 'Not supported in this browser';
  } else if (notifPerm === 'granted') {
    notifStatusText = 'Alerts enabled ✓';
  } else if (notifPerm === 'denied') {
    notifStatusText = 'Blocked in browser site settings';
  }

  return (
    <>
      <div className="scrim" onClick={closeSettingsSheet} />
      <section
        id="sheet-settings"
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <button
          type="button"
          className="sheet-close-btn"
          data-close-sheet
          aria-label="Close"
          onClick={closeSettingsSheet}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              d="M6 6l12 12M18 6L6 18"
            />
          </svg>
        </button>
        <div className="sheet-handle" role="button" aria-label="Drag down to minimize" />
        <h2 id="settings-title">Settings</h2>
        <div className="settings-content">
          {/* Dark Mode */}
          <div className="settings-group">
            <label className="settings-label">Dark Mode</label>
            <div className="segmented-control" id="theme-segmented">
              <button
                type="button"
                className={`segmented-btn ${activeTheme === 'system' ? 'active' : ''}`}
                data-theme-val="system"
                onClick={() => handleThemeChange('system')}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M17 1H7c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm0 18H7V5h10v14z"
                  />
                </svg>
                <span>System</span>
              </button>
              <button
                type="button"
                className={`segmented-btn ${activeTheme === 'light' ? 'active' : ''}`}
                data-theme-val="light"
                onClick={() => handleThemeChange('light')}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 0 0 0-1.41.996.996 0 0 0 0 1.41l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"
                  />
                </svg>
                <span>Light</span>
              </button>
              <button
                type="button"
                className={`segmented-btn ${activeTheme === 'dark' ? 'active' : ''}`}
                data-theme-val="dark"
                onClick={() => handleThemeChange('dark')}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"
                  />
                </svg>
                <span>Dark</span>
              </button>
            </div>
          </div>

          {/* Colour Theme */}
          <div className="settings-group">
            <label className="settings-label">Colour Theme</label>
            <div className="color-picker-row" id="color-picker">
              {COLOR_SWATCHES.map((swatch) => (
                <button
                  key={swatch.id}
                  type="button"
                  className={`color-swatch-btn ${activeColor === swatch.id ? 'active' : ''}`}
                  data-color={swatch.id}
                  style={{ '--swatch-color': swatch.color } as React.CSSProperties}
                  aria-label={`${swatch.name} theme`}
                  title={swatch.name}
                  onClick={() => handleColorChange(swatch.id)}
                >
                  <span className="swatch-check">✓</span>
                </button>
              ))}
            </div>
          </div>

          {/* Task Card Background Colour */}
          <div className="settings-group" id="settings-task-color-group">
            <label className="settings-label">Task Card Background Colour</label>
            <p className="settings-hint">
              Colour-code task backgrounds dynamically based on deadline urgency, importance rating,
              or both.
            </p>
            <div className="segmented-control" id="task-color-segmented">
              <button
                type="button"
                className={`segmented-btn ${activeTaskColorMode === 'none' ? 'active' : ''}`}
                data-task-color-val="none"
                onClick={() => handleCardColorModeChange('none')}
              >
                <span>None</span>
              </button>
              <button
                type="button"
                className={`segmented-btn ${activeTaskColorMode === 'deadline' ? 'active' : ''}`}
                data-task-color-val="deadline"
                onClick={() => handleCardColorModeChange('deadline')}
              >
                <span>Deadline</span>
              </button>
              <button
                type="button"
                className={`segmented-btn ${activeTaskColorMode === 'importance' ? 'active' : ''}`}
                data-task-color-val="importance"
                onClick={() => handleCardColorModeChange('importance')}
              >
                <span>Importance</span>
              </button>
              <button
                type="button"
                className={`segmented-btn ${activeTaskColorMode === 'both' ? 'active' : ''}`}
                data-task-color-val="both"
                onClick={() => handleCardColorModeChange('both')}
              >
                <span>Both</span>
              </button>
            </div>
          </div>

          {/* PWA Installation */}
          <div className="settings-group" id="settings-pwa-group">
            <label className="settings-label">PWA Installation</label>
            <button
              type="button"
              id="btn-settings-install"
              className="settings-item-btn"
              onClick={handleInstallClick}
            >
              <div className="settings-item-left">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"
                  />
                </svg>
                <div className="settings-item-text">
                  <span className="settings-item-title" id="settings-install-title">
                    Install App
                  </span>
                  <span className="settings-item-subtitle" id="settings-install-status">
                    {isInstalled
                      ? 'App is installed on this device'
                      : 'Install on this device for offline access'}
                  </span>
                </div>
              </div>
              <svg viewBox="0 0 24 24" width="20" height="20" className="chevron-icon" aria-hidden="true">
                <path fill="currentColor" d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
              </svg>
            </button>
          </div>

          {/* Tab Press Timers */}
          <div className="settings-group" id="settings-tab-timers-group">
            <label className="settings-label">Tab Press Timers</label>
            <p className="settings-hint">
              Configure touch &amp; hold durations for dragging tabs and opening tab options on
              touchscreen devices.
            </p>
            <div className="timer-setting-item">
              <div className="timer-setting-header">
                <span className="timer-setting-title">Timer 1: Drag Activation</span>
                <span className="timer-setting-value" id="val-timer1">
                  {t1} ms
                </span>
              </div>
              <p className="timer-setting-hint">Hold a category tab this long to lift it and drag to reorder.</p>
              <input
                type="range"
                id="input-timer1"
                className="timer-range-slider"
                min="200"
                max="1000"
                step="50"
                value={t1}
                onChange={(e) => updateSettings({ tabDragHoldMs: Number(e.target.value) })}
                aria-label="Timer 1 drag activation hold duration"
              />
            </div>
            <div className="timer-setting-item">
              <div className="timer-setting-header">
                <span className="timer-setting-title">Timer 2: Tab Options</span>
                <span className="timer-setting-value" id="val-timer2">
                  {t2} ms
                </span>
              </div>
              <p className="timer-setting-hint">Hold still without dragging to open color palette and options.</p>
              <input
                type="range"
                id="input-timer2"
                className="timer-range-slider"
                min="500"
                max="2500"
                step="50"
                value={t2}
                onChange={(e) => updateSettings({ tabOptionsHoldMs: Number(e.target.value) })}
                aria-label="Timer 2 tab options hold duration"
              />
            </div>
          </div>

          {/* Reminders & Notifications */}
          <div className="settings-group">
            <label className="settings-label">Reminders &amp; Notifications</label>
            <div className="settings-item-btn" id="notif-settings-row" style={{ cursor: 'default' }}>
              <div className="settings-item-left">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"
                  />
                </svg>
                <div className="settings-item-text">
                  <span className="settings-item-title">Browser Notifications</span>
                  <span className="settings-item-subtitle" id="notif-perm-status">
                    {notifStatusText}
                  </span>
                </div>
              </div>
              <button
                type="button"
                id="btn-request-notif"
                className="btn-text-sm"
                style={{ marginLeft: 'auto' }}
                disabled={notifPerm === 'granted' || notifPerm === 'denied'}
                onClick={handleRequestNotif}
              >
                {notifPerm === 'granted' ? 'Enabled' : notifPerm === 'denied' ? 'Blocked' : 'Enable'}
              </button>
            </div>
            <div className="settings-actions-row" style={{ marginTop: '8px' }}>
              <button
                type="button"
                id="btn-test-notif"
                className="btn-text-outlined"
                onClick={handleTestNotification}
              >
                Send Test Alert
              </button>
            </div>
          </div>

          {/* Program Name */}
          <div className="settings-group">
            <label className="settings-label">Program Name</label>
            <p className="settings-hint">
              Customize the program name shown in the top header and browser tab. Current: <strong>{settings.appName || 'Lists'}</strong>
            </p>
            <div className="settings-actions-row">
              <button
                type="button"
                className="btn-text-outlined"
                onClick={() => {
                  closeSettingsSheet();
                  openAppNameDialog();
                }}
              >
                Change Program Name
              </button>
            </div>
          </div>

          {/* Data Storage */}
          <div className="settings-group">
            <label className="settings-label">Data Storage</label>
            <p className="settings-hint">Data is stored locally on this device in browser IndexedDB.</p>
            <div className="settings-actions-row">
              <button
                type="button"
                id="btn-export-data"
                className="btn-text-outlined"
                onClick={exportLocalBackup}
              >
                Export JSON
              </button>
              <button
                type="button"
                id="btn-import-data"
                className="btn-text-outlined"
                onClick={() => fileInputRef.current?.click()}
              >
                Import JSON
              </button>
              <input
                type="file"
                id="file-import-data"
                ref={fileInputRef}
                accept=".json"
                hidden
                onChange={handleFileImport}
              />
            </div>
          </div>

          {/* Live Realtime Multi-Device Sync (Firebase Cloud Firestore) */}
          <div className="settings-group" id="cloud-sync-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <label className="settings-label" style={{ marginBottom: 0 }}>
                Multi-Device Live Sync
              </label>
              <span
                id="cloud-sync-badge"
                className="action-badge"
                style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#047857',
                  fontSize: '0.72rem',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontWeight: 600,
                }}
              >
                Realtime
              </span>
            </div>
            <p className="settings-hint">
              Sync tasks in real time across PC, phone, and tablet with your Google account. Never lose
              work: smart merge combines changes, and new devices automatically adopt your cloud tasks.
            </p>
            {!cloudUser ? (
              <div id="cloud-disconnected-ui">
                <button
                  type="button"
                  className="gsi-material-button"
                  id="btn-cloud-connect"
                  onClick={connectCloud}
                >
                  <div className="gsi-material-button-state"></div>
                  <div className="gsi-material-button-content-wrapper">
                    <div className="gsi-material-button-icon">
                      <svg
                        version="1.1"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 48 48"
                        style={{ display: 'block' }}
                      >
                        <path
                          fill="#EA4335"
                          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                        ></path>
                        <path
                          fill="#4285F4"
                          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                        ></path>
                        <path
                          fill="#FBBC05"
                          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                        ></path>
                        <path
                          fill="#34A853"
                          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                        ></path>
                        <path fill="none" d="M0 0h48v48H0z"></path>
                      </svg>
                    </div>
                    <span className="gsi-material-button-contents">Sign in for Live Sync</span>
                  </div>
                </button>
              </div>
            ) : (
              <div id="cloud-connected-ui">
                <div className="google-user-card">
                  <img
                    id="cloud-user-photo"
                    className="google-user-avatar"
                    src={cloudUser.photoURL || ''}
                    alt="Profile"
                  />
                  <div className="google-user-info">
                    <span id="cloud-user-name" className="google-user-name">
                      {cloudUser.displayName || 'User'}
                    </span>
                    <span id="cloud-user-email" className="google-user-email">
                      {cloudUser.email || ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    id="btn-cloud-disconnect"
                    className="btn-text-sm"
                    title="Disconnect Live Sync"
                    onClick={disconnectCloud}
                  >
                    Disconnect
                  </button>
                </div>
                {/* Version Comparison & Status Card */}
                <div className="sync-summary-card">
                  <div className="sync-device-row">
                    <span className="sync-device-label">
                      <svg viewBox="0 0 24 24" width="16" height="16">
                        <path
                          fill="currentColor"
                          d="M4 6h16v10H4V6zm16 12H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2h16c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2zm-8 1h4v2h-4v-2z"
                        />
                      </svg>
                      This Device:
                    </span>
                    <span id="sync-local-count" className="sync-device-count">
                      {tasks.length} task{tasks.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="sync-device-row">
                    <span className="sync-device-label">
                      <svg viewBox="0 0 24 24" width="16" height="16">
                        <path
                          fill="currentColor"
                          d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"
                        />
                      </svg>
                      Cloud Storage:
                    </span>
                    <span id="sync-cloud-count" className="sync-device-count">
                      {lastCloudTaskCount} task{lastCloudTaskCount === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div
                    id="sync-compare-hint"
                    style={{
                      fontSize: '0.73rem',
                      color: 'var(--md-on-surface-variant)',
                      marginTop: '2px',
                    }}
                  >
                    {syncStatusMsg || (syncStatus === 'synced' ? 'Up to date with Cloud' : 'Ready to sync')}
                  </div>
                </div>
                {/* Resolution & Direction Controls */}
                <div className="sync-actions-grid">
                  <button
                    type="button"
                    id="btn-cloud-merge"
                    className="sync-action-btn-primary"
                    title="Merge both devices safely keeping newest edits"
                    onClick={pushAllToCloudAction}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16">
                      <path
                        fill="currentColor"
                        d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"
                      />
                    </svg>
                    Smart Merge (Keep Both Devices)
                  </button>
                  <div className="sync-actions-row-secondary">
                    <button
                      type="button"
                      id="btn-cloud-pull"
                      className="btn-text-outlined"
                      title="Replace this device's tasks with Cloud version"
                      onClick={pullCloudAction}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="15"
                        height="15"
                        style={{ verticalAlign: '-2px', marginRight: '3px' }}
                      >
                        <path
                          fill="currentColor"
                          d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"
                        />
                      </svg>
                      Pull from Cloud
                    </button>
                    <button
                      type="button"
                      id="btn-cloud-push-all"
                      className="btn-text-outlined"
                      title="Overwrite Cloud with this device's tasks"
                      onClick={overwriteCloudAction}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="15"
                        height="15"
                        style={{ verticalAlign: '-2px', marginRight: '3px' }}
                      >
                        <path
                          fill="currentColor"
                          d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"
                        />
                      </svg>
                      Push to Cloud
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div id="cloud-sync-status" className="drive-status-message" style={{ marginTop: '8px' }}>
              <span>
                {syncStatus === 'synced'
                  ? 'All changes synced in real time'
                  : syncStatusMsg || 'Ready for multi-device sync'}
              </span>
            </div>
          </div>

          <div className="settings-footer">
            <span className="settings-version" id="settings-version-string">
              Lists v1.6.0 • Offline PWA
            </span>
          </div>
        </div>
      </section>
    </>
  );
};

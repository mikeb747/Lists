import React from 'react';
import { usePlanner } from '../context/PlannerContext';
import { SortMode } from '../types';

const SORT_LABELS: Record<SortMode, string> = {
  manual: 'Manual order',
  today: 'Due today',
  tomorrow: 'Due tomorrow',
  due7: 'Due next 7 days',
  importance: 'Sorted by importance',
  time: 'Sorted by estimated time',
  quickWins: 'Quick wins',
};

export const Header: React.FC = () => {
  const {
    settings,
    openBulkPasteSheet,
    openFilterSheet,
    openSettingsSheet,
    cloudUser,
    syncStatus,
  } = usePlanner();



  return (
    <header className="top-app-bar">
      <div className="bar-title">
        <h1 id="app-title" className="app-title-header">
          {settings.appName || 'Lists'}
        </h1>
        <p id="sort-caption" className="sort-caption">
          {SORT_LABELS[settings.sortMode] || 'Manual order'}
        </p>
      </div>

      <div className="bar-actions">

        <button
          type="button"
          id="btn-bulk-paste"
          className="icon-btn"
          aria-label="Paste multiple tasks"
          title="Paste multiple tasks"
          onClick={openBulkPasteSheet}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z"
            />
          </svg>
        </button>

        <button
          type="button"
          id="btn-filter"
          className="icon-btn"
          aria-label="Sort and filters"
          title="Sort and filters"
          onClick={openFilterSheet}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M10 18h4v-2h-4v2ZM3 6v2h18V6H3Zm3 7h12v-2H6v2Z"
            />
          </svg>
        </button>

        {(() => {
          const isCloudWorking = Boolean(cloudUser && syncStatus === 'synced');
          return (
            <button
              type="button"
              id="btn-cloud-status-indicator"
              className={`icon-btn header-sync-indicator ${isCloudWorking ? 'sync-working' : 'sync-offline'}`}
              aria-label={isCloudWorking ? 'Cloud sync is working' : 'Cloud sync is not working'}
              title={isCloudWorking ? 'Cloud sync working' : 'Cloud sync not working (tap for settings)'}
              onClick={openSettingsSheet}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"
                />
              </svg>
              {isCloudWorking ? (
                <span
                  id="header-sync-dot"
                  className="header-sync-dot"
                  aria-hidden="true"
                />
              ) : (
                <span
                  id="header-sync-cross"
                  className="header-sync-cross"
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 12 12" width="8" height="8" aria-hidden="true">
                    <path
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      d="M2.5 2.5l7 7M9.5 2.5l-7 7"
                    />
                  </svg>
                </span>
              )}
            </button>
          );
        })()}

        <button
          type="button"
          id="btn-settings"
          className="icon-btn"
          aria-label="Settings"
          title="Settings"
          onClick={openSettingsSheet}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6-3.6 3.6 1.62 3.6-3.6 3.6z"
            />
          </svg>
        </button>
      </div>
    </header>
  );
};

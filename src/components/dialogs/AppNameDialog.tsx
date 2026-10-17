import React, { useState, useEffect } from 'react';
import { usePlanner } from '../../context/PlannerContext';

export const AppNameDialog: React.FC = () => {
  const { appNameDialogOpen, closeAppNameDialog, settings, updateSettings, showToast } =
    usePlanner();
  const [name, setName] = useState('');

  useEffect(() => {
    if (appNameDialogOpen) {
      setName(settings.appName || 'Lists');
    }
  }, [appNameDialogOpen, settings.appName]);

  if (!appNameDialogOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim() || 'Lists';
    await updateSettings({ appName: trimmed });
    closeAppNameDialog();
    showToast(`Program name set to “${trimmed}”`);
  };

  const handleReset = async () => {
    await updateSettings({ appName: 'Lists' });
    closeAppNameDialog();
    showToast('Program name reset to “Lists”');
  };

  return (
    <>
      <div className="scrim" onClick={closeAppNameDialog} />
      <section
        id="dialog-app-name"
        className="dialog"
        role="dialog"
        aria-labelledby="app-name-dialog-title"
      >
        <form id="app-name-form" onSubmit={handleSubmit}>
          <h2 id="app-name-dialog-title">Change Program Name</h2>
          <p
            className="dialog-hint"
            style={{
              margin: '0 0 14px 0',
              fontSize: '0.8rem',
              color: 'var(--md-on-surface-variant)',
              lineHeight: 1.4,
            }}
          >
            Customize the program name shown in the top header and browser tab.
          </p>
          <label>
            Name
            <input
              type="text"
              name="appName"
              id="app-name-input"
              required
              maxLength={30}
              autoComplete="off"
              autoFocus
              placeholder="e.g. Lists, Tasks, Daily Planner"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div className="dialog-actions">
            <button
              type="button"
              id="app-name-reset"
              className="btn-text"
              style={{ marginRight: 'auto' }}
              onClick={handleReset}
            >
              Reset to Default
            </button>
            <button
              type="button"
              id="app-name-cancel"
              className="btn-text"
              onClick={closeAppNameDialog}
            >
              Cancel
            </button>
            <button type="submit" className="btn-filled">
              Save
            </button>
          </div>
        </form>
      </section>
    </>
  );
};

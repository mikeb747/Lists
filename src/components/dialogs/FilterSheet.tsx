import React from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { SortMode } from '../../types';

export const FilterSheet: React.FC = () => {
  const { filterSheetOpen, closeFilterSheet, settings, updateSettings } = usePlanner();

  if (!filterSheetOpen) return null;

  const handleSortChange = (mode: SortMode) => {
    updateSettings({ sortMode: mode });
  };

  const handleHideCompletedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateSettings({ hideCompleted: e.target.checked });
  };

  return (
    <>
      <div className="scrim" onClick={closeFilterSheet} />
      <section
        id="sheet-filter"
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-title"
      >
        <button
          type="button"
          className="sheet-close-btn"
          data-close-sheet
          aria-label="Close"
          onClick={closeFilterSheet}
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
        <h2 id="filter-title">Sort &amp; filters</h2>
        <p className="sheet-note">Manual order is restored when you return to Manual Order.</p>
        <form id="filter-form" className="choice-list" onSubmit={(e) => e.preventDefault()}>
          <label className="choice">
            <input
              type="radio"
              name="sortMode"
              value="manual"
              checked={settings.sortMode === 'manual'}
              onChange={() => handleSortChange('manual')}
            />
            <span>Manual order</span>
          </label>
          <label className="choice">
            <input
              type="radio"
              name="sortMode"
              value="today"
              checked={settings.sortMode === 'today'}
              onChange={() => handleSortChange('today')}
            />
            <span>Due today</span>
          </label>
          <label className="choice">
            <input
              type="radio"
              name="sortMode"
              value="tomorrow"
              checked={settings.sortMode === 'tomorrow'}
              onChange={() => handleSortChange('tomorrow')}
            />
            <span>Due tomorrow</span>
          </label>
          <label className="choice">
            <input
              type="radio"
              name="sortMode"
              value="due7"
              checked={settings.sortMode === 'due7'}
              onChange={() => handleSortChange('due7')}
            />
            <span>Due next 7 days</span>
          </label>
          <label className="choice">
            <input
              type="radio"
              name="sortMode"
              value="importance"
              checked={settings.sortMode === 'importance'}
              onChange={() => handleSortChange('importance')}
            />
            <span>Sort by importance</span>
          </label>
          <label className="choice">
            <input
              type="radio"
              name="sortMode"
              value="time"
              checked={settings.sortMode === 'time'}
              onChange={() => handleSortChange('time')}
            />
            <span>Sort by estimated time</span>
          </label>
          <label className="choice">
            <input
              type="radio"
              name="sortMode"
              value="quickWins"
              checked={settings.sortMode === 'quickWins'}
              onChange={() => handleSortChange('quickWins')}
            />
            <span>Quick wins</span>
          </label>
          <label className="choice switch-row">
            <span>Hide completed</span>
            <input
              type="checkbox"
              id="hide-completed"
              checked={Boolean(settings.hideCompleted)}
              onChange={handleHideCompletedChange}
            />
          </label>
        </form>
      </section>
    </>
  );
};

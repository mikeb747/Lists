import React from 'react';
import { usePlanner } from '../../context/PlannerContext';

export const MoveTaskSheet: React.FC = () => {
  const {
    moveTaskSheetOpen,
    closeMoveTaskSheet,
    movingTask,
    categories,
    moveTaskToCategory,
  } = usePlanner();

  if (!moveTaskSheetOpen || !movingTask) return null;

  const handleSelectCategory = (catId: string) => {
    moveTaskToCategory(movingTask.id, catId);
    closeMoveTaskSheet();
  };

  const items = [{ id: '', name: 'Uncategorized' }, ...categories];

  return (
    <>
      <div className="scrim" onClick={closeMoveTaskSheet} />
      <section
        id="sheet-move-task"
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-task-title"
      >
        <button
          type="button"
          className="sheet-close-btn"
          data-close-sheet
          aria-label="Close"
          onClick={closeMoveTaskSheet}
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
        <h2 id="move-task-title">Move to Tab</h2>
        <p className="sheet-note" id="move-task-desc">
          Move “{movingTask.name}” to:
        </p>
        <div id="move-tab-list" className="move-tab-list">
          {items.map((cat) => {
            const isCurrent = (movingTask.categoryId || '') === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                className={`move-tab-item ${isCurrent ? 'active' : ''}`}
                onClick={() => handleSelectCategory(cat.id)}
              >
                <span>{cat.name}</span>
                {isCurrent && <span className="move-tab-check">Current</span>}
              </button>
            );
          })}
        </div>
        <div className="dialog-actions" style={{ marginTop: '16px' }}>
          <button
            type="button"
            id="move-task-cancel"
            className="btn-text"
            onClick={closeMoveTaskSheet}
          >
            Cancel
          </button>
        </div>
      </section>
    </>
  );
};

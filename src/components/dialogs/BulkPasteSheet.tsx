import React, { useState, useRef, useEffect } from 'react';
import { usePlanner } from '../../context/PlannerContext';

export const BulkPasteSheet: React.FC = () => {
  const {
    bulkPasteSheetOpen,
    closeBulkPasteSheet,
    categories,
    settings,
    bulkAddTasks,
  } = usePlanner();

  const [text, setText] = useState('');
  const [targetCategory, setTargetCategory] = useState(
    settings.activeTab !== 'all' && settings.activeTab !== 'archive'
      ? settings.activeTab
      : (categories[0]?.id ?? '')
  );

  const [isKeyboardReady, setIsKeyboardReady] = useState(false);

  const sheetRef = useRef<HTMLElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (bulkPasteSheetOpen) {
      setIsKeyboardReady(false);
      // Explicitly blur any active input element so the Android virtual keyboard does not open automatically
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      if (textareaRef.current) {
        textareaRef.current.blur();
      }
      // Focus the sheet container itself instead of the text box
      sheetRef.current?.focus({ preventScroll: true });
    } else {
      setIsKeyboardReady(false);
    }
  }, [bulkPasteSheetOpen]);

  if (!bulkPasteSheetOpen) return null;

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => line.replace(/^[-*•\–\—]\s+/, ''))
    .filter((line) => line.length > 0);
  const taskCount = lines.length;

  const handlePasteClipboard = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText) {
        setText(clipText);
      }
    } catch (err) {
      console.warn('Clipboard read error:', err);
    }
  };

  const handleClear = () => {
    setText('');
  };

  const handleSubmit = async () => {
    if (!taskCount) return;
    await bulkAddTasks(lines, targetCategory);
    setText('');
    closeBulkPasteSheet();
  };

  return (
    <>
      <div className="scrim" onClick={closeBulkPasteSheet} />
      <section
        id="sheet-bulk-paste"
        className="sheet sheet-bulk"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-paste-title"
        ref={sheetRef}
        tabIndex={-1}
      >
        <button
          type="button"
          className="sheet-close-btn"
          data-close-sheet
          aria-label="Close"
          onClick={closeBulkPasteSheet}
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
        <div className="sheet-header-row">
          <div>
            <h2 id="bulk-paste-title">Paste Multiple Tasks</h2>
            <p className="sheet-note" id="bulk-paste-subtitle">
              Paste a list from notes, email, or clipboard to generate tasks all at once.
            </p>
          </div>
        </div>
        <div className="bulk-paste-content">
          <label className="bulk-category-label">
            <span>Add into tab:</span>
            <select
              id="bulk-category-select"
              className="bulk-select"
              value={targetCategory}
              onChange={(e) => setTargetCategory(e.target.value)}
            >
              {categories.length === 0 && <option value="">(No categories yet)</option>}
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="bulk-textarea-wrap">
            <textarea
              ref={textareaRef}
              id="bulk-paste-textarea"
              className="bulk-textarea"
              rows={7}
              autoFocus={false}
              readOnly={!isKeyboardReady}
              onClick={() => setIsKeyboardReady(true)}
              onTouchStart={() => setIsKeyboardReady(true)}
              onFocus={() => setIsKeyboardReady(true)}
              placeholder={'Paste list of items here (separated by line breaks)\ne.g.\nChapter 1: The Beginning\nChapter 2: Deep Dive\nChapter 3: Conclusion'}
              aria-label="List of items separated by line breaks"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <div className="bulk-toolbar">
            <button
              type="button"
              id="btn-paste-clipboard"
              className="btn-paste-action"
              title="Paste text from your clipboard"
              onClick={handlePasteClipboard}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z"
                />
              </svg>
              <span>Paste from clipboard</span>
            </button>
            <button
              type="button"
              id="btn-bulk-clear"
              className="btn-text-sm"
              title="Clear text"
              onClick={handleClear}
            >
              Clear
            </button>
            <span id="bulk-item-counter" className="bulk-counter-pill">
              {taskCount === 1 ? '1 task' : `${taskCount} tasks`}
            </span>
          </div>
          <div className="dialog-actions" style={{ marginTop: '14px' }}>
            <button
              type="button"
              id="bulk-paste-cancel"
              className="btn-text"
              onClick={closeBulkPasteSheet}
            >
              Cancel
            </button>
            <button
              type="button"
              id="bulk-paste-submit"
              className="btn-filled"
              disabled={taskCount === 0}
              onClick={handleSubmit}
            >
              Add Tasks
            </button>
          </div>
        </div>
      </section>
    </>
  );
};

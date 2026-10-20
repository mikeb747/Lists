import React, { useRef, useState, useEffect } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { SubtaskItem, RecurrenceType } from '../../types';

export const TaskDialog: React.FC = () => {
  const {
    taskDialogOpen,
    closeTaskDialog,
    editingTask,
    addTask,
    updateTask,
    categories,
    settings,
  } = usePlanner();

  const [name, setName] = useState('');
  const [isSubheading, setIsSubheading] = useState(false);
  const [importance, setImportance] = useState(3);
  const [estimatedTime, setEstimatedTime] = useState(60);
  const [dueDate, setDueDate] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('none');
  const [reminderAt, setReminderAt] = useState('');
  const [subtasks, setSubtasks] = useState<SubtaskItem[]>([]);
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const importanceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTask) {
      setName(editingTask.name || '');
      setIsSubheading(Boolean(editingTask.isSubheading));
      setImportance(editingTask.importance ?? 3);
      setEstimatedTime(
        editingTask.estimatedTime !== undefined ? editingTask.estimatedTime : 60
      );
      setDueDate(editingTask.dueDate || '');
      setCategoryId(
        editingTask.categoryId ||
          (settings.activeTab !== 'all' && settings.activeTab !== 'archive'
            ? settings.activeTab
            : categories[0]?.id || '')
      );
      setRecurrence((editingTask.recurrence as RecurrenceType) || 'none');
      setReminderAt(editingTask.reminderAt || '');
      setSubtasks(editingTask.subtasks ? [...editingTask.subtasks] : []);
    } else {
      setName('');
      setIsSubheading(false);
      setImportance(3);
      setEstimatedTime(60);
      setDueDate('');
      const defaultCat =
        settings.activeTab !== 'all' && settings.activeTab !== 'archive'
          ? settings.activeTab
          : categories[0]?.id || '';
      setCategoryId(defaultCat);
      setRecurrence('none');
      setReminderAt('');
      setSubtasks([]);
    }
    setNewSubtaskText('');
  }, [editingTask, taskDialogOpen, categories, settings.activeTab]);

  if (!taskDialogOpen) return null;

  const handleAddSubtask = () => {
    const trimmed = newSubtaskText.trim();
    if (!trimmed) return;
    setSubtasks((prev) => [
      ...prev,
      { id: crypto.randomUUID(), title: trimmed, completed: false },
    ]);
    setNewSubtaskText('');
  };

  const handleMoveSubtask = (idx: number, direction: 'up' | 'down') => {
    setSubtasks((prev) => {
      const next = [...prev];
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= next.length) return prev;
      const temp = next[idx];
      next[idx] = next[targetIdx];
      next[targetIdx] = temp;
      return next;
    });
  };

  const handleDeleteSubtask = (idx: number) => {
    setSubtasks((prev) => prev.filter((_, i) => i !== idx));
  };

  const applyReminderPreset = (preset: '1h' | '3h' | 'tomorrow-9am' | 'due-9am') => {
    const now = new Date();
    let target = new Date();
    if (preset === '1h') {
      target = new Date(now.getTime() + 60 * 60 * 1000);
    } else if (preset === '3h') {
      target = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    } else if (preset === 'tomorrow-9am') {
      target.setDate(target.getDate() + 1);
      target.setHours(9, 0, 0, 0);
    } else if (preset === 'due-9am') {
      if (dueDate) {
        target = new Date(`${dueDate}T09:00:00`);
      } else {
        target.setDate(target.getDate() + 1);
        target.setHours(9, 0, 0, 0);
      }
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    const val = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(
      target.getDate()
    )}T${pad(target.getHours())}:${pad(target.getMinutes())}`;
    setReminderAt(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    if (editingTask) {
      await updateTask({
        ...editingTask,
        name: trimmedName,
        isSubheading,
        importance: isSubheading ? 3 : importance,
        estimatedTime: isSubheading ? 0 : estimatedTime,
        dueDate: isSubheading ? '' : dueDate,
        categoryId: categoryId || (categories[0]?.id ?? ''),
        recurrence: isSubheading ? 'none' : recurrence,
        reminderAt: isSubheading ? '' : reminderAt,
        reminderFired:
          editingTask.reminderAt !== reminderAt ? false : editingTask.reminderFired,
        subtasks: isSubheading ? [] : subtasks,
      });
    } else {
      const added = await addTask({
        name: trimmedName,
        isSubheading,
        importance: isSubheading ? 3 : importance,
        estimatedTime: isSubheading ? 0 : estimatedTime,
        dueDate: isSubheading ? '' : dueDate,
        categoryId: categoryId || (categories[0]?.id ?? ''),
        recurrence: isSubheading ? 'none' : recurrence,
        reminderAt: isSubheading ? '' : reminderAt,
        subtasks: isSubheading ? [] : subtasks,
      });
      if (!added) return;
    }
    closeTaskDialog();
  };

  const dialogTitle = isSubheading
    ? editingTask
      ? 'Edit subheading'
      : 'Add subheading'
    : editingTask
    ? 'Edit task'
    : 'Add task';

  return (
    <>
      <div className="scrim" onClick={closeTaskDialog} />
      <section
        id="dialog-task"
        className="dialog sheet-like-dialog"
        role="dialog"
        aria-labelledby="task-dialog-title"
      >
        <button
          type="button"
          className="sheet-close-btn"
          data-close-sheet
          aria-label="Close"
          onClick={closeTaskDialog}
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
        <form id="task-form" onSubmit={handleSubmit}>
          <h2 id="task-dialog-title">{dialogTitle}</h2>
          <label>
            Name
            <input
              type="text"
              name="name"
              required
              maxLength={120}
              autoComplete="off"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (
                  (e.key === 'Enter' || e.code === 'NumpadEnter') &&
                  !e.nativeEvent.isComposing &&
                  !isSubheading
                ) {
                  e.preventDefault();
                  const importanceInput = importanceInputRef.current;
                  e.currentTarget.blur();
                  window.requestAnimationFrame(() => importanceInput?.focus());
                }
              }}
            />
          </label>
          <label className="choice switch-row">
            <span>Make this a subheading (section header)</span>
            <input
              type="checkbox"
              name="isSubheading"
              id="task-is-subheading"
              checked={isSubheading}
              onChange={(e) => setIsSubheading(e.target.checked)}
            />
          </label>
          {!isSubheading && (
            <div id="task-meta-fields">
              <label>
                Importance
                <input
                  type="range"
                  name="importance"
                  ref={importanceInputRef}
                  min="1"
                  max="5"
                  step="1"
                  value={importance}
                  onChange={(e) => setImportance(Number(e.target.value))}
                />
                <span id="importance-value" className="hint">
                  {importance}
                </span>
              </label>
              <label>
                Estimated time (minutes)
                <input
                  type="number"
                  name="estimatedTime"
                  min="1"
                  max="4800"
                  step="1"
                  value={estimatedTime}
                  required
                  onChange={(e) => setEstimatedTime(Number(e.target.value))}
                />
              </label>
              <label>
                Due date
                <input
                  type="date"
                  name="dueDate"
                  id="task-due-date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </label>
              <div className="form-row-reminder">
                <label htmlFor="task-reminder-input">Reminder (date &amp; time)</label>
                <div className="reminder-input-wrap">
                  <input
                    type="datetime-local"
                    name="reminderAt"
                    id="task-reminder-input"
                    value={reminderAt}
                    onChange={(e) => setReminderAt(e.target.value)}
                  />
                  <button
                    type="button"
                    id="btn-clear-reminder"
                    className="btn-text-sm"
                    title="Clear reminder"
                    onClick={() => setReminderAt('')}
                  >
                    Clear
                  </button>
                </div>
                <div className="reminder-presets-row">
                  <button
                    type="button"
                    className="preset-chip"
                    data-preset="1h"
                    onClick={() => applyReminderPreset('1h')}
                  >
                    +1 Hour
                  </button>
                  <button
                    type="button"
                    className="preset-chip"
                    data-preset="3h"
                    onClick={() => applyReminderPreset('3h')}
                  >
                    +3 Hours
                  </button>
                  <button
                    type="button"
                    className="preset-chip"
                    data-preset="tomorrow-9am"
                    onClick={() => applyReminderPreset('tomorrow-9am')}
                  >
                    Tomorrow 9 AM
                  </button>
                  <button
                    type="button"
                    className="preset-chip"
                    data-preset="due-9am"
                    onClick={() => applyReminderPreset('due-9am')}
                  >
                    Due Date 9 AM
                  </button>
                </div>
              </div>
              <label>
                Repeat (Recurring)
                <select
                  name="recurrence"
                  id="task-recurrence-select"
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value as RecurrenceType)}
                >
                  <option value="none">Does not repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekdays">Every weekday (Mon–Fri)</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Every 2 weeks</option>
                  <option value="monthly">Monthly</option>
                </select>
              </label>
              <div className="form-row-subtasks">
                <div className="subtasks-header-row">
                  <label className="subtasks-label">Subtask Checklist</label>
                  <span className="subtasks-count-hint" id="task-form-subtask-count">
                    {subtasks.length} step{subtasks.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="subtask-add-row">
                  <input
                    type="text"
                    id="input-new-subtask"
                    placeholder="Add a step / checklist item..."
                    maxLength={120}
                    autoComplete="off"
                    value={newSubtaskText}
                    onChange={(e) => setNewSubtaskText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSubtask();
                      }
                    }}
                  />
                  <button
                    type="button"
                    id="btn-add-subtask"
                    className="btn-text-sm"
                    title="Add step"
                    onClick={handleAddSubtask}
                  >
                    + Add
                  </button>
                </div>
                <div id="subtasks-editor-list" className="subtasks-editor-list">
                  {subtasks.length === 0 ? (
                    <span
                      style={{
                        fontSize: '0.78rem',
                        opacity: 0.6,
                        fontStyle: 'italic',
                        padding: '2px 0',
                      }}
                    >
                      No steps added yet.
                    </span>
                  ) : (
                    subtasks.map((sub, idx) => (
                      <div key={sub.id} className="subtask-editor-item">
                        <span>{sub.title}</span>
                        <div className="subtask-editor-actions">
                          <button
                            type="button"
                            className="btn-subtask-move"
                            data-subtask-up-idx={idx}
                            aria-label="Move step up"
                            title="Move up"
                            disabled={idx === 0}
                            onClick={() => handleMoveSubtask(idx, 'up')}
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            className="btn-subtask-move"
                            data-subtask-down-idx={idx}
                            aria-label="Move step down"
                            title="Move down"
                            disabled={idx === subtasks.length - 1}
                            onClick={() => handleMoveSubtask(idx, 'down')}
                          >
                            ▼
                          </button>
                          <button
                            type="button"
                            className="btn-subtask-del"
                            data-subtask-del-idx={idx}
                            aria-label="Delete step"
                            title="Delete"
                            onClick={() => handleDeleteSubtask(idx)}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
          <label>
            Category
            <select
              name="categoryId"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {categories.length === 0 ? (
                <option value="">(No categories yet)</option>
              ) : (
                categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))
              )}
            </select>
          </label>
          <div className="dialog-actions">
            <button
              type="button"
              id="task-cancel"
              className="btn-text"
              onClick={closeTaskDialog}
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

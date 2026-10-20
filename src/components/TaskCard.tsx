import React, { useState, useRef } from 'react';
import { usePlanner } from '../context/PlannerContext';
import { Task, Category } from '../types';

interface TaskCardProps {
  task: Task;
  category?: Category;
  isCompact?: boolean;
  manualOrder?: boolean;
  isArchive?: boolean;
  isDragging?: boolean;
  onReorderStart?: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onReorderEnd?: (e: React.PointerEvent<HTMLButtonElement>) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  category,
  isCompact = false,
  manualOrder = true,
  isArchive = false,
  isDragging = false,
  onReorderStart,
  onReorderEnd,
}) => {
  const {
    settings,
    toggleComplete,
    deleteTask,
    updateTask,
    openTaskActions,
    confirmAction,
  } = usePlanner();

  const [expandedSubtasks, setExpandedSubtasks] = useState(false);

  // Swipe handling state
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const hasDecidedAxisRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const swipeOffsetRef = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const SWIPE_THRESHOLD = 72;

  const getTodayISO = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
  };

  const addDaysISO = (days: number) => {
    const now = new Date(`${getTodayISO()}T00:00:00`);
    now.setDate(now.getDate() + days);
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
  };

  const getTaskCardColorAttr = () => {
    if (task.isSubheading || task.completed) return undefined;
    const mode = settings.taskColorMode || 'both';
    if (mode === 'none') return undefined;

    const today = getTodayISO();
    const tomorrow = addDaysISO(1);
    const nextWeek = addDaysISO(7);

    const isOverdue = task.dueDate && task.dueDate < today;
    const isToday = task.dueDate && task.dueDate === today;
    const isTomorrow = task.dueDate && task.dueDate === tomorrow;
    const isSoon = task.dueDate && task.dueDate > tomorrow && task.dueDate <= nextWeek;

    if (mode === 'deadline') {
      if (isOverdue) return 'deadline-overdue';
      if (isToday) return 'deadline-today';
      if (isTomorrow) return 'deadline-tomorrow';
      if (isSoon) return 'deadline-soon';
      return undefined;
    }

    if (mode === 'importance') {
      const imp = Number(task.importance) || 3;
      if (imp >= 5) return 'importance-5';
      if (imp === 4) return 'importance-4';
      if (imp === 3) return 'importance-3';
      if (imp === 2) return 'importance-2';
      return undefined;
    }

    if (mode === 'both') {
      if (isOverdue) return 'deadline-overdue';
      if (isToday) return 'deadline-today';
      const imp = Number(task.importance) || 3;
      if (imp >= 5) return 'importance-5';
      if (imp === 4) return 'importance-4';
      if (isTomorrow) return 'deadline-tomorrow';
      if (imp === 3) return 'importance-3';
      if (isSoon) return 'deadline-soon';
      if (imp === 2) return 'importance-2';
      return undefined;
    }

    return undefined;
  };

  const formatReminderBadge = (isoStr?: string) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return '';
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      if (isToday) return `Today ${timeStr}`;
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (d.toDateString() === tomorrow.toDateString()) return `Tmrw ${timeStr}`;
      return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeStr}`;
    } catch {
      return '';
    }
  };

  const formatRecurrence = (rec?: string) => {
    switch (rec) {
      case 'daily':
        return 'Daily';
      case 'weekdays':
        return 'Weekdays';
      case 'weekly':
        return 'Weekly';
      case 'biweekly':
        return 'Every 2w';
      case 'monthly':
        return 'Monthly';
      default:
        return '';
    }
  };

  const handleSubtaskToggle = (subtaskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!task.subtasks) return;
    const updated = task.subtasks.map((s) =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );
    updateTask({ ...task, subtasks: updated });
  };

  // Pointer swipe handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if (task.isSubheading || !e.isPrimary || activePointerIdRef.current !== null) return;
    if (
      (e.target as HTMLElement).closest(
        'button, .drag-handle, .task-complete, .task-icon-btn, .subtask-check-btn'
      )
    ) {
      return;
    }
    activePointerIdRef.current = e.pointerId;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    hasDecidedAxisRef.current = false;
    swipeOffsetRef.current = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (
      activePointerIdRef.current !== e.pointerId ||
      task.isSubheading ||
      !cardRef.current
    ) {
      return;
    }
    if (e.pointerType === 'mouse' && e.buttons === 0) {
      handlePointerCancel(e);
      return;
    }

    const deltaX = e.clientX - startXRef.current;
    const deltaY = e.clientY - startYRef.current;

    if (!hasDecidedAxisRef.current) {
      if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
        hasDecidedAxisRef.current = true;
        if (Math.abs(deltaY) >= Math.abs(deltaX)) {
          setIsSwiping(false);
          swipeOffsetRef.current = 0;
          setSwipeOffset(0);
          return;
        }
        setIsSwiping(true);
      }
    }

    if (isSwiping) {
      let visualX = deltaX;
      if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
        const excess = Math.abs(deltaX) - SWIPE_THRESHOLD;
        visualX = Math.sign(deltaX) * (SWIPE_THRESHOLD + excess * 0.35);
      }
      swipeOffsetRef.current = visualX;
      setSwipeOffset(visualX);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    activePointerIdRef.current = null;
    if (!isSwiping) {
      swipeOffsetRef.current = 0;
      setSwipeOffset(0);
      return;
    }
    setIsSwiping(false);
    const finalOffset = swipeOffsetRef.current;
    swipeOffsetRef.current = 0;
    setSwipeOffset(0);

    if (Math.abs(finalOffset) >= SWIPE_THRESHOLD) {
      if (finalOffset > 0) {
        // Swipe Right: Complete or restore
        const isArchived = Boolean(task.completed);
        confirmAction({
          title: isArchived ? 'Mark incomplete?' : 'Mark complete?',
          message: isArchived
            ? `Move “${task.name}” back to active tasks?`
            : `Mark “${task.name}” as complete?`,
          okLabel: isArchived ? 'Restore' : 'Complete',
          okClass: 'success',
          onConfirm: () => toggleComplete(task),
        });
      } else {
        // Swipe Left: Delete task
        confirmAction({
          title: 'Delete task?',
          message: `“${task.name}” will be removed.`,
          okLabel: 'Delete',
          okClass: 'danger',
          onConfirm: () => deleteTask(task.id),
        });
      }
    }
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    activePointerIdRef.current = null;
    hasDecidedAxisRef.current = false;
    swipeOffsetRef.current = 0;
    setIsSwiping(false);
    setSwipeOffset(0);
  };

  // Subheading Card
  if (task.isSubheading) {
    return (
      <div className="task-item-wrapper" data-id={task.id}>
        <article
          className={`task-card subheading ${isDragging ? 'dragging' : ''}`}
          data-id={task.id}
          data-is-subheading="true"
          onClick={() => openTaskActions(task)}
        >
          <button
            type="button"
            className="drag-handle"
            aria-label="Reorder"
            disabled={!manualOrder}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={onReorderStart}
            onPointerUp={onReorderEnd}
            onPointerCancel={onReorderEnd}
          >
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path
                fill="currentColor"
                d="M9 7h2v2H9V7zm4 0h2v2h-2V7zM9 11h2v2H9v-2zm4 0h2v2h-2v-2zM9 15h2v2H9v-2zm4 0h2v2h-2v-2z"
              />
            </svg>
          </button>
          <div className="task-body">
            <p className="task-name subheading-title">{task.name}</p>
          </div>
        </article>
      </div>
    );
  }

  // Subtasks calculations
  const hasSubtasks = Boolean(task.subtasks && task.subtasks.length > 0);
  const totalSubtasks = hasSubtasks ? task.subtasks!.length : 0;
  const doneSubtasks = hasSubtasks ? task.subtasks!.filter((s) => s.completed).length : 0;
  const pctSubtasks = totalSubtasks ? Math.round((doneSubtasks / totalSubtasks) * 100) : 0;
  const allSubtasksDone = doneSubtasks === totalSubtasks;

  const todayStr = getTodayISO();
  const isOverdue = task.dueDate && task.dueDate < todayStr && !task.completed;

  const cardClasses = [
    'task-card',
    task.completed ? 'completed' : '',
    isCompact ? 'compact' : '',
    !isCompact || isArchive ? 'has-controls' : '',
    isSwiping ? 'swiping' : '',
    isDragging ? 'dragging' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const cueProgress = Math.min(1, Math.abs(swipeOffset) / SWIPE_THRESHOLD);
  const completeCueOpacity = swipeOffset > 0 ? cueProgress : 0;
  const deleteCueOpacity = swipeOffset < 0 ? cueProgress : 0;

  return (
    <div className="task-item-wrapper" data-id={task.id}>
      {/* Swipe Right Cue: Complete */}
      <div className="swipe-action-cue cue-complete" style={{ opacity: completeCueOpacity }}>
        <span className="swipe-cue-icon">
          <svg viewBox="0 0 24 24">
            <path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
          </svg>
          <span>Complete</span>
        </span>
      </div>

      {/* Swipe Left Cue: Delete */}
      <div className="swipe-action-cue cue-delete" style={{ opacity: deleteCueOpacity }}>
        <span className="swipe-cue-icon">
          <span>Delete</span>
          <svg viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
            />
          </svg>
        </span>
      </div>

      {/* Foreground Card */}
      <article
        ref={cardRef}
        className={cardClasses}
        data-id={task.id}
        data-card-color={getTaskCardColorAttr()}
        style={{ transform: `translateX(${swipeOffset}px)` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClick={() => openTaskActions(task)}
      >
        <button
          type="button"
          className="drag-handle"
          aria-label="Reorder"
          disabled={!manualOrder}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={onReorderStart}
          onPointerUp={onReorderEnd}
          onPointerCancel={onReorderEnd}
        >
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path
              fill="currentColor"
              d="M9 7h2v2H9V7zm4 0h2v2h-2V7zM9 11h2v2H9v-2zm4 0h2v2h-2v-2zM9 15h2v2H9v-2zm4 0h2v2h-2v-2z"
            />
          </svg>
        </button>

        <div className="task-body">
          <div className="task-name-row">
            <p className="task-name">{task.name}</p>
            {isCompact && hasSubtasks && (
              <button
                type="button"
                className="compact-subtask-toggle-btn"
                aria-label={expandedSubtasks ? 'Hide subtasks' : 'Show subtasks'}
                title={expandedSubtasks ? 'Hide steps' : 'Show steps'}
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedSubtasks(!expandedSubtasks);
                }}
              >
                <span className="compact-subtask-badge">
                  {doneSubtasks}/{totalSubtasks}
                </span>
                <span className="compact-subtask-arrow">{expandedSubtasks ? '▲' : '▼'}</span>
              </button>
            )}
          </div>

          {!isCompact && (
            <div className="task-meta">
              <span
                className={`chip task-chip-importance ${
                  task.importance >= 4 ? 'importance-high' : ''
                }`}
              >
                Importance {task.importance}
              </span>
              <span className="chip task-chip-time">{task.estimatedTime}m</span>
              {task.dueDate && (
                <span className={`chip task-chip-due ${isOverdue ? 'overdue' : ''}`}>
                  {task.dueDate}
                </span>
              )}
              {task.reminderAt && !task.completed && (
                <span
                  className={`chip task-chip-reminder ${task.reminderFired ? 'fired' : ''}`}
                  title={`Reminder: ${formatReminderBadge(task.reminderAt)}`}
                >
                  🔔 {formatReminderBadge(task.reminderAt)}
                </span>
              )}
              {task.recurrence && task.recurrence !== 'none' && (
                <span
                  className="chip task-chip-recurrence"
                  title={`Repeats ${formatRecurrence(task.recurrence)}`}
                >
                  🔁 {formatRecurrence(task.recurrence)}
                </span>
              )}
              {category && (
                <span className="chip task-chip-category">{category.name}</span>
              )}
            </div>
          )}

          {/* Subtasks in standard view */}
          {!isCompact && hasSubtasks && (
            <div className="task-subtasks-summary" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="subtask-progress-btn"
                title="Toggle checklist"
                onClick={() => setExpandedSubtasks(!expandedSubtasks)}
              >
                <span className="subtask-progress-bar">
                  <span
                    className={`subtask-progress-fill ${allSubtasksDone ? 'all-done' : ''}`}
                    style={{ width: `${pctSubtasks}%` }}
                  />
                </span>
                <span className="subtask-progress-text">
                  {doneSubtasks}/{totalSubtasks} steps ({pctSubtasks}%)
                </span>
                <span className="subtask-toggle-arrow">{expandedSubtasks ? '▲' : '▼'}</span>
              </button>

              {expandedSubtasks && (
                <div className="task-subtasks-list">
                  {task.subtasks!.map((s) => (
                    <div
                      key={s.id}
                      className={`task-subtask-item ${s.completed ? 'completed' : ''}`}
                    >
                      <button
                        type="button"
                        className={`subtask-check-btn ${s.completed ? 'checked' : ''}`}
                        aria-label={s.completed ? 'Mark step incomplete' : 'Mark step complete'}
                        onClick={(e) => handleSubtaskToggle(s.id, e)}
                      >
                        <svg viewBox="0 0 24 24">
                          <path
                            fill="currentColor"
                            d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"
                          />
                        </svg>
                      </button>
                      <span className="subtask-title">{s.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Subtasks in compact view when expanded */}
          {isCompact && hasSubtasks && expandedSubtasks && (
            <div
              className="task-subtasks-list compact-subtasks"
              onClick={(e) => e.stopPropagation()}
            >
              {task.subtasks!.map((s) => (
                <div
                  key={s.id}
                  className={`task-subtask-item ${s.completed ? 'completed' : ''}`}
                >
                  <button
                    type="button"
                    className={`subtask-check-btn ${s.completed ? 'checked' : ''}`}
                    aria-label={s.completed ? 'Mark step incomplete' : 'Mark step complete'}
                    onClick={(e) => handleSubtaskToggle(s.id, e)}
                  >
                    <svg viewBox="0 0 24 24">
                      <path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
                    </svg>
                  </button>
                  <span className="subtask-title">{s.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right controls */}
        {isArchive ? (
          <div className="task-actions-group" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="task-icon-btn btn-archive-undo"
              aria-label="Undo completion"
              title="Restore task"
              onClick={() => toggleComplete(task)}
            >
              <svg viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"
                />
              </svg>
            </button>
            <button
              type="button"
              className="task-icon-btn btn-archive-delete"
              aria-label="Delete task permanently"
              title="Delete task permanently"
              onClick={() =>
                confirmAction({
                  title: 'Delete Permanently?',
                  message: `Remove “${task.name}” permanently?`,
                  okLabel: 'Delete',
                  okClass: 'danger',
                  onConfirm: () => deleteTask(task.id),
                })
              }
            >
              <svg viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                />
              </svg>
            </button>
          </div>
        ) : !isCompact ? (
          <button
            type="button"
            className={`task-complete ${task.completed ? 'done' : ''}`}
            aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
            onClick={(e) => {
              e.stopPropagation();
              toggleComplete(task);
            }}
          >
            <svg viewBox="0 0 24 24">
              <path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
            </svg>
          </button>
        ) : null}
      </article>
    </div>
  );
};

import React from 'react';
import { usePlanner } from '../../context/PlannerContext';

export const TaskActionsSheet: React.FC = () => {
  const {
    taskActionsOpen,
    closeTaskActions,
    actionTask,
    openTaskDialog,
    openMoveTaskSheet,
    deleteTask,
    toggleComplete,
    updateTask,
    convertSubtasksToTasks,
    confirmAction,
  } = usePlanner();

  if (!taskActionsOpen || !actionTask) return null;

  const isSub = Boolean(actionTask.isSubheading);
  const hasSubtasks = Boolean(actionTask.subtasks && actionTask.subtasks.length > 0);

  const handleEdit = () => {
    closeTaskActions();
    openTaskDialog(actionTask);
  };

  const handleSetReminder = () => {
    closeTaskActions();
    openTaskDialog(actionTask);
  };

  const handleMove = () => {
    closeTaskActions();
    openMoveTaskSheet(actionTask);
  };

  const handleToggleSubheading = async () => {
    closeTaskActions();
    await updateTask({
      ...actionTask,
      isSubheading: !isSub,
      importance: !isSub ? 3 : actionTask.importance || 3,
      estimatedTime: !isSub ? 0 : actionTask.estimatedTime || 60,
      dueDate: !isSub ? '' : actionTask.dueDate || '',
      reminderAt: !isSub ? '' : actionTask.reminderAt || '',
    });
  };

  const handleToggleComplete = async () => {
    closeTaskActions();
    await toggleComplete(actionTask);
  };

  const handleConvert = () => {
    closeTaskActions();
    confirmAction({
      title: 'Convert Subtasks to Tasks?',
      message: `Convert all ${actionTask.subtasks?.length || 0} checklist steps into standalone tasks?`,
      okLabel: 'Convert',
      okClass: 'success',
      onConfirm: () => convertSubtasksToTasks(actionTask),
    });
  };

  const handleDelete = () => {
    closeTaskActions();
    confirmAction({
      title: 'Delete Task?',
      message: `“${actionTask.name}” will be removed.`,
      okLabel: 'Delete',
      okClass: 'danger',
      onConfirm: () => deleteTask(actionTask.id),
    });
  };

  return (
    <>
      <div className="scrim" onClick={closeTaskActions} />
      <section
        id="sheet-task-actions"
        className="sheet"
        role="dialog"
        aria-labelledby="task-actions-title"
      >
        <button
          type="button"
          className="sheet-close-btn"
          data-close-sheet
          aria-label="Close"
          onClick={closeTaskActions}
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
        <h2 id="task-actions-title">{isSub ? 'Subheading' : actionTask.name || 'Task'}</h2>
        <div className="action-list">
          <button type="button" data-action="edit" onClick={handleEdit}>
            Edit
          </button>
          {!isSub && hasSubtasks && (
            <button
              type="button"
              data-action="convert-subtasks"
              id="action-convert-subtasks"
              onClick={handleConvert}
            >
              Turn subtasks into new tasks ({actionTask.subtasks?.length})
            </button>
          )}
          {!isSub && (
            <button
              type="button"
              data-action="set-reminder"
              id="action-task-reminder"
              onClick={handleSetReminder}
            >
              Set reminder
            </button>
          )}
          <button type="button" data-action="move" id="action-move-task" onClick={handleMove}>
            Move task
          </button>
          <button
            type="button"
            data-action="toggle-subheading"
            id="action-toggle-subheading"
            onClick={handleToggleSubheading}
          >
            {isSub ? 'Convert to regular task' : 'Convert to subheading'}
          </button>
          {!isSub && (
            <button type="button" data-action="complete" onClick={handleToggleComplete}>
              {actionTask.completed ? 'Move back to list' : 'Complete'}
            </button>
          )}
          <button
            type="button"
            data-action="delete"
            className="danger"
            onClick={handleDelete}
          >
            Delete
          </button>
        </div>
      </section>
    </>
  );
};

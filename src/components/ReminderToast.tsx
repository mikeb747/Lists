import React from 'react';
import { usePlanner } from '../context/PlannerContext';

export const ReminderToast: React.FC = () => {
  const { activeReminderTask, dismissReminderToast, snoozeReminder, toggleComplete } =
    usePlanner();

  if (!activeReminderTask) return null;

  const parts: string[] = [];
  if (activeReminderTask.dueDate) parts.push(`Due: ${activeReminderTask.dueDate}`);
  if (activeReminderTask.importance) parts.push(`Importance ${activeReminderTask.importance}/5`);
  const subtitle = parts.join(' • ') || 'Scheduled reminder alert';

  return (
    <div id="reminder-toast" className="reminder-toast" role="alert">
      <div className="reminder-toast-header">
        <span className="reminder-toast-icon">🔔</span>
        <div className="reminder-toast-body">
          <strong id="toast-title" className="toast-title">
            Reminder: {activeReminderTask.name}
          </strong>
          <span id="toast-msg" className="toast-msg">
            {subtitle}
          </span>
        </div>
        <button
          type="button"
          id="toast-close"
          className="toast-close-btn"
          aria-label="Dismiss reminder"
          onClick={dismissReminderToast}
        >
          ✕
        </button>
      </div>
      <div className="reminder-toast-actions">
        <button
          type="button"
          id="toast-btn-complete"
          className="toast-action-btn complete"
          onClick={async () => {
            await toggleComplete(activeReminderTask);
            dismissReminderToast();
          }}
        >
          ✓ Complete
        </button>
        <button
          type="button"
          id="toast-btn-snooze-15"
          className="toast-action-btn"
          onClick={() => snoozeReminder(15)}
        >
          ⏱ Snooze 15m
        </button>
        <button
          type="button"
          id="toast-btn-snooze-60"
          className="toast-action-btn"
          onClick={() => snoozeReminder(60)}
        >
          ⏱ Snooze 1h
        </button>
      </div>
    </div>
  );
};

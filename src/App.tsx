import React from 'react';
import { usePlanner } from './context/PlannerContext';
import { Header } from './components/Header';
import { CategoryTabs } from './components/CategoryTabs';
import { InstallBar } from './components/InstallBar';
import { TaskList } from './components/TaskList';
import { TaskDialog } from './components/dialogs/TaskDialog';
import { CategoryDialog } from './components/dialogs/CategoryDialog';
import { CategoryActionsSheet } from './components/dialogs/CategoryActionsSheet';
import { TaskActionsSheet } from './components/dialogs/TaskActionsSheet';
import { MoveTaskSheet } from './components/dialogs/MoveTaskSheet';
import { FilterSheet } from './components/dialogs/FilterSheet';
import { BulkPasteSheet } from './components/dialogs/BulkPasteSheet';
import { SettingsSheet } from './components/dialogs/SettingsSheet';
import { AppNameDialog } from './components/dialogs/AppNameDialog';
import { ConfirmDialog } from './components/dialogs/ConfirmDialog';
import { ReminderToast } from './components/ReminderToast';

export const App: React.FC = () => {
  const { toastMessage } = usePlanner();

  return (
    <div id="app">
      <Header />
      <CategoryTabs />
      <InstallBar />
      <TaskList />

      {/* Dialogs and Sheets */}
      <TaskDialog />
      <CategoryDialog />
      <CategoryActionsSheet />
      <TaskActionsSheet />
      <MoveTaskSheet />
      <FilterSheet />
      <BulkPasteSheet />
      <SettingsSheet />
      <AppNameDialog />
      <ConfirmDialog />
      <ReminderToast />

      {/* Global Toast Alert */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '88px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--md-on-surface)',
            color: 'var(--md-surface)',
            padding: '10px 18px',
            borderRadius: 'var(--radius-xl)',
            fontSize: '0.85rem',
            fontWeight: 500,
            boxShadow: 'var(--md-shadow-fab)',
            zIndex: 9999,
            pointerEvents: 'none',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
};

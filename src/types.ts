export type SortMode =
  | 'manual'
  | 'today'
  | 'tomorrow'
  | 'due7'
  | 'importance'
  | 'time'
  | 'quickWins';

export type RecurrenceType =
  | 'none'
  | 'daily'
  | 'weekdays'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'yearly';

export type ThemeType = 'system' | 'light' | 'dark';

export type TaskColorMode = 'both' | 'deadline' | 'importance' | 'none';

export interface SubtaskItem {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  name: string;
  importance: number; // 1 - 5
  estimatedTime: number; // minutes
  estimatedTimeUnit?: 'minutes';
  dueDate: string; // YYYY-MM-DD
  categoryId: string;
  completed: boolean;
  completedAt?: string | null;
  sortPosition: number;
  isSubheading?: boolean;
  recurrence?: RecurrenceType | string;
  reminderAt?: string; // YYYY-MM-DDTHH:mm
  reminderFired?: boolean;
  subtasks?: SubtaskItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Category {
  id: string;
  name: string;
  sortPosition: number;
  color?: string | null;
  isCompact?: boolean;
  hiddenFromTasks?: boolean;
  updatedAt?: string;
}

export interface Settings {
  sortMode: SortMode;
  hideCompleted: boolean;
  theme: ThemeType;
  colorTheme: string;
  activeTab: string;
  compactTabs: Record<string, boolean>;
  tabColors: Record<string, string>;
  hiddenFromTasksTabs: Record<string, boolean>;
  tabDragHoldMs: number;
  tabOptionsHoldMs: number;
  appName: string;
  customAppName?: string;
  taskColorMode: TaskColorMode;
  updatedAt?: string;
}

export type CloudSyncStatus = 'offline' | 'connecting' | 'synced' | 'error';

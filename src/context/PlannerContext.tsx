import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { Task, Category, Settings, SortMode, CloudSyncStatus } from '../types';
import * as dbService from '../services/db';
import {
  auth,
  db,
  signInCloudWithGoogle,
  signOutCloud,
  pushTaskToCloud,
  deleteTaskFromCloud,
  pushCategoryToCloud,
  deleteCategoryFromCloud,
  pushSettingsToCloud,
  pushAllToCloud,
  overwriteCloudWithLocal,
  fetchCloudData,
  handleFirestoreError,
  OperationType,
} from '../services/firebase';
import { playReminderChime } from '../services/audio';

const THEME_HEADER_COLORS: Record<string, string> = {
  purple: '#6750a4',
  indigo: '#4f46e5',
  blue: '#0061a4',
  sky: '#0284c7',
  cyan: '#0891b2',
  teal: '#006a60',
  mint: '#059669',
  green: '#386a20',
  lime: '#65a30d',
  amber: '#d97706',
  orange: '#8b5000',
  deeporange: '#c2410c',
  red: '#b91c1c',
  rose: '#984061',
  pink: '#db2777',
  slate: '#475569',
};

const DEFAULT_SETTINGS: Settings = {
  sortMode: 'manual',
  hideCompleted: true,
  theme: 'system',
  colorTheme: 'purple',
  activeTab: 'all',
  compactTabs: {},
  tabColors: {},
  hiddenFromTasksTabs: {},
  tabDragHoldMs: 400,
  tabOptionsHoldMs: 1000,
  appName: 'Lists',
  taskColorMode: 'both',
};

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  okLabel?: string;
  okClass?: string;
  onConfirm: () => void | Promise<void>;
}

interface PlannerContextType {
  tasks: Task[];
  categories: Category[];
  settings: Settings;
  cloudUser: User | null;
  syncStatus: CloudSyncStatus;
  syncStatusMsg: string;
  lastCloudTaskCount: number;
  activeReminderTask: Task | null;
  toastMessage: string | null;
  showToast: (msg: string) => void;

  // CRUD
  addTask: (data: Partial<Task>) => Promise<void>;
  updateTask: (task: Task) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  toggleComplete: (task: Task) => Promise<void>;
  reorderTasks: (newTasks: Task[]) => Promise<void>;
  moveTaskToCategory: (taskId: string, categoryId: string) => Promise<void>;
  convertSubtasksToTasks: (task: Task) => Promise<void>;

  addCategory: (name: string) => Promise<void>;
  updateCategory: (category: Category) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  reorderCategories: (newCats: Category[]) => Promise<void>;

  updateSettings: (partial: Partial<Settings>) => Promise<void>;
  bulkAddTasks: (lines: string[], targetCategoryId: string) => Promise<number>;

  // Cloud Sync
  connectCloud: () => Promise<void>;
  disconnectCloud: () => Promise<void>;
  pushAllToCloudAction: () => Promise<void>;
  overwriteCloudAction: () => Promise<void>;
  pullCloudAction: () => Promise<void>;

  exportLocalBackup: () => void;
  importLocalBackup: (file: File) => Promise<void>;

  // Dialogs / Sheets
  taskDialogOpen: boolean;
  editingTask: Task | null;
  openTaskDialog: (task?: Task | null) => void;
  closeTaskDialog: () => void;

  categoryDialogOpen: boolean;
  editingCategory: Category | null;
  openCategoryDialog: (category?: Category | null) => void;
  closeCategoryDialog: () => void;

  categoryActionsOpen: boolean;
  actionTabId: string | null;
  openCategoryActions: (tabId: string) => void;
  closeCategoryActions: () => void;

  taskActionsOpen: boolean;
  actionTask: Task | null;
  openTaskActions: (task: Task) => void;
  closeTaskActions: () => void;

  moveTaskSheetOpen: boolean;
  movingTask: Task | null;
  openMoveTaskSheet: (task: Task) => void;
  closeMoveTaskSheet: () => void;

  filterSheetOpen: boolean;
  openFilterSheet: () => void;
  closeFilterSheet: () => void;

  bulkPasteSheetOpen: boolean;
  openBulkPasteSheet: () => void;
  closeBulkPasteSheet: () => void;

  settingsSheetOpen: boolean;
  openSettingsSheet: () => void;
  closeSettingsSheet: () => void;

  appNameDialogOpen: boolean;
  openAppNameDialog: () => void;
  closeAppNameDialog: () => void;

  confirmState: ConfirmDialogOptions | null;
  confirmAction: (opts: ConfirmDialogOptions) => void;
  closeConfirm: () => void;

  // Reminders
  dismissReminderToast: () => void;
  snoozeReminder: (minutes: number) => Promise<void>;
}

const PlannerContext = createContext<PlannerContextType | undefined>(undefined);

function computeNextRecurrenceDate(baseDateStr: string, recurrence: string): string {
  if (!recurrence || recurrence === 'none') return '';
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const today = new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);

  let d: Date;
  if (baseDateStr && baseDateStr >= today) {
    d = new Date(`${baseDateStr}T00:00:00`);
  } else {
    d = new Date(`${today}T00:00:00`);
  }

  if (recurrence === 'daily') {
    d.setDate(d.getDate() + 1);
  } else if (recurrence === 'weekdays') {
    do {
      d.setDate(d.getDate() + 1);
    } while (d.getDay() === 0 || d.getDay() === 6);
  } else if (recurrence === 'weekly') {
    d.setDate(d.getDate() + 7);
  } else if (recurrence === 'biweekly') {
    d.setDate(d.getDate() + 14);
  } else if (recurrence === 'monthly') {
    d.setMonth(d.getMonth() + 1);
  }
  const dOffset = d.getTimezoneOffset();
  return new Date(d.getTime() - dOffset * 60000).toISOString().slice(0, 10);
}

function computeNextReminderDate(baseReminderISO: string, recurrence: string): string {
  if (!baseReminderISO || !recurrence || recurrence === 'none') return '';
  let d = new Date(baseReminderISO);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  if (d < now) {
    const origHours = d.getHours();
    const origMins = d.getMinutes();
    d = new Date();
    d.setHours(origHours, origMins, 0, 0);
  }

  if (recurrence === 'daily') {
    d.setDate(d.getDate() + 1);
  } else if (recurrence === 'weekdays') {
    do {
      d.setDate(d.getDate() + 1);
    } while (d.getDay() === 0 || d.getDay() === 6);
  } else if (recurrence === 'weekly') {
    d.setDate(d.getDate() + 7);
  } else if (recurrence === 'biweekly') {
    d.setDate(d.getDate() + 14);
  } else if (recurrence === 'monthly') {
    d.setMonth(d.getMonth() + 1);
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${mins}`;
}

export const PlannerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const [cloudUser, setCloudUser] = useState<User | null>(null);

  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>('offline');
  const [syncStatusMsg, setSyncStatusMsg] = useState<string>('Signed out from live sync');
  const [lastCloudTaskCount, setLastCloudTaskCount] = useState<number>(0);

  const [activeReminderTask, setActiveReminderTask] = useState<Task | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Dialogs
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [categoryActionsOpen, setCategoryActionsOpen] = useState(false);
  const [actionTabId, setActionTabId] = useState<string | null>(null);

  const [taskActionsOpen, setTaskActionsOpen] = useState(false);
  const [actionTask, setActionTask] = useState<Task | null>(null);

  const [moveTaskSheetOpen, setMoveTaskSheetOpen] = useState(false);
  const [movingTask, setMovingTask] = useState<Task | null>(null);

  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [bulkPasteSheetOpen, setBulkPasteSheetOpen] = useState(false);
  const [settingsSheetOpen, setSettingsSheetOpen] = useState(false);
  const [appNameDialogOpen, setAppNameDialogOpen] = useState(false);

  const [confirmState, setConfirmState] = useState<ConfirmDialogOptions | null>(null);

  const isApplyingRemoteRef = useRef(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 3200);
  }, []);

  // Theme application
  useEffect(() => {
    const theme = settings.theme;
    const isDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    const colorKey = settings.colorTheme || 'purple';
    document.documentElement.dataset.color = colorKey;

    const headerColor = isDark ? '#1c1b1f' : THEME_HEADER_COLORS[colorKey] || '#6750a4';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', headerColor);

    const appTitle = settings.appName || 'Lists';
    document.title = appTitle;
  }, [settings.theme, settings.colorTheme, settings.appName]);

  // Initial local DB load: On fresh install, do NOT seed "Personal" and "Work" (categories start empty)
  useEffect(() => {
    async function loadLocal() {
      try {
        const [loadedTasks, loadedCats, loadedSettings] = await Promise.all([
          dbService.getAllTasks(),
          dbService.getAllCategories(),
          dbService.getSettings(),
        ]);
        setTasks(loadedTasks || []);
        // Note: As requested by the user, on fresh install remove the Personal and Work categories!
        // We preserve whatever exists in local DB or start with empty categories array.
        setCategories(loadedCats || []);
        if (loadedSettings) {
          setSettings((prev) => ({ ...prev, ...loadedSettings }));
        }
      } catch (err) {
        console.error('Failed to load local DB:', err);
      }
    }
    loadLocal();
  }, []);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCloudUser(user);
      if (user) {
        setSyncStatus('connecting');
        setSyncStatusMsg('Connecting to live cloud sync...');
      } else {
        setSyncStatus('offline');
        setSyncStatusMsg('Signed out from live sync');
      }
    });
    return () => unsub();
  }, []);

  // Subscribe to real-time Firestore when cloudUser is present
  useEffect(() => {
    if (!cloudUser || !db) return;
    const uid = cloudUser.uid;

    const tasksRef = collection(db, 'users', uid, 'tasks');
    const categoriesRef = collection(db, 'users', uid, 'categories');
    const settingsDocRef = doc(db, 'users', uid, 'settings', 'prefs');

    let initialTasks = false;
    let initialCats = false;

    const unsubTasks = onSnapshot(
      tasksRef,
      async (snapshot) => {
        const hasPending = snapshot.metadata.hasPendingWrites;
        const remoteTasks: Task[] = [];
        snapshot.forEach((docSnap) => {
          remoteTasks.push({ id: docSnap.id, ...docSnap.data() } as Task);
        });

        const isFirst = !initialTasks;
        initialTasks = true;
        setLastCloudTaskCount(remoteTasks.length);

        if (!hasPending || isFirst) {
          isApplyingRemoteRef.current = true;
          setTasks(remoteTasks);
          for (const t of remoteTasks) {
            await dbService.putTask(t);
          }
          isApplyingRemoteRef.current = false;
        }

        const timeStr = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        setSyncStatus('synced');
        setSyncStatusMsg(`Live Synced at ${timeStr} ✓`);
      },
      (error) => {
        setSyncStatus('error');
        setSyncStatusMsg(`Sync error: ${error.message}`);
        try {
          handleFirestoreError(error, OperationType.GET, `users/${uid}/tasks`);
        } catch (e) {
          console.warn('Tasks sync error:', e);
        }
      }
    );

    const unsubCats = onSnapshot(
      categoriesRef,
      async (snapshot) => {
        const hasPending = snapshot.metadata.hasPendingWrites;
        const remoteCats: Category[] = [];
        snapshot.forEach((docSnap) => {
          remoteCats.push({ id: docSnap.id, ...docSnap.data() } as Category);
        });

        const isFirst = !initialCats;
        initialCats = true;

        if (!hasPending || isFirst) {
          isApplyingRemoteRef.current = true;
          const sorted = remoteCats.sort((a, b) => (a.sortPosition ?? 0) - (b.sortPosition ?? 0));
          setCategories(sorted);
          for (const c of sorted) {
            await dbService.putCategory(c);
          }
          isApplyingRemoteRef.current = false;
        }
      },
      (error) => {
        setSyncStatus('error');
        setSyncStatusMsg(`Sync error: ${error.message}`);
        try {
          handleFirestoreError(error, OperationType.GET, `users/${uid}/categories`);
        } catch (e) {
          console.warn('Categories sync error:', e);
        }
      }
    );

    const unsubSettings = onSnapshot(
      settingsDocRef,
      async (docSnap) => {
        if (docSnap.exists() && !docSnap.metadata.hasPendingWrites) {
          const remoteSettings = docSnap.data() as Partial<Settings>;
          isApplyingRemoteRef.current = true;
          setSettings((prev) => {
            const merged = { ...prev, ...remoteSettings };
            dbService.saveSettings(merged);
            return merged;
          });
          isApplyingRemoteRef.current = false;
        }
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, `users/${uid}/settings/prefs`);
        } catch (e) {
          console.warn('Settings sync error:', e);
        }
      }
    );

    return () => {
      unsubTasks();
      unsubCats();
      unsubSettings();
    };
  }, [cloudUser]);

  // Reminder checking interval
  const checkPendingReminders = useCallback(() => {
    const now = Date.now();
    tasks.forEach((task) => {
      if (task.completed || task.isSubheading || !task.reminderAt || task.reminderFired) {
        return;
      }
      const timeMs = new Date(task.reminderAt).getTime();
      if (!isNaN(timeMs) && now >= timeMs) {
        // Fire reminder
        playReminderChime();
        setActiveReminderTask(task);

        // Update task state as fired
        const updated = { ...task, reminderFired: true, updatedAt: new Date().toISOString() };
        dbService.putTask(updated);
        setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
        if (cloudUser) {
          pushTaskToCloud(updated, cloudUser.uid);
        }

        // Web Notifications API
        if ('Notification' in window && Notification.permission === 'granted') {
          const appName = settings.appName || 'Lists';
          const notifTitle = `Reminder: ${task.name}`;
          const notifOptions: NotificationOptions = {
            body: `${appName} • ${task.dueDate ? `Due ${task.dueDate} • ` : ''}Importance ${task.importance}/5`,
            icon: './icons/icon-512.png',
            badge: './icons/notification.png',
            tag: `task-reminder-${task.id}`,
            data: { taskId: task.id },
          };
          try {
            const notif = new Notification(notifTitle, notifOptions);
            notif.onclick = () => {
              window.focus();
              notif.close();
            };
          } catch (_) {}
        }
      }
    });
  }, [tasks, cloudUser, settings.appName]);

  useEffect(() => {
    checkPendingReminders();
    const interval = setInterval(checkPendingReminders, 15000);
    const onVisibility = () => {
      if (!document.hidden) checkPendingReminders();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [checkPendingReminders]);

  // CRUD Operations
  const addTask = useCallback(
    async (data: Partial<Task>) => {
      const maxSort = tasks.reduce((max, t) => Math.max(max, t.sortPosition || 0), 0);
      const newTask: Task = {
        id: crypto.randomUUID(),
        name: data.name || '',
        importance: data.importance || 3,
        estimatedTime: data.estimatedTime !== undefined ? data.estimatedTime : 1,
        dueDate: data.dueDate || '',
        categoryId: data.categoryId || '',
        completed: false,
        sortPosition: maxSort + 1,
        isSubheading: Boolean(data.isSubheading),
        recurrence: data.recurrence || 'none',
        reminderAt: data.reminderAt || '',
        reminderFired: false,
        subtasks: data.subtasks || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await dbService.putTask(newTask);
      setTasks((prev) => [...prev, newTask]);
      if (cloudUser && !isApplyingRemoteRef.current) {
        pushTaskToCloud(newTask, cloudUser.uid);
      }
      showToast('Task added');
    },
    [tasks, cloudUser, showToast]
  );

  const updateTask = useCallback(
    async (task: Task) => {
      const updated: Task = {
        ...task,
        updatedAt: new Date().toISOString(),
      };
      await dbService.putTask(updated);
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      if (cloudUser && !isApplyingRemoteRef.current) {
        pushTaskToCloud(updated, cloudUser.uid);
      }
    },
    [cloudUser]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      await dbService.deleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      if (cloudUser && !isApplyingRemoteRef.current) {
        deleteTaskFromCloud(taskId, cloudUser.uid);
      }
      showToast('Task deleted');
    },
    [cloudUser, showToast]
  );

  const toggleComplete = useCallback(
    async (task: Task) => {
      const isBecomingCompleted = !task.completed;
      const completedAt = isBecomingCompleted ? new Date().toISOString() : null;

      // Handle recurrence when completing
      if (isBecomingCompleted && task.recurrence && task.recurrence !== 'none') {
        const nextDueDate = computeNextRecurrenceDate(task.dueDate || new Date().toISOString().slice(0, 10), task.recurrence);
        const nextReminderAt = task.reminderAt ? computeNextReminderDate(task.reminderAt, task.recurrence) : '';
        const nextSubtasks = (task.subtasks || []).map((s) => ({ ...s, id: crypto.randomUUID(), completed: false }));

        const maxSort = tasks.reduce((max, t) => Math.max(max, t.sortPosition || 0), 0);
        const nextTask: Task = {
          ...task,
          id: crypto.randomUUID(),
          completed: false,
          completedAt: null,
          dueDate: nextDueDate,
          reminderAt: nextReminderAt,
          reminderFired: false,
          subtasks: nextSubtasks,
          sortPosition: maxSort + 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await dbService.putTask(nextTask);
        setTasks((prev) => [...prev, nextTask]);
        if (cloudUser) pushTaskToCloud(nextTask, cloudUser.uid);
        showToast(`Completed! Next occurrence scheduled for ${nextDueDate || 'next cycle'}`);
      }

      const updated: Task = {
        ...task,
        completed: isBecomingCompleted,
        completedAt,
        updatedAt: new Date().toISOString(),
      };

      await dbService.putTask(updated);
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      if (cloudUser && !isApplyingRemoteRef.current) {
        pushTaskToCloud(updated, cloudUser.uid);
      }
    },
    [tasks, cloudUser, showToast]
  );

  const reorderTasks = useCallback(
    async (newTasks: Task[]) => {
      setTasks(newTasks);
      for (let i = 0; i < newTasks.length; i++) {
        const t = { ...newTasks[i], sortPosition: i, updatedAt: new Date().toISOString() };
        await dbService.putTask(t);
        if (cloudUser && !isApplyingRemoteRef.current) {
          pushTaskToCloud(t, cloudUser.uid);
        }
      }
    },
    [cloudUser]
  );

  const moveTaskToCategory = useCallback(
    async (taskId: string, categoryId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      const updated: Task = {
        ...task,
        categoryId,
        updatedAt: new Date().toISOString(),
      };
      await dbService.putTask(updated);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      if (cloudUser) pushTaskToCloud(updated, cloudUser.uid);
      showToast('Task moved');
    },
    [tasks, cloudUser, showToast]
  );

  const convertSubtasksToTasks = useCallback(
    async (task: Task) => {
      if (!task.subtasks || task.subtasks.length === 0) return;
      const subtasks = [...task.subtasks];
      let maxSort = tasks.reduce((max, t) => Math.max(max, t.sortPosition || 0), 0);

      const created: Task[] = [];
      for (const s of subtasks) {
        maxSort++;
        const nt: Task = {
          id: crypto.randomUUID(),
          name: s.title,
          importance: task.importance,
          estimatedTime: Math.max(0.25, Math.round((task.estimatedTime / subtasks.length) * 10) / 10),
          dueDate: task.dueDate,
          categoryId: task.categoryId,
          completed: s.completed,
          sortPosition: maxSort,
          subtasks: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await dbService.putTask(nt);
        if (cloudUser) pushTaskToCloud(nt, cloudUser.uid);
        created.push(nt);
      }

      const clearedTask: Task = {
        ...task,
        subtasks: [],
        updatedAt: new Date().toISOString(),
      };
      await dbService.putTask(clearedTask);
      if (cloudUser) pushTaskToCloud(clearedTask, cloudUser.uid);

      setTasks((prev) => [...prev.map((t) => (t.id === task.id ? clearedTask : t)), ...created]);
      showToast(`Converted ${subtasks.length} subtasks into tasks`);
    },
    [tasks, cloudUser, showToast]
  );

  const addCategory = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const newCat: Category = {
        id: crypto.randomUUID(),
        name: trimmed,
        sortPosition: categories.length,
        updatedAt: new Date().toISOString(),
      };
      await dbService.putCategory(newCat);
      setCategories((prev) => [...prev, newCat]);
      if (cloudUser && !isApplyingRemoteRef.current) {
        pushCategoryToCloud(newCat, cloudUser.uid);
      }
      showToast(`Tab “${trimmed}” created`);
    },
    [categories, cloudUser, showToast]
  );

  const updateCategory = useCallback(
    async (category: Category) => {
      const updated: Category = {
        ...category,
        updatedAt: new Date().toISOString(),
      };
      await dbService.putCategory(updated);
      setCategories((prev) => prev.map((c) => (c.id === category.id ? updated : c)));
      if (cloudUser && !isApplyingRemoteRef.current) {
        pushCategoryToCloud(updated, cloudUser.uid);
      }
    },
    [cloudUser]
  );

  const deleteCategory = useCallback(
    async (categoryId: string) => {
      await dbService.deleteCategory(categoryId);
      setCategories((prev) => prev.filter((c) => c.id !== categoryId));
      if (cloudUser && !isApplyingRemoteRef.current) {
        deleteCategoryFromCloud(categoryId, cloudUser.uid);
      }
      setSettings((prev) => {
        if (prev.activeTab === categoryId) {
          const next = { ...prev, activeTab: 'all' };
          dbService.saveSettings(next);
          return next;
        }
        return prev;
      });
      showToast('Tab removed');
    },
    [cloudUser, showToast]
  );

  const reorderCategories = useCallback(
    async (newCats: Category[]) => {
      setCategories(newCats);
      for (let i = 0; i < newCats.length; i++) {
        const c = { ...newCats[i], sortPosition: i, updatedAt: new Date().toISOString() };
        await dbService.putCategory(c);
        if (cloudUser && !isApplyingRemoteRef.current) {
          pushCategoryToCloud(c, cloudUser.uid);
        }
      }
    },
    [cloudUser]
  );

  const updateSettings = useCallback(
    async (partial: Partial<Settings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...partial, updatedAt: new Date().toISOString() };
        dbService.saveSettings(next);
        if (cloudUser && !isApplyingRemoteRef.current) {
          pushSettingsToCloud(next, cloudUser.uid);
        }
        return next;
      });
    },
    [cloudUser]
  );

  const bulkAddTasks = useCallback(
    async (lines: string[], targetCategoryId: string) => {
      const validLines = lines.map((l) => l.trim()).filter(Boolean);
      if (!validLines.length) return 0;

      let maxSort = tasks.reduce((max, t) => Math.max(max, t.sortPosition || 0), 0);
      const newTasks: Task[] = [];

      for (const line of validLines) {
        maxSort++;
        const t: Task = {
          id: crypto.randomUUID(),
          name: line,
          importance: 3,
          estimatedTime: 1,
          dueDate: '',
          categoryId: targetCategoryId || '',
          completed: false,
          sortPosition: maxSort,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await dbService.putTask(t);
        if (cloudUser) pushTaskToCloud(t, cloudUser.uid);
        newTasks.push(t);
      }

      setTasks((prev) => [...prev, ...newTasks]);
      showToast(`Added ${newTasks.length} tasks`);
      return newTasks.length;
    },
    [tasks, cloudUser, showToast]
  );

  // Cloud Actions
  const connectCloud = useCallback(async () => {
    try {
      setSyncStatus('connecting');
      setSyncStatusMsg('Opening Google sign-in window...');
      const user = await signInCloudWithGoogle();
      setCloudUser(user);
      setSyncStatus('synced');
      setSyncStatusMsg(`Connected as ${user.email} ✓`);
      showToast(`Connected as ${user.displayName || user.email}`);
    } catch (err: any) {
      console.error('Cloud connect error:', err);
      let msg = err.message || 'Failed to sign in';
      if (err.code === 'auth/popup-blocked') {
        msg = 'Popup was blocked by your browser. Please allow popups.';
      } else if (err.code === 'auth/popup-closed-by-user') {
        msg = 'Sign-in cancelled.';
      }
      setSyncStatus('error');
      setSyncStatusMsg(msg);
      showToast(msg);
    }
  }, [showToast]);

  const disconnectCloud = useCallback(async () => {
    await signOutCloud();
    setCloudUser(null);
    setSyncStatus('offline');
    setSyncStatusMsg('Signed out from live sync');
    showToast('Disconnected from Cloud Sync');
  }, [showToast]);

  const pushAllToCloudAction = useCallback(async () => {
    if (!cloudUser) return;
    try {
      await pushAllToCloud(tasks, categories, settings, cloudUser.uid);
      showToast('Merged all local tasks to cloud');
    } catch (err: any) {
      showToast(`Cloud push failed: ${err.message}`);
    }
  }, [cloudUser, tasks, categories, settings, showToast]);

  const overwriteCloudAction = useCallback(async () => {
    if (!cloudUser) return;
    try {
      await overwriteCloudWithLocal(tasks, categories, settings, cloudUser.uid);
      showToast('Replaced cloud database with local tasks');
    } catch (err: any) {
      showToast(`Cloud overwrite failed: ${err.message}`);
    }
  }, [cloudUser, tasks, categories, settings, showToast]);

  const pullCloudAction = useCallback(async () => {
    if (!cloudUser) return;
    try {
      const data = await fetchCloudData(cloudUser.uid);
      if (data) {
        setTasks(data.tasks);
        setCategories(data.categories.sort((a, b) => (a.sortPosition ?? 0) - (b.sortPosition ?? 0)));
        if (data.settings) setSettings((prev) => ({ ...prev, ...data.settings }));

        for (const t of data.tasks) await dbService.putTask(t);
        for (const c of data.categories) await dbService.putCategory(c);
        if (data.settings) await dbService.saveSettings({ ...settings, ...data.settings });

        showToast(`Pulled ${data.tasks.length} tasks from cloud`);
      }
    } catch (err: any) {
      showToast(`Pull from cloud failed: ${err.message}`);
    }
  }, [cloudUser, settings, showToast]);

  // Local JSON Export/Import
  const exportLocalBackup = useCallback(() => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      tasks,
      categories,
      settings,
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lists-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported backup file');
  }, [tasks, categories, settings, showToast]);

  const importLocalBackup = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data || !Array.isArray(data.tasks)) {
          throw new Error('Invalid backup file format');
        }
        for (const t of data.tasks) await dbService.putTask(t);
        if (Array.isArray(data.categories)) {
          for (const c of data.categories) await dbService.putCategory(c);
        }
        if (data.settings) {
          await dbService.saveSettings({ ...settings, ...data.settings });
        }
        setTasks(data.tasks);
        if (Array.isArray(data.categories)) setCategories(data.categories);
        if (data.settings) setSettings((prev) => ({ ...prev, ...data.settings }));
        showToast(`Imported ${data.tasks.length} tasks`);
      } catch (err: any) {
        showToast(`Import failed: ${err.message}`);
      }
    },
    [settings, showToast]
  );

  // Dialog open / close handlers
  const openTaskDialog = useCallback((task?: Task | null) => {
    setEditingTask(task || null);
    setTaskDialogOpen(true);
  }, []);
  const closeTaskDialog = useCallback(() => setTaskDialogOpen(false), []);

  const openCategoryDialog = useCallback((category?: Category | null) => {
    setEditingCategory(category || null);
    setCategoryDialogOpen(true);
  }, []);
  const closeCategoryDialog = useCallback(() => setCategoryDialogOpen(false), []);

  const openCategoryActions = useCallback((tabId: string) => {
    setActionTabId(tabId);
    setCategoryActionsOpen(true);
  }, []);
  const closeCategoryActions = useCallback(() => setCategoryActionsOpen(false), []);

  const openTaskActions = useCallback((task: Task) => {
    setActionTask(task);
    setTaskActionsOpen(true);
  }, []);
  const closeTaskActions = useCallback(() => setTaskActionsOpen(false), []);

  const openMoveTaskSheet = useCallback((task: Task) => {
    setMovingTask(task);
    setMoveTaskSheetOpen(true);
  }, []);
  const closeMoveTaskSheet = useCallback(() => setMoveTaskSheetOpen(false), []);

  const openFilterSheet = useCallback(() => setFilterSheetOpen(true), []);
  const closeFilterSheet = useCallback(() => setFilterSheetOpen(false), []);

  const openBulkPasteSheet = useCallback(() => setBulkPasteSheetOpen(true), []);
  const closeBulkPasteSheet = useCallback(() => setBulkPasteSheetOpen(false), []);

  const openSettingsSheet = useCallback(() => setSettingsSheetOpen(true), []);
  const closeSettingsSheet = useCallback(() => setSettingsSheetOpen(false), []);

  const openAppNameDialog = useCallback(() => setAppNameDialogOpen(true), []);
  const closeAppNameDialog = useCallback(() => setAppNameDialogOpen(false), []);

  const confirmAction = useCallback((opts: ConfirmDialogOptions) => {
    setConfirmState(opts);
  }, []);
  const closeConfirm = useCallback(() => setConfirmState(null), []);

  const dismissReminderToast = useCallback(() => setActiveReminderTask(null), []);

  const snoozeReminder = useCallback(
    async (minutes: number) => {
      if (!activeReminderTask) return;
      const newTime = new Date(Date.now() + minutes * 60 * 1000);
      const year = newTime.getFullYear();
      const month = String(newTime.getMonth() + 1).padStart(2, '0');
      const day = String(newTime.getDate()).padStart(2, '0');
      const hours = String(newTime.getHours()).padStart(2, '0');
      const mins = String(newTime.getMinutes()).padStart(2, '0');

      const updated: Task = {
        ...activeReminderTask,
        reminderAt: `${year}-${month}-${day}T${hours}:${mins}`,
        reminderFired: false,
        updatedAt: new Date().toISOString(),
      };
      await updateTask(updated);
      setActiveReminderTask(null);
      showToast(`Snoozed for ${minutes} minutes`);
    },
    [activeReminderTask, updateTask, showToast]
  );

  return (
    <PlannerContext.Provider
      value={{
        tasks,
        categories,
        settings,
        cloudUser,
        syncStatus,
        syncStatusMsg,
        lastCloudTaskCount,
        activeReminderTask,
        toastMessage,
        showToast,

        addTask,
        updateTask,
        deleteTask,
        toggleComplete,
        reorderTasks,
        moveTaskToCategory,
        convertSubtasksToTasks,
        addCategory,
        updateCategory,
        deleteCategory,
        reorderCategories,
        updateSettings,
        bulkAddTasks,

        connectCloud,
        disconnectCloud,
        pushAllToCloudAction,
        overwriteCloudAction,
        pullCloudAction,

        exportLocalBackup,
        importLocalBackup,

        taskDialogOpen,
        editingTask,
        openTaskDialog,
        closeTaskDialog,

        categoryDialogOpen,
        editingCategory,
        openCategoryDialog,
        closeCategoryDialog,

        categoryActionsOpen,
        actionTabId,
        openCategoryActions,
        closeCategoryActions,

        taskActionsOpen,
        actionTask,
        openTaskActions,
        closeTaskActions,

        moveTaskSheetOpen,
        movingTask,
        openMoveTaskSheet,
        closeMoveTaskSheet,

        filterSheetOpen,
        openFilterSheet,
        closeFilterSheet,

        bulkPasteSheetOpen,
        openBulkPasteSheet,
        closeBulkPasteSheet,

        settingsSheetOpen,
        openSettingsSheet,
        closeSettingsSheet,

        appNameDialogOpen,
        openAppNameDialog,
        closeAppNameDialog,

        confirmState,
        confirmAction,
        closeConfirm,

        dismissReminderToast,
        snoozeReminder,
      }}
    >
      {children}
    </PlannerContext.Provider>
  );
};

export const usePlanner = () => {
  const context = useContext(PlannerContext);
  if (!context) {
    throw new Error('usePlanner must be used within a PlannerProvider');
  }
  return context;
};

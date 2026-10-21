import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { PluginListenerHandle } from '@capacitor/core';
import { User, onAuthStateChanged } from 'firebase/auth';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import {
  Task,
  Category,
  CategoryDeletion,
  Settings,
  SortMode,
  CloudSyncStatus,
} from '../types';
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
  pushCategoryDeletionToCloud,
  pushSettingsToCloud,
  pushAllToCloud,
  overwriteCloudWithLocal,
  fetchCloudData,
  handleFirestoreError,
  OperationType,
} from '../services/firebase';
import { playReminderChime } from '../services/audio';
import { LocalNotifications } from '@capacitor/local-notifications';
import {
  isAndroidNative,
  requestReminderPermission,
  synchronizeAndroidReminders,
  TASK_REMINDER_ACTION_TYPE,
} from '../services/nativeReminders';

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

function migrateTaskEstimatedTime(task: Task): Task {
  if (task.estimatedTimeUnit === 'minutes') return task;
  const hours = Number(task.estimatedTime);
  return {
    ...task,
    estimatedTime: Math.round((Number.isFinite(hours) ? hours : 1) * 60),
    estimatedTimeUnit: 'minutes',
  };
}

async function uploadPendingCategoryDeletions(userId: string): Promise<void> {
  const deletions = await dbService.getAllCategoryDeletions();
  for (const deletion of deletions) {
    if (deletion.userId !== userId) continue;
    await pushCategoryDeletionToCloud(deletion, userId);
    await deleteCategoryFromCloud(deletion.categoryId, userId);
  }
}

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
  addTask: (data: Partial<Task>) => Promise<boolean>;
  updateTask: (task: Task) => Promise<boolean>;
  deleteTask: (taskId: string) => Promise<void>;
  toggleComplete: (task: Task) => Promise<void>;
  reorderTasks: (newTasks: Task[]) => Promise<void>;
  moveTaskToCategory: (taskId: string, categoryId: string) => Promise<void>;
  convertSubtasksToTasks: (task: Task) => Promise<void>;

  addCategory: (name: string) => Promise<string | null>;
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
  snoozeReminder: (minutes: number, taskId?: string) => Promise<void>;
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
  const [tasksLoaded, setTasksLoaded] = useState(false);

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

  const ensureReminderPermission = useCallback(async (task: Task) => {
    const reminderTime = new Date(task.reminderAt || '').getTime();
    if (
      !task.reminderAt ||
      task.completed ||
      task.isSubheading ||
      !Number.isFinite(reminderTime) ||
      reminderTime <= Date.now()
    ) {
      return true;
    }
    try {
      return await requestReminderPermission();
    } catch (error) {
      console.error('Failed to request Android notification permission:', error);
      return false;
    }
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
        const normalizedTasks = (loadedTasks || []).map(migrateTaskEstimatedTime);
        for (let i = 0; i < normalizedTasks.length; i++) {
          if (loadedTasks[i].estimatedTimeUnit !== 'minutes') {
            await dbService.putTask(normalizedTasks[i]);
          }
        }
        setTasks(normalizedTasks);
        setTasksLoaded(true);
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
    const categoryDeletionsRef = collection(db, 'users', uid, 'categoryDeletions');
    const settingsDocRef = doc(db, 'users', uid, 'settings', 'prefs');

    let initialTasks = false;
    let initialCats = false;
    let initialDeletions = false;
    let initialMergeStarted = false;
    let initialMergeCompleted = false;
    let initialRemoteTasks: Task[] = [];
    let initialRemoteCategories: Category[] = [];
    const deletedCategoryIds = new Set<string>();
    const confirmedDeletionIds = new Set<string>();
    const deletionSyncInProgress = new Map<string, Promise<void>>();
    const cloudCategoryDeleteAttempts = new Set<string>();

    const deleteCloudCategoryForTombstone = async (categoryId: string) => {
      if (cloudCategoryDeleteAttempts.has(categoryId)) return;
      cloudCategoryDeleteAttempts.add(categoryId);
      try {
        await deleteCategoryFromCloud(categoryId, uid);
      } catch (error) {
        cloudCategoryDeleteAttempts.delete(categoryId);
        throw error;
      }
    };

    const removeDeletedLocalCategories = async (
      categoryIds: Iterable<string>,
      syncSettings = true
    ) => {
      const ids = new Set(categoryIds);
      if (ids.size === 0) return;
      for (const categoryId of ids) await dbService.deleteCategory(categoryId);
      setCategories((prev) => prev.filter((category) => !ids.has(category.id)));
      setSettings((prev) => {
        if (!ids.has(prev.activeTab)) return prev;
        const next = { ...prev, activeTab: 'all', updatedAt: new Date().toISOString() };
        const saveSettings = async () => {
          await dbService.saveSettings(next);
          if (syncSettings) await pushSettingsToCloud(next, uid);
        };
        void saveSettings().catch((error) => {
          console.error('Failed to update settings after category deletion:', error);
          setSyncStatus('error');
          setSyncStatusMsg(
            `Settings sync failed: ${error instanceof Error ? error.message : String(error)}`
          );
        });
        return next;
      });
    };

    const syncCategoryDeletion = (deletion: CategoryDeletion): Promise<void> => {
      const existingSync = deletionSyncInProgress.get(deletion.categoryId);
      if (existingSync) return existingSync;

      const syncPromise = (async () => {
        await pushCategoryDeletionToCloud(deletion, uid);
        deletedCategoryIds.add(deletion.categoryId);
        confirmedDeletionIds.add(deletion.categoryId);
        await removeDeletedLocalCategories([deletion.categoryId]);
        await deleteCloudCategoryForTombstone(deletion.categoryId);
      })();
      deletionSyncInProgress.set(deletion.categoryId, syncPromise);
      const clearSync = () => {
        if (deletionSyncInProgress.get(deletion.categoryId) === syncPromise) {
          deletionSyncInProgress.delete(deletion.categoryId);
        }
      };
      void syncPromise.then(clearSync, clearSync);
      return syncPromise;
    };

    const syncPendingCategoryDeletions = async () => {
      const localDeletions = await dbService.getAllCategoryDeletions();
      for (const deletion of localDeletions) {
        if (deletion.userId === uid && !confirmedDeletionIds.has(deletion.categoryId)) {
          await syncCategoryDeletion(deletion);
        }
      }
    };

    const mergeInitialLocalData = async () => {
      if (!initialTasks || !initialCats || !initialDeletions || initialMergeStarted) return;
      initialMergeStarted = true;

      try {
        const [localTasks, allLocalCategories, localDeletions] = await Promise.all([
          dbService.getAllTasks(),
          dbService.getAllCategories(),
          dbService.getAllCategoryDeletions(),
        ]);
        const normalizedLocalTasks = localTasks.map(migrateTaskEstimatedTime);
        for (const deletion of localDeletions) {
          if (deletion.userId === uid && !confirmedDeletionIds.has(deletion.categoryId)) {
            await syncCategoryDeletion(deletion);
          }
        }
        const localCategories = allLocalCategories.filter(
          (category) => !deletedCategoryIds.has(category.id)
        );
        const remoteCategories = initialRemoteCategories
          .filter((category) => !deletedCategoryIds.has(category.id))
          .sort(
            (a, b) => (a.sortPosition ?? 0) - (b.sortPosition ?? 0)
          );
        const categoryIdMap = new Map<string, string>();
        const categoriesByName = new Map<string, Category>();
        const mergedCategories: Category[] = [];
        let nextCategoryPosition =
          remoteCategories.reduce((max, category) => Math.max(max, category.sortPosition ?? -1), -1) +
          1;

        for (const category of remoteCategories) {
          const nameKey = category.name.trim().toLowerCase();
          const existing = categoriesByName.get(nameKey);
          if (existing) {
            categoryIdMap.set(category.id, existing.id);
            continue;
          }
          categoriesByName.set(nameKey, category);
          categoryIdMap.set(category.id, category.id);
          mergedCategories.push(category);
        }

        const duplicateRemoteCategoryIds = remoteCategories
          .filter((category) => categoryIdMap.get(category.id) !== category.id)
          .map((category) => category.id);

        for (const category of localCategories) {
          const nameKey = category.name.trim().toLowerCase();
          const cloudCategory = categoriesByName.get(nameKey);
          if (cloudCategory) {
            categoryIdMap.set(category.id, cloudCategory.id);
            continue;
          }
          const mergedCategory = {
            ...category,
            sortPosition: nextCategoryPosition++,
          };
          categoriesByName.set(nameKey, mergedCategory);
          categoryIdMap.set(category.id, category.id);
          mergedCategories.push(mergedCategory);
        }

        const remoteTaskIds = new Set(initialRemoteTasks.map((task) => task.id));
        const mergedTasks: Task[] = initialRemoteTasks.map((task) => {
          const categoryId = task.categoryId ? categoryIdMap.get(task.categoryId) : undefined;
          return categoryId && categoryId !== task.categoryId
            ? { ...task, categoryId }
            : task;
        });
        let nextSortPosition = mergedTasks.reduce(
          (max, task) => Math.max(max, task.sortPosition ?? 0),
          -1
        ) + 1;
        const localOnlyTasks = normalizedLocalTasks
          .filter((task) => !remoteTaskIds.has(task.id))
          .sort((a, b) => (a.sortPosition ?? 0) - (b.sortPosition ?? 0))
          .map((task) => ({
            ...task,
            categoryId: task.categoryId
              ? categoryIdMap.get(task.categoryId) || task.categoryId
              : '',
            sortPosition: nextSortPosition++,
          }));
        mergedTasks.push(...localOnlyTasks);

        isApplyingRemoteRef.current = true;
        setCategories(mergedCategories);
        setTasks(mergedTasks);
        for (const category of mergedCategories) await dbService.putCategory(category);
        for (const task of mergedTasks) await dbService.putTask(task);
        isApplyingRemoteRef.current = false;

        for (const categoryId of duplicateRemoteCategoryIds) {
          await deleteCategoryFromCloud(categoryId, uid);
        }
        for (const category of mergedCategories) {
          if (!remoteCategories.some((remote) => remote.id === category.id)) {
            await pushCategoryToCloud(category, uid);
          }
        }
        for (const task of [...mergedTasks]) {
          const remoteTask = initialRemoteTasks.find((remote) => remote.id === task.id);
          if (
            !remoteTask ||
            remoteTask.categoryId !== task.categoryId ||
            task.sortPosition !== remoteTask.sortPosition
          ) {
            await pushTaskToCloud(task, uid);
          }
        }
        initialMergeCompleted = true;
      } catch (error) {
        isApplyingRemoteRef.current = false;
        initialMergeStarted = false;
        console.error('Failed to merge local data with cloud data:', error);
        setSyncStatus('error');
        setSyncStatusMsg(
          `Cloud merge error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    };

    const unsubDeletions = onSnapshot(
      categoryDeletionsRef,
      async (snapshot) => {
        const cloudDeletions: CategoryDeletion[] = [];
        const serverDeletions: CategoryDeletion[] = [];
        snapshot.forEach((docSnap) => {
          const categoryId = docSnap.id;
          const deletion: CategoryDeletion = {
            id: `${uid}:${categoryId}`,
            categoryId,
            userId: uid,
            deletedAt: String(docSnap.data().deletedAt || new Date().toISOString()),
          };
          cloudDeletions.push(deletion);
          deletedCategoryIds.add(categoryId);
          if (!docSnap.metadata.hasPendingWrites) {
            confirmedDeletionIds.add(categoryId);
            serverDeletions.push(deletion);
          }
        });

        for (const deletion of cloudDeletions) {
          await dbService.putCategoryDeletion(deletion);
        }
        await removeDeletedLocalCategories(deletedCategoryIds, !snapshot.metadata.fromCache);

        if (!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites) {
          try {
            for (const deletion of serverDeletions) {
              await deleteCloudCategoryForTombstone(deletion.categoryId);
            }
            await syncPendingCategoryDeletions();
          } catch (error) {
            console.error('Failed to synchronize category deletions:', error);
            setSyncStatus('error');
            setSyncStatusMsg(
              `Category deletion sync failed: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
            return;
          }
          initialDeletions = true;
          await mergeInitialLocalData();
        }
      },
      (error) => {
        setSyncStatus('error');
        setSyncStatusMsg(`Category deletion sync error: ${error.message}`);
        try {
          handleFirestoreError(error, OperationType.GET, `users/${uid}/categoryDeletions`);
        } catch (e) {
          console.warn('Category deletion sync error:', e);
        }
      }
    );

    const unsubTasks = onSnapshot(
      tasksRef,
      async (snapshot) => {
        const hasPending = snapshot.metadata.hasPendingWrites;
        const remoteTasks: Task[] = [];
        const migratedRemoteTasks: Task[] = [];
        snapshot.forEach((docSnap) => {
          const rawTask = { id: docSnap.id, ...docSnap.data() } as Task;
          const task = migrateTaskEstimatedTime(rawTask);
          remoteTasks.push(task);
          if (rawTask.estimatedTimeUnit !== 'minutes') migratedRemoteTasks.push(task);
        });
        try {
          for (const task of migratedRemoteTasks) await pushTaskToCloud(task, uid);
        } catch (error) {
          console.error('Failed to migrate cloud task estimates:', error);
          setSyncStatus('error');
          setSyncStatusMsg(
            `Cloud estimate migration failed: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
          return;
        }

        const isFirst = !initialTasks;
        initialTasks = !snapshot.metadata.fromCache;
        initialRemoteTasks = remoteTasks;
        setLastCloudTaskCount(remoteTasks.length);

        if (!initialMergeCompleted) {
          await mergeInitialLocalData();
        } else if ((!hasPending || isFirst) && !snapshot.metadata.fromCache) {
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
        initialCats = !snapshot.metadata.fromCache;
        initialRemoteCategories = remoteCats;

        if (!initialMergeCompleted) {
          await mergeInitialLocalData();
        } else if ((!hasPending || isFirst) && !snapshot.metadata.fromCache) {
          const sorted = remoteCats
            .filter((category) => !deletedCategoryIds.has(category.id))
            .sort((a, b) => (a.sortPosition ?? 0) - (b.sortPosition ?? 0));
          const categoriesByName = new Map<string, Category>();
          const categoryIdMap = new Map<string, string>();
          const uniqueCategories: Category[] = [];

          for (const category of sorted) {
            const nameKey = category.name.trim().toLowerCase();
            const existing = categoriesByName.get(nameKey);
            if (existing) {
              categoryIdMap.set(category.id, existing.id);
            } else {
              categoriesByName.set(nameKey, category);
              categoryIdMap.set(category.id, category.id);
              uniqueCategories.push(category);
            }
          }
          const duplicateCategoryIds = new Set(
            sorted
              .filter((category) => categoryIdMap.get(category.id) !== category.id)
              .map((category) => category.id)
          );

          isApplyingRemoteRef.current = true;
          setCategories(uniqueCategories);
          for (const category of uniqueCategories) await dbService.putCategory(category);

          if (duplicateCategoryIds.size > 0) {
            const localTasks = await dbService.getAllTasks();
            const existingTasksById = new Map(localTasks.map((task) => [task.id, task]));
            const lastPositionByCategory = new Map<string, number>();
            for (const task of localTasks) {
              if (!duplicateCategoryIds.has(task.categoryId)) {
                lastPositionByCategory.set(
                  task.categoryId,
                  Math.max(lastPositionByCategory.get(task.categoryId) ?? -1, task.sortPosition ?? -1)
                );
              }
            }
            const movedTasks = localTasks
              .filter((task) => duplicateCategoryIds.has(task.categoryId))
              .sort((a, b) => (a.sortPosition ?? 0) - (b.sortPosition ?? 0));
            const movedTaskIds = new Set(movedTasks.map((task) => task.id));
            const remappedTasks = localTasks.map((task) => {
              const categoryId = categoryIdMap.get(task.categoryId) || task.categoryId;
              if (!duplicateCategoryIds.has(task.categoryId)) {
                return categoryId === task.categoryId ? task : { ...task, categoryId };
              }
              const nextPosition = (lastPositionByCategory.get(categoryId) ?? -1) + 1;
              lastPositionByCategory.set(categoryId, nextPosition);
              return { ...task, categoryId, sortPosition: nextPosition };
            });

            setTasks(remappedTasks);
            for (const task of remappedTasks) {
              if (
                movedTaskIds.has(task.id) ||
                existingTasksById.get(task.id)?.categoryId !== task.categoryId
              ) {
                await dbService.putTask(task);
              }
            }
            setSettings((prev) => {
              const activeTab = categoryIdMap.get(prev.activeTab) || prev.activeTab;
              if (activeTab === prev.activeTab) return prev;
              const updated = { ...prev, activeTab };
              dbService.saveSettings(updated);
              pushSettingsToCloud(updated, uid);
              return updated;
            });
            for (const categoryId of duplicateCategoryIds) {
              await deleteCategoryFromCloud(categoryId, uid);
            }
            for (const task of remappedTasks) {
              if (movedTaskIds.has(task.id)) await pushTaskToCloud(task, uid);
            }
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
      unsubDeletions();
      unsubSettings();
    };
  }, [cloudUser]);

  useEffect(() => {
    if (!tasksLoaded || !isAndroidNative()) return;
    void synchronizeAndroidReminders(tasks).catch((error) => {
      console.error('Failed to synchronize Android reminders:', error);
      showToast('Android reminders could not be updated');
    });
  }, [tasks, tasksLoaded, showToast]);

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
    if (isAndroidNative()) return;
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
      const name = data.name?.trim() || '';
      const nameKey = name.toLowerCase();
      if (nameKey && tasks.some((task) => task.name.trim().toLowerCase() === nameKey)) {
        showToast(`A task named “${name}” already exists`);
        return false;
      }
      const maxSort = tasks.reduce((max, t) => Math.max(max, t.sortPosition || 0), 0);
      const newTask: Task = {
        id: crypto.randomUUID(),
        name,
        importance: data.importance || 3,
        estimatedTime: data.estimatedTime !== undefined ? data.estimatedTime : 60,
        estimatedTimeUnit: 'minutes',
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

      const notificationPermissionGranted = await ensureReminderPermission(newTask);
      await dbService.putTask(newTask);
      setTasks((prev) => [...prev, newTask]);
      if (cloudUser && !isApplyingRemoteRef.current) {
        pushTaskToCloud(newTask, cloudUser.uid);
      }
      showToast(
        notificationPermissionGranted
          ? 'Task added'
          : 'Task added, but Android notifications are disabled'
      );
      return true;
    },
    [tasks, cloudUser, showToast, ensureReminderPermission]
  );

  const updateTask = useCallback(
    async (task: Task) => {
      const updated: Task = {
        ...task,
        updatedAt: new Date().toISOString(),
      };
      const previousTask = tasks.find((existingTask) => existingTask.id === task.id);
      const notificationPermissionGranted =
        updated.reminderAt &&
        updated.reminderAt !== previousTask?.reminderAt &&
        !updated.completed &&
        !updated.isSubheading
          ? await ensureReminderPermission(updated)
          : true;
      await dbService.putTask(updated);
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      if (cloudUser && !isApplyingRemoteRef.current) {
        pushTaskToCloud(updated, cloudUser.uid);
      }
      if (!notificationPermissionGranted) {
        showToast('Task saved, but Android notifications are disabled');
      }
      return notificationPermissionGranted;
    },
    [tasks, cloudUser, showToast, ensureReminderPermission]
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

        const nextReminderPermissionGranted = await ensureReminderPermission(nextTask);
        await dbService.putTask(nextTask);
        setTasks((prev) => [...prev, nextTask]);
        if (cloudUser) pushTaskToCloud(nextTask, cloudUser.uid);
        showToast(
          nextReminderPermissionGranted
            ? `Completed! Next occurrence scheduled for ${nextDueDate || 'next cycle'}`
            : 'Next task created, but Android notifications are disabled'
        );
      }

      const updated: Task = {
        ...task,
        completed: isBecomingCompleted,
        completedAt,
        updatedAt: new Date().toISOString(),
      };

      const notificationPermissionGranted =
        !isBecomingCompleted && updated.reminderAt && !updated.reminderFired
          ? await ensureReminderPermission(updated)
          : true;
      await dbService.putTask(updated);
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      if (cloudUser && !isApplyingRemoteRef.current) {
        pushTaskToCloud(updated, cloudUser.uid);
      }
      if (!notificationPermissionGranted) {
        showToast('Task updated, but Android notifications are disabled');
      }
    },
    [tasks, cloudUser, showToast, ensureReminderPermission]
  );

  const reorderTasks = useCallback(
    async (newTasks: Task[]) => {
      const reorderedTasks = newTasks.map((task, index) => ({
        ...task,
        sortPosition: index,
        updatedAt: new Date().toISOString(),
      }));
      setTasks(reorderedTasks);
      for (const t of reorderedTasks) {
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
      const existingNames = new Set(tasks.map((item) => item.name.trim().toLowerCase()));
      const tasksToCreate = subtasks.filter((subtask) => {
        const nameKey = subtask.title.trim().toLowerCase();
        if (existingNames.has(nameKey)) return false;
        existingNames.add(nameKey);
        return true;
      });
      const taskNamesToCreate = new Set(tasksToCreate.map((subtask) => subtask.id));
      const skippedCount = subtasks.length - tasksToCreate.length;
      if (!tasksToCreate.length) {
        showToast('No tasks created because those names already exist');
        return;
      }
      let maxSort = tasks.reduce((max, t) => Math.max(max, t.sortPosition || 0), 0);

      const created: Task[] = [];
      for (const s of tasksToCreate) {
        maxSort++;
        const nt: Task = {
          id: crypto.randomUUID(),
          name: s.title,
          importance: task.importance,
          estimatedTime: Math.max(1, Math.round(task.estimatedTime / subtasks.length)),
          estimatedTimeUnit: 'minutes',
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
        subtasks: subtasks.filter((subtask) => !taskNamesToCreate.has(subtask.id)),
        updatedAt: new Date().toISOString(),
      };
      await dbService.putTask(clearedTask);
      if (cloudUser) pushTaskToCloud(clearedTask, cloudUser.uid);

      setTasks((prev) => [...prev.map((t) => (t.id === task.id ? clearedTask : t)), ...created]);
      showToast(
        skippedCount
          ? `Converted ${created.length} subtasks; kept ${skippedCount} duplicate${skippedCount === 1 ? '' : 's'}`
          : `Converted ${created.length} subtasks into tasks`
      );
    },
    [tasks, cloudUser, showToast]
  );

  const addCategory = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return null;
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
      return newCat.id;
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
      const deletion: CategoryDeletion = {
        id: `${cloudUser?.uid ?? 'local'}:${categoryId}`,
        categoryId,
        userId: cloudUser?.uid ?? null,
        deletedAt: new Date().toISOString(),
      };
      await dbService.putCategoryDeletion(deletion);
      await dbService.deleteCategory(categoryId);
      setCategories((prev) => prev.filter((c) => c.id !== categoryId));
      if (cloudUser) {
        void (async () => {
          await pushCategoryDeletionToCloud(deletion, cloudUser.uid);
          await deleteCategoryFromCloud(categoryId, cloudUser.uid);
        })().catch((error) => {
          console.error('Failed to synchronize deleted category:', error);
          showToast('Tab removed locally; cloud deletion will retry when connected');
        });
      }
      setSettings((prev) => {
        if (prev.activeTab === categoryId) {
          const next = { ...prev, activeTab: 'all' };
          void dbService.saveSettings(next).catch((error) => {
            console.error('Failed to save settings after category deletion:', error);
            showToast('Tab removed, but settings could not be saved');
          });
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
      const existingNames = new Set(tasks.map((task) => task.name.trim().toLowerCase()));
      const newTasks: Task[] = [];

      for (const line of validLines) {
        const nameKey = line.toLowerCase();
        if (existingNames.has(nameKey)) continue;
        existingNames.add(nameKey);
        maxSort++;
        const t: Task = {
          id: crypto.randomUUID(),
          name: line,
          importance: 3,
          estimatedTime: 60,
          estimatedTimeUnit: 'minutes',
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
      const skipped = validLines.length - newTasks.length;
      showToast(
        skipped
          ? `Added ${newTasks.length} tasks; skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}`
          : `Added ${newTasks.length} tasks`
      );
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
    } catch (err: unknown) {
      console.error('Cloud connect error:', err);
      const errorObject = typeof err === 'object' && err !== null ? err : null;
      const errorCode =
        errorObject && 'code' in errorObject ? String(errorObject.code) : '';
      const errorMessage =
        errorObject && 'message' in errorObject
          ? String(errorObject.message)
          : String(err);
      let msg = errorMessage || 'Failed to sign in';
      if (errorCode === '10' || errorMessage.trim() === '10') {
        msg =
          'Google sign-in configuration error (DEVELOPER_ERROR 10). Check that Google sign-in is enabled in Firebase and the Android OAuth client matches this app’s package name and signing certificate SHA-1.';
      } else if (errorCode === 'auth/popup-blocked') {
        msg = 'Popup was blocked by your browser. Please allow popups.';
      } else if (errorCode === 'auth/popup-closed-by-user') {
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
      await uploadPendingCategoryDeletions(cloudUser.uid);
      await pushAllToCloud(tasks, categories, settings, cloudUser.uid);
      showToast('Merged all local tasks to cloud');
    } catch (err: any) {
      showToast(`Cloud push failed: ${err.message}`);
    }
  }, [cloudUser, tasks, categories, settings, showToast]);

  const overwriteCloudAction = useCallback(async () => {
    if (!cloudUser) return;
    try {
      await uploadPendingCategoryDeletions(cloudUser.uid);
      await overwriteCloudWithLocal(tasks, categories, settings, cloudUser.uid);
      showToast('Replaced cloud database with local tasks');
    } catch (err: any) {
      showToast(`Cloud overwrite failed: ${err.message}`);
    }
  }, [cloudUser, tasks, categories, settings, showToast]);

  const pullCloudAction = useCallback(async () => {
    if (!cloudUser) return;
    try {
      await uploadPendingCategoryDeletions(cloudUser.uid);
      const data = await fetchCloudData(cloudUser.uid);
      if (data) {
        for (const deletion of data.categoryDeletions) {
          await dbService.putCategoryDeletion(deletion);
          await dbService.deleteCategory(deletion.categoryId);
        }
        const normalizedTasks = data.tasks.map(migrateTaskEstimatedTime);
        setTasks(normalizedTasks);
        setCategories(data.categories.sort((a, b) => (a.sortPosition ?? 0) - (b.sortPosition ?? 0)));
        if (data.settings) setSettings((prev) => ({ ...prev, ...data.settings }));

        for (let i = 0; i < normalizedTasks.length; i++) {
          await dbService.putTask(normalizedTasks[i]);
          if (data.tasks[i].estimatedTimeUnit !== 'minutes') {
            await pushTaskToCloud(normalizedTasks[i], cloudUser.uid);
          }
        }
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
    const now = new Date();
    const timestamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
    ].join('');
    a.download = `lists-bak-${timestamp}.json`;
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
        const normalizedTasks = data.tasks.map((task: Task) => migrateTaskEstimatedTime(task));
        for (const task of normalizedTasks) await dbService.putTask(task);
        if (Array.isArray(data.categories)) {
          for (const c of data.categories) await dbService.putCategory(c);
        }
        if (data.settings) {
          await dbService.saveSettings({ ...settings, ...data.settings });
        }
        setTasks(normalizedTasks);
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
    async (minutes: number, taskId?: string) => {
      const reminderTask = taskId
        ? tasks.find((task) => task.id === taskId)
        : activeReminderTask;
      if (!reminderTask) return;
      const newTime = new Date(Date.now() + minutes * 60 * 1000);
      const year = newTime.getFullYear();
      const month = String(newTime.getMonth() + 1).padStart(2, '0');
      const day = String(newTime.getDate()).padStart(2, '0');
      const hours = String(newTime.getHours()).padStart(2, '0');
      const mins = String(newTime.getMinutes()).padStart(2, '0');

      const updated: Task = {
        ...reminderTask,
        reminderAt: `${year}-${month}-${day}T${hours}:${mins}`,
        reminderFired: false,
        updatedAt: new Date().toISOString(),
      };
      const notificationPermissionGranted = await updateTask(updated);
      setActiveReminderTask((current) => (current?.id === reminderTask.id ? null : current));
      showToast(
        notificationPermissionGranted
          ? `Snoozed for ${minutes} minutes`
          : `Snoozed for ${minutes} minutes, but Android notifications are disabled`
      );
    },
    [activeReminderTask, tasks, updateTask, showToast]
  );

  const snoozeReminderRef = useRef(snoozeReminder);
  useEffect(() => {
    snoozeReminderRef.current = snoozeReminder;
  }, [snoozeReminder]);

  useEffect(() => {
    if (!tasksLoaded || !isAndroidNative()) return;

    let disposed = false;
    let listener: PluginListenerHandle | null = null;
    const registerListener = async () => {
      await LocalNotifications.registerActionTypes({
        types: [
          {
            id: TASK_REMINDER_ACTION_TYPE,
            actions: [{ id: 'snooze-15', title: 'Snooze 15m', foreground: true }],
          },
        ],
      });
      const registeredListener = await LocalNotifications.addListener(
        'localNotificationActionPerformed',
        (event) => {
          if (
            event.actionId !== 'snooze-15' ||
            event.notification.extra?.source !== 'lists-task-reminder' ||
            typeof event.notification.extra?.taskId !== 'string'
          ) {
            return;
          }
          void snoozeReminderRef.current(15, event.notification.extra.taskId).catch((error) => {
            console.error('Failed to snooze Android reminder:', error);
            showToast('Could not snooze Android reminder');
          });
        }
      );
      if (disposed) {
        await registeredListener.remove();
      } else {
        listener = registeredListener;
      }
    };
    void registerListener().catch((error) => {
      if (disposed) return;
      console.error('Failed to register Android reminder actions:', error);
      showToast('Android reminder actions could not be enabled');
    });

    return () => {
      disposed = true;
      if (listener) {
        void listener.remove().catch((error) => {
          console.error('Failed to remove Android reminder listener:', error);
        });
      }
    };
  }, [tasksLoaded, showToast]);

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

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  getDocs,
  getDoc,
  writeBatch,
  getDocFromServer,
  Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Task, Category, Settings, CloudSyncStatus } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot
export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration: client is offline.');
    }
  }
}
testConnection();

export async function signInCloudWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutCloud(): Promise<void> {
  await signOut(auth);
}

export async function pushTaskToCloud(task: Task, userId: string): Promise<void> {
  if (!userId) return;
  const path = `users/${userId}/tasks/${task.id}`;
  try {
    const taskRef = doc(db, 'users', userId, 'tasks', String(task.id));
    const payload = {
      ...task,
      updatedAt: task.updatedAt || new Date().toISOString(),
    };
    await setDoc(taskRef, payload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteTaskFromCloud(taskId: string, userId: string): Promise<void> {
  if (!userId) return;
  const path = `users/${userId}/tasks/${taskId}`;
  try {
    const taskRef = doc(db, 'users', userId, 'tasks', String(taskId));
    await deleteDoc(taskRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function pushCategoryToCloud(category: Category, userId: string): Promise<void> {
  if (!userId) return;
  const path = `users/${userId}/categories/${category.id}`;
  try {
    const catRef = doc(db, 'users', userId, 'categories', String(category.id));
    const payload = {
      ...category,
      updatedAt: category.updatedAt || new Date().toISOString(),
    };
    await setDoc(catRef, payload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteCategoryFromCloud(categoryId: string, userId: string): Promise<void> {
  if (!userId) return;
  const path = `users/${userId}/categories/${categoryId}`;
  try {
    const catRef = doc(db, 'users', userId, 'categories', String(categoryId));
    await deleteDoc(catRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function pushSettingsToCloud(settings: Settings, userId: string): Promise<void> {
  if (!userId) return;
  const path = `users/${userId}/settings/prefs`;
  try {
    const settingsRef = doc(db, 'users', userId, 'settings', 'prefs');
    const payload = {
      ...settings,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(settingsRef, payload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function fetchCloudData(userId: string): Promise<{
  tasks: Task[];
  categories: Category[];
  settings: Partial<Settings> | null;
}> {
  try {
    const tasksSnap = await getDocs(collection(db, 'users', userId, 'tasks'));
    const tasks: Task[] = [];
    tasksSnap.forEach((docSnap) => {
      tasks.push({ id: docSnap.id, ...docSnap.data() } as Task);
    });

    const catsSnap = await getDocs(collection(db, 'users', userId, 'categories'));
    const categories: Category[] = [];
    catsSnap.forEach((docSnap) => {
      categories.push({ id: docSnap.id, ...docSnap.data() } as Category);
    });

    let settings: Partial<Settings> | null = null;
    try {
      const setSnap = await getDoc(doc(db, 'users', userId, 'settings', 'prefs'));
      if (setSnap.exists()) {
        settings = setSnap.data() as Partial<Settings>;
      }
    } catch (_) {}

    return { tasks, categories, settings };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `users/${userId}`);
    throw err;
  }
}

export async function pushAllToCloud(
  tasks: Task[],
  categories: Category[],
  settings: Settings,
  userId: string
): Promise<void> {
  if (!userId) return;
  const nowIso = new Date().toISOString();
  let batch = writeBatch(db);
  let opCount = 0;

  for (const task of tasks) {
    if (opCount >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }
    const ref = doc(db, 'users', userId, 'tasks', String(task.id));
    batch.set(ref, { ...task, updatedAt: task.updatedAt || nowIso }, { merge: true });
    opCount++;
  }

  for (const cat of categories) {
    if (opCount >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }
    const ref = doc(db, 'users', userId, 'categories', String(cat.id));
    batch.set(ref, { ...cat, updatedAt: cat.updatedAt || nowIso }, { merge: true });
    opCount++;
  }

  if (settings) {
    if (opCount >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }
    const ref = doc(db, 'users', userId, 'settings', 'prefs');
    batch.set(ref, { ...settings, updatedAt: nowIso }, { merge: true });
    opCount++;
  }

  if (opCount > 0) {
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${userId}`);
    }
  }
}

export async function overwriteCloudWithLocal(
  tasks: Task[],
  categories: Category[],
  settings: Settings,
  userId: string
): Promise<void> {
  if (!userId) throw new Error('Not connected to Cloud Sync');
  const nowIso = new Date().toISOString();

  // Find existing remote tasks to delete obsolete
  const existingSnap = await getDocs(collection(db, 'users', userId, 'tasks'));
  const localTaskIds = new Set(tasks.map((t) => String(t.id)));

  let batch = writeBatch(db);
  let opCount = 0;

  existingSnap.forEach((docSnap) => {
    if (!localTaskIds.has(docSnap.id)) {
      batch.delete(doc(db, 'users', userId, 'tasks', docSnap.id));
      opCount++;
    }
  });

  for (const task of tasks) {
    if (opCount >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }
    const ref = doc(db, 'users', userId, 'tasks', String(task.id));
    batch.set(ref, { ...task, updatedAt: task.updatedAt || nowIso });
    opCount++;
  }

  for (const cat of categories) {
    if (opCount >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }
    const ref = doc(db, 'users', userId, 'categories', String(cat.id));
    batch.set(ref, { ...cat, updatedAt: cat.updatedAt || nowIso });
    opCount++;
  }

  if (settings) {
    if (opCount >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }
    const ref = doc(db, 'users', userId, 'settings', 'prefs');
    batch.set(ref, { ...settings, updatedAt: nowIso });
    opCount++;
  }

  if (opCount > 0) {
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${userId}`);
    }
  }
}

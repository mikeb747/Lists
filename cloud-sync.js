// Real-Time Multi-Device Cloud Sync using Firebase Cloud Firestore & Google Auth
// Lists PWA - Client-side real-time synchronization engine

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
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
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

export const OperationType = {
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  LIST: "list",
  GET: "get",
  WRITE: "write",
};

let db = null;
let auth = null;
let googleProvider = null;
let currentUser = null;
let unsubTasks = null;
let unsubCategories = null;
let unsubSettings = null;
let isApplyingRemoteUpdate = false;
let syncStatusCallback = null;
let latestRemoteTasks = [];

export function handleFirestoreError(error, operationType, path = null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo: auth?.currentUser?.providerData?.map((p) => ({
        providerId: p.providerId,
        email: p.email,
      })) || [],
    },
  };
  console.error("Firestore Error:", JSON.stringify(errInfo));
  return new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  if (!db) return;
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Please check your Firebase configuration: client is offline.");
    }
  }
}

export function getIsApplyingRemote() {
  return isApplyingRemoteUpdate;
}

export function setIsApplyingRemote(val) {
  isApplyingRemoteUpdate = Boolean(val);
}

export function getCurrentCloudUser() {
  return currentUser;
}

export function getLatestRemoteTasks() {
  return [...latestRemoteTasks];
}

/**
 * Initialize Firebase Auth and Firestore for real-time live synchronization.
 */
export async function initFirebaseCloudSync({ onAuthChange, onRemoteUpdate, onSyncStatus }) {
  syncStatusCallback = onSyncStatus;
  try {
    const res = await fetch("./firebase-applet-config.json");
    if (!res.ok) throw new Error("Could not load firebase-applet-config.json");
    const config = await res.json();

    const app = getApps().length > 0 ? getApp() : initializeApp(config);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: "select_account" });

    const dbId = config.firestoreDatabaseId || "(default)";
    try {
      db = dbId && dbId !== "(default)" ? getFirestore(app, dbId) : getFirestore(app);
    } catch (_) {
      db = getFirestore(app);
    }

    testConnection().catch(() => {});

    onAuthStateChanged(auth, async (user) => {
      currentUser = user;
      if (user) {
        if (syncStatusCallback) syncStatusCallback("connecting", "Connecting to live cloud sync...");
        subscribeRealtime(user, onRemoteUpdate);
      } else {
        unsubscribeRealtime();
        latestRemoteTasks = [];
        if (syncStatusCallback) syncStatusCallback("offline", "Signed out from live sync");
      }
      if (onAuthChange) onAuthChange(user);
    });

    return { auth, db };
  } catch (err) {
    console.error("Cloud sync initialization failed:", err);
    if (syncStatusCallback) syncStatusCallback("error", `Cloud sync unavailable: ${err.message}`);
    return null;
  }
}

/**
 * Trigger Google Sign-In popup for cloud live sync.
 */
export async function signInCloudWithGoogle() {
  if (!auth || !googleProvider) {
    throw new Error("Authentication is still initializing. Please try again.");
  }
  const result = await signInWithPopup(auth, googleProvider);
  currentUser = result.user;
  return result.user;
}

/**
 * Sign out from cloud sync.
 */
export async function signOutCloud() {
  unsubscribeRealtime();
  latestRemoteTasks = [];
  if (auth) {
    await signOut(auth);
  }
  currentUser = null;
}

/**
 * Fetch all current cloud data once (tasks, categories, settings).
 */
export async function fetchCloudData() {
  if (!db || !currentUser?.uid) return null;
  const uid = currentUser.uid;
  try {
    const tasksSnap = await getDocs(collection(db, "users", uid, "tasks"));
    const tasks = [];
    tasksSnap.forEach((docSnap) => {
      tasks.push({ id: docSnap.id, ...docSnap.data() });
    });

    const catsSnap = await getDocs(collection(db, "users", uid, "categories"));
    const categories = [];
    catsSnap.forEach((docSnap) => {
      categories.push({ id: docSnap.id, ...docSnap.data() });
    });

    let settings = null;
    try {
      const setSnap = await getDoc(doc(db, "users", uid, "settings", "prefs"));
      if (setSnap.exists()) {
        settings = setSnap.data();
      }
    } catch (_) {}

    latestRemoteTasks = tasks;
    return { tasks, categories, settings };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `users/${uid}`);
    throw err;
  }
}

/**
 * Subscribe to real-time updates for tasks, categories, and settings in Firestore.
 */
function subscribeRealtime(user, onRemoteUpdate) {
  unsubscribeRealtime();
  if (!db || !user?.uid) return;

  const uid = user.uid;
  const tasksPath = `users/${uid}/tasks`;
  const categoriesPath = `users/${uid}/categories`;
  const settingsPath = `users/${uid}/settings/prefs`;

  const tasksRef = collection(db, "users", uid, "tasks");
  const categoriesRef = collection(db, "users", uid, "categories");
  const settingsDocRef = doc(db, "users", uid, "settings", "prefs");

  let initialTasksLoaded = false;
  let initialCatsLoaded = false;

  unsubTasks = onSnapshot(
    tasksRef,
    async (snapshot) => {
      const hasPendingWrites = snapshot.metadata.hasPendingWrites;
      const remoteTasks = [];
      snapshot.forEach((docSnap) => {
        remoteTasks.push({ id: docSnap.id, ...docSnap.data() });
      });

      const isFirst = !initialTasksLoaded;
      initialTasksLoaded = true;
      latestRemoteTasks = remoteTasks;

      const changes = snapshot.docChanges().map((ch) => ({
        type: ch.type,
        id: ch.doc.id,
        data: ch.doc.data(),
      }));

      // Deliver remote update to application listener
      if (!hasPendingWrites || isFirst) {
        if (onRemoteUpdate) {
          try {
            await onRemoteUpdate({
              type: "tasks",
              items: remoteTasks,
              isInitial: isFirst,
              changes,
            });
          } catch (e) {
            console.error("Error in onRemoteUpdate:", e);
          }
        }
      }

      if (syncStatusCallback) {
        const timeStr = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        syncStatusCallback("synced", `Live Synced at ${timeStr} ✓`, {
          remoteCount: remoteTasks.length,
          timeStr,
        });
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, tasksPath);
      if (syncStatusCallback) syncStatusCallback("error", `Sync error: ${error.message}`);
    }
  );

  unsubCategories = onSnapshot(
    categoriesRef,
    async (snapshot) => {
      const hasPendingWrites = snapshot.metadata.hasPendingWrites;
      const remoteCategories = [];
      snapshot.forEach((docSnap) => {
        remoteCategories.push({ id: docSnap.id, ...docSnap.data() });
      });

      const isFirst = !initialCatsLoaded;
      initialCatsLoaded = true;

      if (!hasPendingWrites || isFirst) {
        if (onRemoteUpdate) {
          try {
            await onRemoteUpdate({
              type: "categories",
              items: remoteCategories,
              isInitial: isFirst,
            });
          } catch (e) {
            console.error("Error in onRemoteUpdate categories:", e);
          }
        }
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, categoriesPath);
    }
  );

  unsubSettings = onSnapshot(
    settingsDocRef,
    async (docSnap) => {
      if (docSnap.exists() && !docSnap.metadata.hasPendingWrites) {
        const remoteSettings = docSnap.data();
        if (onRemoteUpdate) {
          try {
            await onRemoteUpdate({ type: "settings", item: remoteSettings });
          } catch (e) {
            console.error("Error in onRemoteUpdate settings:", e);
          }
        }
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, settingsPath);
    }
  );
}

/**
 * Detach all Firestore active listeners.
 */
function unsubscribeRealtime() {
  if (unsubTasks) {
    unsubTasks();
    unsubTasks = null;
  }
  if (unsubCategories) {
    unsubCategories();
    unsubCategories = null;
  }
  if (unsubSettings) {
    unsubSettings();
    unsubSettings = null;
  }
}

/**
 * Push an added or edited task to Firestore.
 */
export async function pushTaskToCloud(task) {
  if (!db || !currentUser?.uid || isApplyingRemoteUpdate) return;
  const path = `users/${currentUser.uid}/tasks/${task.id}`;
  try {
    const taskRef = doc(db, "users", currentUser.uid, "tasks", String(task.id));
    const payload = {
      ...task,
      updatedAt: task.updatedAt || new Date().toISOString(),
    };
    await setDoc(taskRef, payload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Delete a task from Firestore.
 */
export async function deleteTaskFromCloud(taskId) {
  if (!db || !currentUser?.uid || isApplyingRemoteUpdate) return;
  const path = `users/${currentUser.uid}/tasks/${taskId}`;
  try {
    const taskRef = doc(db, "users", currentUser.uid, "tasks", String(taskId));
    await deleteDoc(taskRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * Push an added or updated category to Firestore.
 */
export async function pushCategoryToCloud(category) {
  if (!db || !currentUser?.uid || isApplyingRemoteUpdate) return;
  const path = `users/${currentUser.uid}/categories/${category.id}`;
  try {
    const catRef = doc(db, "users", currentUser.uid, "categories", String(category.id));
    const payload = {
      ...category,
      updatedAt: category.updatedAt || new Date().toISOString(),
    };
    await setDoc(catRef, payload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Delete a category from Firestore.
 */
export async function deleteCategoryFromCloud(categoryId) {
  if (!db || !currentUser?.uid || isApplyingRemoteUpdate) return;
  const path = `users/${currentUser.uid}/categories/${categoryId}`;
  try {
    const catRef = doc(db, "users", currentUser.uid, "categories", String(categoryId));
    await deleteDoc(catRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * Push user settings preferences to Firestore.
 */
export async function pushSettingsToCloud(settings) {
  if (!db || !currentUser?.uid || isApplyingRemoteUpdate) return;
  const path = `users/${currentUser.uid}/settings/prefs`;
  try {
    const settingsRef = doc(db, "users", currentUser.uid, "settings", "prefs");
    const payload = {
      ...settings,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(settingsRef, payload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Batch upload/merge local tasks, categories, and settings to the cloud.
 */
export async function pushAllToCloud(tasks, categories, settings) {
  if (!db || !currentUser?.uid) return;
  const uid = currentUser.uid;
  const nowIso = new Date().toISOString();

  let batch = writeBatch(db);
  let opCount = 0;

  if (Array.isArray(tasks)) {
    for (const task of tasks) {
      if (opCount >= 450) {
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
      }
      const ref = doc(db, "users", uid, "tasks", String(task.id));
      batch.set(ref, { ...task, updatedAt: task.updatedAt || nowIso }, { merge: true });
      opCount++;
    }
  }

  if (Array.isArray(categories)) {
    for (const cat of categories) {
      if (opCount >= 450) {
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
      }
      const ref = doc(db, "users", uid, "categories", String(cat.id));
      batch.set(ref, { ...cat, updatedAt: cat.updatedAt || nowIso }, { merge: true });
      opCount++;
    }
  }

  if (settings) {
    if (opCount >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }
    const ref = doc(db, "users", uid, "settings", "prefs");
    batch.set(ref, { ...settings, updatedAt: nowIso }, { merge: true });
    opCount++;
  }

  if (opCount > 0) {
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
      throw err;
    }
  }
}

/**
 * Explicit Overwrite: Replace Cloud database completely with local dataset.
 * Removes obsolete tasks from Cloud that no longer exist locally, then writes all local tasks.
 */
export async function overwriteCloudWithLocal(tasks, categories, settings) {
  if (!db || !currentUser?.uid) throw new Error("Not connected to Cloud Sync");
  const uid = currentUser.uid;
  const nowIso = new Date().toISOString();

  // 1. Fetch current cloud tasks to identify deletions
  const existingSnap = await getDocs(collection(db, "users", uid, "tasks"));
  const localTaskIds = new Set((tasks || []).map((t) => String(t.id)));

  let batch = writeBatch(db);
  let opCount = 0;

  existingSnap.forEach((docSnap) => {
    if (!localTaskIds.has(docSnap.id)) {
      batch.delete(doc(db, "users", uid, "tasks", docSnap.id));
      opCount++;
    }
  });

  if (Array.isArray(tasks)) {
    for (const task of tasks) {
      if (opCount >= 450) {
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
      }
      const ref = doc(db, "users", uid, "tasks", String(task.id));
      batch.set(ref, { ...task, updatedAt: task.updatedAt || nowIso });
      opCount++;
    }
  }

  if (Array.isArray(categories)) {
    for (const cat of categories) {
      if (opCount >= 450) {
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
      }
      const ref = doc(db, "users", uid, "categories", String(cat.id));
      batch.set(ref, { ...cat, updatedAt: cat.updatedAt || nowIso });
      opCount++;
    }
  }

  if (settings) {
    if (opCount >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }
    const ref = doc(db, "users", uid, "settings", "prefs");
    batch.set(ref, { ...settings, updatedAt: nowIso });
    opCount++;
  }

  if (opCount > 0) {
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
      throw err;
    }
  }
}

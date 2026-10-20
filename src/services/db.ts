import { Task, Category, CategoryDeletion, Settings } from '../types';

const DB_NAME = 'priority-planner';
const DB_VERSION = 2;

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('tasks')) {
        db.createObjectStore('tasks', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('categories')) {
        db.createObjectStore('categories', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('categoryDeletions')) {
        db.createObjectStore('categoryDeletions', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

function reqToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllTasks(): Promise<Task[]> {
  const db = await openDb();
  const tx = db.transaction('tasks', 'readonly');
  return reqToPromise(tx.objectStore('tasks').getAll());
}

export async function putTask(task: Task): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('tasks', 'readwrite');
  await reqToPromise(tx.objectStore('tasks').put(task));
}

export async function deleteTask(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('tasks', 'readwrite');
  await reqToPromise(tx.objectStore('tasks').delete(id));
}

export async function getAllCategories(): Promise<Category[]> {
  const db = await openDb();
  const tx = db.transaction('categories', 'readonly');
  const items: Category[] = await reqToPromise(tx.objectStore('categories').getAll());
  return items.sort((a, b) => (a.sortPosition ?? 0) - (b.sortPosition ?? 0));
}

export async function putCategory(category: Category): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('categories', 'readwrite');
  await reqToPromise(tx.objectStore('categories').put(category));
}

export async function deleteCategory(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('categories', 'readwrite');
  await reqToPromise(tx.objectStore('categories').delete(id));
}

export async function getAllCategoryDeletions(): Promise<CategoryDeletion[]> {
  const db = await openDb();
  const tx = db.transaction('categoryDeletions', 'readonly');
  return reqToPromise(tx.objectStore('categoryDeletions').getAll());
}

export async function putCategoryDeletion(deletion: CategoryDeletion): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('categoryDeletions', 'readwrite');
  await reqToPromise(tx.objectStore('categoryDeletions').put(deletion));
}

export async function getSettings(): Promise<Partial<Settings> | null> {
  const db = await openDb();
  const tx = db.transaction('settings', 'readonly');
  const items: Array<Settings & { id: string }> = await reqToPromise(tx.objectStore('settings').getAll());
  const found = items.find((item) => item.id === 'app');
  return found || null;
}

export async function saveSettings(settings: Settings): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('settings', 'readwrite');
  await reqToPromise(tx.objectStore('settings').put({ id: 'app', ...settings }));
}

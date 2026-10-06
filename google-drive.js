// Google Drive & Identity Services Integration for Lists PWA
// Uses official Firebase Auth and Google Drive REST API v3
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

export const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

let authInstance = null;
let googleProvider = null;
let isSigningIn = false;
let cachedAccessToken = null;
let currentFirebaseUser = null;

/**
 * Initialize Firebase Authentication for Google Drive integration.
 */
export async function initGoogleAuth(onAuthChangeCallback) {
  try {
    const res = await fetch("./firebase-applet-config.json");
    if (!res.ok) throw new Error("Could not load firebase-applet-config.json");
    const firebaseConfig = await res.json();

    const app = initializeApp(firebaseConfig);
    authInstance = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    SCOPES.forEach((scope) => googleProvider.addScope(scope));
    googleProvider.setCustomParameters({
      prompt: "select_account"
    });

    onAuthStateChanged(authInstance, (user) => {
      currentFirebaseUser = user;
      if (!user) {
        cachedAccessToken = null;
      }
      if (onAuthChangeCallback) {
        onAuthChangeCallback(user, cachedAccessToken);
      }
    });

    return { auth: authInstance, provider: googleProvider };
  } catch (err) {
    console.error("Failed to initialize Firebase Auth for Drive:", err);
    return null;
  }
}

/**
 * Prompt user for Google OAuth sign in with drive.file scope.
 */
export async function signInWithGoogle() {
  if (!authInstance || !googleProvider) {
    throw new Error("Google authentication is still initializing. Please try again.");
  }
  try {
    isSigningIn = true;
    const result = await signInWithPopup(authInstance, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Unable to obtain Google Drive OAuth access token.");
    }
    cachedAccessToken = credential.accessToken;
    currentFirebaseUser = result.user;
    return { user: currentFirebaseUser, accessToken: cachedAccessToken };
  } catch (error) {
    console.error("Google sign-in error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
}

/**
 * Sign out and clear in-memory tokens.
 */
export async function signOutGoogle() {
  if (authInstance) {
    await signOut(authInstance);
  }
  cachedAccessToken = null;
  currentFirebaseUser = null;
}

export function getCachedToken() {
  return cachedAccessToken;
}

export function getCurrentUser() {
  return currentFirebaseUser;
}

/**
 * Generate a timestamped backup filename (e.g. lists-backup-2026-10-06_09-35-12.json)
 */
export function generateBackupFileName() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const mins = pad(now.getMinutes());
  const secs = pad(now.getSeconds());
  return `lists-backup-${year}-${month}-${day}_${hours}-${mins}-${secs}.json`;
}

/**
 * Get or create a dedicated folder in Google Drive (e.g. 'Lists')
 */
export async function getOrCreateDriveFolder(accessToken, folderName = "Lists") {
  const query = encodeURIComponent(`mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and trashed = false`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)&orderBy=createdTime desc`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (res.ok) {
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return data.files[0];
    }
  }

  // Create the folder if it does not exist
  const createRes = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      description: "Dedicated backup folder for Lists application",
    }),
  });

  if (!createRes.ok) {
    const errorBody = await createRes.text();
    throw new Error(`Failed to create '${folderName}' folder in Google Drive: ${errorBody}`);
  }

  return await createRes.json();
}

/**
 * Search Google Drive for the latest backup file in the 'Lists' folder or root Drive.
 */
export async function findDriveBackupFile(accessToken) {
  // First, check if the 'Lists' folder exists
  let folder = null;
  try {
    const folderQuery = encodeURIComponent("mimeType = 'application/vnd.google-apps.folder' and name = 'Lists' and trashed = false");
    const folderRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${folderQuery}&fields=files(id,name,webViewLink)&orderBy=createdTime desc`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (folderRes.ok) {
      const folderData = await folderRes.json();
      if (folderData.files && folderData.files.length > 0) {
        folder = folderData.files[0];
      }
    }
  } catch (err) {
    console.warn("Could not check Lists folder:", err);
  }

  // If folder found, query files inside the Lists folder
  if (folder?.id) {
    const inFolderQuery = encodeURIComponent(`'${folder.id}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`);
    const inFolderRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${inFolderQuery}&fields=files(id,name,modifiedTime,size,parents)&orderBy=modifiedTime desc`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (inFolderRes.ok) {
      const inFolderData = await inFolderRes.json();
      if (inFolderData.files && inFolderData.files.length > 0) {
        return { file: inFolderData.files[0], folder, allFiles: inFolderData.files };
      }
    }
  }

  // Fallback: search anywhere in Drive for any lists-backup files
  const fallbackQuery = encodeURIComponent("name contains 'lists-backup' and trashed = false and mimeType != 'application/vnd.google-apps.folder'");
  const fallbackRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${fallbackQuery}&fields=files(id,name,modifiedTime,size,parents)&orderBy=modifiedTime desc`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (fallbackRes.ok) {
    const fallbackData = await fallbackRes.json();
    if (fallbackData.files && fallbackData.files.length > 0) {
      return { file: fallbackData.files[0], folder, allFiles: fallbackData.files };
    }
  }

  return { file: null, folder, allFiles: [] };
}

/**
 * Upload a new date-and-time timestamped backup JSON file into the 'Lists' folder on Google Drive.
 */
export async function backupToDrive(accessToken, backupData) {
  if (!accessToken) {
    throw new Error("Missing Google Drive authorization token.");
  }

  // 1. Get or create the dedicated 'Lists' folder
  const folder = await getOrCreateDriveFolder(accessToken, "Lists");
  const fileName = generateBackupFileName();
  const jsonContent = JSON.stringify(backupData, null, 2);

  // 2. Upload the timestamped file directly into the 'Lists' folder
  const metadata = {
    name: fileName,
    mimeType: "application/json",
    description: `Backup of Lists tasks, categories, and settings created on ${new Date().toLocaleString()}.`,
    parents: [folder.id],
  };

  const boundary = "-------ListsAppDriveBoundary" + Date.now();
  const delimiter = "\r\n--" + boundary + "\r\n";
  const closeDelimiter = "\r\n--" + boundary + "--";

  const multipartRequestBody =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    jsonContent +
    closeDelimiter;

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,size,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Failed to upload Drive backup (${res.status}): ${errorBody}`);
  }

  const createdFile = await res.json();
  return { file: createdFile, folder, fileName };
}

/**
 * Download the latest backup from the 'Lists' folder on Google Drive.
 */
export async function restoreFromDrive(accessToken) {
  if (!accessToken) {
    throw new Error("Missing Google Drive authorization token.");
  }

  const { file, folder, allFiles } = await findDriveBackupFile(accessToken);
  if (!file) {
    throw new Error("No backup files found in your Google Drive 'Lists' folder or root. Create a backup first.");
  }

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Failed to download backup from Drive (${res.status}): ${errorBody}`);
  }

  const data = await res.json();
  return { data, fileMeta: file, folder, allFiles };
}

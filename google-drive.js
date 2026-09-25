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
 * Search Google Drive for the lists-backup.json file.
 */
export async function findDriveBackupFile(accessToken) {
  const query = encodeURIComponent("name = 'lists-backup.json' and trashed = false");
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Google Drive API error (${res.status}): ${errorBody}`);
  }

  const data = await res.json();
  return data.files && data.files.length > 0 ? data.files[0] : null;
}

/**
 * Upload or update lists-backup.json to Google Drive.
 */
export async function backupToDrive(accessToken, backupData) {
  if (!accessToken) {
    throw new Error("Missing Google Drive authorization token.");
  }

  const existingFile = await findDriveBackupFile(accessToken);
  const jsonContent = JSON.stringify(backupData, null, 2);

  if (existingFile) {
    // Update existing file content directly
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: jsonContent,
      }
    );

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Failed to update Drive backup (${res.status}): ${errorBody}`);
    }

    return await res.json();
  } else {
    // Create new backup file via multipart upload
    const metadata = {
      name: "lists-backup.json",
      mimeType: "application/json",
      description: "Backup of Lists tasks, categories, and settings.",
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
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
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

    return await res.json();
  }
}

/**
 * Download lists-backup.json from Google Drive.
 */
export async function restoreFromDrive(accessToken) {
  if (!accessToken) {
    throw new Error("Missing Google Drive authorization token.");
  }

  const file = await findDriveBackupFile(accessToken);
  if (!file) {
    throw new Error("No 'lists-backup.json' file found in your Google Drive. Create a backup first.");
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
  return { data, fileMeta: file };
}

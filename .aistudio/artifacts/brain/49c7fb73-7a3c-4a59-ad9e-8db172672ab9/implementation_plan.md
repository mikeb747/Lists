# Implementation Plan: Firebase Cloud Firestore Real-Time Multi-Device Sync

## 1. Executive Summary & User Alignment

The user requested a seamless way to synchronize tasks and lists across multiple devices (such as PC and phone) without relying on Google Drive manual backups or folder management, while **strictly preserving** the existing **Google Drive Cloud Sync** and **Local JSON Export/Import** options for backup redundancy.

### Chosen Architecture
* **Cloud Platform**: **Firebase Cloud Firestore** (hosted on Google Cloud Platform).
* **Authentication**: **Google Sign-In** via Firebase Auth (allowing the user to log in with their existing Google account).
* **Sync Engine**: Bidirectional offline-first sync. Tasks, categories, and settings automatically synchronize between devices in real time via Firestore listeners (`onSnapshot`), while IndexedDB continues to serve as the local offline cache.
* **Preservation of Existing Features**:
  * Local JSON Export & Import remains fully functional.
  * Google Drive Cloud Backup & Restore (`lists-backup-*.json` in the `Lists` folder) remains completely functional as a secondary archive option.

---

## 2. Architecture & Security Model

### A. Firestore Data Hierarchy
To guarantee total privacy, isolation, and security, all data will be organized under each user's authenticated UID:

```text
/databases/(default)/documents/
  users/{userId}/
    data/
      profile (document: email, displayName, lastSyncedAt, clientVersion)
      settings (document: app settings, theme, colorTheme, activeTab, holdTimers)
    tasks/{taskId} (collection of task documents: name, importance, dueDate, categoryId, subtasks, completed, sortPosition, updatedAt)
    categories/{categoryId} (collection of user tabs/categories: name, sortPosition, color, compact, hiddenFromTasks)
```

### B. Security Rules (`firestore.rules`)
Strict authorization rules ensuring users can only read, write, and query their own private data:

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

### C. Blueprint Specification (`firebase-blueprint.json`)
A structured schema document detailing entity schemas, properties, required fields, and index definitions for `tasks`, `categories`, and `settings`.

---

## 3. UI/UX Design & Ergonomics

Following `frontend-design` and mobile ergonomics guidelines ($44\text{px}$ touch targets, clean unboxed metadata, zero pill clutter):

1. **Settings Pane Organization**:
   * **Live Cloud Sync (Recommended)**:
     * Prominent Google Sign-In card with connected user avatar and real-time status indicator (`Live Synced ✓`, `Syncing changes...`, or `Offline (saved locally)`).
     * Automatic sync: any edit made on PC reflects on mobile in real time without clicking buttons.
   * **Google Drive Cloud Backup (Secondary Archive)**:
     * Retained exactly as is with "Backup to Drive", "Restore from Drive", and "Open 'Lists' Folder".
   * **Local Data Storage (Offline File Backup)**:
     * Retained exactly as is with "Export JSON" and "Import JSON".

2. **Conflict Resolution**:
   * Last-Write-Wins (LWW) based on `updatedAt` ISO timestamps.
   * Real-time listeners update the in-memory state and IndexedDB smoothly without resetting user inputs or scrolling.

---

## 4. Step-by-Step Implementation Flow

### Step 1: Firebase Provisioning (Interactive Workflow)
1. Invoke `show_aistudio_ui` with `ui_type: "firebase_setup"` to open the setup UI for user confirmation.
2. Verify terms acceptance using `GetFirebaseTos` via `rpc_action`.
3. Provision Firestore database using `ProvisionFirebase` via `rpc_action` with project `gen-lang-client-0797159188` on platform `web`.
4. Deploy security rules (`firestore.rules`) using `DeployRules` via `rpc_action`.

### Step 2: Cloud Sync Client Module (`cloud-sync.js`)
* Create `cloud-sync.js` importing Firebase Firestore SDK (`getFirestore`, `collection`, `doc`, `onSnapshot`, `setDoc`, `deleteDoc`, `writeBatch`).
* Provide functions:
  * `initCloudSync(user, onRemoteUpdateCallback)`: Subscribes to `/users/{uid}/tasks` and `/users/{uid}/categories` real-time listeners.
  * `syncLocalChangeToCloud(type, item, action)`: Pushes local adds, updates, and deletes to Firestore.
  * `initialPullAndMerge(user)`: Performs initial pull and smart merge with local IndexedDB on first login.
  * `detachCloudSync()`: Cleans up listeners on sign-out.

### Step 3: Integrate with App Engine (`app.js`)
* Connect `cloud-sync.js` to task mutations (`put`, `remove`, reordering).
* Automatically publish changes to Firestore when online and signed in.
* Wire incoming remote snapshots to update state and render views in real time.
* Maintain IndexedDB as local instant storage so the PWA remains 100% offline-capable.

### Step 4: UI Updates (`index.html` & `styles.css`)
* Add "Live Cloud Sync" section to the Settings pane.
* Add live synchronization status indicators.
* Keep Google Drive and JSON import/export sections completely intact.

### Step 5: Verification & Testing
* Test Google Sign-In flow.
* Verify simultaneous multi-device/multi-tab updates (creating a task in one window immediately updates the other).
* Verify offline behavior (making changes offline, then reconnecting to observe automatic sync).
* Verify Google Drive backup and local JSON export still function independently.

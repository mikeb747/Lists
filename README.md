# Lists - React PWA

A mobile-first, high-performance Progressive Web App (PWA) rewritten in **React + TypeScript + Vite**.

## Overview
Lists allows users to plan tasks by importance, estimated duration, due dates, recurrence rules, and custom categories. It includes real-time multi-device cloud synchronization with Firebase Firestore & Google Auth, JSON Backup & Restore.

## Technology Stack
- **Framework**: React 19 + TypeScript
- **Bundler & Dev Server**: Vite (listening on port 3000)
- **Styling**: Material Design 3 CSS custom properties with 16 color themes + Light/Dark/System modes
- **Local Persistence**: IndexedDB (`priority-planner`)
- **Cloud Database**: Firebase Firestore with real-time `onSnapshot` subscriptions
- **Category deletions**: locally persisted deletion records sync to Firestore and remain there to prevent offline tabs from reappearing
- **Authentication**: Firebase Google Auth with popup
- **Manual Backup**: JSON file export and import

## Running and deploying

Run the app locally with `npm install` followed by `npm run dev`. For a production
build, run `npm run build`; the deployable files are written to `dist`.
Deploy `firestore.rules` when enabling category-deletion sync so signed-in clients can
read and write the `categoryDeletions` collection.

## Android

The Android app is a Capacitor wrapper around the same React interface. Install
Android Studio and its Android SDK, then run `npm run android:sync` to build the
web app and copy it into the native project. Open the project with
`npx cap open android` to run it on a device or emulator.

Task reminders use Android local notifications. The app requests notification
permission when a reminder is added or changed, and restores pending notifications
from saved tasks at startup. Android reminders include a 15-minute snooze action.
Browser and PWA installs continue to use the existing in-app and Web Notifications
behavior.

Every push to `main` also builds an Android debug APK using the workflow in
`.github/workflows/android.yml`, in parallel with the GitHub Pages build. Download
the `Lists-android-debug-<commit>` artifact from that run under **Actions** and
extract `app-debug.apk`. Transfer the APK to your phone (for example, over USB),
open it there, and allow installation from that source if Android prompts you.
The artifact is available for 30 days; it is a debug build for sideloading, not
a Play Store release.

GitHub Pages deployments are built by the workflow in
`.github/workflows/deploy.yml`. In the repository settings, set **Pages → Build
and deployment → Source** to **GitHub Actions**. The Vite build compiles the
React and TypeScript entry point and copies the PWA manifest and icons from
`public/`; serving the repository root directly will not work.

## Key Features
1. **Category Tabs**:
   - Fresh install starts clean without default seeded tabs.
   - "All", "Archive", and custom user-defined tabs with names and emojis.
   - Tab customization: 12 accent colors, compact list mode, "Hide from All" toggle, tab reordering.
2. **Tasks & Subheadings**:
   - Task name, importance rating (1-5), estimated duration in minutes, due dates with overdue detection. Existing hour-based estimates are converted to equivalent minutes.
   - Section subheadings (dividers) for itineraries and long lists.
   - Recurrence rules: Daily, Weekdays, Weekly, Biweekly, Monthly.
   - Checklists / Subtasks: progress bar with completion percentage, collapsible view, and subtask-to-task conversion.
   - Swipe gestures: Swipe right to complete, swipe left to delete.
3. **Bulk Paste**:
   - Multi-line textarea to paste batches of items directly into any category tab.
4. **Live Cloud Sync & Manual JSON Backup**:
   - Real-time Firestore sync with local vs cloud task counter comparison.
   - Offline-first local JSON file export/import.

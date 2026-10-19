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
- **Authentication**: Firebase Google Auth with popup
- **Manual Backup**: JSON file export and import

## Running and deploying

Run the app locally with `npm install` followed by `npm run dev`. For a production
build, run `npm run build`; the deployable files are written to `dist`.

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
   - Task name, importance rating (1-5), estimated hours, due dates with overdue detection.
   - Section subheadings (dividers) for itineraries and long lists.
   - Recurrence rules: Daily, Weekdays, Weekly, Biweekly, Monthly.
   - Checklists / Subtasks: progress bar with completion percentage, collapsible view, and subtask-to-task conversion.
   - Swipe gestures: Swipe right to complete, swipe left to delete.
3. **Bulk Paste**:
   - Multi-line textarea to paste batches of items directly into any category tab.
4. **Live Cloud Sync & Manual JSON Backup**:
   - Real-time Firestore sync with local vs cloud task counter comparison.
   - Offline-first local JSON file export/import.

# Lists - React PWA

A mobile-first, high-performance Progressive Web App (PWA) rewritten in **React + TypeScript + Vite**.

## Overview
Lists allows users to plan tasks by importance, estimated duration, due dates, recurrence rules, and custom categories. It includes real-time multi-device cloud synchronization with Firebase Firestore & Google Auth, Google Drive snapshot backup/restore, an integrated Pomodoro focus timer with synth audio chimes, and productivity analytics.

## Technology Stack
- **Framework**: React 19 + TypeScript
- **Bundler & Dev Server**: Vite (listening on port 3000)
- **Styling**: Material Design 3 CSS custom properties with 16 color themes + Light/Dark/System modes
- **Local Persistence**: IndexedDB (`priority-planner`)
- **Cloud Database**: Firebase Firestore with real-time `onSnapshot` subscriptions
- **Authentication**: Firebase Google Auth with popup
- **Cloud Backup**: Google Drive REST API v3
- **Audio & Alerts**: Web Audio API synthesizer chimes & Web Notifications API

## Key Features
1. **Category Tabs**:
   - Fresh install starts clean without default seeded tabs (Personal and Work removed).
   - "All", "Archive", and custom user-defined tabs with names and emojis.
   - Tab customization: 12 accent colors, compact list mode, "Hide from All" toggle, tab reordering.
2. **Tasks & Subheadings**:
   - Task name, importance rating (1-5), estimated hours, due dates with overdue detection.
   - Section subheadings (dividers) for itineraries and long lists.
   - Recurrence rules: Daily, Weekdays, Weekly, Biweekly, Monthly.
   - Checklists / Subtasks: progress bar with completion percentage, collapsible view, and subtask-to-task conversion.
   - Swipe gestures: Swipe right to complete, swipe left to delete.
3. **Focus Timer**:
   - 25m Pomodoro, 15m Sprint, 45m Deep, or Task Estimated duration.
   - Circular SVG clock countdown with audio chimes and focus time logging.
4. **Productivity Metrics**:
   - Daily streak tracking, tasks completed today/week, focus minutes today, and category completion breakdown.
5. **Bulk Paste**:
   - Multi-line textarea to paste batches of items directly into any category tab.
6. **Live Cloud Sync & Google Drive**:
   - Real-time Firestore sync with local vs cloud task counter comparison.
   - Timestamped backup JSON files directly in a dedicated `Lists` Google Drive folder.
   - Offline-first local JSON file export/import.

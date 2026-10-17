# Android APK Packaging & Persistent Background Timers Plan

Comprehensive blueprint for transforming the Lists React web application into a production-grade, installable Android APK using Capacitor. This architecture introduces true native background processing through Android's `AlarmManager` for exact reminders, a foreground service for persistent Pomodoro and focus timer sessions, while preserving local IndexedDB storage and real-time Firestore synchronization.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural parameters have been confirmed:
> - **Packaging Platform**: Capacitor hybrid shell wrapping the existing Vite React build (`dist/`), ensuring zero rewrite of UI components, animations, and state logic.
> - **Background Strategy**: Native Android `AlarmManager` for exact reminder scheduling (waking the device from Doze mode) combined with a `ForegroundService` with ongoing notification controls for active focus timer countdowns.
> - **Data Layer**: Preserves current IndexedDB and real-time Firebase Firestore synchronization without requiring migration to native Room SQLite.

---

## 1. Overview & Core Concept

### What It Does
Transforms the existing browser/PWA web experience into a native Android `.apk` binary that runs without browser UI chrome. It solves the primary limitation of web apps on mobile: mobile browsers throttle or kill background JavaScript execution when the screen turns off or the app is minimized. The native layer ensures:
1. **Guaranteed Scheduled Reminders**: Even if the app is swiped away or the phone is in deep Doze mode, notifications trigger on time with vibration and sound.
2. **Persistent Focus Sessions**: Active focus sessions maintain a persistent notification with a running countdown and action controls (Pause/Complete) without losing time or getting terminated by Android's low-memory killer.

### Target Audience & Persona
Mobile-first users on Android devices who need a reliable, self-contained productivity tool that rings alerts like a native alarm clock and keeps focus timers running during deep work sessions.

### Key Value
Reliable, offline-first task management with native OS integration (exact alarms, ongoing status bar notifications, app launcher icon, back-button handling, and fast native boots) while retaining cloud sync across devices.

---

## 2. User Experience & Visual Design

### Key User Flows

```
┌─────────────────────────────────────────────────────────────┐
│                      Android System                         │
└──────────────────────────────┬──────────────────────────────┘
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
    ┌───────────────────────┐     ┌───────────────────────┐
    │     Timer Session     │     │    Task Due Reminder  │
    └───────────┬───────────┘     └───────────┬───────────┘
                │                             │
                ▼                             ▼
    ┌───────────────────────┐     ┌───────────────────────┐
    │  Foreground Service   │     │  AlarmManager Wakeup  │
    │  • Sticky Notification│     │  • Sound / Vibrate    │
    │  • Live MM:SS Counter │     │  • Full Screen / Heads│
    │  • Pause / Complete   │     │  • Complete / Snooze  │
    └───────────────────────┘     └───────────────────────┘
```

1. **Scheduling a Task Reminder**:
   - The user picks a reminder time in the task dialog.
   - The React app saves to IndexedDB/Firestore and invokes the native bridge (`NativeReminders.scheduleReminder`).
   - The native bridge schedules an exact alarm via Android `AlarmManager.setExactAndAllowWhileIdle()`.
   - When the scheduled time arrives: Android wakes up, plays the reminder chime, and fires a rich Notification with `Complete`, `Snooze 15m`, and `Snooze 1h` action buttons.
2. **Starting a Focus Timer**:
   - User hits "Start Focus" (e.g. 25m Pomodoro).
   - The native bridge starts `TimerForegroundService` with an ongoing notification.
   - Even when the screen locks or the phone switches to other apps, the status bar shows the live countdown (`Focusing • 24:18 remaining`).
   - Tapping the notification immediately returns to the Lists app; action buttons allow quick Pause or Mark Done directly from the lock screen.
3. **App Launch & Navigation**:
   - Instant native splash screen transitioning into the Lists top bar and category tabs.
   - Hardware Android back button navigates backwards through open bottom sheets and dialogs before minimizing the app.

### Visual Identity & Theme
- **Consistent Material Design 3 Styling**: Retains the established 16 dynamic accent color themes and dark/light modes.
- **Android Status Bar & Navigation Bar Sync**: Native window insets tint the Android status bar and navigation bar to match the active accent color (`--md-primary` or `--md-surface`).
- **Android Notification Channels**: Distinct channels configured for:
  - `lists_reminders`: High importance, alarm sound, vibration pattern `[0, 250, 100, 250]`.
  - `lists_focus_timer`: Low/Medium importance, silent ongoing notification for the live timer.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Capacitor Native Shell vs. Full Kotlin/Compose Rewrite
- **Chosen Approach**: Capacitor 6+ Native Shell with custom Android plugins.
- **Why**: The React 19 app is already feature-complete, responsive, and contains custom swipe gestures, focus timers, and Firestore integration. Re-writing the entire app in Jetpack Compose would take significant time and introduce divergence bugs. Capacitor provides direct access to native Java/Kotlin Android services while running the proven React UI in a high-performance Android WebView.
- **Alternatives Considered**: 
  - *Full Kotlin Rewrite*: Highest possible performance, but requires re-implementing 100% of all UI, theme logic, and cloud syncing from scratch.
  - *Trusted Web Activity (TWA)*: Simplest packaging, but cannot run persistent foreground services or exact device alarms without external web push servers.

### Decision 2: Background Reminders via `AlarmManager` vs. Web Workers / Service Worker
- **Chosen Approach**: Native Android `AlarmManager` with `setExactAndAllowWhileIdle()`.
- **Why**: Android aggressively terminates JavaScript timers (`setInterval`, `setTimeout`, and Service Worker background threads) when the device sleeps. `AlarmManager` is the only mechanism that reliably wakes up Android from Doze mode at an exact second.
- **Trade-Off**: Requires `SCHEDULE_EXACT_ALARM` and `POST_NOTIFICATIONS` permissions in `AndroidManifest.xml`.

### Decision 3: Background Focus Timer via Foreground Service
- **Chosen Approach**: `android.app.Service` with `startForeground()` and an ongoing notification.
- **Why**: Android 8.0+ restricts background execution. A foreground service with a visible user notification is the standard, OS-approved method to run active timers without system termination.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Capacitor Android Shell                         │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                    React 19 SPA (WebView)                      │   │
│   │                                                                │   │
│   │   ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐   │   │
│   │   │ CategoryTabs │   │   TaskList   │   │ FocusTimerSheet  │   │   │
│   │   └──────┬───────┘   └──────┬───────┘   └────────┬─────────┘   │   │
│   │          │                  │                    │             │   │
│   │   ┌──────┴──────────────────┴────────────────────┴─────────┐   │   │
│   │   │                    PlannerContext                      │   │   │
│   │   └──────────────┬───────────────────────────────┬─────────┘   │   │
│   │                  │                               │             │   │
│   │         ┌────────┴────────┐             ┌────────┴─────────┐   │   │
│   │         │    IndexedDB    │             │ Firebase Cloud   │   │   │
│   │         │ (Local Storage) │             │ (Live Sync)      │   │   │
│   │         └─────────────────┘             └──────────────────┘   │   │
│   └──────────────────────────────────┬─────────────────────────────┘   │
│                                      │ (Capacitor JavaScript Bridge)   │
│                                      ▼                                 │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                     Native Android Plugins                     │   │
│   │                                                                │   │
│   │   ┌───────────────────────────┐    ┌───────────────────────┐   │   │
│   │   │   ReminderPlugin.kt       │    │   FocusTimerPlugin.kt │   │   │
│   │   │   • AlarmManager          │    │   • ForegroundService │   │   │
│   │   │   • BootReceiver          │    │   • Ongoing Notif     │   │   │
│   │   │   • NotificationManager   │    │   • Action Receiver   │   │   │
│   │   └───────────────────────────┘    └───────────────────────┘   │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

### Steps to Implement the Android APK

1. **Install Capacitor Dependencies**:
   - Install `@capacitor/core`, `@capacitor/cli`, and `@capacitor/android`.
   - Initialize Capacitor config (`capacitor.config.ts`) targeting `dist/` as the web directory.
   - Run `npx cap add android` to generate the native Android project directory structure.

2. **Native Alarm & Notification Implementation (`android/`)**:
   - **Permissions in `AndroidManifest.xml`**:
     - `android.permission.POST_NOTIFICATIONS` (Android 13+)
     - `android.permission.SCHEDULE_EXACT_ALARM`
     - `android.permission.USE_EXACT_ALARM`
     - `android.permission.FOREGROUND_SERVICE`
     - `android.permission.RECEIVE_BOOT_COMPLETED` (reschedules alarms after phone reboot)
     - `android.permission.VIBRATE`
   - **`ReminderBroadcastReceiver.kt`**:
     - Receives `AlarmManager` intents.
     - Builds and displays the Heads-Up notification with the task title, due date, and action buttons (`Complete`, `Snooze 15m`).
   - **`BootCompletedReceiver.kt`**:
     - Reads stored pending reminder timestamps from local storage on device restart and re-registers them with `AlarmManager`.
   - **`FocusTimerService.kt`**:
     - Android `Service` running in the foreground with `ServiceCompat.startForeground()`.
     - Maintains internal timer state and updates the ongoing notification ticker once per second.

3. **Capacitor Custom Plugin Bridge (`src/services/nativeBridge.ts`)**:
   - Provides web-to-native bindings with fallback to existing browser `Notification` and `playReminderChime` when running in browser preview:
     ```ts
     export interface NativeBridge {
       scheduleAlarm(taskId: string, title: string, timeMs: number): Promise<void>;
       cancelAlarm(taskId: string): Promise<void>;
       startFocusTimer(taskId: string, title: string, durationSec: number): Promise<void>;
       stopFocusTimer(): Promise<void>;
       isNative(): boolean;
     }
     ```

4. **Integration with `PlannerContext.tsx`**:
   - When a task is added/updated with `reminderAt`, call `scheduleAlarm()`.
   - When a task is completed or deleted, call `cancelAlarm()`.
   - When focus timer starts, call `startFocusTimer()`; on pause/reset/done, call `stopFocusTimer()`.

5. **Building the APK**:
   - Build React web assets: `npm run build`.
   - Sync assets into native Android shell: `npx cap sync android`.
   - Compile debug APK using Gradle: `./gradlew assembleDebug` in `android/`.
   - Output APK location: `android/app/build/outputs/apk/debug/app-debug.apk`.

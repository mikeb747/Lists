# Lists: Power Productivity & Focus Upgrades

Deliver a major suite of productivity upgrades for **Lists**—combining recurring task automation, nested subtask checklists, interactive Android notification snooze/complete actions, and a focused Pomodoro timer with productivity streak analytics.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following four feature suites were selected from the upgrade survey to be built together into the existing Material Design 3 PWA:
> 1. **Recurring Tasks & Smart Scheduling** (Daily, Weekdays, Weekly, Bi-weekly, Monthly with auto-advance on complete)
> 2. **Subtask Checklists within Task Cards** (Interactive step checklists with progress tracking and progress bar)
> 3. **Notification Snooze & Quick-Complete Actions** (Direct Android notification action buttons: "Mark Done", "Snooze 15m", "Snooze 1h", plus in-app snooze chips)
> 4. **Focus Timer & Productivity Stats** (Integrated Pomodoro focus countdown tied to task estimates, along with daily streaks and weekly completion analytics)

---

### 1. Overview & Core Concept

- **What It Does**: Transforms *Lists* from a straightforward task manager into an automated daily driver. Users can set recurring tasks that never get forgotten, break complex tasks into actionable checklists, act on reminders directly from their Android notification shade without opening the app, and run focused work blocks while tracking productivity streaks.
- **Target Audience / Persona**: Everyday task planners, mobile PWA users, and professionals seeking frictionless execution without heavy project management overhead.
- **Key Value**: Drastically reduces manual task recreation, minimizes context switching through direct notification actions, and keeps users motivated with tangible focus sessions and streaks.

---

### 2. User Experience & Visual Design

#### Key User Flows
1. **Recurring Task Flow**:
   - Open task modal → Tap "Repeat" dropdown (Never, Daily, Weekdays, Weekly, Bi-weekly, Monthly).
   - Completing a recurring task rings a celebratory tone, checks off the current task, and automatically schedules the next instance with its time/reminder offsets intact.
2. **Subtasks Checklist Flow**:
   - On any task card, a quiet `+ Add step` or subtask checklist section allows quick typing of subtasks.
   - Checking off a subtask fills the subtle progress bar and updates the unboxed count (e.g., `2 / 5 steps`).
3. **Notification Snooze & Complete Flow**:
   - When a reminder triggers on Android or desktop, the notification displays actionable buttons: `Done`, `Snooze 15m`, and `Snooze 1h`.
   - In-app reminder banners also gain 1-tap `+15m` and `+1h` snooze pills alongside the complete button.
4. **Focus Timer & Insights Flow**:
   - Tap the timer icon on any task card (or from the top app bar) to open the Focus Timer drawer.
   - Shows a clean radial/countdown display based on the task's estimated time (or standard 25-minute Pomodoro) with tactile start/pause/reset controls.
   - A dedicated "Stats & Streaks" modal displays completion rates, daily streaks, and hours focused.

#### Visual Identity & Theme
- **Aesthetic Direction**: Clean Material Design 3 ergonomics respecting touch targets ($\ge 44\text{px}$) and natural thumb reach.
- **Color Palette**: Fully integrates with current user-selected color themes (Purple `#6750a4`, Blue `#0061a4`, Teal `#006a60`, Green `#386a20`, Orange `#8b5000`, Rose `#984061`) and persistent dark/light mode. Snooze and urgent reminder accents maintain the established `#f08833` warm orange.
- **Typography & Formatting**: Clean unboxed metadata with bullet separators (`·`); tabular numbers for countdown timers and stats; zero ornamental clutter.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Recurrence on Completion vs Fixed Cron**
  - *Chosen Approach*: Recurrence generates the next iteration upon task completion (or manual duplicate).
  - *Why*: Prevents cluttering the user's active list with multiple future ghost duplicates if a task hasn't been completed yet.
- **Decision 2: Subtask Storage Model**
  - *Chosen Approach*: Embed subtasks array `[{ id, text, completed }]` directly inside the task object in IndexedDB.
  - *Why*: Seamless backwards compatibility with existing Google Drive sync JSON backups; zero schema migration friction.
- **Decision 3: Android Notification Action Buttons**
  - *Chosen Approach*: Pass `actions: [{ action: "complete", title: "Done" }, { action: "snooze_15", title: "Snooze 15m" }, { action: "snooze_60", title: "Snooze 1h" }]` in Service Worker `showNotification()`.
  - *Why*: Android Chrome/WebAPK natively supports notification action buttons, allowing one-tap actions straight from the shade.

---

### 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                       Lists PWA Core                        │
│                                                             │
│   ┌───────────────────┐               ┌─────────────────┐   │
│   │   Task & Tab UI   │ <-----------> │  Focus Timer &  │   │
│   │ (Subtasks, Chips) │               │  Stats Drawer   │   │
│   └─────────┬─────────┘               └────────┬────────┘   │
│             │                                  │            │
│             ▼                                  ▼            │
│   ┌─────────────────────────────────────────────────────┐   │
│   │      State Management & IndexedDB (idb-keyval)      │   │
│   │  - Tasks with recurrence, subtasks, focus logs      │   │
│   │  - Productivity streaks & daily completion history  │   │
│   └─────────────────────────┬───────────────────────────┘   │
│                             │                               │
│                             ▼                               │
│   ┌─────────────────────────────────────────────────────┐   │
│   │             Service Worker & Web Alarms             │   │
│   │  - Notification actions (Done, Snooze 15m, 1h)      │   │
│   │  - Badge: notification.png | Icon: icon-512.png     │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

#### State & Data Extensions
- `Task.recurrence`: `'none' | 'daily' | 'weekdays' | 'weekly' | 'biweekly' | 'monthly'`
- `Task.subtasks`: `Array<{ id: string, text: string, completed: boolean }>`
- `Task.timeSpentMinutes`: `number` (tracked from focus timer)
- `AppState.productivity`: `{ streakDays: number, lastCompletedDate: string, dailyCounts: Record<string, number>, totalFocusMinutes: number }`

#### Service Worker & Notification Actions
- The Service Worker `notificationclick` listener inspects `event.action`:
  - `complete`: Posts a message to open clients or updates IndexedDB to mark the task done and dismisses the notification.
  - `snooze_15`: Calculates `Date.now() + 15 * 60 * 1000` and posts a message to update the task reminder.
  - `snooze_60`: Calculates `Date.now() + 60 * 60 * 1000` and schedules next alert.

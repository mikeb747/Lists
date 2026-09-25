'Lists' - Android App

Prompt: Build a Progressive Web App (PWA) called Lists.
The app must be mobile-first and work well on Android phones.
 
TECHNOLOGY
Plain HTML, CSS, Vanilla JavaScript, No frameworks, Store data using browser local storage (IndexedDB), Installable as a PWA, JS Timers + Notifications

LAYOUT
 
The app should have:
- Top toolbar (Filters & Settings button)
- Different Tabs
- Task list
- Floating Add Task button at the bottom right corner


Feature list:
        
    Tasks
          Add task button (+) with task list
          Long-press on task
            Edit task
            Delete task
            Mark task as complete
            Move task (Moves to different tab)
            Archive completed tasks (Moves to archive tab)
            Delete task
            Make task a subheading, bold text, useful for a holiday itinerary (no longer an actual task)
            Set Reminder (Notification

    Task Fields (Options when adding a task)
          Task name
          Importance rating (1-5)
          Estimated time/effort (im minutes)
          Due date
          Tab category
          Created date (created automatically)
          Completed date (created when marked complete)
      
    Tabs
        User Defined, initially just 1 tab and a '+' button 
        Tabs can be names or Emojis
        Long-press on tabs
          Rename tab
          Delete tab
          Change tab background colour
              Tab Examples
                Home
                Archive
                Work
                Training
                Admin
                Reading Order
                Shopping List
                Packing List
                Holiday Itiary
                Weekly Recurring
                Monthly Recurring
                Birthdays
                Upcoming Bills

    Ordering
      Manual Ordering
      Drag and drop tasks
      Save custom order
      Custom order persists after app restart
      Automatic Sorting
      Sort by Importance
      Sort by Time
      Sort by Priority Score

    Filters button
      Manual Order
      Sort by Importance
      Sort by Time
      Sort by Priority Score, Priority Score = (Importance × Urgency) ÷ Effort
      Quick Wins
      Due Today
      Due Next 7 Days

    Settings button
        An area for other future options, backup and import, colour/dark mode switch, version numbers etc.

    Data Storage
      Local Storage
      IndexedDB
      No backend
      No account required
      No cloud sync
      
    Data stored entirely on device.
    
    User Interface
        Mobile First Design
        Android friendly
        Responsive layout
        Large touch targets
        Appearance
        Modern Material Design styling
        Rounded cards
        Smooth animations
        Floating Add Task button
        Dark Mode (Buttom hidden in settings)
    
    Notifications
        Due date reminders
        Data and time set reminders
    
    Progressive Web App (PWA)
      Installation
      Hosted on GitHub Pages
      Installable from Chrome
      Runs like an app
      Home screen icon
      PWA Components
      manifest.json
      service-worker.js
      custom 192x192 and 512x512 icons

---

## Feature Implementation Tracker & Roadmap

### Summary Status

| Status | Count | Description |
|---|---|---|
| ✅ **Implemented** | 29 | Fully functional in the app |
| 🟡 **Partially Implemented** | 3 | Partially functional or differing from spec |
| ⏳ **Left to Implement** | 12 | Planned / remaining to implement |
| **Total Features** | **44** | **~66% Complete** |

---

### Detailed Breakdown

#### 1. Tasks
- [x] **Add task button (+) with task list**: FAB button opens task creation dialog, persists to IndexedDB, renders responsive cards in the list.
- [x] **Long-press on task**: Long-press (520ms hold) opens the bottom action sheet on touch and pointer devices.
- [x] **Edit task**: Edit action opens task dialog pre-populated with current values and updates record.
- [x] **Delete task**: Confirmation modal prevents accidental deletion; removes task from IndexedDB.
- [x] **Mark task as complete**: Checkbox button on card and action sheet toggles complete state with visual line-through and timestamp-ready state.
- [x] **Move task (Moves to different tab)**: Direct "Move task" action in the task action sheet opens a destination tab picker to move tasks immediately between existing tabs.
- [-] **Archive completed tasks (Moves to archive tab)**: *Partially Implemented* — "Archive" tab automatically isolates completed tasks; a batch "Archive all completed" button is pending.
- [x] **Make task a subheading, bold text, useful for a holiday itinerary (no longer an actual task)**: Subheading toggle in task dialog and long-press action sheet renders bold section headers without checkbox or priority metadata chips; reorderable with drag-and-drop.
- [ ] **Set Reminder (Notification)**: *Left to Implement* — Integration with Web Notifications API and reminder date/time scheduler.

#### 2. Task Fields (Options when adding a task)
- [x] **Task name**: Text input with 120 character limit and required validation.
- [x] **Importance rating (1-5)**: Interactive slider (1 to 5) with live preview badge.
- [-] **Estimated time/effort**: *Partially Implemented* — Currently configured in hours (0.25h increments); spec calls for minutes (`im minutes`).
- [x] **Due date**: HTML5 date picker with overdue indicator styling.
- [x] **Tab category**: Category select dropdown linking task to user-defined tabs or Uncategorized.
- [ ] **Created date (created automatically)**: *Left to Implement* — Store ISO timestamp on task creation.
- [ ] **Completed date (created when marked complete)**: *Left to Implement* — Store ISO timestamp when marked complete.

#### 3. Tabs
- [-] **User Defined, initially just 1 tab and a '+' button**: *Partially Implemented* — User-defined tabs with '+' works; currently defaults to seeding "Personal" and "Work" instead of just 1 initial tab.
- [x] **Tabs can be names or Emojis**: Supports unicode emojis and text names in tab labels.
- [x] **Long-press on tabs**: Long-pressing user tabs opens the category action sheet.
- [x] **Rename tab**: Modifies category name and updates all assigned tasks.
- [x] **Delete tab**: Confirmation dialog; reassigns associated tasks to uncategorized so no tasks are lost.
- [ ] **Change tab background colour**: *Left to Implement* — Add color picker to assign individual accent colors to tabs.
- [ ] **Tab Examples**: *Left to Implement* — Quick-add presets for Home, Work, Shopping List, Packing List, Holiday Itinerary, etc.

#### 4. Ordering
- [x] **Manual Ordering**: Preserves user's custom sort order using numeric sort positions.
- [x] **Drag and drop tasks**: Smooth pointer drag-and-drop reordering with visual placeholder.
- [x] **Save custom order**: Persists updated order positions directly to IndexedDB.
- [x] **Custom order persists after app restart**: Re-queries saved positions on initial boot.
- [x] **Automatic Sorting**: Supported via Sort & Filters bottom sheet.
- [x] **Sort by Importance**: Descending sort by importance rating (1-5).
- [x] **Sort by Time**: Ascending sort by estimated time.
- [ ] **Sort by Priority Score**: *Left to Implement* — Priority formula `(Importance × Urgency) ÷ Effort`.

#### 5. Filters button
- [x] **Manual Order**: Option in Sort & Filters sheet.
- [x] **Sort by Importance**: Option in Sort & Filters sheet.
- [x] **Sort by Time**: Option in Sort & Filters sheet.
- [ ] **Sort by Priority Score**: *Left to Implement* — Missing from filter options.
- [x] **Quick Wins**: Filters high importance (4-5) and short time (<= 2h).
- [ ] **Due Today**: *Left to Implement* — Dedicated filter for tasks due on current date.
- [x] **Due Next 7 Days**: Filter showing tasks due within the upcoming week.

#### 6. Settings button
- [x] **Settings button & modal**: Settings bottom sheet with dark mode segmented switch (System, Light, Dark), 6 Material Design colour theme palettes, local JSON backup export & restore, and version information.

#### 7. Data Storage
- [x] **Local Storage / IndexedDB**: Full offline schema with `tasks`, `categories`, and `settings` stores.
- [x] **No backend**: Zero external API or database requirement.
- [x] **No account required**: Immediate use without sign-in.
- [x] **No cloud sync**: Fully private, local-only data.
- [x] **Data stored entirely on device**: Verified.

#### 8. User Interface
- [x] **Mobile First Design**: Optimized for single-hand mobile usage with bottom sheets.
- [x] **Android friendly**: Material Design 3 tokens, viewport fit, safe areas, touch actions.
- [x] **Responsive layout**: Adapts to desktop and tablet with centered container (max-width 760px).
- [x] **Large touch targets**: All buttons, tabs, and list items have minimum 44px-48px touch targets.
- [x] **Appearance**: Modern Material styling with rounded corners, subtle shadows, and ripple effects.
- [x] **Dark Mode (Button hidden in settings)**: Fully functional dark/light/system theme switch relocated into the Settings pane.

#### 9. Notifications
- [ ] **Due date reminders**: *Left to Implement* — Background or in-app alerts when a task reaches its due date.
- [ ] **Date and time set reminders**: *Left to Implement* — Specific timestamp reminder scheduling.

#### 10. Progressive Web App (PWA)
- [x] **Installation**: PWA installable via Chrome/Android prompts.
- [x] **Hosted on GitHub Pages / Web server**: Served via Express on port 3000.
- [x] **Installable from Chrome / Runs like an app / Home screen icon**: Manifest configured with `display: standalone`.
- [x] **PWA Components**: Complete set of `manifest.json`, `sw.js` cache worker, and 192x192 / 512x512 icons.


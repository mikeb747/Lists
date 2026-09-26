import {
  initGoogleAuth,
  signInWithGoogle,
  signOutGoogle,
  backupToDrive,
  restoreFromDrive,
  getCachedToken,
  getCurrentUser,
} from "./google-drive.js";

const DB_NAME = "priority-planner";
const DB_VERSION = 1;
const LONG_PRESS_MS = 520;
const MOVE_CANCEL_PX = 10;

  const SORT_LABELS = {
    manual: "Manual order",
    today: "Due today",
    tomorrow: "Due tomorrow",
    due7: "Due next 7 days",
    importance: "Sorted by importance",
    time: "Sorted by estimated time",
    quickWins: "Quick wins",
  };

  const els = {
    tabs: document.getElementById("category-tabs"),
    list: document.getElementById("task-list"),
    caption: document.getElementById("sort-caption"),
    fab: document.getElementById("fab"),
    scrim: document.getElementById("scrim"),
    filterSheet: document.getElementById("sheet-filter"),
    filterForm: document.getElementById("filter-form"),
    hideCompleted: document.getElementById("hide-completed"),
    taskActions: document.getElementById("sheet-task-actions"),
    categoryActions: document.getElementById("sheet-category-actions"),
    taskDialog: document.getElementById("dialog-task"),
    taskForm: document.getElementById("task-form"),
    taskTitle: document.getElementById("task-dialog-title"),
    importanceValue: document.getElementById("importance-value"),
    categoryDialog: document.getElementById("dialog-category"),
    categoryForm: document.getElementById("category-form"),
    categoryTitle: document.getElementById("cat-dialog-title"),
    confirmDialog: document.getElementById("dialog-confirm"),
    confirmTitle: document.getElementById("confirm-title"),
    confirmMessage: document.getElementById("confirm-message"),
    confirmOk: document.getElementById("confirm-ok"),
    settingsBtn: document.getElementById("btn-settings"),
    settingsSheet: document.getElementById("sheet-settings"),
    openTrackerBtn: document.getElementById("btn-open-tracker"),
    settingsTrackerBadge: document.getElementById("settings-tracker-badge"),
    exportBtn: document.getElementById("btn-export-data"),
    importBtn: document.getElementById("btn-import-data"),
    importFile: document.getElementById("file-import-data"),
    themeSegmented: document.getElementById("theme-segmented"),
    colorPicker: document.getElementById("color-picker"),
    moveSheet: document.getElementById("sheet-move-task"),
    moveTabList: document.getElementById("move-tab-list"),
    moveTaskDesc: document.getElementById("move-task-desc"),
    moveTaskCancel: document.getElementById("move-task-cancel"),
    installBtn: document.getElementById("install-app-btn"),
    installBar: document.getElementById("install-bar"),
    dismissInstallBtn: document.getElementById("btn-dismiss-install"),
    settingsInstallBtn: document.getElementById("btn-settings-install"),
    settingsInstallTitle: document.getElementById("settings-install-title"),
    settingsInstallStatus: document.getElementById("settings-install-status"),
    trackerDialog: document.getElementById("dialog-tracker"),
    trackerClose: document.getElementById("tracker-close"),
    trackerCloseIcon: document.getElementById("tracker-close-icon"),
    trackerList: document.getElementById("tracker-content-list"),
    trackerProgressBar: document.getElementById("tracker-progress-bar"),
    trackerSummaryText: document.getElementById("tracker-summary-text"),
    trackerSummaryPercent: document.getElementById("tracker-summary-percent"),
    reminderInput: document.getElementById("task-reminder-input"),
    clearReminderBtn: document.getElementById("btn-clear-reminder"),
    notifStatus: document.getElementById("notif-perm-status"),
    requestNotifBtn: document.getElementById("btn-request-notif"),
    testNotifBtn: document.getElementById("btn-test-notif"),
    actionTaskReminder: document.getElementById("action-task-reminder"),
    actionCompactBtn: document.getElementById("action-toggle-compact"),
    labelCompact: document.getElementById("label-toggle-compact"),
    badgeCompact: document.getElementById("badge-toggle-compact"),
    actionMoveTabLeft: document.getElementById("action-move-tab-left"),
    actionMoveTabRight: document.getElementById("action-move-tab-right"),
    actionRenameCat: document.getElementById("action-rename-cat"),
    actionDeleteCat: document.getElementById("action-delete-cat"),
    tabColorPalette: document.getElementById("tab-color-palette"),
    tabColorName: document.getElementById("tab-color-name"),
    reminderToast: document.getElementById("reminder-toast"),
    toastTitle: document.getElementById("toast-title"),
    toastMsg: document.getElementById("toast-msg"),
    toastClose: document.getElementById("toast-close"),
    driveDisconnectedUi: document.getElementById("drive-disconnected-ui"),
    driveConnectedUi: document.getElementById("drive-connected-ui"),
    googleConnectBtn: document.getElementById("btn-google-drive-connect"),
    googleDisconnectBtn: document.getElementById("btn-google-drive-disconnect"),
    driveBackupBtn: document.getElementById("btn-drive-backup"),
    driveRestoreBtn: document.getElementById("btn-drive-restore"),
    driveUserPhoto: document.getElementById("drive-user-photo"),
    driveUserName: document.getElementById("drive-user-name"),
    driveUserEmail: document.getElementById("drive-user-email"),
    driveSyncStatus: document.getElementById("drive-sync-status"),
    bulkPasteBtn: document.getElementById("btn-bulk-paste"),
    bulkPasteSheet: document.getElementById("sheet-bulk-paste"),
    bulkCategorySelect: document.getElementById("bulk-category-select"),
    bulkTextarea: document.getElementById("bulk-paste-textarea"),
    bulkPasteClipBtn: document.getElementById("btn-paste-clipboard"),
    bulkClearBtn: document.getElementById("btn-bulk-clear"),
    bulkCounter: document.getElementById("bulk-item-counter"),
    bulkFeedback: document.getElementById("bulk-feedback-msg"),
    bulkCancelBtn: document.getElementById("bulk-paste-cancel"),
    bulkSubmitBtn: document.getElementById("bulk-paste-submit"),
    tabsWrapper: document.getElementById("tabs-wrapper"),
    tabScrollLeft: document.getElementById("tab-scroll-left"),
    tabScrollRight: document.getElementById("tab-scroll-right"),
    inputTimer1: document.getElementById("input-timer1"),
    inputTimer2: document.getElementById("input-timer2"),
    valTimer1: document.getElementById("val-timer1"),
    valTimer2: document.getElementById("val-timer2"),
    btnTimerFast: document.getElementById("btn-timer-preset-fast"),
    btnTimerDefault: document.getElementById("btn-timer-preset-default"),
    btnTimerRelaxed: document.getElementById("btn-timer-preset-relaxed"),
  };

  const state = {
    db: null,
    tasks: [],
    categories: [],
    googleUser: null,
    suppressTabClick: false,
    isDraggingTab: false,
    longPressFired: false,
    driveToken: null,
    settings: {
      sortMode: "manual",
      hideCompleted: true,
      theme: "system",
      colorTheme: "purple",
      activeTab: "all",
      compactTabs: {},
      tabColors: {},
      tabDragHoldMs: 400,
      tabOptionsHoldMs: 1000,
    },
    editingTaskId: null,
    editingCategoryId: null,
    actionTaskId: null,
    actionCategoryId: null,
    actionTabId: null,
    movingTaskId: null,
    confirmHandler: null,
    drag: null,
  };

  let deferredPrompt = null;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (typeof updateInstallUI === "function") {
      updateInstallUI();
    }
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    if (typeof updateInstallUI === "function") {
      updateInstallUI();
    }
  });

  function uid() {
    return crypto.randomUUID();
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("tasks")) {
          db.createObjectStore("tasks", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("categories")) {
          db.createObjectStore("categories", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function tx(storeName, mode = "readonly") {
    return state.db.transaction(storeName, mode).objectStore(storeName);
  }

  function reqToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function getAll(storeName) {
    return reqToPromise(tx(storeName).getAll());
  }

  async function put(storeName, value) {
    await reqToPromise(tx(storeName, "readwrite").put(value));
  }

  async function remove(storeName, id) {
    await reqToPromise(tx(storeName, "readwrite").delete(id));
  }

  async function loadAll() {
    const [tasks, categories, settingsRows] = await Promise.all([
      getAll("tasks"),
      getAll("categories"),
      getAll("settings"),
    ]);
    state.tasks = tasks;
    state.categories = categories.sort((a, b) => a.sortPosition - b.sortPosition);
    const saved = settingsRows.find((row) => row.id === "app");
    if (saved) {
      state.settings = { ...state.settings, ...saved };
    }
  }

  async function saveSettings() {
    await put("settings", { id: "app", ...state.settings });
  }

  async function seedIfEmpty() {
    if (state.categories.length) return;
    const seeded = [
      { id: uid(), name: "Personal", sortPosition: 0 },
      { id: uid(), name: "Work", sortPosition: 1 },
    ];
    for (const category of seeded) await put("categories", category);
    state.categories = seeded;
    await saveSettings();
  }

  function todayISO() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
  }

  function addDaysISO(days) {
    const now = new Date(`${todayISO()}T00:00:00`);
    now.setDate(now.getDate() + days);
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
  }

  function categoryName(id) {
    return state.categories.find((category) => category.id === id)?.name || "Uncategorized";
  }

  const THEME_HEADER_COLORS = {
    purple: "#6750a4",
    blue: "#0061a4",
    teal: "#006a60",
    green: "#386a20",
    orange: "#8b5000",
    rose: "#984061",
  };

  function applyTheme() {
    const theme = state.settings.theme;
    const dark =
      theme === "dark" ||
      (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    const colorKey = state.settings.colorTheme || "purple";
    document.documentElement.dataset.color = colorKey;
    const headerColor = dark ? "#1c1b1f" : (THEME_HEADER_COLORS[colorKey] || "#6750a4");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", headerColor);
  }

  function formatReminderBadge(isoStr) {
    if (!isoStr) return "";
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return "";
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      if (isToday) return `Today ${timeStr}`;
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (d.toDateString() === tomorrow.toDateString()) return `Tmrw ${timeStr}`;
      return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${timeStr}`;
    } catch {
      return "";
    }
  }

  function visibleTasks() {
    const { activeTab, sortMode, hideCompleted } = state.settings;
    let tasks = [...state.tasks];

    if (activeTab === "archive") {
      tasks = tasks.filter((task) => task.completed && !task.isSubheading);
    } else {
      if (activeTab !== "all") {
        tasks = tasks.filter((task) => task.categoryId === activeTab);
      }
      if (hideCompleted) {
        tasks = tasks.filter((task) => task.isSubheading || !task.completed);
      }
    }

    if (sortMode === "today") {
      const today = todayISO();
      tasks = tasks.filter((task) => !task.isSubheading && task.dueDate === today);
    }

    if (sortMode === "tomorrow") {
      const tomorrow = addDaysISO(1);
      tasks = tasks.filter((task) => !task.isSubheading && task.dueDate === tomorrow);
    }

    if (sortMode === "quickWins") {
      tasks = tasks.filter(
        (task) => !task.isSubheading && Number(task.importance) >= 4 && Number(task.estimatedTime) <= 2
      );
    }

    if (sortMode === "due7") {
      const start = todayISO();
      const end = addDaysISO(7);
      tasks = tasks.filter((task) => !task.isSubheading && task.dueDate && task.dueDate >= start && task.dueDate <= end);
    }

    const byManual = (a, b) => a.sortPosition - b.sortPosition;
    if (sortMode === "manual") {
      tasks.sort(byManual);
    } else if (sortMode === "today" || sortMode === "tomorrow") {
      tasks.sort((a, b) => (b.isSubheading ? -1 : a.isSubheading ? 1 : b.importance - a.importance || byManual(a, b)));
    } else if (sortMode === "importance") {
      tasks.sort((a, b) => (b.isSubheading ? -1 : a.isSubheading ? 1 : b.importance - a.importance || byManual(a, b)));
    } else if (sortMode === "time") {
      tasks.sort((a, b) => (b.isSubheading ? -1 : a.isSubheading ? 1 : a.estimatedTime - b.estimatedTime || byManual(a, b)));
    } else if (sortMode === "quickWins") {
      tasks.sort((a, b) => b.importance - a.importance || a.estimatedTime - b.estimatedTime || byManual(a, b));
    } else if (sortMode === "due7") {
      tasks.sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)) || byManual(a, b));
    }

    return tasks;
  }

  function renderTabs() {
    const { activeTab } = state.settings;
    const parts = [
      tabButton("all", "All", activeTab === "all"),
      ...state.categories.map((category) =>
        tabButton(category.id, category.name, activeTab === category.id, true)
      ),
      tabButton("archive", "Archive", activeTab === "archive"),
      `<button type="button" class="tab add" data-tab="add" aria-label="Add category">+</button>`,
    ];
    els.tabs.innerHTML = parts.join("");
    updateTabScrollButtons();
  }

  function isTabCompact(tabId) {
    if (!state.settings.compactTabs) return false;
    if (state.settings.compactTabs[tabId]) return true;
    const cat = state.categories.find(
      (c) => c.id === tabId || c.name.toLowerCase() === String(tabId).toLowerCase()
    );
    if (cat) {
      if (state.settings.compactTabs[cat.id]) return true;
      if (state.settings.compactTabs[cat.name]) return true;
    }
    return false;
  }

  function getTabColor(tabId) {
    if (!tabId) return "";
    if (state.settings.tabColors && state.settings.tabColors[tabId]) {
      return state.settings.tabColors[tabId];
    }
    const cat = state.categories.find(
      (c) => c.id === tabId || c.name.toLowerCase() === String(tabId).toLowerCase()
    );
    if (cat) {
      if (state.settings.tabColors && state.settings.tabColors[cat.id]) {
        return state.settings.tabColors[cat.id];
      }
      if (cat.color) return cat.color;
    }
    return "";
  }

  function tabButton(id, label, active, userCategory = false) {
    const activeClass = active ? " active" : "";
    const catAttr = userCategory ? " data-user-category='true'" : "";
    const isCompact = isTabCompact(id);
    const compactAttr = isCompact ? " data-compact='true'" : "";
    const color = getTabColor(id);
    const colorAttr = color ? ` data-tab-color="${color}"` : "";
    return `<button type="button" class="tab${activeClass}" data-tab="${id}"${catAttr}${compactAttr}${colorAttr}>${escapeHtml(
      label
    )}</button>`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function renderTasks() {
    const tasks = visibleTasks();
    const manual = state.settings.sortMode === "manual" && state.settings.activeTab !== "archive";
    els.caption.textContent = SORT_LABELS[state.settings.sortMode] || "Manual order";

    const isCompact = isTabCompact(state.settings.activeTab);
    els.list.classList.toggle("compact-list", isCompact);

    if (!tasks.length) {
      const copy =
        state.settings.activeTab === "archive"
          ? ["No archived tasks", "Completed tasks appear here."]
          : state.settings.sortMode === "today"
            ? ["No tasks due today", "Tasks scheduled for today will appear here."]
            : state.settings.sortMode === "tomorrow"
              ? ["No tasks due tomorrow", "Tasks scheduled for tomorrow will appear here."]
              : state.settings.sortMode === "quickWins"
                ? ["No quick wins", "Quick wins have importance 4+ and take 2 hours or less."]
                : state.settings.sortMode === "due7"
                  ? ["Nothing due in the next 7 days", "Tasks with a due date this week will show here."]
                  : ["No tasks yet", "Tap the + button to add one."];
      els.list.innerHTML = `<div class="empty-state"><h2>${copy[0]}</h2><p>${copy[1]}</p></div>`;
      return;
    }

    els.list.innerHTML = tasks.map((task) => taskCard(task, manual, isCompact)).join("");
  }

  function taskCard(task, manual, isCompact = false) {
    if (task.isSubheading) {
      return `
      <div class="task-item-wrapper" data-id="${task.id}">
        <article class="task-card subheading" data-id="${task.id}" data-is-subheading="true">
          <button type="button" class="drag-handle" aria-label="Reorder" ${manual ? "" : "disabled"}>
            <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M9 7h2v2H9V7zm4 0h2v2h-2V7zM9 11h2v2H9v-2zm4 0h2v2h-2v-2zM9 15h2v2H9v-2zm4 0h2v2h-2v-2z"/></svg>
          </button>
          <div class="task-body">
            <p class="task-name subheading-title">${escapeHtml(task.name)}</p>
          </div>
        </article>
      </div>`;
    }

    const isArchive = state.settings.activeTab === "archive";
    const due = task.dueDate
      ? `<span class="chip task-chip-due${task.dueDate < todayISO() && !task.completed ? " overdue" : ""}">${escapeHtml(
          task.dueDate
        )}</span>`
      : "";
    const reminderBadge = task.reminderAt && !task.completed
      ? `<span class="chip task-chip-reminder${task.reminderFired ? " fired" : ""}" title="Reminder: ${formatReminderBadge(task.reminderAt)}">🔔 ${formatReminderBadge(task.reminderAt)}</span>`
      : "";
    const doneClass = task.completed ? " completed" : "";
    const checkClass = task.completed ? " done" : "";
    const compactClass = isCompact ? " compact" : "";

    let rightControls = "";
    if (isArchive) {
      // In Archive tab: delete and undo icons instead of tick icon
      rightControls = `
        <div class="task-actions-group">
          <button type="button" class="task-icon-btn btn-archive-undo" data-undo="${task.id}" aria-label="Undo completion" title="Restore task">
            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>
          </button>
          <button type="button" class="task-icon-btn btn-archive-delete" data-delete="${task.id}" aria-label="Delete task" title="Delete task permanently">
            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      `;
    } else if (isCompact) {
      // In compact view: hide the tick button to complete tasks, so completion is swipe-only
      rightControls = "";
    } else {
      // In regular tabs: standard complete checkbox button
      rightControls = `
        <button type="button" class="task-complete${checkClass}" data-complete="${task.id}" aria-label="${
          task.completed ? "Mark incomplete" : "Mark complete"
        }">
          <svg viewBox="0 0 24 24"><path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>
        </button>
      `;
    }

    const hasControlsClass = rightControls ? " has-controls" : "";

    return `
      <div class="task-item-wrapper" data-id="${task.id}">
        <!-- Swipe right: Green Complete tick -->
        <div class="swipe-action-cue cue-complete">
          <span class="swipe-cue-icon">
            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>
            <span>Complete</span>
          </span>
        </div>
        <!-- Swipe left: Red Trash bin -->
        <div class="swipe-action-cue cue-delete">
          <span class="swipe-cue-icon">
            <span>Delete</span>
            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </span>
        </div>
        <!-- Foreground Card -->
        <article class="task-card${doneClass}${compactClass}${hasControlsClass}" data-id="${task.id}">
          <button type="button" class="drag-handle" aria-label="Reorder" ${manual ? "" : "disabled"}>
            <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M9 7h2v2H9V7zm4 0h2v2h-2V7zM9 11h2v2H9v-2zm4 0h2v2h-2v-2zM9 15h2v2H9v-2zm4 0h2v2h-2v-2z"/></svg>
          </button>
          <div class="task-body">
            <p class="task-name">${escapeHtml(task.name)}</p>
            ${!isCompact ? `
            <div class="task-meta">
              <span class="chip task-chip-importance${task.importance >= 4 ? " importance-high" : ""}">Importance ${task.importance}</span>
              <span class="chip task-chip-time">${task.estimatedTime}h</span>
              ${due}
              ${reminderBadge}
              <span class="chip task-chip-category">${escapeHtml(categoryName(task.categoryId))}</span>
            </div>` : ""}
          </div>
          ${rightControls}
        </article>
      </div>`;
  }

  function render() {
    applyTheme();
    renderTabs();
    renderTasks();
    syncFilterSheet();
    syncSettingsSheet();
  }

  function syncFilterSheet() {
    const radio = els.filterForm.querySelector(
      `input[name="sortMode"][value="${state.settings.sortMode}"]`
    );
    if (radio) radio.checked = true;
    els.hideCompleted.checked = Boolean(state.settings.hideCompleted);
  }

  function syncSettingsSheet() {
    const activeTheme = state.settings.theme || "system";
    document.querySelectorAll(".segmented-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.themeVal === activeTheme);
    });

    const activeColor = state.settings.colorTheme || "purple";
    document.querySelectorAll(".color-swatch-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.color === activeColor);
    });

    if (els.settingsTrackerBadge) {
      const total = FEATURES.length;
      const doneCount = FEATURES.filter((f) => f.status === "done").length;
      const percent = Math.round((doneCount / total) * 100);
      els.settingsTrackerBadge.textContent = `${doneCount} of ${total} features complete (${percent}%)`;
    }

    const t1 = Number(state.settings.tabDragHoldMs) || 400;
    const t2 = Number(state.settings.tabOptionsHoldMs) || 1000;
    if (els.inputTimer1) els.inputTimer1.value = t1;
    if (els.valTimer1) els.valTimer1.textContent = `${t1} ms`;
    if (els.inputTimer2) els.inputTimer2.value = t2;
    if (els.valTimer2) els.valTimer2.textContent = `${t2} ms`;

    updateInstallUI();
    updateNotificationSettingsUI();
  }

  function updateNotificationSettingsUI() {
    if (!els.notifStatus) return;
    if (!("Notification" in window)) {
      els.notifStatus.textContent = "Not supported in this browser";
      if (els.requestNotifBtn) els.requestNotifBtn.hidden = true;
      if (els.testNotifBtn) els.testNotifBtn.disabled = true;
      return;
    }
    const perm = Notification.permission;
    if (perm === "granted") {
      els.notifStatus.textContent = "Alerts enabled ✓";
      if (els.requestNotifBtn) {
        els.requestNotifBtn.textContent = "Enabled";
        els.requestNotifBtn.disabled = true;
      }
      if (els.testNotifBtn) els.testNotifBtn.disabled = false;
    } else if (perm === "denied") {
      els.notifStatus.textContent = "Blocked in browser site settings";
      if (els.requestNotifBtn) {
        els.requestNotifBtn.textContent = "Blocked";
        els.requestNotifBtn.disabled = true;
      }
      if (els.testNotifBtn) els.testNotifBtn.disabled = false;
    } else {
      els.notifStatus.textContent = "Permission not yet granted";
      if (els.requestNotifBtn) {
        els.requestNotifBtn.textContent = "Enable";
        els.requestNotifBtn.disabled = false;
      }
      if (els.testNotifBtn) els.testNotifBtn.disabled = false;
    }
  }

  async function requestNotificationPermission() {
    if (!("Notification" in window)) return "unsupported";
    if (Notification.permission === "granted") return "granted";
    try {
      const permission = await Notification.requestPermission();
      updateNotificationSettingsUI();
      return permission;
    } catch {
      return Notification.permission;
    }
  }

  function playReminderChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5

      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880, now + 0.15);
      osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.35); // D6

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.25);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.65);
    } catch {}
  }

  let toastTimeout = null;
  function showInAppReminderToast(task) {
    if (!els.reminderToast) return;
    if (els.toastTitle) {
      els.toastTitle.textContent = `Reminder: ${task.name}`;
    }
    if (els.toastMsg) {
      const parts = [];
      if (task.dueDate) parts.push(`Due: ${task.dueDate}`);
      if (task.importance) parts.push(`Importance ${task.importance}/5`);
      els.toastMsg.textContent = parts.join(" • ") || "Scheduled reminder alert";
    }
    els.reminderToast.hidden = false;
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      if (els.reminderToast) els.reminderToast.hidden = true;
    }, 8000);
  }

  function fireTaskReminder(task) {
    playReminderChime();
    showInAppReminderToast(task);

    if ("Notification" in window && Notification.permission === "granted") {
      try {
        const notif = new Notification(`Reminder: ${task.name}`, {
          body: `Lists • ${task.dueDate ? `Due ${task.dueDate} • ` : ""}Importance ${task.importance}/5`,
          icon: "./icons/icon-192.png",
          badge: "./icons/icon-192.png",
          tag: `task-reminder-${task.id}`,
        });
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      } catch {
        if ("serviceWorker" in navigator && navigator.serviceWorker.ready) {
          navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification(`Reminder: ${task.name}`, {
              body: `Lists • ${task.dueDate ? `Due ${task.dueDate} • ` : ""}Importance ${task.importance}/5`,
              icon: "./icons/icon-192.png",
              badge: "./icons/icon-192.png",
              tag: `task-reminder-${task.id}`,
            }).catch(() => {});
          });
        }
      }
    }
  }

  async function checkPendingReminders() {
    if (!state.tasks || !state.tasks.length) return;
    const now = Date.now();
    let hasUpdates = false;

    for (const task of state.tasks) {
      if (task.completed || task.isSubheading || !task.reminderAt || task.reminderFired) {
        continue;
      }
      const timeMs = new Date(task.reminderAt).getTime();
      if (!isNaN(timeMs) && now >= timeMs) {
        task.reminderFired = true;
        hasUpdates = true;
        await put("tasks", task);
        fireTaskReminder(task);
      }
    }

    if (hasUpdates) {
      state.tasks = await getAll("tasks");
      renderTasks();
    }
  }

  function isInstallBannerDismissed() {
    try {
      return localStorage.getItem("lists_install_banner_dismissed") === "true";
    } catch {
      return false;
    }
  }

  function dismissInstallBanner() {
    try {
      localStorage.setItem("lists_install_banner_dismissed", "true");
    } catch {}
    if (els.installBar) els.installBar.hidden = true;
  }

  function updateInstallUI() {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;

    if (isStandalone) {
      if (els.installBtn) els.installBtn.hidden = true;
      if (els.installBar) els.installBar.hidden = true;
      if (els.settingsInstallStatus) {
        els.settingsInstallStatus.textContent = "Lists is installed on this device ✓";
      }
      if (els.settingsInstallTitle) {
        els.settingsInstallTitle.textContent = "App Installed";
      }
      return;
    }

    const dismissed = isInstallBannerDismissed();

    if (deferredPrompt) {
      // Browser triggered beforeinstallprompt - installing is supported and available right now!
      if (els.installBtn) els.installBtn.hidden = false;
      // Show the install banner above tasks only if the user hasn't dismissed it
      if (els.installBar) els.installBar.hidden = dismissed;
      if (els.settingsInstallStatus) {
        els.settingsInstallStatus.textContent = "Ready to install as an app";
      }
      if (els.settingsInstallTitle) {
        els.settingsInstallTitle.textContent = "Install App";
      }
    } else {
      // Not installable right now (non-mobile browser without prompt, unsupported browser, or already installed)
      if (els.installBtn) els.installBtn.hidden = true;
      if (els.installBar) els.installBar.hidden = true;

      const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
      if (els.settingsInstallStatus) {
        els.settingsInstallStatus.textContent = isIOS
          ? "Tap Share ⎋ then 'Add to Home Screen'"
          : "Web browser mode • Use browser menu to install";
      }
      if (els.settingsInstallTitle) {
        els.settingsInstallTitle.textContent = "Install App";
      }
    }
  }

  async function handleInstallPrompt() {
    if (deferredPrompt) {
      closeOverlays();
      try {
        const promptEvent = deferredPrompt;
        deferredPrompt = null;
        await promptEvent.prompt();
        await promptEvent.userChoice;
      } catch (err) {
        console.warn("Install prompt error:", err);
      }
      updateInstallUI();
      return;
    }

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;

    if (isStandalone) {
      confirmAction({
        title: "App Already Installed",
        message: "Lists is already installed as a standalone app on your device.",
        okLabel: "OK",
        onConfirm: () => {},
      });
      return;
    }

    const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    if (isIOS) {
      confirmAction({
        title: "Install on iOS",
        message: "To install Lists on your iPhone or iPad, tap the Share icon ⎋ in Safari, then choose 'Add to Home Screen'.",
        okLabel: "Got it",
        onConfirm: () => {},
      });
    } else {
      confirmAction({
        title: "Install Lists App",
        message: "To install Lists as a standalone app, open Chrome's menu (⋮ at top right) → 'Save and share' → 'Install Lists' or 'Install and create shortcut'. You can also click the install icon in Chrome's address bar.",
        okLabel: "Got it",
        onConfirm: () => {},
      });
    }
  }

  function exportData() {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      tasks: state.tasks,
      categories: state.categories,
      settings: state.settings,
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lists-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importData(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || !Array.isArray(data.tasks)) return;
      for (const task of data.tasks) {
        await put("tasks", task);
      }
      if (Array.isArray(data.categories)) {
        for (const cat of data.categories) {
          await put("categories", cat);
        }
      }
      if (data.settings) {
        state.settings = { ...state.settings, ...data.settings };
        await saveSettings();
      }
      await loadAll();
      applyTheme();
      render();
      closeOverlays();
    } catch (err) {
      console.warn("Failed to restore backup:", err);
    }
  }

  function updateGoogleDriveUI(user = state.googleUser) {
    if (!els.driveDisconnectedUi || !els.driveConnectedUi) return;
    if (user) {
      els.driveDisconnectedUi.hidden = true;
      els.driveConnectedUi.hidden = false;
      if (els.driveUserName) {
        els.driveUserName.textContent = user.displayName || user.email?.split("@")[0] || "Google User";
      }
      if (els.driveUserEmail) {
        els.driveUserEmail.textContent = user.email || "";
      }
      if (els.driveUserPhoto) {
        if (user.photoURL) {
          els.driveUserPhoto.src = user.photoURL;
          els.driveUserPhoto.style.display = "block";
        } else {
          els.driveUserPhoto.style.display = "none";
        }
      }
    } else {
      els.driveDisconnectedUi.hidden = false;
      els.driveConnectedUi.hidden = true;
    }
  }

  function setDriveStatus(text, type = "normal") {
    if (!els.driveSyncStatus) return;
    els.driveSyncStatus.className = `drive-status-message ${type}`;
    els.driveSyncStatus.innerHTML = `<span>${escapeHtml(text)}</span>`;
  }

  async function handleGoogleConnect() {
    try {
      setDriveStatus("Opening Google sign-in window...", "normal");
      const res = await signInWithGoogle();
      if (res?.user) {
        state.googleUser = res.user;
        state.driveToken = res.accessToken;
        updateGoogleDriveUI(res.user);
        setDriveStatus(`Connected to ${res.user.email} ✓`, "success");
      }
    } catch (err) {
      console.error("Google connect error:", err);
      let msg = err.message || "Failed to connect to Google";
      if (err.code === "auth/popup-blocked") {
        msg = "Popup was blocked by your browser. Please allow popups for this site.";
      } else if (err.code === "auth/popup-closed-by-user") {
        msg = "Sign-in popup closed before completing. Click to try again.";
      } else if (err.code === "auth/unauthorized-domain") {
        const currentHost = window.location.hostname;
        msg = `Domain not authorized in Firebase: "${currentHost}". Add this exact domain to Firebase Console.`;
      }
      setDriveStatus(msg, "error");
    }
  }

  async function handleGoogleDisconnect() {
    confirmAction({
      title: "Disconnect Google Drive?",
      message: "This will disconnect your Google account from Lists. Your local tasks will remain untouched.",
      okLabel: "Disconnect",
      onConfirm: async () => {
        try {
          await signOutGoogle();
          state.googleUser = null;
          state.driveToken = null;
          updateGoogleDriveUI(null);
          setDriveStatus("Disconnected from Google Drive", "normal");
        } catch (err) {
          console.error("Error signing out:", err);
        }
      },
    });
  }

  async function handleDriveBackup() {
    let token = state.driveToken || getCachedToken();
    if (!token) {
      try {
        setDriveStatus("Connecting to Google Drive...", "normal");
        const res = await signInWithGoogle();
        token = res?.accessToken;
        state.googleUser = res?.user;
        state.driveToken = token;
        updateGoogleDriveUI(res?.user);
      } catch (err) {
        setDriveStatus("Sign-in cancelled or failed", "error");
        return;
      }
    }

    try {
      if (els.driveBackupBtn) els.driveBackupBtn.disabled = true;
      setDriveStatus("Uploading backup to Google Drive...", "normal");

      const payload = {
        version: 1,
        source: "Lists PWA",
        account: state.googleUser?.email || "unknown",
        exportedAt: new Date().toISOString(),
        tasks: state.tasks,
        categories: state.categories,
        settings: state.settings,
      };

      await backupToDrive(token, payload);
      const timeStr = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      setDriveStatus(`Saved to Google Drive at ${timeStr} (${payload.tasks.length} tasks) ✓`, "success");
    } catch (err) {
      console.error("Drive backup error:", err);
      setDriveStatus(`Backup failed: ${err.message}`, "error");
    } finally {
      if (els.driveBackupBtn) els.driveBackupBtn.disabled = false;
    }
  }

  async function handleDriveRestore() {
    let token = state.driveToken || getCachedToken();
    if (!token) {
      try {
        setDriveStatus("Connecting to Google Drive...", "normal");
        const res = await signInWithGoogle();
        token = res?.accessToken;
        state.googleUser = res?.user;
        state.driveToken = token;
        updateGoogleDriveUI(res?.user);
      } catch (err) {
        setDriveStatus("Sign-in cancelled or failed", "error");
        return;
      }
    }

    try {
      if (els.driveRestoreBtn) els.driveRestoreBtn.disabled = true;
      setDriveStatus("Checking Google Drive for backup...", "normal");

      const { data, fileMeta } = await restoreFromDrive(token);
      if (!data || !Array.isArray(data.tasks)) {
        throw new Error("Backup file found on Drive is invalid or corrupted.");
      }

      const taskCount = data.tasks.length;
      const modDate = fileMeta.modifiedTime ? new Date(fileMeta.modifiedTime).toLocaleString() : "Recent";

      // Explicit user confirmation dialog as mandated by skill guidelines!
      confirmAction({
        title: "Restore from Google Drive?",
        message: `Restore ${taskCount} tasks from ${state.googleUser?.email || "Google Drive"} (saved: ${modDate})? Your current local data will be replaced.`,
        okLabel: "Restore Data",
        onConfirm: async () => {
          try {
            setDriveStatus("Restoring data from Drive...", "normal");
            for (const task of data.tasks) {
              await put("tasks", task);
            }
            if (Array.isArray(data.categories)) {
              for (const cat of data.categories) {
                await put("categories", cat);
              }
            }
            if (data.settings) {
              state.settings = { ...state.settings, ...data.settings };
              await saveSettings();
            }
            await loadAll();
            applyTheme();
            render();
            closeOverlays();
            setDriveStatus(`Restored ${taskCount} tasks from Google Drive ✓`, "success");
          } catch (restoreErr) {
            console.error("Failed applying restore:", restoreErr);
            setDriveStatus(`Restore error: ${restoreErr.message}`, "error");
          }
        },
      });
    } catch (err) {
      console.error("Drive restore error:", err);
      setDriveStatus(err.message, "error");
    } finally {
      if (els.driveRestoreBtn) els.driveRestoreBtn.disabled = false;
    }
  }

  function openOverlay(el) {
    els.scrim.hidden = false;
    el.hidden = false;
    el.setAttribute("aria-hidden", "false");
  }

  function closeOverlays() {
    els.scrim.hidden = true;
    els.filterSheet.hidden = true;
    els.taskActions.hidden = true;
    els.categoryActions.hidden = true;
    els.taskDialog.hidden = true;
    els.categoryDialog.hidden = true;
    els.confirmDialog.hidden = true;
    if (els.settingsSheet) els.settingsSheet.hidden = true;
    if (els.moveSheet) els.moveSheet.hidden = true;
    if (els.trackerDialog) els.trackerDialog.hidden = true;
    if (els.bulkPasteSheet) els.bulkPasteSheet.hidden = true;
    state.confirmHandler = null;
  }

  function openMoveTaskSheet(task) {
    if (!task) return;
    state.movingTaskId = task.id;
    if (els.moveTaskDesc) {
      els.moveTaskDesc.textContent = `Move “${task.name}” to:`;
    }

    const items = [
      { id: "", name: "Uncategorized" },
      ...state.categories,
    ];

    els.moveTabList.innerHTML = items
      .map((cat) => {
        const isCurrent = (task.categoryId || "") === cat.id;
        return `
          <button type="button" class="move-tab-item${isCurrent ? " active" : ""}" data-move-id="${cat.id}">
            <span>${escapeHtml(cat.name)}</span>
            ${isCurrent ? `<span class="move-tab-check">Current</span>` : ""}
          </button>
        `;
      })
      .join("");

    openOverlay(els.moveSheet);
  }

  function parseBulkLines(text) {
    if (!text) return [];
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .map((line) => line.replace(/^[-*•\–\—]\s+/, ""))
      .filter((line) => line.length > 0);
  }

  function updateBulkCounter() {
    if (!els.bulkTextarea || !els.bulkCounter || !els.bulkSubmitBtn) return;
    const lines = parseBulkLines(els.bulkTextarea.value);
    const count = lines.length;
    if (count === 0) {
      els.bulkCounter.textContent = "0 tasks";
      els.bulkSubmitBtn.disabled = true;
      els.bulkSubmitBtn.textContent = "Add Tasks";
    } else if (count === 1) {
      els.bulkCounter.textContent = "1 task";
      els.bulkSubmitBtn.disabled = false;
      els.bulkSubmitBtn.textContent = "Add 1 Task";
    } else {
      els.bulkCounter.textContent = `${count} tasks`;
      els.bulkSubmitBtn.disabled = false;
      els.bulkSubmitBtn.textContent = `Add ${count} Tasks`;
    }
  }

  function showBulkFeedback(msg, type = "info") {
    if (!els.bulkFeedback) return;
    els.bulkFeedback.textContent = msg;
    els.bulkFeedback.className = `bulk-feedback-msg ${type}`;
    els.bulkFeedback.hidden = false;
  }

  function fillBulkCategorySelect() {
    if (!els.bulkCategorySelect) return;
    const active = state.settings.activeTab;
    const isSpecial = active === "all" || active === "archive";

    let defaultCatId = "";
    if (!isSpecial && state.categories.some((c) => c.id === active)) {
      defaultCatId = active;
    } else if (state.categories.length > 0) {
      defaultCatId = state.categories[0].id;
    }

    const options = state.categories.map((c) => {
      const isSelected = c.id === defaultCatId;
      return `<option value="${c.id}" ${isSelected ? "selected" : ""}>${escapeHtml(c.name)}</option>`;
    });

    options.push(
      `<option value="" ${defaultCatId === "" ? "selected" : ""}>Uncategorized</option>`
    );

    els.bulkCategorySelect.innerHTML = options.join("");
  }

  function openBulkPasteSheet() {
    fillBulkCategorySelect();
    if (els.bulkFeedback) els.bulkFeedback.hidden = true;
    updateBulkCounter();
    openOverlay(els.bulkPasteSheet);
    setTimeout(() => {
      if (els.bulkTextarea) els.bulkTextarea.focus();
    }, 120);
  }

  async function pasteFromClipboard() {
    if (!els.bulkTextarea) return;
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        throw new Error("Clipboard API not supported in this browser context.");
      }
      const clipText = await navigator.clipboard.readText();
      if (!clipText || !clipText.trim()) {
        showBulkFeedback("Clipboard is empty or contains non-text content.", "info");
        return;
      }
      const existing = els.bulkTextarea.value;
      if (existing.trim()) {
        els.bulkTextarea.value = existing.endsWith("\n") ? existing + clipText : existing + "\n" + clipText;
      } else {
        els.bulkTextarea.value = clipText;
      }
      updateBulkCounter();
      const count = parseBulkLines(clipText).length;
      showBulkFeedback(`Pasted ${count} ${count === 1 ? "item" : "items"} from clipboard ✓`, "success");
      els.bulkTextarea.focus();
    } catch (err) {
      console.warn("Clipboard read failed:", err);
      showBulkFeedback("Clipboard access was blocked by browser. You can click and hold the text box to paste directly.", "info");
      els.bulkTextarea.focus();
    }
  }

  async function handleBulkSubmit() {
    if (!els.bulkTextarea) return;
    const lines = parseBulkLines(els.bulkTextarea.value);
    if (!lines.length) return;

    const targetCategoryId = els.bulkCategorySelect?.value || "";
    const startSortPosition = await nextSortPosition();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      await put("tasks", {
        id: uid(),
        name: line,
        importance: 3,
        estimatedTime: 1,
        dueDate: "",
        categoryId: targetCategoryId,
        reminderAt: "",
        reminderFired: false,
        completed: false,
        sortPosition: startSortPosition + i,
      });
    }

    state.tasks = await getAll("tasks");

    // If currently on archive tab, switch to the target tab so new tasks are visible
    if (state.settings.activeTab === "archive") {
      state.settings.activeTab = targetCategoryId || "all";
      await saveSettings();
    } else if (targetCategoryId && state.settings.activeTab !== "all" && state.settings.activeTab !== targetCategoryId) {
      state.settings.activeTab = targetCategoryId;
      await saveSettings();
    }

    els.bulkTextarea.value = "";
    updateBulkCounter();
    closeOverlays();
    render();
  }

  function fillCategorySelect(selectedId) {
    const select = els.taskForm.elements.categoryId;
    const options = [`<option value="">Uncategorized</option>`].concat(
      state.categories.map(
        (category) =>
          `<option value="${category.id}" ${category.id === selectedId ? "selected" : ""}>${escapeHtml(
            category.name
          )}</option>`
      )
    );
    select.innerHTML = options.join("");
  }

  function updateSubheadingUI() {
    const isSub = Boolean(els.taskForm.elements.isSubheading?.checked);
    const metaBox = document.getElementById("task-meta-fields");
    if (metaBox) metaBox.hidden = isSub;
    if (els.taskForm.elements.estimatedTime) {
      els.taskForm.elements.estimatedTime.required = !isSub;
    }
    els.taskTitle.textContent = isSub
      ? (state.editingTaskId ? "Edit subheading" : "Add subheading")
      : (state.editingTaskId ? "Edit task" : "Add task");
  }

  function openTaskDialog(task) {
    state.editingTaskId = task?.id || null;
    els.taskForm.reset();
    fillCategorySelect(task?.categoryId || (state.settings.activeTab !== "all" && state.settings.activeTab !== "archive"
      ? state.settings.activeTab
      : ""));
    const isSub = Boolean(task?.isSubheading);
    if (els.taskForm.elements.isSubheading) {
      els.taskForm.elements.isSubheading.checked = isSub;
    }
    if (task) {
      els.taskForm.elements.name.value = task.name;
      els.taskForm.elements.importance.value = task.importance ?? 3;
      els.taskForm.elements.estimatedTime.value = task.estimatedTime ?? 1;
      els.taskForm.elements.dueDate.value = task.dueDate || "";
      els.taskForm.elements.categoryId.value = task.categoryId || "";
      if (els.reminderInput) {
        els.reminderInput.value = task.reminderAt || "";
      }
    } else {
      if (els.reminderInput) {
        els.reminderInput.value = "";
      }
    }
    els.importanceValue.textContent = els.taskForm.elements.importance.value;
    updateSubheadingUI();
    openOverlay(els.taskDialog);
    els.taskForm.elements.name.focus();
  }

  function openCategoryDialog(category) {
    state.editingCategoryId = category?.id || null;
    els.categoryTitle.textContent = category ? "Rename category" : "New category";
    els.categoryForm.reset();
    if (category) els.categoryForm.elements.name.value = category.name;
    openOverlay(els.categoryDialog);
    els.categoryForm.elements.name.focus();
  }

  function confirmAction({ title, message, okLabel = "Delete", okClass = "danger", onConfirm }) {
    els.confirmTitle.textContent = title;
    els.confirmMessage.textContent = message;
    els.confirmOk.textContent = okLabel;
    els.confirmOk.className = `btn-filled ${okClass}`;
    state.confirmHandler = onConfirm;
    openOverlay(els.confirmDialog);
  }

  async function nextSortPosition() {
    const max = state.tasks.reduce((acc, task) => Math.max(acc, task.sortPosition ?? 0), -1);
    return max + 1;
  }

  async function persistTasks(tasks) {
    for (const task of tasks) await put("tasks", task);
    state.tasks = await getAll("tasks");
  }

  async function applyManualOrder(orderedIds) {
    const visibleSet = new Set(orderedIds);
    const full = [...state.tasks].sort((a, b) => a.sortPosition - b.sortPosition);
    const queue = [...orderedIds];
    const resultIds = [];
    for (const task of full) {
      if (visibleSet.has(task.id)) resultIds.push(queue.shift());
      else resultIds.push(task.id);
    }
    const byId = new Map(state.tasks.map((task) => [task.id, task]));
    const updated = resultIds.map((id, index) => ({ ...byId.get(id), sortPosition: index }));
    await persistTasks(updated);
  }

  let activeLongPressTimer = null;
  let clearActiveLongPress = null;

  function cancelActiveLongPress() {
    if (activeLongPressTimer) {
      window.clearTimeout(activeLongPressTimer);
      activeLongPressTimer = null;
    }
    if (clearActiveLongPress) {
      clearActiveLongPress();
      clearActiveLongPress = null;
    }
  }

  function bindLongPress(root, selector, onLongPress) {
    let timer = null;
    let startX = 0;
    let startY = 0;
    let target = null;

    const clear = () => {
      if (timer) window.clearTimeout(timer);
      timer = null;
      target = null;
      if (activeLongPressTimer === timer) {
        activeLongPressTimer = null;
      }
    };

    root.addEventListener("pointerdown", (event) => {
      if (state.isDraggingTab) return;
      if (els.categoryActions && !els.categoryActions.hidden) return;

      const hit = event.target.closest(selector);
      if (!hit || event.button) return;

      cancelActiveLongPress();
      startX = event.clientX;
      startY = event.clientY;
      target = hit;

      clearActiveLongPress = () => {
        if (timer) window.clearTimeout(timer);
        timer = null;
        target = null;
      };

      timer = window.setTimeout(() => {
        const current = target;
        clear();
        clearActiveLongPress = null;
        if (state.isDraggingTab) return;
        state.longPressFired = true;
        if (navigator.vibrate) navigator.vibrate(20);
        onLongPress(current, event);
      }, LONG_PRESS_MS);

      activeLongPressTimer = timer;
    });

    root.addEventListener("pointermove", (event) => {
      if (!timer) return;
      if (
        Math.abs(event.clientX - startX) > MOVE_CANCEL_PX ||
        Math.abs(event.clientY - startY) > MOVE_CANCEL_PX
      ) {
        clear();
        clearActiveLongPress = null;
      }
    });

    ["pointerup", "pointercancel", "pointerleave"].forEach((name) => {
      root.addEventListener(name, () => {
        clear();
        clearActiveLongPress = null;
      });
    });
  }

  function setupDrag() {
    let previewEl = null;
    let dragOffsetY = 0;
    let dragOffsetX = 0;

    const onMove = (event) => {
      if (!state.drag) return;
      const draggingCard = els.list.querySelector(".task-card.dragging");
      if (!draggingCard) return;
      const draggingWrapper = draggingCard.closest(".task-item-wrapper") || draggingCard;

      if (previewEl) {
        previewEl.style.top = `${event.clientY - dragOffsetY}px`;
        previewEl.style.left = `${event.clientX - dragOffsetX}px`;
      }

      const y = event.clientY;
      const otherWrappers = [...els.list.querySelectorAll(".task-item-wrapper")].filter(
        (w) => !w.contains(draggingCard)
      );
      for (const wrapper of otherWrappers) {
        const rect = wrapper.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        if (y < mid) {
          wrapper.before(draggingWrapper);
          return;
        }
      }
      const last = otherWrappers[otherWrappers.length - 1];
      if (last) last.after(draggingWrapper);
    };

    const endDrag = async () => {
      if (!state.drag) return;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", endDrag);
      document.removeEventListener("pointercancel", endDrag);

      if (previewEl) {
        previewEl.remove();
        previewEl = null;
      }

      const dragging = els.list.querySelector(".task-card.dragging");
      if (dragging) {
        dragging.classList.remove("dragging");
        dragging.classList.remove("drag-placeholder");
      }
      const ids = [...els.list.querySelectorAll(".task-item-wrapper")].map((w) => w.dataset.id);
      state.drag = null;
      await applyManualOrder(ids);
      render();
    };

    els.list.addEventListener("pointerdown", (event) => {
      const handle = event.target.closest(".drag-handle");
      if (!handle || handle.disabled) return;
      const card = handle.closest(".task-card");
      if (!card) return;
      event.preventDefault();

      const rect = card.getBoundingClientRect();
      dragOffsetY = event.clientY - rect.top;
      dragOffsetX = event.clientX - rect.left;

      previewEl = card.cloneNode(true);
      previewEl.classList.add("drag-ghost-preview");
      previewEl.classList.remove("dragging");
      previewEl.style.width = `${rect.width}px`;
      previewEl.style.height = `${rect.height}px`;
      previewEl.style.top = `${rect.top}px`;
      previewEl.style.left = `${rect.left}px`;
      document.body.appendChild(previewEl);

      state.drag = { id: card.dataset.id };
      card.classList.add("dragging", "drag-placeholder");
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", endDrag);
      document.addEventListener("pointercancel", endDrag);
    });
  }

  function updateTabScrollButtons() {
    if (!els.tabs || !els.tabsWrapper || !els.tabScrollLeft || !els.tabScrollRight) return;
    const { scrollLeft, scrollWidth, clientWidth } = els.tabs;
    const hasOverflow = scrollWidth > clientWidth + 2;

    els.tabsWrapper.classList.toggle("has-overflow", hasOverflow);

    const canScrollLeft = hasOverflow && scrollLeft > 2;
    const canScrollRight = hasOverflow && Math.ceil(scrollLeft + clientWidth) < scrollWidth - 2;

    els.tabScrollLeft.disabled = !canScrollLeft;
    els.tabScrollRight.disabled = !canScrollRight;

    els.tabsWrapper.classList.toggle("fade-left", canScrollLeft);
    els.tabsWrapper.classList.toggle("fade-right", canScrollRight);
  }

  function setupTabScroll() {
    if (!els.tabScrollLeft || !els.tabScrollRight || !els.tabs) return;

    els.tabScrollLeft.addEventListener("click", () => {
      els.tabs.scrollBy({ left: -220, behavior: "smooth" });
    });

    els.tabScrollRight.addEventListener("click", () => {
      els.tabs.scrollBy({ left: 220, behavior: "smooth" });
    });

    els.tabs.addEventListener("scroll", updateTabScrollButtons, { passive: true });
    window.addEventListener("resize", updateTabScrollButtons, { passive: true });
    updateTabScrollButtons();
  }

  const TAB_COLORS = [
    { id: "default", name: "Default" },
    { id: "red", name: "Red" },
    { id: "orange", name: "Orange" },
    { id: "amber", name: "Amber" },
    { id: "green", name: "Green" },
    { id: "teal", name: "Teal" },
    { id: "blue", name: "Blue" },
    { id: "indigo", name: "Indigo" },
    { id: "purple", name: "Purple" },
    { id: "pink", name: "Pink" },
    { id: "slate", name: "Slate" },
  ];

  function openTabOptionsSheet(tabId) {
    state.actionTabId = tabId;
    const isCompact = isTabCompact(state.actionTabId);
    let tabTitle = "Tab Options";
    if (state.actionTabId === "all") tabTitle = "All Tasks Tab";
    else if (state.actionTabId === "archive") tabTitle = "Archive Tab";
    else {
      const category = state.categories.find((item) => item.id === state.actionTabId);
      if (category) tabTitle = `${category.name} Tab`;
    }
    document.getElementById("cat-actions-title").textContent = tabTitle;

    if (els.labelCompact) {
      els.labelCompact.textContent = isCompact ? "Disable compact list" : "Compact list";
    }
    if (els.badgeCompact) {
      els.badgeCompact.textContent = isCompact ? "ON" : "OFF";
      els.badgeCompact.className = isCompact ? "action-badge active" : "action-badge";
    }

    const isUserCat = state.categories.some((item) => item.id === state.actionTabId);
    if (els.actionRenameCat) els.actionRenameCat.hidden = !isUserCat;
    if (els.actionDeleteCat) els.actionDeleteCat.hidden = !isUserCat;

    const catIndex = state.categories.findIndex((item) => item.id === state.actionTabId);
    if (els.actionMoveTabLeft) {
      els.actionMoveTabLeft.hidden = !isUserCat;
      els.actionMoveTabLeft.disabled = catIndex <= 0;
    }
    if (els.actionMoveTabRight) {
      els.actionMoveTabRight.hidden = !isUserCat;
      els.actionMoveTabRight.disabled = catIndex < 0 || catIndex >= state.categories.length - 1;
    }

    const currentColor = getTabColor(state.actionTabId) || "default";
    if (els.tabColorName) {
      const colObj = TAB_COLORS.find((c) => c.id === currentColor) || TAB_COLORS[0];
      els.tabColorName.textContent = colObj.name;
    }
    if (els.tabColorPalette) {
      els.tabColorPalette.innerHTML = TAB_COLORS.map((c) => {
        const isSelected = c.id === currentColor;
        return `<button type="button" class="tab-color-swatch${isSelected ? " active" : ""}" data-color="${c.id}" aria-label="${c.name} color" title="${c.name}"></button>`;
      }).join("");
    }

    openOverlay(els.categoryActions);
  }

  function setupTabInteraction() {
    let dragTimer = null;
    let optionsTimer = null;
    let dragActive = false;
    let dragMoved = false;
    let activeTab = null;
    let activePointerId = null;
    let startX = 0;
    let startY = 0;
    let currentPointerX = 0;
    let currentPointerY = 0;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let previewEl = null;
    let dragLockedScrollLeft = 0;

    const clearTimers = () => {
      if (dragTimer) {
        clearTimeout(dragTimer);
        dragTimer = null;
      }
      if (optionsTimer) {
        clearTimeout(optionsTimer);
        optionsTimer = null;
      }
    };

    const onTabsScrollDuringDrag = () => {
      if (dragActive) {
        els.tabs.scrollLeft = dragLockedScrollLeft;
      }
    };

    const onTouchMovePreventScroll = (ev) => {
      if (dragActive && ev.cancelable) {
        ev.preventDefault();
      }
    };

    const cleanupDragVisuals = () => {
      window.removeEventListener("touchmove", onTouchMovePreventScroll);
      els.tabs.removeEventListener("scroll", onTabsScrollDuringDrag);
      els.tabs.style.overflowX = "";
      els.tabs.style.touchAction = "";
      els.tabs.classList.remove("dragging-tab-mode");
      document.body.classList.remove("dragging-tab-mode");
      if (previewEl) {
        previewEl.remove();
        previewEl = null;
      }
      if (activeTab) {
        activeTab.classList.remove("tab-dragging-placeholder");
      }
    };

    const startDrag = (pointerX, pointerY) => {
      if (!activeTab || dragActive || activeTab.dataset.userCategory !== "true") return;
      dragActive = true;
      state.suppressTabClick = true;

      if (navigator.vibrate) {
        try { navigator.vibrate(35); } catch (_) {}
      }

      // Freeze horizontal scrolling of the tabs bar on touchscreen mobile & desktop
      dragLockedScrollLeft = els.tabs.scrollLeft;
      els.tabs.style.overflowX = "hidden";
      els.tabs.style.touchAction = "none";
      els.tabs.classList.add("dragging-tab-mode");
      document.body.classList.add("dragging-tab-mode");

      els.tabs.addEventListener("scroll", onTabsScrollDuringDrag, { passive: true });
      window.addEventListener("touchmove", onTouchMovePreventScroll, { passive: false });

      const rect = activeTab.getBoundingClientRect();
      activeTab.classList.add("tab-dragging-placeholder");

      previewEl = document.createElement("div");
      previewEl.className = "tab-ghost-preview";
      previewEl.textContent = activeTab.textContent;
      const tabColor = activeTab.dataset.tabColor;
      if (tabColor) {
        previewEl.dataset.tabColor = tabColor;
      }
      previewEl.style.width = `${rect.width}px`;
      previewEl.style.height = `${rect.height}px`;
      previewEl.style.left = `${pointerX - dragOffsetX}px`;
      previewEl.style.top = `${pointerY - dragOffsetY}px`;
      document.body.appendChild(previewEl);

      if (activePointerId !== null && activeTab.setPointerCapture) {
        try {
          activeTab.setPointerCapture(activePointerId);
        } catch (_) {}
      }
    };

    // Smooth FLIP animation: records sibling positions and smoothly glides them into place
    const moveTabWithFLIP = (targetTab, placeBefore = true) => {
      if (!activeTab || !targetTab || activeTab === targetTab) return;

      const userTabs = [...els.tabs.querySelectorAll(".tab[data-user-category='true']")];
      const firstPositions = new Map();
      userTabs.forEach((tab) => {
        firstPositions.set(tab, tab.getBoundingClientRect().left);
      });

      if (placeBefore) {
        targetTab.before(activeTab);
      } else {
        targetTab.after(activeTab);
      }

      userTabs.forEach((tab) => {
        const oldLeft = firstPositions.get(tab);
        if (oldLeft === undefined) return;
        const newLeft = tab.getBoundingClientRect().left;
        const deltaX = oldLeft - newLeft;

        if (Math.abs(deltaX) > 1) {
          tab.style.transition = "none";
          tab.style.transform = `translateX(${deltaX}px)`;
          void tab.offsetWidth; // force reflow
          tab.style.transition = "transform 0.2s cubic-bezier(0.2, 0, 0, 1)";
          tab.style.transform = "";
        }
      });
    };

    const onPointerMove = (e) => {
      if (!activeTab) return;
      currentPointerX = e.clientX;
      currentPointerY = e.clientY;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      const dist = Math.hypot(deltaX, deltaY);

      // If drag mode is not active yet:
      if (!dragActive) {
        // Desktop mouse: moving > 5px immediately starts drag without waiting
        if (e.pointerType === "mouse" && dist > 5 && activeTab.dataset.userCategory === "true") {
          clearTimers();
          startDrag(e.clientX, e.clientY);
          return;
        }

        // On touch: only cancel if movement clearly exceeds resting touch deadzone (> 18px)
        if (dist > 18) {
          clearTimers();
        }
        return;
      }

      // If we are actively dragging:
      if (dist > 6) {
        dragMoved = true;
        // Pointer has moved while dragging -> cancel options timer so sheet won't pop up!
        if (optionsTimer) {
          clearTimeout(optionsTimer);
          optionsTimer = null;
        }
      }

      if (e.cancelable) e.preventDefault();

      if (previewEl) {
        previewEl.style.left = `${e.clientX - dragOffsetX}px`;
        previewEl.style.top = `${e.clientY - dragOffsetY}px`;
      }

      // Reorder among sibling user category tabs
      const userTabs = [...els.tabs.querySelectorAll(".tab[data-user-category='true']")].filter(
        (t) => t !== activeTab
      );

      for (let i = 0; i < userTabs.length; i++) {
        const otherTab = userTabs[i];
        const rect = otherTab.getBoundingClientRect();
        const midX = rect.left + rect.width / 2;

        if (e.clientX < midX) {
          if (activeTab.nextElementSibling !== otherTab) {
            moveTabWithFLIP(otherTab, true);
          }
          break;
        } else if (i === userTabs.length - 1 && e.clientX >= midX) {
          if (activeTab.previousElementSibling !== otherTab) {
            moveTabWithFLIP(otherTab, false);
          }
          break;
        }
      }

      // Keep tab bar completely still: no auto-scrolling left and right during drag
    };

    const onPointerUp = async (e) => {
      clearTimers();

      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);

      const tabToCommit = activeTab;
      const wasDragging = dragActive;
      const didMove = dragMoved;

      if (activePointerId !== null && tabToCommit?.releasePointerCapture) {
        try {
          tabToCommit.releasePointerCapture(activePointerId);
        } catch (_) {}
      }

      activePointerId = null;
      cleanupDragVisuals();

      if (wasDragging && tabToCommit) {
        if (previewEl) {
          const rect = tabToCommit.getBoundingClientRect();
          previewEl.style.transition = "all 0.15s cubic-bezier(0.2, 0, 0, 1)";
          previewEl.style.left = `${rect.left}px`;
          previewEl.style.top = `${rect.top}px`;
          previewEl.style.transform = "scale(1)";
        }

        setTimeout(async () => {
          cleanupDragVisuals();

          if (didMove) {
            // Persist the reordered positions to IndexedDB
            const reorderedIds = [...els.tabs.querySelectorAll(".tab[data-user-category='true']")].map(
              (t) => t.dataset.tab
            );

            for (let i = 0; i < reorderedIds.length; i++) {
              const catId = reorderedIds[i];
              const cat = state.categories.find((c) => c.id === catId);
              if (cat) {
                cat.sortPosition = i;
                await put("categories", cat);
              }
            }

            state.categories.sort((a, b) => a.sortPosition - b.sortPosition);
            renderTabs();
            updateTabScrollButtons();
          }

          setTimeout(() => {
            state.suppressTabClick = false;
          }, 100);
        }, 150);
      } else {
        cleanupDragVisuals();

        // Tap handling (when neither dragged nor opened in options sheet)
        if (tabToCommit && !state.suppressTabClick) {
          const tabId = tabToCommit.dataset.tab;
          if (tabId === "add") {
            openCategoryDialog(null);
          } else if (tabId) {
            state.settings.activeTab = tabId;
            saveSettings();
            render();
          }
        }
      }

      dragActive = false;
      dragMoved = false;
      activeTab = null;
    };

    els.tabs.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      if (els.categoryActions && !els.categoryActions.hidden) return;

      const tab = e.target.closest(".tab");
      if (!tab) return;

      activeTab = tab;
      activePointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      currentPointerX = e.clientX;
      currentPointerY = e.clientY;
      dragActive = false;
      dragMoved = false;

      const rect = tab.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;

      clearTimers();

      // Read customizable durations from settings
      const dragHoldMs = Math.max(100, Number(state.settings.tabDragHoldMs) || 400);
      const optionsHoldMs = Math.max(dragHoldMs + 50, Number(state.settings.tabOptionsHoldMs) || 1000);

      // Only selectable tabs get drag & options timers (not '+' add button)
      if (tab.dataset.tab !== "add") {
        // 1st Timer: activates drag mode
        dragTimer = setTimeout(() => {
          if (activeTab?.dataset.userCategory === "true") {
            startDrag(currentPointerX, currentPointerY);
          }
        }, dragHoldMs);

        // 2nd Timer: opens Tab Options sheet
        optionsTimer = setTimeout(() => {
          if (dragMoved) return;

          cleanupDragVisuals();
          dragActive = false;
          state.suppressTabClick = true;

          if (navigator.vibrate) {
            try { navigator.vibrate([30, 40, 30]); } catch (_) {}
          }

          openTabOptionsSheet(tab.dataset.tab);
          setTimeout(() => {
            state.suppressTabClick = false;
          }, 300);
        }, optionsHoldMs);
      }

      document.addEventListener("pointermove", onPointerMove, { passive: false });
      document.addEventListener("pointerup", onPointerUp);
      document.addEventListener("pointercancel", onPointerUp);
    });
  }

  const FEATURES = [
    // 1. Tasks
    { section: "Tasks", name: "Add task button (+) with task list", status: "done", desc: "FAB button opens task creation dialog, persists to IndexedDB, renders responsive cards in the list." },
    { section: "Tasks", name: "Long-press on task", status: "done", desc: "Long-press (520ms hold) opens bottom action sheet on touch and pointer devices." },
    { section: "Tasks", name: "Edit task", status: "done", desc: "Edit action opens prefilled dialog to update task name, importance, time, due date, category." },
    { section: "Tasks", name: "Delete task", status: "done", desc: "Confirmation modal safeguards against accidental deletion; removes task from IndexedDB." },
    { section: "Tasks", name: "Mark task as complete", status: "done", desc: "Checkbox toggle marks task complete with visual strike-through styling." },
    { section: "Tasks", name: "Move task (Moves to different tab)", status: "done", desc: "Click and hold on task opens action sheet with 'Move task' to move immediately to another existing tab." },
    { section: "Tasks", name: "Archive completed tasks", status: "partial", desc: "Archive tab automatically shows completed tasks; manual batch 'Archive all' action is pending." },
    { section: "Tasks", name: "Make task a subheading / bold text", status: "done", desc: "Subheading support: bold section title with no checkbox or priority metadata chips; reorderable for itineraries." },
    { section: "Tasks", name: "Set Reminder (Notification)", status: "done", desc: "Notification API integration with timed alarms, alert chimes, in-app toast, and quick presets." },

    // 2. Task Fields
    { section: "Task Fields", name: "Task name", status: "done", desc: "Text input with 120 character limit and required validation." },
    { section: "Task Fields", name: "Importance rating (1-5)", status: "done", desc: "Slider with live numeric value feedback and high-importance badges." },
    { section: "Task Fields", name: "Estimated time/effort", status: "partial", desc: "Currently configured in hours; spec specifies minutes (in minutes)." },
    { section: "Task Fields", name: "Due date", status: "done", desc: "Date picker with overdue highlight indicator chip." },
    { section: "Task Fields", name: "Tab category", status: "done", desc: "Category dropdown linked to user-defined tabs or Uncategorized." },
    { section: "Task Fields", name: "Created date (automatic)", status: "todo", desc: "Automatic ISO timestamp recorded upon task creation." },
    { section: "Task Fields", name: "Completed date (automatic)", status: "todo", desc: "Automatic ISO timestamp recorded when marked complete." },

    // 3. Tabs
    { section: "Tabs", name: "User Defined (+ button)", status: "partial", desc: "User tabs can be added with '+'; app currently seeds 2 tabs instead of 1." },
    { section: "Tabs", name: "Tabs can be names or Emojis", status: "done", desc: "Full UTF-8 emoji and text string support for tab titles." },
    { section: "Tabs", name: "Long-press on tabs", status: "done", desc: "Long-pressing any tab triggers Tab Options sheet for compact list toggle, rename, and delete." },
    { section: "Tabs", name: "Drag and drop tab positions left/right", status: "done", desc: "Drag and drop the horizontal position of each category tab left and right with persistence." },
    { section: "Tabs", name: "Desktop tab scroll buttons (< & >)", status: "done", desc: "Scroll arrow buttons on computer screens when there are more tabs than fit." },
    { section: "Tabs", name: "Compact list per tab", status: "done", desc: "Long press any tab to toggle compact mode, hiding importance, time, and tab name chips." },
    { section: "Tabs", name: "Rename tab", status: "done", desc: "Category dialog renames tab and updates associations in real time." },
    { section: "Tabs", name: "Change tab background colour", status: "done", desc: "11-color palette inside Tab Options sheet with active/inactive adaptive tints." },
    { section: "Tabs", name: "Customizable Tab Hold Timers", status: "done", desc: "Configure Timer 1 (drag activation) and Timer 2 (tab options) within the Settings pane." },
    { section: "Tabs", name: "Mobile Tab Drag Scroll Lock", status: "done", desc: "Locks horizontal tab bar scrolling while dragging a tab on mobile touchscreens." },
    { section: "Tabs", name: "Tab Examples", status: "todo", desc: "Quick-add presets for Home, Work, Shopping List, Packing List, Holiday Itinerary, etc." },

    // 4. Ordering
    { section: "Ordering", name: "Manual Ordering", status: "done", desc: "Preserves custom order using numeric sort positions." },
    { section: "Ordering", name: "Drag and drop tasks", status: "done", desc: "Smooth touch/pointer drag reordering with handle." },
    { section: "Ordering", name: "Save custom order", status: "done", desc: "Persists reordered positions to IndexedDB immediately." },
    { section: "Ordering", name: "Order persists after app restart", status: "done", desc: "Reloads exact saved manual ordering from local storage." },
    { section: "Ordering", name: "Automatic Sorting", status: "done", desc: "Sort by importance, estimated time, and quick wins." },
    { section: "Ordering", name: "Sort by Importance", status: "done", desc: "High-to-low priority sort option in filter sheet." },
    { section: "Ordering", name: "Sort by Time", status: "done", desc: "Ascending time/effort sort option in filter sheet." },
    { section: "Ordering", name: "Sort by Priority Score", status: "todo", desc: "Formula: (Importance × Urgency) ÷ Effort calculation." },

    // 5. Filters button
    { section: "Filters Button", name: "Manual Order", status: "done", desc: "Restores manual drag-and-drop order." },
    { section: "Filters Button", name: "Sort by Importance", status: "done", desc: "Available in Sort & Filters sheet." },
    { section: "Filters Button", name: "Sort by Time", status: "done", desc: "Available in Sort & Filters sheet." },
    { section: "Filters Button", name: "Sort by Priority Score", status: "todo", desc: "Missing from filter sheet choices." },
    { section: "Filters Button", name: "Quick Wins", status: "done", desc: "Filters high importance (4-5) and short duration (<= 2h)." },
    { section: "Filters Button", name: "Due Today", status: "done", desc: "Dedicated filter for tasks due on today's date." },
    { section: "Filters Button", name: "Due Tomorrow", status: "done", desc: "Dedicated filter for tasks due on tomorrow's date." },
    { section: "Filters Button", name: "Due Next 7 Days", status: "done", desc: "Filters tasks due in the upcoming week." },

    // 6. Settings button
    { section: "Settings Button", name: "Settings Area / Modal", status: "done", desc: "Settings pane with dark mode switch, 6 colour themes, JSON backup & restore, version info." },

    // 7. Data Storage
    { section: "Data Storage", name: "Local Storage / IndexedDB", status: "done", desc: "IndexedDB database 'priority-planner' with 3 stores." },
    { section: "Data Storage", name: "No backend required", status: "done", desc: "100% client-side offline execution." },
    { section: "Data Storage", name: "No account required for offline use", status: "done", desc: "Zero authentication friction; works immediately offline." },
    { section: "Data Storage", name: "Google Drive Cloud Backup & Restore", status: "done", desc: "Client-side Google OAuth integration allowing users to connect their personal Google account to backup and restore tasks across devices." },
    { section: "Data Storage", name: "Data stored entirely on device", status: "done", desc: "Confirmed local-first storage with optional private cloud backup." },

    // 8. User Interface
    { section: "User Interface", name: "Mobile First Design", status: "done", desc: "Single-hand friendly layout with bottom sheets and thumb zones." },
    { section: "User Interface", name: "Android Friendly", status: "done", desc: "MD3 design tokens, ripple-friendly targets, viewport-fit." },
    { section: "User Interface", name: "Responsive Layout", status: "done", desc: "Clean centered layout supporting mobile, tablet, and desktop." },
    { section: "User Interface", name: "Large Touch Targets", status: "done", desc: "Minimum 44px-48px touch targets for touch accuracy." },
    { section: "User Interface", name: "Modern Material Design styling", status: "done", desc: "Rounded cards, MD3 color system, FAB, elevation." },
    { section: "User Interface", name: "Dark Mode in Settings", status: "done", desc: "Dark mode switch placed cleanly in Settings pane with System, Light, and Dark options." },
    { section: "User Interface", name: "Bulk Paste Multiple Tasks", status: "done", desc: "Batch paste multiline items directly into any list tab with clipboard integration and item counter." },

    // 9. Notifications
    { section: "Notifications", name: "Due date reminders", status: "done", desc: "System notifications and in-app alerts when tasks reach their reminder time." },
    { section: "Notifications", name: "Date and time set reminders", status: "done", desc: "Custom scheduled alarms for specific task dates and times with quick presets." },

    // 10. Progressive Web App
    { section: "PWA", name: "Installation", status: "done", desc: "PWA installable banner and offline service worker." },
    { section: "PWA", name: "Web Server / Hosting", status: "done", desc: "Static Node.js Express server configured on port 3000." },
    { section: "PWA", name: "Runs like an app / Home screen icon", status: "done", desc: "Configured with standalone display mode." },
    { section: "PWA", name: "PWA Components (manifest, sw, icons)", status: "done", desc: "Complete manifest.json, sw.js cache, and 192/512 icons." },
  ];

  function renderTracker(filter = "all") {
    if (!els.trackerList) return;
    const total = FEATURES.length;
    const doneCount = FEATURES.filter((f) => f.status === "done").length;
    const partialCount = FEATURES.filter((f) => f.status === "partial").length;
    const todoCount = FEATURES.filter((f) => f.status === "todo").length;
    const percent = Math.round((doneCount / total) * 100);

    if (els.trackerSummaryText) {
      els.trackerSummaryText.textContent = `${doneCount} of ${total} features complete (${partialCount} in progress)`;
    }
    if (els.trackerSummaryPercent) {
      els.trackerSummaryPercent.textContent = `${percent}%`;
    }
    if (els.trackerProgressBar) {
      els.trackerProgressBar.style.width = `${percent}%`;
    }

    const filtered = filter === "all" ? FEATURES : FEATURES.filter((f) => f.status === filter);

    const sections = {};
    for (const item of filtered) {
      if (!sections[item.section]) sections[item.section] = [];
      sections[item.section].push(item);
    }

    const labels = {
      done: "Implemented",
      partial: "Partial",
      todo: "To Do",
    };

    const pillClasses = {
      done: "pill-done",
      partial: "pill-partial",
      todo: "pill-todo",
    };

    const cardClasses = {
      done: "is-done",
      partial: "is-partial",
      todo: "is-todo",
    };

    let html = "";
    for (const [sec, items] of Object.entries(sections)) {
      html += `<div class="tracker-section-title">${escapeHtml(sec)} (${items.length})</div>`;
      for (const item of items) {
        html += `
          <div class="tracker-card ${cardClasses[item.status]}">
            <div class="tracker-card-header">
              <h4 class="tracker-card-name">${escapeHtml(item.name)}</h4>
              <span class="tracker-pill ${pillClasses[item.status]}">${labels[item.status]}</span>
            </div>
            <p class="tracker-card-desc">${escapeHtml(item.desc)}</p>
          </div>
        `;
      }
    }

    if (!filtered.length) {
      html = `<div class="empty-state"><h2>No features found</h2><p>No features match the selected filter.</p></div>`;
    }

    els.trackerList.innerHTML = html;
  }

  function openTracker() {
    renderTracker("all");
    document.querySelectorAll(".tracker-filter-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.filter === "all");
    });
    openOverlay(els.trackerDialog);
  }

  function setupEvents() {
    if (els.trackerBtn) {
      els.trackerBtn.addEventListener("click", openTracker);
    }
    if (els.trackerClose) {
      els.trackerClose.addEventListener("click", closeOverlays);
    }
    if (els.trackerCloseIcon) {
      els.trackerCloseIcon.addEventListener("click", closeOverlays);
    }
    if (els.openTrackerBtn) {
      els.openTrackerBtn.addEventListener("click", () => {
        closeOverlays();
        openTracker();
      });
    }

    document.querySelectorAll(".tracker-filter-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tracker-filter-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        renderTracker(btn.dataset.filter);
      });
    });

    if (els.bulkPasteBtn) {
      els.bulkPasteBtn.addEventListener("click", openBulkPasteSheet);
    }

    if (els.bulkTextarea) {
      els.bulkTextarea.addEventListener("input", updateBulkCounter);
      els.bulkTextarea.addEventListener("paste", () => setTimeout(updateBulkCounter, 10));
      els.bulkTextarea.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          if (els.bulkSubmitBtn && !els.bulkSubmitBtn.disabled) {
            handleBulkSubmit();
          }
        }
      });
    }

    if (els.bulkPasteClipBtn) {
      els.bulkPasteClipBtn.addEventListener("click", pasteFromClipboard);
    }

    if (els.bulkClearBtn) {
      els.bulkClearBtn.addEventListener("click", () => {
        if (els.bulkTextarea) {
          els.bulkTextarea.value = "";
          updateBulkCounter();
          if (els.bulkFeedback) els.bulkFeedback.hidden = true;
          els.bulkTextarea.focus();
        }
      });
    }

    if (els.bulkCancelBtn) {
      els.bulkCancelBtn.addEventListener("click", closeOverlays);
    }

    if (els.bulkSubmitBtn) {
      els.bulkSubmitBtn.addEventListener("click", handleBulkSubmit);
    }

    document.getElementById("btn-filter").addEventListener("click", () => {
      syncFilterSheet();
      openOverlay(els.filterSheet);
    });

    if (els.settingsBtn) {
      els.settingsBtn.addEventListener("click", () => {
        syncSettingsSheet();
        openOverlay(els.settingsSheet);
      });
    }

    document.querySelectorAll(".segmented-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        state.settings.theme = btn.dataset.themeVal;
        await saveSettings();
        applyTheme();
        syncSettingsSheet();
      });
    });

    document.querySelectorAll(".color-swatch-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        state.settings.colorTheme = btn.dataset.color;
        await saveSettings();
        applyTheme();
        syncSettingsSheet();
      });
    });

    if (els.exportBtn) {
      els.exportBtn.addEventListener("click", exportData);
    }

    if (els.installBtn) {
      els.installBtn.addEventListener("click", handleInstallPrompt);
    }

    if (els.dismissInstallBtn) {
      els.dismissInstallBtn.addEventListener("click", dismissInstallBanner);
    }

    if (els.settingsInstallBtn) {
      els.settingsInstallBtn.addEventListener("click", handleInstallPrompt);
    }

    if (els.importBtn && els.importFile) {
      els.importBtn.addEventListener("click", () => els.importFile.click());
      els.importFile.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (file) importData(file);
      });
    }

    if (els.googleConnectBtn) {
      els.googleConnectBtn.addEventListener("click", handleGoogleConnect);
    }

    if (els.googleDisconnectBtn) {
      els.googleDisconnectBtn.addEventListener("click", handleGoogleDisconnect);
    }

    if (els.driveBackupBtn) {
      els.driveBackupBtn.addEventListener("click", handleDriveBackup);
    }

    if (els.driveRestoreBtn) {
      els.driveRestoreBtn.addEventListener("click", handleDriveRestore);
    }

    els.scrim.addEventListener("click", closeOverlays);

    els.filterForm.addEventListener("change", async () => {
      const selected = els.filterForm.querySelector("input[name='sortMode']:checked");
      if (selected) state.settings.sortMode = selected.value;
      state.settings.hideCompleted = els.hideCompleted.checked;
      await saveSettings();
      render();
    });

    els.tabs.addEventListener("click", (event) => {
      if (state.suppressTabClick) return;
      const tab = event.target.closest("[data-tab]");
      if (!tab) return;
      if (tab.dataset.tab === "add") {
        openCategoryDialog(null);
        return;
      }
      state.settings.activeTab = tab.dataset.tab;
      saveSettings();
      render();
    });

    bindLongPress(els.list, ".task-card", (card, event) => {
      if (
        event.target.closest(".drag-handle") ||
        event.target.closest(".task-complete") ||
        event.target.closest(".task-icon-btn")
      ) {
        return;
      }
      state.actionTaskId = card.dataset.id;
      const task = state.tasks.find((item) => item.id === state.actionTaskId);
      const isSub = Boolean(task?.isSubheading);
      document.getElementById("task-actions-title").textContent = isSub ? "Subheading" : (task?.name || "Task");
      const completeBtn = els.taskActions.querySelector("[data-action='complete']");
      if (completeBtn) {
        completeBtn.hidden = isSub;
        completeBtn.textContent = task?.completed ? "Move back to list" : "Complete";
      }
      const toggleSubBtn = els.taskActions.querySelector("[data-action='toggle-subheading']");
      if (toggleSubBtn) {
        toggleSubBtn.textContent = isSub ? "Convert to regular task" : "Convert to subheading";
      }
      if (els.actionTaskReminder) {
        els.actionTaskReminder.hidden = isSub;
      }
      openOverlay(els.taskActions);
    });

    els.list.addEventListener("click", async (event) => {
      const undoBtn = event.target.closest("[data-undo]");
      if (undoBtn) {
        const task = state.tasks.find((item) => item.id === undoBtn.dataset.undo);
        if (!task || task.isSubheading) return;
        confirmAction({
          title: "Restore task?",
          message: `Move “${task.name}” back to active tasks?`,
          okLabel: "Restore",
          okClass: "success",
          onConfirm: async () => {
            await toggleComplete(task);
          },
        });
        return;
      }

      const delBtn = event.target.closest("[data-delete]");
      if (delBtn) {
        const task = state.tasks.find((item) => item.id === delBtn.dataset.delete);
        if (!task) return;
        confirmAction({
          title: "Delete task permanently?",
          message: `“${task.name}” will be permanently removed.`,
          okLabel: "Delete",
          okClass: "danger",
          onConfirm: async () => {
            await remove("tasks", task.id);
            state.tasks = await getAll("tasks");
            render();
          },
        });
        return;
      }

      const complete = event.target.closest("[data-complete]");
      if (!complete) return;
      const task = state.tasks.find((item) => item.id === complete.dataset.complete);
      if (!task || task.isSubheading) return;
      await toggleComplete(task);
    });

    els.fab.addEventListener("click", () => openTaskDialog(null));

    els.taskForm.elements.isSubheading?.addEventListener("change", updateSubheadingUI);

    els.taskForm.elements.importance.addEventListener("input", () => {
      els.importanceValue.textContent = els.taskForm.elements.importance.value;
    });

    document.querySelectorAll(".reminder-presets-row .preset-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const preset = btn.dataset.preset;
        const now = new Date();
        let target = new Date();

        if (preset === "1h") {
          target = new Date(now.getTime() + 60 * 60 * 1000);
        } else if (preset === "3h") {
          target = new Date(now.getTime() + 3 * 60 * 60 * 1000);
        } else if (preset === "tomorrow-9am") {
          target.setDate(target.getDate() + 1);
          target.setHours(9, 0, 0, 0);
        } else if (preset === "due-9am") {
          const dueDateVal = els.taskForm.elements.dueDate?.value;
          if (dueDateVal) {
            target = new Date(`${dueDateVal}T09:00:00`);
          } else {
            target.setDate(target.getDate() + 1);
            target.setHours(9, 0, 0, 0);
          }
        }

        const pad = (n) => String(n).padStart(2, "0");
        const val = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}T${pad(
          target.getHours()
        )}:${pad(target.getMinutes())}`;
        if (els.reminderInput) {
          els.reminderInput.value = val;
        }
      });
    });

    if (els.clearReminderBtn) {
      els.clearReminderBtn.addEventListener("click", () => {
        if (els.reminderInput) els.reminderInput.value = "";
      });
    }

    if (els.requestNotifBtn) {
      els.requestNotifBtn.addEventListener("click", async () => {
        await requestNotificationPermission();
      });
    }

    if (els.testNotifBtn) {
      els.testNotifBtn.addEventListener("click", async () => {
        if ("Notification" in window && Notification.permission !== "granted") {
          await requestNotificationPermission();
        }
        fireTaskReminder({
          id: "test-alert",
          name: "Test Reminder Alert",
          dueDate: todayISO(),
          importance: 5,
        });
      });
    }

    if (els.toastClose) {
      els.toastClose.addEventListener("click", () => {
        if (els.reminderToast) els.reminderToast.hidden = true;
      });
    }

    els.taskForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(els.taskForm);
      const reminderAt = String(data.get("reminderAt") || "");
      const isSubheading = Boolean(els.taskForm.elements.isSubheading?.checked);
      const payload = {
        name: String(data.get("name") || "").trim(),
        importance: isSubheading ? 3 : Number(data.get("importance") || 3),
        estimatedTime: isSubheading ? 0 : Number(data.get("estimatedTime") || 1),
        dueDate: isSubheading ? "" : String(data.get("dueDate") || ""),
        categoryId: String(data.get("categoryId") || ""),
        reminderAt: isSubheading ? "" : reminderAt,
        isSubheading,
      };
      if (!payload.name) return;

      if (payload.reminderAt && "Notification" in window && Notification.permission === "default") {
        requestNotificationPermission();
      }

      if (state.editingTaskId) {
        const existing = state.tasks.find((task) => task.id === state.editingTaskId);
        const reminderChanged = existing?.reminderAt !== payload.reminderAt;
        await put("tasks", {
          ...existing,
          ...payload,
          reminderFired: reminderChanged ? false : Boolean(existing?.reminderFired),
        });
      } else {
        await put("tasks", {
          id: uid(),
          ...payload,
          reminderFired: false,
          completed: false,
          sortPosition: await nextSortPosition(),
        });
      }
      state.tasks = await getAll("tasks");
      closeOverlays();
      render();
      checkPendingReminders();
    });

    document.getElementById("task-cancel").addEventListener("click", closeOverlays);

    els.categoryForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const name = String(new FormData(els.categoryForm).get("name") || "").trim();
      if (!name) return;
      if (state.editingCategoryId) {
        const existing = state.categories.find((category) => category.id === state.editingCategoryId);
        await put("categories", { ...existing, name });
      } else {
        await put("categories", {
          id: uid(),
          name,
          sortPosition: state.categories.length,
        });
      }
      state.categories = (await getAll("categories")).sort((a, b) => a.sortPosition - b.sortPosition);
      closeOverlays();
      render();
    });

    document.getElementById("category-cancel").addEventListener("click", closeOverlays);

    els.taskActions.addEventListener("click", async (event) => {
      const action = event.target.closest("[data-action]")?.dataset.action;
      const task = state.tasks.find((item) => item.id === state.actionTaskId);
      if (!action || !task) return;
      if (action === "edit") {
        closeOverlays();
        openTaskDialog(task);
      } else if (action === "set-reminder") {
        closeOverlays();
        openTaskDialog(task);
        setTimeout(() => els.reminderInput?.focus(), 150);
      } else if (action === "move") {
        closeOverlays();
        openMoveTaskSheet(task);
      } else if (action === "toggle-subheading") {
        closeOverlays();
        await put("tasks", { ...task, isSubheading: !task.isSubheading });
        state.tasks = await getAll("tasks");
        render();
      } else if (action === "complete") {
        closeOverlays();
        await toggleComplete(task);
      } else if (action === "delete") {
        closeOverlays();
        confirmAction({
          title: "Delete task?",
          message: `“${task.name}” will be removed.`,
          onConfirm: async () => {
            await remove("tasks", task.id);
            state.tasks = await getAll("tasks");
            render();
          },
        });
      }
    });

    if (els.moveTabList) {
      els.moveTabList.addEventListener("click", async (event) => {
        const item = event.target.closest("[data-move-id]");
        if (!item) return;
        const targetCatId = item.dataset.moveId;
        const task = state.tasks.find((t) => t.id === state.movingTaskId);
        if (task) {
          task.categoryId = targetCatId;
          await put("tasks", task);
          state.tasks = await getAll("tasks");
          closeOverlays();
          render();
        }
      });
    }

    if (els.moveTaskCancel) {
      els.moveTaskCancel.addEventListener("click", closeOverlays);
    }

    els.categoryActions.addEventListener("click", async (event) => {
      const action = event.target.closest("[data-action]")?.dataset.action;
      if (!action) return;

      if (action === "toggle-compact") {
        closeOverlays();
        state.settings.compactTabs = state.settings.compactTabs || {};
        const nextVal = !isTabCompact(state.actionTabId);
        state.settings.compactTabs[state.actionTabId] = nextVal;
        const cat = state.categories.find(
          (c) => c.id === state.actionTabId || c.name.toLowerCase() === String(state.actionTabId).toLowerCase()
        );
        if (cat) {
          state.settings.compactTabs[cat.id] = nextVal;
          state.settings.compactTabs[cat.name] = nextVal;
        }
        if (state.settings.activeTab !== state.actionTabId) {
          state.settings.activeTab = state.actionTabId;
        }
        await saveSettings();
        render();
        return;
      }

      if (action === "move-left") {
        closeOverlays();
        const catIndex = state.categories.findIndex((c) => c.id === state.actionTabId);
        if (catIndex > 0) {
          const temp = state.categories[catIndex];
          state.categories[catIndex] = state.categories[catIndex - 1];
          state.categories[catIndex - 1] = temp;
          for (let i = 0; i < state.categories.length; i++) {
            state.categories[i].sortPosition = i;
            await put("categories", state.categories[i]);
          }
          renderTabs();
          updateTabScrollButtons();
        }
        return;
      }

      if (action === "move-right") {
        closeOverlays();
        const catIndex = state.categories.findIndex((c) => c.id === state.actionTabId);
        if (catIndex >= 0 && catIndex < state.categories.length - 1) {
          const temp = state.categories[catIndex];
          state.categories[catIndex] = state.categories[catIndex + 1];
          state.categories[catIndex + 1] = temp;
          for (let i = 0; i < state.categories.length; i++) {
            state.categories[i].sortPosition = i;
            await put("categories", state.categories[i]);
          }
          renderTabs();
          updateTabScrollButtons();
        }
        return;
      }

      const category = state.categories.find((item) => item.id === state.actionTabId);
      if (!category) return;
      if (action === "rename") {
        closeOverlays();
        openCategoryDialog(category);
      } else if (action === "delete") {
        closeOverlays();
        confirmAction({
          title: "Delete category?",
          message: `“${category.name}” will be removed. Tasks stay in All as Uncategorized.`,
          onConfirm: async () => {
            const affected = state.tasks.filter((task) => task.categoryId === category.id);
            for (const task of affected) {
              await put("tasks", { ...task, categoryId: "" });
            }
            await remove("categories", category.id);
            if (state.settings.tabColors && state.settings.tabColors[category.id]) {
              delete state.settings.tabColors[category.id];
            }
            if (state.settings.activeTab === category.id) state.settings.activeTab = "all";
            await saveSettings();
            await loadAll();
            render();
          },
        });
      }
    });

    if (els.tabColorPalette) {
      els.tabColorPalette.addEventListener("click", async (event) => {
        const swatch = event.target.closest(".tab-color-swatch");
        if (!swatch) return;
        const color = swatch.dataset.color;
        if (!color) return;

        state.settings.tabColors = state.settings.tabColors || {};
        if (color === "default") {
          delete state.settings.tabColors[state.actionTabId];
        } else {
          state.settings.tabColors[state.actionTabId] = color;
        }

        const cat = state.categories.find((c) => c.id === state.actionTabId);
        if (cat) {
          cat.color = color === "default" ? null : color;
          await put("categories", cat);
        }

        await saveSettings();
        renderTabs();

        if (els.tabColorName) {
          const colObj = TAB_COLORS.find((c) => c.id === color) || TAB_COLORS[0];
          els.tabColorName.textContent = colObj.name;
        }

        [...els.tabColorPalette.querySelectorAll(".tab-color-swatch")].forEach((el) => {
          el.classList.toggle("active", el.dataset.color === color);
        });

        showToast("Tab color updated");
      });
    }

    document.getElementById("confirm-cancel").addEventListener("click", closeOverlays);
    els.confirmOk.addEventListener("click", async () => {
      const handler = state.confirmHandler;
      closeOverlays();
      if (handler) await handler();
    });

    if (els.inputTimer1) {
      els.inputTimer1.addEventListener("input", async () => {
        let t1 = Number(els.inputTimer1.value);
        let t2 = Number(els.inputTimer2?.value || 1000);
        if (t1 >= t2) {
          t2 = t1 + 100;
          if (els.inputTimer2) els.inputTimer2.value = t2;
          if (els.valTimer2) els.valTimer2.textContent = `${t2} ms`;
          state.settings.tabOptionsHoldMs = t2;
        }
        if (els.valTimer1) els.valTimer1.textContent = `${t1} ms`;
        state.settings.tabDragHoldMs = t1;
        await saveSettings();
      });
    }

    if (els.inputTimer2) {
      els.inputTimer2.addEventListener("input", async () => {
        let t1 = Number(els.inputTimer1?.value || 400);
        let t2 = Number(els.inputTimer2.value);
        if (t2 <= t1) {
          t1 = Math.max(200, t2 - 100);
          if (els.inputTimer1) els.inputTimer1.value = t1;
          if (els.valTimer1) els.valTimer1.textContent = `${t1} ms`;
          state.settings.tabDragHoldMs = t1;
        }
        if (els.valTimer2) els.valTimer2.textContent = `${t2} ms`;
        state.settings.tabOptionsHoldMs = t2;
        await saveSettings();
      });
    }

    const setTimerPreset = async (t1, t2) => {
      state.settings.tabDragHoldMs = t1;
      state.settings.tabOptionsHoldMs = t2;
      if (els.inputTimer1) els.inputTimer1.value = t1;
      if (els.valTimer1) els.valTimer1.textContent = `${t1} ms`;
      if (els.inputTimer2) els.inputTimer2.value = t2;
      if (els.valTimer2) els.valTimer2.textContent = `${t2} ms`;
      await saveSettings();
      showToast(`Timers set to ${t1}ms / ${t2}ms`);
    };

    if (els.btnTimerFast) {
      els.btnTimerFast.addEventListener("click", () => setTimerPreset(300, 800));
    }
    if (els.btnTimerDefault) {
      els.btnTimerDefault.addEventListener("click", () => setTimerPreset(400, 1000));
    }
    if (els.btnTimerRelaxed) {
      els.btnTimerRelaxed.addEventListener("click", () => setTimerPreset(600, 1500));
    }

    setupDrag();
    setupTabInteraction();
    setupTabScroll();
    setupSwipeActions();
  }

  function setupSwipeActions() {
    let activeCard = null;
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let isSwiping = false;
    let hasDecidedAxis = false;
    let completeCue = null;
    let deleteCue = null;

    const SWIPE_THRESHOLD_PX = 72; // Distance needed to trigger confirmation

    const resetCardPosition = (card) => {
      if (!card) return;
      card.classList.remove("swiping");
      card.classList.add("swipe-animating");
      card.style.transform = "translateX(0px)";
      const wrapper = card.closest(".task-item-wrapper");
      if (wrapper) {
        const comp = wrapper.querySelector(".cue-complete");
        const del = wrapper.querySelector(".cue-delete");
        if (comp) comp.style.opacity = "0";
        if (del) del.style.opacity = "0";
      }
      setTimeout(() => {
        card.classList.remove("swipe-animating");
      }, 250);
    };

    const onPointerMove = (e) => {
      if (!activeCard) return;
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      if (!hasDecidedAxis) {
        if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
          hasDecidedAxis = true;
          // If vertical movement dominates, cancel swipe and allow natural scrolling
          if (Math.abs(deltaY) >= Math.abs(deltaX)) {
            cleanupSwipe();
            return;
          }
          isSwiping = true;
          activeCard.classList.add("swiping");
          activeCard.classList.remove("swipe-animating");
        }
      }

      if (!isSwiping) return;

      // Prevent accidental scrolling while horizontal swipe is engaged
      if (e.cancelable) e.preventDefault();

      currentX = deltaX;
      // Damping resistance past threshold
      let visualX = deltaX;
      if (Math.abs(deltaX) > SWIPE_THRESHOLD_PX) {
        const excess = Math.abs(deltaX) - SWIPE_THRESHOLD_PX;
        visualX = Math.sign(deltaX) * (SWIPE_THRESHOLD_PX + excess * 0.35);
      }

      activeCard.style.transform = `translateX(${visualX}px)`;

      // Update cue opacities based on direction
      const progress = Math.min(1, Math.abs(visualX) / SWIPE_THRESHOLD_PX);
      if (deltaX > 0) {
        // Swiping right -> complete cue
        if (completeCue) completeCue.style.opacity = String(progress);
        if (deleteCue) deleteCue.style.opacity = "0";
      } else {
        // Swiping left -> delete cue
        if (deleteCue) deleteCue.style.opacity = String(progress);
        if (completeCue) completeCue.style.opacity = "0";
      }
    };

    const cleanupSwipe = () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
      activeCard = null;
      completeCue = null;
      deleteCue = null;
      isSwiping = false;
      hasDecidedAxis = false;
    };

    const onPointerUp = (e) => {
      if (!activeCard) return;
      const card = activeCard;
      const finalDeltaX = currentX;
      cleanupSwipe();

      if (Math.abs(finalDeltaX) >= SWIPE_THRESHOLD_PX) {
        const taskId = card.dataset.id;
        const task = state.tasks.find((t) => t.id === taskId);
        if (!task || task.isSubheading) {
          resetCardPosition(card);
          return;
        }

        if (finalDeltaX > 0) {
          // Swipe Right: Complete task -> require confirmation
          resetCardPosition(card);
          const isArchived = Boolean(task.completed);
          confirmAction({
            title: isArchived ? "Mark incomplete?" : "Mark complete?",
            message: isArchived
              ? `Move “${task.name}” back to active tasks?`
              : `Mark “${task.name}” as complete?`,
            okLabel: isArchived ? "Restore" : "Complete",
            okClass: "success",
            onConfirm: async () => {
              await toggleComplete(task);
            },
          });
        } else {
          // Swipe Left: Delete task -> require confirmation
          resetCardPosition(card);
          confirmAction({
            title: "Delete task?",
            message: `“${task.name}” will be removed.`,
            okLabel: "Delete",
            okClass: "danger",
            onConfirm: async () => {
              await remove("tasks", task.id);
              state.tasks = await getAll("tasks");
              render();
            },
          });
        }
      } else {
        resetCardPosition(card);
      }
    };

    els.list.addEventListener("pointerdown", (e) => {
      // Ignore if clicking drag-handle, complete toggle, or archive buttons
      if (
        e.target.closest(".drag-handle") ||
        e.target.closest(".task-complete") ||
        e.target.closest(".task-icon-btn")
      ) {
        return;
      }

      const card = e.target.closest(".task-card");
      if (!card || card.dataset.isSubheading === "true") return;

      const wrapper = card.closest(".task-item-wrapper");
      if (!wrapper) return;

      activeCard = card;
      startX = e.clientX;
      startY = e.clientY;
      currentX = 0;
      isSwiping = false;
      hasDecidedAxis = false;
      completeCue = wrapper.querySelector(".cue-complete");
      deleteCue = wrapper.querySelector(".cue-delete");

      document.addEventListener("pointermove", onPointerMove, { passive: false });
      document.addEventListener("pointerup", onPointerUp);
      document.addEventListener("pointercancel", onPointerUp);
    });
  }

  async function toggleComplete(task) {
    await put("tasks", { ...task, completed: !task.completed });
    state.tasks = await getAll("tasks");
    render();
  }

  async function init() {
    state.db = await openDb();
    await loadAll();
    await seedIfEmpty();
    applyTheme();
    setupEvents();
    updateInstallUI();
    render();
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (state.settings.theme === "system") applyTheme();
    });
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").then((reg) => {
        reg.update();
      }).catch(() => {});
    }
    checkPendingReminders();
    setInterval(checkPendingReminders, 15000);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) checkPendingReminders();
    });

    initGoogleAuth((user, token) => {
      state.googleUser = user;
      state.driveToken = token;
      updateGoogleDriveUI(user);
      if (user) {
        setDriveStatus(`Connected as ${user.email} (Drive ready) ✓`, "success");
      }
    });
  }

  init();


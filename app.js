(() => {
  const DB_NAME = "priority-planner";
  const DB_VERSION = 1;
  const LONG_PRESS_MS = 520;
  const MOVE_CANCEL_PX = 10;

  const SORT_LABELS = {
    manual: "Manual order",
    importance: "Sorted by importance",
    time: "Sorted by estimated time",
    quickWins: "Quick wins",
    due7: "Due next 7 days",
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
  };

  const state = {
    db: null,
    tasks: [],
    categories: [],
    settings: {
      sortMode: "manual",
      hideCompleted: true,
      theme: "system",
      colorTheme: "purple",
      activeTab: "all",
    },
    editingTaskId: null,
    editingCategoryId: null,
    actionTaskId: null,
    actionCategoryId: null,
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
  }

  function tabButton(id, label, active, userCategory = false) {
    const activeClass = active ? " active" : "";
    const catAttr = userCategory ? " data-user-category='true'" : "";
    return `<button type="button" class="tab${activeClass}" data-tab="${id}"${catAttr}>${escapeHtml(
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

    if (!tasks.length) {
      const copy =
        state.settings.activeTab === "archive"
          ? ["No archived tasks", "Completed tasks appear here."]
          : state.settings.sortMode === "quickWins"
            ? ["No quick wins", "Quick wins have importance 4+ and take 2 hours or less."]
            : state.settings.sortMode === "due7"
              ? ["Nothing due in the next 7 days", "Tasks with a due date this week will show here."]
              : ["No tasks yet", "Tap the + button to add one."];
      els.list.innerHTML = `<div class="empty-state"><h2>${copy[0]}</h2><p>${copy[1]}</p></div>`;
      return;
    }

    els.list.innerHTML = tasks.map((task) => taskCard(task, manual)).join("");
  }

  function taskCard(task, manual) {
    if (task.isSubheading) {
      return `
      <article class="task-card subheading" data-id="${task.id}" data-is-subheading="true">
        <button type="button" class="drag-handle" aria-label="Reorder" ${manual ? "" : "disabled"}>
          <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M9 7h2v2H9V7zm4 0h2v2h-2V7zM9 11h2v2H9v-2zm4 0h2v2h-2v-2zM9 15h2v2H9v-2zm4 0h2v2h-2v-2z"/></svg>
        </button>
        <div class="task-body">
          <p class="task-name subheading-title">${escapeHtml(task.name)}</p>
        </div>
      </article>`;
    }

    const due = task.dueDate
      ? `<span class="chip${task.dueDate < todayISO() && !task.completed ? " overdue" : ""}">${escapeHtml(
          task.dueDate
        )}</span>`
      : "";
    const doneClass = task.completed ? " completed" : "";
    const checkClass = task.completed ? " done" : "";
    return `
      <article class="task-card${doneClass}" data-id="${task.id}">
        <button type="button" class="drag-handle" aria-label="Reorder" ${manual ? "" : "disabled"}>
          <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M9 7h2v2H9V7zm4 0h2v2h-2V7zM9 11h2v2H9v-2zm4 0h2v2h-2v-2zM9 15h2v2H9v-2zm4 0h2v2h-2v-2z"/></svg>
        </button>
        <div class="task-body">
          <p class="task-name">${escapeHtml(task.name)}</p>
          <div class="task-meta">
            <span class="chip${task.importance >= 4 ? " importance-high" : ""}">Importance ${task.importance}</span>
            <span class="chip">${task.estimatedTime}h</span>
            ${due}
            <span class="chip">${escapeHtml(categoryName(task.categoryId))}</span>
          </div>
        </div>
        <button type="button" class="task-complete${checkClass}" data-complete="${task.id}" aria-label="${
          task.completed ? "Mark incomplete" : "Mark complete"
        }">
          <svg viewBox="0 0 24 24"><path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>
        </button>
      </article>`;
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

    updateInstallUI();
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

    if (deferredPrompt) {
      if (els.installBtn) els.installBtn.hidden = false;
      if (els.installBar) els.installBar.hidden = false;
      if (els.settingsInstallStatus) {
        els.settingsInstallStatus.textContent = "Ready to install as an app";
      }
      if (els.settingsInstallTitle) {
        els.settingsInstallTitle.textContent = "Install App";
      }
    } else {
      if (els.installBtn) els.installBtn.hidden = false;
      if (els.installBar) els.installBar.hidden = false;
      const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
      if (els.settingsInstallStatus) {
        els.settingsInstallStatus.textContent = isIOS
          ? "Tap Share ⎋ then 'Add to Home Screen'"
          : "Tap for installation options";
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

  function confirmAction({ title, message, okLabel = "Delete", onConfirm }) {
    els.confirmTitle.textContent = title;
    els.confirmMessage.textContent = message;
    els.confirmOk.textContent = okLabel;
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

  function bindLongPress(root, selector, onLongPress) {
    let timer = null;
    let startX = 0;
    let startY = 0;
    let target = null;

    const clear = () => {
      if (timer) window.clearTimeout(timer);
      timer = null;
      target = null;
    };

    root.addEventListener("pointerdown", (event) => {
      const hit = event.target.closest(selector);
      if (!hit || event.button) return;
      startX = event.clientX;
      startY = event.clientY;
      target = hit;
      timer = window.setTimeout(() => {
        const current = target;
        clear();
        if (navigator.vibrate) navigator.vibrate(20);
        onLongPress(current, event);
      }, LONG_PRESS_MS);
    });

    root.addEventListener("pointermove", (event) => {
      if (!timer) return;
      if (
        Math.abs(event.clientX - startX) > MOVE_CANCEL_PX ||
        Math.abs(event.clientY - startY) > MOVE_CANCEL_PX
      ) {
        clear();
      }
    });

    ["pointerup", "pointercancel", "pointerleave"].forEach((name) => {
      root.addEventListener(name, clear);
    });
  }

  function setupDrag() {
    let previewEl = null;
    let dragOffsetY = 0;
    let dragOffsetX = 0;

    const onMove = (event) => {
      if (!state.drag) return;
      const dragging = els.list.querySelector(".task-card.dragging");
      if (!dragging) return;

      if (previewEl) {
        previewEl.style.top = `${event.clientY - dragOffsetY}px`;
        previewEl.style.left = `${event.clientX - dragOffsetX}px`;
      }

      const y = event.clientY;
      const others = [...els.list.querySelectorAll(".task-card:not(.dragging)")];
      for (const card of others) {
        const rect = card.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        if (y < mid) {
          card.before(dragging);
          return;
        }
      }
      const last = others[others.length - 1];
      if (last) last.after(dragging);
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
      const ids = [...els.list.querySelectorAll(".task-card")].map((card) => card.dataset.id);
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
    { section: "Tasks", name: "Set Reminder (Notification)", status: "todo", desc: "Web Notifications API integration and timed alarm reminder triggers." },

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
    { section: "Tabs", name: "Long-press on tabs", status: "done", desc: "Long-pressing user tabs triggers category action sheet for rename/delete." },
    { section: "Tabs", name: "Rename tab", status: "done", desc: "Category dialog renames tab and updates associations in real time." },
    { section: "Tabs", name: "Delete tab", status: "done", desc: "Safe delete confirmation; reassigns associated tasks to Uncategorized." },
    { section: "Tabs", name: "Change tab background colour", status: "todo", desc: "Color picker palette to assign custom tab colors." },
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
    { section: "Filters Button", name: "Due Today", status: "todo", desc: "Dedicated filter for tasks due on today's date." },
    { section: "Filters Button", name: "Due Next 7 Days", status: "done", desc: "Filters tasks due in the upcoming week." },

    // 6. Settings button
    { section: "Settings Button", name: "Settings Area / Modal", status: "done", desc: "Settings pane with dark mode switch, 6 colour themes, JSON backup & restore, version info." },

    // 7. Data Storage
    { section: "Data Storage", name: "Local Storage / IndexedDB", status: "done", desc: "IndexedDB database 'priority-planner' with 3 stores." },
    { section: "Data Storage", name: "No backend required", status: "done", desc: "100% client-side offline execution." },
    { section: "Data Storage", name: "No account required", status: "done", desc: "Zero authentication friction; works immediately." },
    { section: "Data Storage", name: "No cloud sync", status: "done", desc: "All data stays private and stored locally on the device." },
    { section: "Data Storage", name: "Data stored entirely on device", status: "done", desc: "Confirmed local-only storage." },

    // 8. User Interface
    { section: "User Interface", name: "Mobile First Design", status: "done", desc: "Single-hand friendly layout with bottom sheets and thumb zones." },
    { section: "User Interface", name: "Android Friendly", status: "done", desc: "MD3 design tokens, ripple-friendly targets, viewport-fit." },
    { section: "User Interface", name: "Responsive Layout", status: "done", desc: "Clean centered layout supporting mobile, tablet, and desktop." },
    { section: "User Interface", name: "Large Touch Targets", status: "done", desc: "Minimum 44px-48px touch targets for touch accuracy." },
    { section: "User Interface", name: "Modern Material Design styling", status: "done", desc: "Rounded cards, MD3 color system, FAB, elevation." },
    { section: "User Interface", name: "Dark Mode in Settings", status: "done", desc: "Dark mode switch placed cleanly in Settings pane with System, Light, and Dark options." },

    // 9. Notifications
    { section: "Notifications", name: "Due date reminders", status: "todo", desc: "In-app or system notifications when a task is due." },
    { section: "Notifications", name: "Date and time set reminders", status: "todo", desc: "Custom scheduled alarms for specific task dates and times." },

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

    els.scrim.addEventListener("click", closeOverlays);

    els.filterForm.addEventListener("change", async () => {
      const selected = els.filterForm.querySelector("input[name='sortMode']:checked");
      if (selected) state.settings.sortMode = selected.value;
      state.settings.hideCompleted = els.hideCompleted.checked;
      await saveSettings();
      render();
    });

    els.tabs.addEventListener("click", (event) => {
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

    bindLongPress(els.tabs, "[data-user-category]", (tab) => {
      state.actionCategoryId = tab.dataset.tab;
      const category = state.categories.find((item) => item.id === state.actionCategoryId);
      document.getElementById("cat-actions-title").textContent = category?.name || "Category";
      openOverlay(els.categoryActions);
    });

    bindLongPress(els.list, ".task-card", (card, event) => {
      if (event.target.closest(".drag-handle") || event.target.closest(".task-complete")) return;
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
      openOverlay(els.taskActions);
    });

    els.list.addEventListener("click", async (event) => {
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

    els.taskForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(els.taskForm);
      const isSubheading = Boolean(els.taskForm.elements.isSubheading?.checked);
      const payload = {
        name: String(data.get("name") || "").trim(),
        importance: isSubheading ? 3 : Number(data.get("importance") || 3),
        estimatedTime: isSubheading ? 0 : Number(data.get("estimatedTime") || 1),
        dueDate: isSubheading ? "" : String(data.get("dueDate") || ""),
        categoryId: String(data.get("categoryId") || ""),
        isSubheading,
      };
      if (!payload.name) return;
      if (state.editingTaskId) {
        const existing = state.tasks.find((task) => task.id === state.editingTaskId);
        await put("tasks", { ...existing, ...payload });
      } else {
        await put("tasks", {
          id: uid(),
          ...payload,
          completed: false,
          sortPosition: await nextSortPosition(),
        });
      }
      state.tasks = await getAll("tasks");
      closeOverlays();
      render();
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

    els.categoryActions.addEventListener("click", (event) => {
      const action = event.target.closest("[data-action]")?.dataset.action;
      const category = state.categories.find((item) => item.id === state.actionCategoryId);
      if (!action || !category) return;
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
            if (state.settings.activeTab === category.id) state.settings.activeTab = "all";
            await saveSettings();
            await loadAll();
            render();
          },
        });
      }
    });

    document.getElementById("confirm-cancel").addEventListener("click", closeOverlays);
    els.confirmOk.addEventListener("click", async () => {
      const handler = state.confirmHandler;
      closeOverlays();
      if (handler) await handler();
    });

    setupDrag();
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
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
  }

  init();
})();

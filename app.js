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
    themeBtn: document.getElementById("btn-theme"),
  };

  const state = {
    db: null,
    tasks: [],
    categories: [],
    settings: {
      sortMode: "manual",
      hideCompleted: true,
      theme: "system",
      activeTab: "all",
    },
    editingTaskId: null,
    editingCategoryId: null,
    actionTaskId: null,
    actionCategoryId: null,
    confirmHandler: null,
    drag: null,
  };

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

  function applyTheme() {
    const theme = state.settings.theme;
    const dark =
      theme === "dark" ||
      (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      "content",
      dark ? "#1c1b1f" : "#6750A4"
    );
  }

  function visibleTasks() {
    const { activeTab, sortMode, hideCompleted } = state.settings;
    let tasks = [...state.tasks];

    if (activeTab === "archive") {
      tasks = tasks.filter((task) => task.completed);
    } else {
      if (activeTab !== "all") {
        tasks = tasks.filter((task) => task.categoryId === activeTab);
      }
      if (hideCompleted) {
        tasks = tasks.filter((task) => !task.completed);
      }
    }

    if (sortMode === "quickWins") {
      tasks = tasks.filter(
        (task) => Number(task.importance) >= 4 && Number(task.estimatedTime) <= 2
      );
    }

    if (sortMode === "due7") {
      const start = todayISO();
      const end = addDaysISO(7);
      tasks = tasks.filter((task) => task.dueDate && task.dueDate >= start && task.dueDate <= end);
    }

    const byManual = (a, b) => a.sortPosition - b.sortPosition;
    if (sortMode === "manual") {
      tasks.sort(byManual);
    } else if (sortMode === "importance") {
      tasks.sort((a, b) => b.importance - a.importance || byManual(a, b));
    } else if (sortMode === "time") {
      tasks.sort((a, b) => a.estimatedTime - b.estimatedTime || byManual(a, b));
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
  }

  function syncFilterSheet() {
    const radio = els.filterForm.querySelector(
      `input[name="sortMode"][value="${state.settings.sortMode}"]`
    );
    if (radio) radio.checked = true;
    els.hideCompleted.checked = Boolean(state.settings.hideCompleted);
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
    state.confirmHandler = null;
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

  function openTaskDialog(task) {
    state.editingTaskId = task?.id || null;
    els.taskTitle.textContent = task ? "Edit task" : "Add task";
    els.taskForm.reset();
    fillCategorySelect(task?.categoryId || (state.settings.activeTab !== "all" && state.settings.activeTab !== "archive"
      ? state.settings.activeTab
      : ""));
    if (task) {
      els.taskForm.elements.name.value = task.name;
      els.taskForm.elements.importance.value = task.importance;
      els.taskForm.elements.estimatedTime.value = task.estimatedTime;
      els.taskForm.elements.dueDate.value = task.dueDate || "";
      els.taskForm.elements.categoryId.value = task.categoryId || "";
    }
    els.importanceValue.textContent = els.taskForm.elements.importance.value;
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
    const onMove = (event) => {
      if (!state.drag) return;
      const dragging = els.list.querySelector(".task-card.dragging");
      if (!dragging) return;
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
      const dragging = els.list.querySelector(".task-card.dragging");
      if (dragging) dragging.classList.remove("dragging");
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
      state.drag = { id: card.dataset.id };
      card.classList.add("dragging");
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", endDrag);
      document.addEventListener("pointercancel", endDrag);
    });
  }

  function setupEvents() {
    document.getElementById("btn-filter").addEventListener("click", () => {
      syncFilterSheet();
      openOverlay(els.filterSheet);
    });

    els.themeBtn.addEventListener("click", async () => {
      const order = ["system", "light", "dark"];
      const next = order[(order.indexOf(state.settings.theme) + 1) % order.length];
      state.settings.theme = next;
      await saveSettings();
      render();
    });

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
      document.getElementById("task-actions-title").textContent = task?.name || "Task";
      const completeBtn = els.taskActions.querySelector("[data-action='complete']");
      completeBtn.textContent = task?.completed ? "Move back to list" : "Complete";
      openOverlay(els.taskActions);
    });

    els.list.addEventListener("click", async (event) => {
      const complete = event.target.closest("[data-complete]");
      if (!complete) return;
      const task = state.tasks.find((item) => item.id === complete.dataset.complete);
      if (!task) return;
      await toggleComplete(task);
    });

    els.fab.addEventListener("click", () => openTaskDialog(null));

    els.taskForm.elements.importance.addEventListener("input", () => {
      els.importanceValue.textContent = els.taskForm.elements.importance.value;
    });

    els.taskForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(els.taskForm);
      const payload = {
        name: String(data.get("name") || "").trim(),
        importance: Number(data.get("importance")),
        estimatedTime: Number(data.get("estimatedTime")),
        dueDate: String(data.get("dueDate") || ""),
        categoryId: String(data.get("categoryId") || ""),
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

import React, { useState, useEffect, useRef } from 'react';
import { usePlanner } from '../context/PlannerContext';
import { TaskCard } from './TaskCard';
import { Task } from '../types';

export const TaskList: React.FC = () => {
  const { tasks, categories, settings, openTaskDialog, reorderTasks } = usePlanner();
  const listRef = useRef<HTMLElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const draggingTaskIdRef = useRef<string | null>(null);
  const dragOrderRef = useRef<Task[]>([]);
  const initialDragOrderRef = useRef<Task[]>([]);
  const pointerYRef = useRef(0);
  const ghostRef = useRef<HTMLElement | null>(null);
  const grabOffsetYRef = useRef(0);
  const autoScrollFrameRef = useRef<number | null>(null);
  const pointerEndListenerRef = useRef<((event: PointerEvent) => void) | null>(null);
  const preventScrollListenerRef = useRef<((event: Event) => void) | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOrder, setDragOrder] = useState<Task[]>([]);
  const [isFullPage, setIsFullPage] = useState(false);

  const getTodayISO = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
  };

  const addDaysISO = (days: number) => {
    const now = new Date(`${getTodayISO()}T00:00:00`);
    now.setDate(now.getDate() + days);
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
  };

  const isTabCompact = Boolean(settings.compactTabs?.[settings.activeTab]);

  const isTabHiddenFromTasks = (catId?: string) => {
    if (!catId) return false;
    return Boolean(settings.hiddenFromTasksTabs?.[catId]);
  };

  // Filter tasks based on activeTab, hideCompleted, and sortMode
  let filtered: Task[] = [...tasks];
  const { activeTab, sortMode, hideCompleted } = settings;

  if (activeTab === 'archive') {
    filtered = filtered.filter((t) => t.completed && !t.isSubheading);
  } else {
    if (activeTab === 'all') {
      filtered = filtered.filter((t) => {
        if (t.isSubheading) return false;
        if (t.categoryId && isTabHiddenFromTasks(t.categoryId)) return false;
        return true;
      });
    } else {
      filtered = filtered.filter((t) => t.categoryId === activeTab);
    }

    if (hideCompleted) {
      filtered = filtered.filter((t) => t.isSubheading || !t.completed);
    }
  }

  // Sort mode specific filters
  if (sortMode === 'today') {
    const today = getTodayISO();
    filtered = filtered.filter((t) => !t.isSubheading && t.dueDate === today);
  } else if (sortMode === 'tomorrow') {
    const tomorrow = addDaysISO(1);
    filtered = filtered.filter((t) => !t.isSubheading && t.dueDate === tomorrow);
  } else if (sortMode === 'due7') {
    const start = getTodayISO();
    const end = addDaysISO(7);
    filtered = filtered.filter(
      (t) => !t.isSubheading && t.dueDate && t.dueDate >= start && t.dueDate <= end
    );
  } else if (sortMode === 'quickWins') {
    filtered = filtered.filter(
      (t) => !t.isSubheading && Number(t.importance) >= 4 && Number(t.estimatedTime) <= 2
    );
  }

  // Sorting
  const byManual = (a: Task, b: Task) => (a.sortPosition ?? 0) - (b.sortPosition ?? 0);

  if (sortMode === 'manual') {
    filtered.sort(byManual);
  } else if (sortMode === 'today' || sortMode === 'tomorrow' || sortMode === 'importance') {
    filtered.sort((a, b) =>
      b.isSubheading ? -1 : a.isSubheading ? 1 : b.importance - a.importance || byManual(a, b)
    );
  } else if (sortMode === 'time') {
    filtered.sort((a, b) =>
      b.isSubheading ? -1 : a.isSubheading ? 1 : a.estimatedTime - b.estimatedTime || byManual(a, b)
    );
  } else if (sortMode === 'quickWins') {
    filtered.sort(
      (a, b) =>
        b.importance - a.importance ||
        a.estimatedTime - b.estimatedTime ||
        byManual(a, b)
    );
  } else if (sortMode === 'due7') {
    filtered.sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)) || byManual(a, b));
  }

  const placeDraggedTask = (pointerY: number) => {
    const draggedId = draggingTaskIdRef.current;
    const list = listRef.current;
    if (!draggedId || !list) return;

    const currentOrder = dragOrderRef.current;
    const remaining = currentOrder.filter((task) => task.id !== draggedId);
    let insertionIndex = remaining.length;
    const wrappers = Array.from(list.querySelectorAll<HTMLElement>('.task-item-wrapper'));
    for (let i = 0; i < remaining.length; i++) {
      const wrapper = wrappers.find((candidate) => candidate.dataset.id === remaining[i].id);
      if (wrapper && pointerY < wrapper.getBoundingClientRect().top + wrapper.offsetHeight / 2) {
        insertionIndex = i;
        break;
      }
    }

    const draggedTask = currentOrder.find((task) => task.id === draggedId);
    if (!draggedTask) return;
    remaining.splice(insertionIndex, 0, draggedTask);
    if (remaining.some((task, index) => task.id !== currentOrder[index]?.id)) {
      dragOrderRef.current = remaining;
      setDragOrder(remaining);
    }
  };

  const finishTaskDrag = (pointerId: number) => {
    if (pointerIdRef.current !== pointerId) return;
    pointerIdRef.current = null;
    draggingTaskIdRef.current = null;
    if (pointerEndListenerRef.current) {
      window.removeEventListener('pointerup', pointerEndListenerRef.current);
      window.removeEventListener('pointercancel', pointerEndListenerRef.current);
      pointerEndListenerRef.current = null;
    }
    if (preventScrollListenerRef.current) {
      document.removeEventListener('touchmove', preventScrollListenerRef.current);
      document.removeEventListener('wheel', preventScrollListenerRef.current);
      preventScrollListenerRef.current = null;
    }
    if (autoScrollFrameRef.current !== null) {
      cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }

    const finalOrder = dragOrderRef.current;
    const initialOrder = initialDragOrderRef.current;
    const changed = finalOrder.some((task, index) => task.id !== initialOrder[index]?.id);
    document.body.classList.remove('dragging-task-mode');
    ghostRef.current?.remove();
    ghostRef.current = null;
    setDraggingTaskId(null);
    setDragOrder([]);

    if (changed) {
      const visibleIds = new Set(initialOrder.map((task) => task.id));
      let visibleIndex = 0;
      const allTasksByOrder = [...tasks].sort(byManual);
      const reorderedTasks = allTasksByOrder.map((task) =>
        visibleIds.has(task.id) ? finalOrder[visibleIndex++] : task
      );
      void reorderTasks(reorderedTasks);
    }
  };

  const handleReorderStart = (task: Task, e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isManual || !e.isPrimary || e.button !== 0 || pointerIdRef.current !== null) return;
    e.preventDefault();
    e.stopPropagation();

    pointerIdRef.current = e.pointerId;
    draggingTaskIdRef.current = task.id;
    pointerYRef.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);

    const card = e.currentTarget.closest('.task-card');
    if (card instanceof HTMLElement) {
      const bounds = card.getBoundingClientRect();
      const ghost = card.cloneNode(true) as HTMLElement;
      ghost.classList.remove('dragging');
      ghost.classList.add('drag-ghost-preview');
      ghost.style.width = `${bounds.width}px`;
      ghost.style.left = `${bounds.left}px`;
      ghost.style.top = `${bounds.top}px`;
      ghostRef.current = ghost;
      grabOffsetYRef.current = e.clientY - bounds.top;
      document.body.appendChild(ghost);
    }

    const startingOrder = [...filtered];
    dragOrderRef.current = startingOrder;
    initialDragOrderRef.current = startingOrder;
    setDragOrder(startingOrder);
    setDraggingTaskId(task.id);
    document.body.classList.add('dragging-task-mode');

    pointerEndListenerRef.current = (event) => finishTaskDrag(event.pointerId);
    window.addEventListener('pointerup', pointerEndListenerRef.current);
    window.addEventListener('pointercancel', pointerEndListenerRef.current);
    preventScrollListenerRef.current = (event) => event.preventDefault();
    document.addEventListener('touchmove', preventScrollListenerRef.current, { passive: false });
    document.addEventListener('wheel', preventScrollListenerRef.current, { passive: false });

    const autoScroll = () => {
      if (pointerIdRef.current === null) return;
      const y = pointerYRef.current;
      if (y < 52) window.scrollBy(0, -7);
      else if (y > window.innerHeight - 52) window.scrollBy(0, 7);
      placeDraggedTask(y);
      autoScrollFrameRef.current = requestAnimationFrame(autoScroll);
    };
    autoScrollFrameRef.current = requestAnimationFrame(autoScroll);
  };

  const handleReorderMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    pointerYRef.current = e.clientY;
    if (ghostRef.current) {
      ghostRef.current.style.top = `${e.clientY - grabOffsetYRef.current}px`;
    }
    placeDraggedTask(e.clientY);
  };

  const handleReorderEnd = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    finishTaskDrag(e.pointerId);
  };

  useEffect(
    () => () => {
      if (autoScrollFrameRef.current !== null) {
        cancelAnimationFrame(autoScrollFrameRef.current);
      }
      if (pointerEndListenerRef.current) {
        window.removeEventListener('pointerup', pointerEndListenerRef.current);
        window.removeEventListener('pointercancel', pointerEndListenerRef.current);
      }
      if (preventScrollListenerRef.current) {
        document.removeEventListener('touchmove', preventScrollListenerRef.current);
        document.removeEventListener('wheel', preventScrollListenerRef.current);
      }
      ghostRef.current?.remove();
      document.body.classList.remove('dragging-task-mode');
    },
    []
  );

  // Reactive detection of full page of tasks
  useEffect(() => {
    const checkOverflow = () => {
      if (filtered.length === 0) {
        setIsFullPage(false);
        return;
      }
      const docHeight = document.documentElement.scrollHeight;
      const viewHeight = window.innerHeight;
      const isOverflow = docHeight > viewHeight + 30;
      setIsFullPage(isOverflow);
    };

    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    window.addEventListener('scroll', checkOverflow, { passive: true });
    const rId = requestAnimationFrame(checkOverflow);
    const timer = setTimeout(checkOverflow, 60);

    return () => {
      window.removeEventListener('resize', checkOverflow);
      window.removeEventListener('scroll', checkOverflow);
      cancelAnimationFrame(rId);
      clearTimeout(timer);
    };
  }, [filtered.length, settings.activeTab, settings.sortMode, settings.hideCompleted]);

  useEffect(() => {
    if (!listRef.current || typeof ResizeObserver === 'undefined') return;
    try {
      const ro = new ResizeObserver(() => {
        if (filtered.length === 0) {
          setIsFullPage(false);
          return;
        }
        const docHeight = document.documentElement?.scrollHeight || 0;
        const viewHeight = window.innerHeight || 0;
        setIsFullPage(docHeight > viewHeight + 30);
      });
      ro.observe(listRef.current);
      if (document.body) ro.observe(document.body);
      return () => ro.disconnect();
    } catch (_) {}
  }, [filtered.length]);

  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const visibleTasks = draggingTaskId ? dragOrder : filtered;

  // Case 1: When there are no tasks in a tab -> Button in middle horizontal and vertical of screen
  if (filtered.length === 0) {
    const getEmptyCopy = (): [string, string] => {
      if (activeTab === 'archive') {
        return ['No archived tasks', 'Completed tasks appear here.'];
      }
      if (sortMode === 'today') {
        return ['No tasks due today', 'Tasks scheduled for today will appear here.'];
      }
      if (sortMode === 'tomorrow') {
        return ['No tasks due tomorrow', 'Tasks scheduled for tomorrow will appear here.'];
      }
      if (sortMode === 'quickWins') {
        return ['No quick wins', 'Quick wins have importance 4+ and take 2 hours or less.'];
      }
      if (sortMode === 'due7') {
        return ['Nothing due in the next 7 days', 'Tasks with a due date this week will show here.'];
      }
      return ['No tasks yet', 'Tap below to add your first task.'];
    };

    const [heading, subtitle] = getEmptyCopy();

    return (
      <main id="task-list" className="task-list" aria-live="polite" ref={listRef}>
        <div className="empty-state-centered">
          <h2>{heading}</h2>
          <p>{subtitle}</p>
          <button
            type="button"
            className="new-task-btn empty-center"
            aria-label="New Task"
            onClick={() => openTaskDialog(null)}
          >
            New Task +
          </button>
        </div>
      </main>
    );
  }

  const isArchive = activeTab === 'archive';
  const isManual = sortMode === 'manual' && !isArchive;

  return (
    <main
      id="task-list"
      ref={listRef}
      className={`task-list ${isTabCompact ? 'compact-list' : ''}`}
      aria-live="polite"
    >
      {visibleTasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          category={task.categoryId ? categoryMap.get(task.categoryId) : undefined}
          isCompact={isTabCompact}
          manualOrder={isManual}
          isArchive={isArchive}
          isDragging={draggingTaskId === task.id}
          onReorderStart={(e) => handleReorderStart(task, e)}
          onReorderMove={handleReorderMove}
          onReorderEnd={handleReorderEnd}
        />
      ))}

      {/* Case 2: When there are only a couple of tasks -> Button is just below the bottom task */}
      {!isFullPage && (
        <div className="new-task-inline-wrap">
          <button
            type="button"
            className="new-task-btn"
            aria-label="New Task"
            onClick={() => openTaskDialog(null)}
          >
            New Task +
          </button>
        </div>
      )}

      {/* Case 3: When there is a full page of tasks -> Button floats above at bottom of screen, always visible */}
      {isFullPage && (
        <button
          type="button"
          id="fab"
          className="new-task-btn new-task-btn-floating"
          aria-label="New Task"
          title="Add new task"
          onClick={() => openTaskDialog(null)}
        >
          New Task +
        </button>
      )}
    </main>
  );
};

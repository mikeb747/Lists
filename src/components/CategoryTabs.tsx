import React, { useRef, useEffect, useState } from 'react';
import { usePlanner } from '../context/PlannerContext';
import { Category } from '../types';

export const CategoryTabs: React.FC = () => {
  const {
    categories,
    settings,
    updateSettings,
    openCategoryDialog,
    openCategoryActions,
    reorderCategories,
  } = usePlanner();

  const tabsRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [dragOrder, setDragOrder] = useState<Category[]>([]);
  const [draggingCategoryId, setDraggingCategoryId] = useState<string | null>(null);

  const dragActivationTimerRef = useRef<number | null>(null);
  const tabOptionsTimerRef = useRef<number | null>(null);
  const pointerStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pointerIdRef = useRef<number | null>(null);
  const tabElementRef = useRef<HTMLButtonElement | null>(null);
  const ghostRef = useRef<HTMLElement | null>(null);
  const pointerXRef = useRef(0);
  const edgeScrollIntervalRef = useRef<number | null>(null);
  const grabOffsetRef = useRef({ x: 0, y: 0 });
  const suppressClickRef = useRef(false);

  const [containerWidth, setContainerWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 760);
  const visibleCategories = draggingCategoryId ? dragOrder : categories;

  const checkScroll = () => {
    if (!tabsRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = tabsRef.current;
    setContainerWidth(clientWidth);
    const overflow = scrollWidth > clientWidth + 2;
    setHasOverflow(overflow);
    setCanScrollLeft(overflow && scrollLeft > 2);
    setCanScrollRight(overflow && Math.ceil(scrollLeft + clientWidth) < scrollWidth - 2);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [categories, dragOrder]);

  useEffect(
    () => () => {
      if (dragActivationTimerRef.current) window.clearTimeout(dragActivationTimerRef.current);
      if (tabOptionsTimerRef.current) window.clearTimeout(tabOptionsTimerRef.current);
      if (edgeScrollIntervalRef.current !== null) {
        window.clearInterval(edgeScrollIntervalRef.current);
      }
      ghostRef.current?.remove();
      document.body.classList.remove('dragging-tab-mode');
    },
    []
  );

  const scrollLeft = () => {
    tabsRef.current?.scrollBy({ left: -220, behavior: 'smooth' });
  };

  const scrollRight = () => {
    tabsRef.current?.scrollBy({ left: 220, behavior: 'smooth' });
  };

  const isTabCompact = (tabId: string) => {
    return Boolean(settings.compactTabs?.[tabId]);
  };

  const isTabHiddenFromTasks = (tabId: string) => {
    return Boolean(settings.hiddenFromTasksTabs?.[tabId]);
  };

  const getTabColor = (category: Category) => {
    if (settings.tabColors?.[category.id]) return settings.tabColors[category.id];
    return category.color || '';
  };

  const clearPressTimers = () => {
    if (dragActivationTimerRef.current) {
      window.clearTimeout(dragActivationTimerRef.current);
      dragActivationTimerRef.current = null;
    }
    if (tabOptionsTimerRef.current) {
      window.clearTimeout(tabOptionsTimerRef.current);
      tabOptionsTimerRef.current = null;
    }
  };

  const startTabDrag = (categoryId: string) => {
    const tab = tabElementRef.current;
    if (!tab || pointerIdRef.current === null) return;

    const rect = tab.getBoundingClientRect();
    const ghost = tab.cloneNode(true) as HTMLElement;
    ghost.classList.add('tab-ghost-preview');
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    document.body.appendChild(ghost);
    ghostRef.current = ghost;
    grabOffsetRef.current = {
      x: pointerStartPosRef.current.x - rect.left,
      y: pointerStartPosRef.current.y - rect.top,
    };
    tab.setPointerCapture(pointerIdRef.current);
    setDragOrder([...categories]);
    setDraggingCategoryId(categoryId);
    suppressClickRef.current = true;
    document.body.classList.add('dragging-tab-mode');
    edgeScrollIntervalRef.current = window.setInterval(() => {
      const tabs = tabsRef.current;
      if (!tabs) return;
      const bounds = tabs.getBoundingClientRect();
      if (pointerXRef.current < bounds.left + 36) tabs.scrollBy({ left: -12 });
      else if (pointerXRef.current > bounds.right - 36) tabs.scrollBy({ left: 12 });
      checkScroll();
    }, 20);
    if (navigator.vibrate) navigator.vibrate(20);
  };

  const handlePointerDown = (
    tabId: string,
    isUserCategory: boolean,
    e: React.PointerEvent<HTMLButtonElement>
  ) => {
    if (e.button !== 0) return;
    clearPressTimers();
    pointerStartPosRef.current = { x: e.clientX, y: e.clientY };
    pointerXRef.current = e.clientX;
    suppressClickRef.current = false;
    pointerIdRef.current = e.pointerId;
    tabElementRef.current = e.currentTarget;

    if (isUserCategory) {
      dragActivationTimerRef.current = window.setTimeout(() => {
        dragActivationTimerRef.current = null;
        if (tabOptionsTimerRef.current) {
          window.clearTimeout(tabOptionsTimerRef.current);
          tabOptionsTimerRef.current = null;
        }
        startTabDrag(tabId);
      }, settings.tabDragHoldMs || 400);
    }

    tabOptionsTimerRef.current = window.setTimeout(() => {
      tabOptionsTimerRef.current = null;
      if (draggingCategoryId) return;
      if (dragActivationTimerRef.current) {
        window.clearTimeout(dragActivationTimerRef.current);
        dragActivationTimerRef.current = null;
      }
      suppressClickRef.current = true;
      if (navigator.vibrate) {
        navigator.vibrate(35);
      }
      openCategoryActions(tabId);
    }, settings.tabOptionsHoldMs || 1000);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingCategoryId && pointerIdRef.current === e.pointerId) {
      pointerXRef.current = e.clientX;
      const ghost = ghostRef.current;
      if (ghost) {
        ghost.style.left = `${e.clientX - grabOffsetRef.current.x}px`;
        ghost.style.top = `${e.clientY - grabOffsetRef.current.y}px`;
      }

      const tabs = tabsRef.current;
      if (tabs) {
        const remaining = dragOrder.filter((category) => category.id !== draggingCategoryId);
        const buttons = tabs.querySelectorAll<HTMLButtonElement>('[data-user-category="true"]');
        let insertionIndex = remaining.length;
        for (let i = 0; i < remaining.length; i++) {
          const button = Array.from(buttons).find(
            (candidate) => candidate.dataset.tab === remaining[i].id
          );
          if (button && e.clientX < button.getBoundingClientRect().left + button.offsetWidth / 2) {
            insertionIndex = i;
            break;
          }
        }
        const dragged = dragOrder.find((category) => category.id === draggingCategoryId);
        if (dragged) {
          remaining.splice(insertionIndex, 0, dragged);
          if (remaining.some((category, index) => category.id !== dragOrder[index]?.id)) {
            setDragOrder(remaining);
          }
        }
      }
      checkScroll();
      return;
    }

    if (dragActivationTimerRef.current || tabOptionsTimerRef.current) {
      const dist = Math.hypot(
        e.clientX - pointerStartPosRef.current.x,
        e.clientY - pointerStartPosRef.current.y
      );
      if (dist > 10) {
        clearPressTimers();
        suppressClickRef.current = true;
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (pointerIdRef.current !== e.pointerId) return;
    clearPressTimers();
    if (draggingCategoryId) {
      const reordered = [...dragOrder];
      setDraggingCategoryId(null);
      setDragOrder([]);
      document.body.classList.remove('dragging-tab-mode');
      if (edgeScrollIntervalRef.current !== null) {
        window.clearInterval(edgeScrollIntervalRef.current);
        edgeScrollIntervalRef.current = null;
      }
      ghostRef.current?.remove();
      ghostRef.current = null;
      void reorderCategories(reordered);
    }
    pointerIdRef.current = null;
    tabElementRef.current = null;
    if (suppressClickRef.current) {
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
  };

  const handleTabClick = (tabId: string) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    updateSettings({ activeTab: tabId });
  };

  const fadeClass = [
    hasOverflow ? 'has-overflow' : '',
    canScrollLeft ? 'fade-left' : '',
    canScrollRight ? 'fade-right' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`tabs-wrapper ${fadeClass}`} id="tabs-wrapper">
      <button
        type="button"
        id="tab-scroll-left"
        className="tab-scroll-btn left"
        aria-label="Scroll tabs left"
        title="Scroll tabs left"
        disabled={!canScrollLeft}
        onClick={scrollLeft}
        style={{ display: hasOverflow ? 'grid' : 'none' }}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path fill="currentColor" d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
        </svg>
      </button>

      <nav
        className="tabs"
        id="category-tabs"
        aria-label="Categories"
        ref={tabsRef}
        onScroll={checkScroll}
      >
        {/* All Tab */}
        <button
          type="button"
          className={`tab ${settings.activeTab === 'all' ? 'active' : ''}`}
          data-tab="all"
          data-compact={isTabCompact('all')}
          onClick={() => handleTabClick('all')}
          onPointerDown={(e) => handlePointerDown('all', false, e)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onContextMenu={(e) => {
            e.preventDefault();
            openCategoryActions('all');
          }}
        >
          All
        </button>

        {/* User Categories */}
        {visibleCategories.map((cat) => {
          const isActive = settings.activeTab === cat.id;
          const compact = isTabCompact(cat.id);
          const hidden = isTabHiddenFromTasks(cat.id);
          const color = getTabColor(cat);

          return (
            <button
              key={cat.id}
              type="button"
              className={`tab ${isActive ? 'active' : ''} ${
                draggingCategoryId === cat.id ? 'tab-dragging-placeholder' : ''
              }`}
              data-tab={cat.id}
              data-user-category="true"
              data-compact={compact}
              data-hidden-from-tasks={hidden}
              data-tab-color={color || undefined}
              onClick={() => handleTabClick(cat.id)}
              onPointerDown={(e) => handlePointerDown(cat.id, true, e)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onContextMenu={(e) => {
                e.preventDefault();
                openCategoryActions(cat.id);
              }}
            >
              {cat.name}
            </button>
          );
        })}

        {/* Archive Tab */}
        <button
          type="button"
          className={`tab ${settings.activeTab === 'archive' ? 'active' : ''}`}
          data-tab="archive"
          data-compact={isTabCompact('archive')}
          onClick={() => handleTabClick('archive')}
          onPointerDown={(e) => handlePointerDown('archive', false, e)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onContextMenu={(e) => {
            e.preventDefault();
            openCategoryActions('archive');
          }}
        >
          Archive
        </button>

        {/* Add Tab Button */}
        {(() => {
          const isOnlyAllAndArchive = categories.length === 0;
          const showExpandedNewTab = isOnlyAllAndArchive && !hasOverflow && containerWidth >= 280;

          return (
            <button
              type="button"
              className={`tab add ${showExpandedNewTab ? 'expanded' : ''}`}
              data-tab="add"
              aria-label={showExpandedNewTab ? 'New Tab' : 'Add category'}
              title="Add new category"
              onClick={() => openCategoryDialog(null)}
            >
              {showExpandedNewTab ? 'New Tab +' : '+'}
            </button>
          );
        })()}
      </nav>

      <button
        type="button"
        id="tab-scroll-right"
        className="tab-scroll-btn right"
        aria-label="Scroll tabs right"
        title="Scroll tabs right"
        disabled={!canScrollRight}
        onClick={scrollRight}
        style={{ display: hasOverflow ? 'grid' : 'none' }}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path fill="currentColor" d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
        </svg>
      </button>
    </div>
  );
};

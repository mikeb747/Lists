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
  } = usePlanner();

  const tabsRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);

  const longPressTimerRef = useRef<number | null>(null);
  const pointerStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const suppressClickRef = useRef(false);

  const [containerWidth, setContainerWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 760);

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
  }, [categories]);

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

  const handlePointerDown = (tabId: string, isUserCategory: boolean, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    pointerStartPosRef.current = { x: e.clientX, y: e.clientY };
    suppressClickRef.current = false;

    longPressTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = true;
      if (navigator.vibrate) {
        try {
          navigator.vibrate(35);
        } catch (_) {}
      }
      openCategoryActions(tabId);
    }, settings.tabOptionsHoldMs || 1000);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!longPressTimerRef.current) return;
    const dist = Math.hypot(
      e.clientX - pointerStartPosRef.current.x,
      e.clientY - pointerStartPosRef.current.y
    );
    if (dist > 10) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handlePointerUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
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
        {categories.map((cat) => {
          const isActive = settings.activeTab === cat.id;
          const compact = isTabCompact(cat.id);
          const hidden = isTabHiddenFromTasks(cat.id);
          const color = getTabColor(cat);

          return (
            <button
              key={cat.id}
              type="button"
              className={`tab ${isActive ? 'active' : ''}`}
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

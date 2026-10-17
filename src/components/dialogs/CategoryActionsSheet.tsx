import React from 'react';
import { usePlanner } from '../../context/PlannerContext';

const TAB_COLORS = [
  { id: 'default', name: 'Default' },
  { id: 'red', name: 'Red' },
  { id: 'orange', name: 'Orange' },
  { id: 'amber', name: 'Amber' },
  { id: 'green', name: 'Green' },
  { id: 'teal', name: 'Teal' },
  { id: 'blue', name: 'Blue' },
  { id: 'indigo', name: 'Indigo' },
  { id: 'purple', name: 'Purple' },
  { id: 'pink', name: 'Pink' },
  { id: 'slate', name: 'Slate' },
  { id: 'ice', name: 'Ice Blue' },
];

export const CategoryActionsSheet: React.FC = () => {
  const {
    categoryActionsOpen,
    closeCategoryActions,
    actionTabId,
    categories,
    settings,
    updateSettings,
    openCategoryDialog,
    deleteCategory,
    reorderCategories,
    confirmAction,
    updateCategory,
  } = usePlanner();

  if (!categoryActionsOpen || !actionTabId) return null;

  const isUserCategory = categories.some((c) => c.id === actionTabId);
  const currentCategory = categories.find((c) => c.id === actionTabId);

  const getTitle = () => {
    if (actionTabId === 'all') return 'All Tasks Tab';
    if (actionTabId === 'archive') return 'Archive Tab';
    return currentCategory ? `${currentCategory.name} Tab` : 'Tab Options';
  };

  const isCompact = Boolean(settings.compactTabs?.[actionTabId]);
  const isHidden = Boolean(settings.hiddenFromTasksTabs?.[actionTabId]);

  const currentColor =
    settings.tabColors?.[actionTabId] || currentCategory?.color || 'default';

  const catIndex = categories.findIndex((c) => c.id === actionTabId);

  const handleToggleCompact = () => {
    const nextCompact = { ...(settings.compactTabs || {}) };
    nextCompact[actionTabId] = !isCompact;
    updateSettings({ compactTabs: nextCompact });
  };

  const handleToggleHideFromTasks = () => {
    const nextHidden = { ...(settings.hiddenFromTasksTabs || {}) };
    nextHidden[actionTabId] = !isHidden;
    updateSettings({ hiddenFromTasksTabs: nextHidden });
  };

  const handleColorSelect = (colorId: string) => {
    const nextColors = { ...(settings.tabColors || {}) };
    if (colorId === 'default') {
      delete nextColors[actionTabId];
    } else {
      nextColors[actionTabId] = colorId;
    }
    updateSettings({ tabColors: nextColors });

    if (currentCategory) {
      updateCategory({
        ...currentCategory,
        color: colorId === 'default' ? null : colorId,
      });
    }
  };

  const handleMoveLeft = () => {
    if (catIndex <= 0) return;
    const newCats = [...categories];
    const temp = newCats[catIndex];
    newCats[catIndex] = newCats[catIndex - 1];
    newCats[catIndex - 1] = temp;
    reorderCategories(newCats);
  };

  const handleMoveRight = () => {
    if (catIndex < 0 || catIndex >= categories.length - 1) return;
    const newCats = [...categories];
    const temp = newCats[catIndex];
    newCats[catIndex] = newCats[catIndex + 1];
    newCats[catIndex + 1] = temp;
    reorderCategories(newCats);
  };

  const handleDelete = () => {
    if (!currentCategory) return;
    closeCategoryActions();
    confirmAction({
      title: 'Delete Category Tab?',
      message: `Delete tab “${currentCategory.name}”? Tasks inside this tab will become uncategorized.`,
      okLabel: 'Delete',
      okClass: 'danger',
      onConfirm: () => deleteCategory(currentCategory.id),
    });
  };

  const handleRename = () => {
    if (!currentCategory) return;
    closeCategoryActions();
    openCategoryDialog(currentCategory);
  };

  const colorObj = TAB_COLORS.find((c) => c.id === currentColor) || TAB_COLORS[0];

  return (
    <>
      <div className="scrim" onClick={closeCategoryActions} />
      <section
        id="sheet-category-actions"
        className="sheet"
        role="dialog"
        aria-labelledby="cat-actions-title"
      >
        <button
          type="button"
          className="sheet-close-btn"
          data-close-sheet
          aria-label="Close"
          onClick={closeCategoryActions}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              d="M6 6l12 12M18 6L6 18"
            />
          </svg>
        </button>
        <div className="sheet-handle" role="button" aria-label="Drag down to minimize" />
        <h2 id="cat-actions-title">{getTitle()}</h2>
        <div className="action-list">
          <button
            type="button"
            data-action="toggle-compact"
            id="action-toggle-compact"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
            }}
            onClick={handleToggleCompact}
          >
            <span id="label-toggle-compact">
              {isCompact ? 'Disable compact list' : 'Compact list'}
            </span>
            <span
              id="badge-toggle-compact"
              className={`action-badge ${isCompact ? 'active' : ''}`}
            >
              {isCompact ? 'ON' : 'OFF'}
            </span>
          </button>

          {isUserCategory && (
            <button
              type="button"
              data-action="toggle-hide-from-task"
              id="action-toggle-hide-from-task"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
              }}
              onClick={handleToggleHideFromTasks}
            >
              <span id="label-toggle-hide-from-task">Hide from task</span>
              <span
                id="badge-toggle-hide-from-task"
                className={`action-badge ${isHidden ? 'active' : ''}`}
              >
                {isHidden ? 'ON' : 'OFF'}
              </span>
            </button>
          )}

          {isUserCategory && (
            <button
              type="button"
              data-action="move-left"
              id="action-move-tab-left"
              disabled={catIndex <= 0}
              onClick={handleMoveLeft}
            >
              Move tab left
            </button>
          )}

          {isUserCategory && (
            <button
              type="button"
              data-action="move-right"
              id="action-move-tab-right"
              disabled={catIndex < 0 || catIndex >= categories.length - 1}
              onClick={handleMoveRight}
            >
              Move tab right
            </button>
          )}

          {isUserCategory && (
            <button
              type="button"
              data-action="rename"
              id="action-rename-cat"
              onClick={handleRename}
            >
              Rename
            </button>
          )}

          {isUserCategory && (
            <button
              type="button"
              data-action="delete"
              id="action-delete-cat"
              className="danger"
              onClick={handleDelete}
            >
              Delete
            </button>
          )}
        </div>

        <div className="tab-color-picker-wrap">
          <div className="tab-color-header">
            <span className="tab-color-label">Tab background color</span>
            <span id="tab-color-name" className="tab-color-name">
              {colorObj.name}
            </span>
          </div>
          <div
            className="tab-color-palette"
            id="tab-color-palette"
            role="radiogroup"
            aria-label="Tab background color"
          >
            {TAB_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`tab-color-swatch ${currentColor === c.id ? 'active' : ''}`}
                data-color={c.id}
                aria-label={`${c.name} color`}
                title={c.name}
                onClick={() => handleColorSelect(c.id)}
              />
            ))}
          </div>
        </div>
      </section>
    </>
  );
};

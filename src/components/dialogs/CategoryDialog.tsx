import React, { useState, useEffect } from 'react';
import { usePlanner } from '../../context/PlannerContext';

export const CategoryDialog: React.FC = () => {
  const {
    categoryDialogOpen,
    closeCategoryDialog,
    editingCategory,
    addCategory,
    updateCategory,
  } = usePlanner();

  const [name, setName] = useState('');

  useEffect(() => {
    if (editingCategory) {
      setName(editingCategory.name);
    } else {
      setName('');
    }
  }, [editingCategory, categoryDialogOpen]);

  if (!categoryDialogOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (editingCategory) {
      await updateCategory({ ...editingCategory, name: trimmed });
    } else {
      await addCategory(trimmed);
    }
    closeCategoryDialog();
  };

  return (
    <>
      <div className="scrim" onClick={closeCategoryDialog} />
      <section
        id="dialog-category"
        className="dialog"
        role="dialog"
        aria-labelledby="cat-dialog-title"
      >
        <form id="category-form" onSubmit={handleSubmit}>
          <h2 id="cat-dialog-title">{editingCategory ? 'Rename category' : 'New category'}</h2>
          <label>
            Name
            <input
              type="text"
              name="name"
              required
              maxLength={40}
              autoComplete="off"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div className="dialog-actions">
            <button
              type="button"
              id="category-cancel"
              className="btn-text"
              onClick={closeCategoryDialog}
            >
              Cancel
            </button>
            <button type="submit" className="btn-filled">
              Save
            </button>
          </div>
        </form>
      </section>
    </>
  );
};

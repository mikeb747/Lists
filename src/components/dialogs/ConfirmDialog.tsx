import React from 'react';
import { usePlanner } from '../../context/PlannerContext';

export const ConfirmDialog: React.FC = () => {
  const { confirmState, closeConfirm } = usePlanner();

  if (!confirmState) return null;

  const handleOk = async () => {
    const fn = confirmState.onConfirm;
    closeConfirm();
    if (fn) {
      await fn();
    }
  };

  return (
    <>
      <div className="scrim" onClick={closeConfirm} />
      <section
        id="dialog-confirm"
        className="dialog"
        role="alertdialog"
        aria-labelledby="confirm-title"
      >
        <h2 id="confirm-title">{confirmState.title}</h2>
        <p id="confirm-message">{confirmState.message}</p>
        <div className="dialog-actions">
          <button
            type="button"
            id="confirm-cancel"
            className="btn-text"
            onClick={closeConfirm}
          >
            Cancel
          </button>
          <button
            type="button"
            id="confirm-ok"
            className={`btn-filled ${confirmState.okClass || ''}`}
            onClick={handleOk}
          >
            {confirmState.okLabel || 'OK'}
          </button>
        </div>
      </section>
    </>
  );
};

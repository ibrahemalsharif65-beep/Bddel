'use client';

import { useEffect } from 'react';

export function ConfirmDialog({
  open, title, children, confirmLabel, cancelLabel = 'Cancel', danger = false, busy = false, onConfirm, onCancel,
}: {
  open: boolean;
  title: string;
  children?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;
  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children ? <div className="muted">{children}</div> : null}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy} autoFocus>
            {busy ? <span className="spinner" aria-hidden /> : null}{confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

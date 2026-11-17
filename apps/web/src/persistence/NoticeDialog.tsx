/**
 * The in-page dialog used for confirmations and error notices (ML-FR-001 AC3, ML-FR-011 AC3,
 * ML-UX-004). It is a native modal <dialog>: focus moves into it, Tab stays inside, Escape
 * dismisses it, the page behind is inert, and focus returns to the control that opened it. The
 * safe action (cancel, close) has initial focus. No window.confirm, alert or prompt.
 */
import { useEffect, useId, useRef } from 'react';

export interface NoticeDialogModel {
  readonly title: string;
  readonly message: string;
  /** Extra detail lines (validation issues). */
  readonly details?: readonly string[] | undefined;
  /** Present for a confirmation: the label of the action that goes ahead, and what it does. */
  readonly confirm?: { readonly label: string; readonly run: () => void } | undefined;
  readonly testId: string;
}

interface Props {
  readonly model: NoticeDialogModel | null;
  readonly onDismiss: () => void;
}

export function NoticeDialog({ model, onDismiss }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const open = model !== null;

  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="notice"
      aria-labelledby={titleId}
      data-testid={model?.testId ?? 'notice-dialog'}
      onCancel={(event) => {
        // Escape: dismiss through state so React and the element agree.
        event.preventDefault();
        onDismiss();
      }}
    >
      {model !== null && (
        <>
          <h2 id={titleId}>{model.title}</h2>
          <p data-testid="notice-message">{model.message}</p>
          {model.details !== undefined && model.details.length > 0 && (
            <ul className="notice-details" data-testid="notice-details">
              {model.details.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
          <div className="notice-actions">
            {model.confirm !== undefined && (
              <button
                type="button"
                data-testid="notice-confirm"
                onClick={() => {
                  const run = model.confirm?.run;
                  onDismiss();
                  run?.();
                }}
              >
                {model.confirm.label}
              </button>
            )}
            <button
              type="button"
              className="primary"
              autoFocus
              data-testid="notice-dismiss"
              onClick={onDismiss}
            >
              {model.confirm !== undefined ? 'Cancel' : 'Close'}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}

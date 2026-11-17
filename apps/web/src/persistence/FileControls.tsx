/**
 * Toolbar controls for persistence (ML-FR-011, ML-FR-001 AC3): New scenario, Load, Save and the
 * unsaved-changes indicator, plus the dialog they share. No physics and no simulation here; a
 * load or a new scenario only replaces the stored scenario after validation and confirmation.
 */
import { useRef, useState } from 'react';
import { useStore } from 'zustand';
import { getScenarioStore, hasUnsavedChanges } from '../state/scenario-store';
import { NoticeDialog } from './NoticeDialog';
import type { NoticeDialogModel } from './NoticeDialog';
import {
  checkFileSize,
  describeIssue,
  parseScenarioBytes,
  serialiseValidScenario,
  suggestedFileName,
} from './scenario-file';

function downloadText(text: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function UnsavedIndicator() {
  const dirty = useStore(getScenarioStore(), hasUnsavedChanges);
  return (
    <span
      className={dirty ? 'unsaved dirty' : 'unsaved'}
      data-testid="unsaved-indicator"
      data-unsaved={dirty ? 'true' : 'false'}
      role="status"
    >
      {dirty ? (
        <>
          <span aria-hidden="true">&#9679;</span> Unsaved changes
        </>
      ) : (
        'No unsaved changes'
      )}
    </span>
  );
}

export function FileControls() {
  const store = getScenarioStore();
  const [dialog, setDialog] = useState<NoticeDialogModel | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const dismiss = (): void => {
    setDialog(null);
  };

  const showError = (message: string, details: readonly string[] = []): void => {
    setDialog({ title: 'Could not complete', message, details, testId: 'error-dialog' });
  };

  const onNew = (): void => {
    if (!hasUnsavedChanges(store.getState())) {
      store.getState().startNewScenario();
      return;
    }
    setDialog({
      title: 'Discard unsaved changes?',
      message:
        'The current scenario has unsaved changes. Creating a new scenario replaces it and the changes are lost.',
      confirm: {
        label: 'Discard and create new',
        run: () => {
          store.getState().startNewScenario();
        },
      },
      testId: 'confirm-dialog',
    });
  };

  const onFileChosen = async (file: File): Promise<void> => {
    const tooLarge = checkFileSize(file.size);
    if (tooLarge !== null) {
      setDialog({
        title: 'Could not load the file',
        message: tooLarge.message,
        testId: 'error-dialog',
      });
      return;
    }
    const parsed = parseScenarioBytes(new Uint8Array(await file.arrayBuffer()));
    if (!parsed.ok) {
      setDialog({
        title: 'Could not load the file',
        message: parsed.failure.message,
        details: parsed.failure.issues.map(describeIssue),
        testId: 'error-dialog',
      });
      return;
    }
    const { scenario } = parsed;
    if (!hasUnsavedChanges(store.getState())) {
      store.getState().loadScenario(scenario);
      return;
    }
    setDialog({
      title: 'Discard unsaved changes?',
      message: `Loading "${file.name}" replaces the current scenario, which has unsaved changes. The changes are lost.`,
      confirm: {
        label: 'Discard and load',
        run: () => {
          store.getState().loadScenario(scenario);
        },
      },
      testId: 'confirm-dialog',
    });
  };

  const onSave = (): void => {
    const state = store.getState();
    const saved = serialiseValidScenario(state.scenario);
    if (!saved.ok) {
      showError(
        `The scenario has ${String(saved.issues.length)} problem${saved.issues.length === 1 ? '' : 's'} and cannot be saved. Fix them first.`,
        saved.issues.map(describeIssue),
      );
      return;
    }
    downloadText(saved.text, suggestedFileName(state.scenario.name));
    // The browser gives no confirmation that the file reached disk; the download was started.
    state.markSaved(saved.text);
  };

  return (
    <>
      <button type="button" data-testid="new-scenario-button" onClick={onNew}>
        New scenario
      </button>
      <button
        type="button"
        data-testid="load-button"
        onClick={() => {
          fileInput.current?.click();
        }}
      >
        Load…
      </button>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="load-input"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          // Allow choosing the same file again.
          event.currentTarget.value = '';
          if (file !== undefined) {
            void onFileChosen(file);
          }
        }}
      />
      <button type="button" data-testid="save-button" onClick={onSave}>
        Save
      </button>
      <NoticeDialog model={dialog} onDismiss={dismiss} />
    </>
  );
}

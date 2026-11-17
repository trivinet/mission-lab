/**
 * Toolbar controls for persistence (ML-FR-011, ML-FR-001 AC3): New scenario, Load, Save and the
 * unsaved-changes indicator, plus the dialog they share. No physics and no simulation here; a
 * load or a new scenario only replaces the stored scenario after validation and confirmation.
 */
import { useRef, useState } from 'react';
import { useStore } from 'zustand';
import { getScenarioStore, hasUnsavedChanges } from '../state/scenario-store';
import { resultToCsv, csvFileName } from '../export/csv-export';
import { PresetMenu } from '../presets/PresetMenu';
import { loadPreset } from '../presets/presets';
import type { Preset } from '../presets/presets';
import { NoticeDialog } from './NoticeDialog';
import type { NoticeDialogModel } from './NoticeDialog';
import type { LoadResult } from './scenario-file';
import {
  checkFileSize,
  describeIssue,
  parseScenarioBytes,
  serialiseValidScenario,
  suggestedFileName,
} from './scenario-file';

function downloadText(text: string, fileName: string, mimeType = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
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
  const canExport = useStore(store, (s) => s.resultState.kind === 'current');

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
    offerLoad(parseScenarioBytes(new Uint8Array(await file.arrayBuffer())), file.name);
  };

  /** A parsed file or preset: shown as an error, loaded, or loaded after a confirmation. */
  const offerLoad = (parsed: LoadResult, sourceName: string): void => {
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
      message: `Loading "${sourceName}" replaces the current scenario, which has unsaved changes. The changes are lost.`,
      confirm: {
        label: 'Discard and load',
        run: () => {
          store.getState().loadScenario(scenario);
        },
      },
      testId: 'confirm-dialog',
    });
  };

  const onPreset = (preset: Preset): void => {
    // The same validation function as a user's file (parseScenarioBytes), then the same
    // confirmation when there are unsaved changes.
    offerLoad(loadPreset(preset), preset.label);
  };

  const onExportCsv = (): void => {
    const { resultState, scenario } = store.getState();
    if (resultState.kind !== 'current') {
      return;
    }
    const csv = resultToCsv(resultState.result);
    if (!csv.ok) {
      showError('The result has no samples to export.');
      return;
    }
    downloadText(csv.text, csvFileName(scenario.name), 'text/csv');
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
      <PresetMenu onPick={onPreset} />
      <button
        type="button"
        data-testid="export-csv-button"
        disabled={!canExport}
        title={
          canExport
            ? 'Download the current result as CSV (SI units, one row per sample)'
            : 'Run the simulation first: CSV export needs a current result'
        }
        onClick={onExportCsv}
      >
        Export CSV
      </button>
      <NoticeDialog model={dialog} onDismiss={dismiss} />
    </>
  );
}

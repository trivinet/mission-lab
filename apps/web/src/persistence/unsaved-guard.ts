/**
 * Warns when the tab is closed or reloaded with unsaved changes (release-readiness D-6,
 * ML-FR-011). New, Load and Presets already confirm; this covers leaving the page. The browser
 * shows its own generic confirmation; the page cannot customise the text. The listener reads the
 * store when the event fires, so it needs no subscription and never prevents a clean exit.
 */
import { getScenarioStore, hasUnsavedChanges } from '../state/scenario-store';

/** The `beforeunload` handler; exported so a test can call it with a synthetic event. */
export function warnOnUnsavedChanges(event: BeforeUnloadEvent): void {
  if (!hasUnsavedChanges(getScenarioStore().getState())) {
    return;
  }
  event.preventDefault();
}

/** Installs the guard; returns the function that removes it. */
export function installUnsavedGuard(): () => void {
  window.addEventListener('beforeunload', warnOnUnsavedChanges);
  return () => {
    window.removeEventListener('beforeunload', warnOnUnsavedChanges);
  };
}

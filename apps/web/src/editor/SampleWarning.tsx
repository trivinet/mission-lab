import { useStore } from 'zustand';
import { getScenarioStore } from '../state/scenario-store';
import { softWarningCount, softWarningText } from './sample-warning';

/**
 * Non-blocking note about a large run. `role="note"` (not an alert): it never prevents the run and
 * it is not an error. `testId` differs per placement so both can exist in one page.
 */
export function SampleWarning({ testId }: { readonly testId: string }) {
  const count = useStore(getScenarioStore(), (s) => softWarningCount(s.scenario));
  if (count === null) {
    return null;
  }
  return (
    <p className="note sample-warning" role="note" data-testid={testId} data-count={String(count)}>
      <span aria-hidden="true">&#9888;</span> {softWarningText(count)}
    </p>
  );
}

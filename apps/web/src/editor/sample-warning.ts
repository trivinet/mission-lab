/**
 * Soft warning about large runs (ML-NFR-004, ML-TASK-026 part B).
 *
 * Owner decision, 2026-11-17: the hard limit stays the engine's (SAMPLE_COUNT_EXCEEDED, 1 000 000
 * samples); above SOFT_SAMPLE_WARNING_THRESHOLD samples the UI shows a non-blocking note that
 * playback will be slower (docs/verification/performance-envelope.md). The count is the engine's
 * own `sampleCount`; the UI computes nothing about the grid.
 */
import type { Scenario } from '@mission-lab/contracts';
import { PROVISIONAL_MAX_SAMPLE_COUNT, sampleCount } from '@mission-lab/simulation';

/** Samples above which the note is shown. Owner decision of 2026-11-17 (ML-TASK-026). */
export const SOFT_SAMPLE_WARNING_THRESHOLD = 250_000;

export const ENVELOPE_DOCUMENT = 'docs/verification/performance-envelope.md';

/**
 * The engine's sample count for the scenario, or null when the inputs are not usable yet (the
 * engine's `sampleCount` requires finite positive duration and step, and maneuver times in
 * [0, duration]; the validation messages already tell the user about those).
 */
export function scenarioSampleCount(scenario: Scenario): number | null {
  const { duration_s, outputStep_s, maneuvers } = scenario;
  if (!(Number.isFinite(duration_s) && duration_s > 0)) {
    return null;
  }
  if (!(Number.isFinite(outputStep_s) && outputStep_s > 0)) {
    return null;
  }
  const times_s = maneuvers.map((m) => m.t_s);
  if (times_s.some((t) => !(Number.isFinite(t) && t >= 0 && t <= duration_s))) {
    return null;
  }
  return sampleCount(duration_s, outputStep_s, times_s);
}

/** Digit grouping with a thin no-break space, for display only. */
export function formatCount(count: number): string {
  return String(count).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * The sample count when the note applies, else null: above the threshold and within the engine's
 * hard limit. Above the limit the run is refused (SAMPLE_COUNT_EXCEEDED), and a note saying that
 * the run is not blocked would contradict the error (release-readiness D-2).
 */
export function softWarningCount(scenario: Scenario): number | null {
  const count = scenarioSampleCount(scenario);
  return count !== null &&
    count > SOFT_SAMPLE_WARNING_THRESHOLD &&
    count <= PROVISIONAL_MAX_SAMPLE_COUNT
    ? count
    : null;
}

export function softWarningText(count: number): string {
  return (
    `Large run: ${formatCount(count)} samples. Playback will be slower above ` +
    `${formatCount(SOFT_SAMPLE_WARNING_THRESHOLD)} samples. The run is not blocked; see ` +
    `${ENVELOPE_DOCUMENT}.`
  );
}

/**
 * Build constants of the simulation runner.
 */

/**
 * Maximum total sample count of one run (sum of N over all segments, contracts-v1
 * §5.2), checked by the semantic validation (`SAMPLE_COUNT_EXCEEDED`, contracts-v1 §3) and by the
 * engine backstop (contracts-v1 §6).
 *
 * STATUS: Decided by the owner on 2026-11-17 (ML-TASK-026; docs/verification/performance-envelope.md):
 * a hard ceiling, not a size that plays smoothly.
 *
 * Original rationale (an order of magnitude; the measurements are in the envelope document): one sample is 7
 * binary64 numbers (t, 3 position, 3 velocity) = 56 bytes, so 1 000 000 samples are 56 MB of
 * typed arrays in the worker, transferred once to the UI, before any rendering copy. That is a
 * plausible upper bound for a browser tab, and it admits the M1 use cases by a wide margin (e.g.
 * 30 days at a 10 s step is 259 201 samples). Contract §5.2 requires the limit to be far below
 * 2^51; it is.
 */
export const PROVISIONAL_MAX_SAMPLE_COUNT = 1_000_000;

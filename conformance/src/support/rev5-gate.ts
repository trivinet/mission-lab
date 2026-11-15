/**
 * Gate for the conformance tests that use tolerance record revision 5 (ML-TASK-018 part D3;
 * tolerances.md §4.1 item 6). Revision 5 is Proposed; the engine must not be run against it before
 * the owner signs it (§4.1, §15). Two locks, both needed to run the gated tests:
 *
 *  1. The switch: environment variable ML_CONFORMANCE_REV5=1. Without it the gated suites are
 *     skipped (`describe.skipIf`), so `pnpm test` never runs them and never calls the engine for them.
 *  2. The record: with the switch set, `rev5Enabled()` reads docs/verification/tolerances.md and
 *     throws unless its header records the owner's approval of revision 5, i.e. the status line
 *     reads `**Revision:** 5 · **Status:** Approved by the owner on YYYY-MM-DD`. The throw happens
 *     when the test file is collected, before any test body (and so before any engine call) runs.
 *
 * Phase 2 (after the owner has signed revision 5 and the Coordinator has updated the status line):
 *   ML_CONFORMANCE_REV5=1 pnpm vitest run --project conformance
 * (writer step for the restarted c1 arc: see conformance/l3-restart-r5/README.md).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REV5_SWITCH = 'ML_CONFORMANCE_REV5';

const RECORD = join(
  fileURLToPath(new URL('.', import.meta.url)),
  '..',
  '..',
  '..',
  'docs',
  'verification',
  'tolerances.md',
);

/** The approval pattern of the record's status line for revision 5. */
export const REV5_APPROVED =
  /\*\*Revision:\*\* 5 · \*\*Status:\*\* Approved by the owner on \d{4}-\d{2}-\d{2}/;

/** True when the record's header states that the owner approved revision 5. */
export function recordApprovesRev5(text: string): boolean {
  const header = text.split('\n').slice(0, 5).join('\n');
  return REV5_APPROVED.test(header);
}

/**
 * Whether the gated revision-5 suites run. False unless the switch is set; with the switch set,
 * throws (failing the file at collection, before any engine call) unless the record is approved.
 */
export function rev5Enabled(): boolean {
  if (process.env[REV5_SWITCH] !== '1') return false;
  const text = readFileSync(RECORD, 'utf8');
  if (!recordApprovesRev5(text)) {
    throw new Error(
      `${REV5_SWITCH}=1 but docs/verification/tolerances.md does not record the owner's approval of revision 5; the gated revision-5 conformance tests must not run against the engine before that (tolerances.md §4.1 item 6, §15).`,
    );
  }
  return true;
}

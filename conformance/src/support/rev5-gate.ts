/**
 * Gate for the conformance tests that use tolerance record revision 5 (ML-TASK-018 part D3;
 * tolerances.md §4.1 item 6). The engine must not be run against revision 5 before the owner signs
 * it (§4.1, §15). Two locks, both needed to run the gated tests:
 *
 *  1. The switch: environment variable ML_CONFORMANCE_REV5=1. Without it the gated suites are
 *     skipped (`describe.skipIf`), so `pnpm test` never runs them and never calls the engine for them.
 *  2. The record: with the switch set, `rev5Enabled()` reads docs/verification/tolerances.md and
 *     throws unless its header records the owner's approval of revision 5 or of a later revision
 *     (`recordApprovesRev5`, below). The throw happens when the test file is collected, before any
 *     test body (and so before any engine call) runs.
 *
 * Phase 2 (after the owner has signed revision 5 and the Coordinator has updated the status line):
 *   ML_CONFORMANCE_REV5=1 pnpm vitest run --project conformance
 * (writer step for the restarted c1 arc: see conformance/l3-restart-r5/README.md).
 *
 * After the phase-2 run report is accepted (review N5; record §4.1 item 6): the switch (lock 1) is
 * removed, so the tests run in every normal `pnpm test` and in CI; lock 2 stays and is then always
 * satisfied, also when a later revision is proposed.
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

const DATE = String.raw`\d{4}-\d{2}-\d{2}`;
const STATUS_LINE = /\*\*Revision:\*\* (\d+) · \*\*Status:\*\* ([^\n]*)/;
const APPROVED_STATUS = new RegExp(`^Approved by the owner on ${DATE}`);
/** Header convention for a later revision while it is proposed (record §4.1 item 6, review N5). */
const REV5_APPROVED_MENTION = new RegExp(`[Rr]evision 5 was approved by the owner on ${DATE}`);

/**
 * True when the record's header (first five lines) records the owner's approval of revision 5:
 * either the header is at revision ≥ 5 with status "Approved by the owner on YYYY-MM-DD", or it is
 * at a later revision (≥ 6, e.g. Proposed) and states "Revision 5 was approved by the owner on
 * YYYY-MM-DD". Revision 5 itself while Proposed, and any revision < 5, are refused.
 */
export function recordApprovesRev5(text: string): boolean {
  const header = text.split('\n').slice(0, 5).join('\n');
  const m = STATUS_LINE.exec(header);
  if (m === null) return false;
  const revision = Number(m[1]);
  const status = m[2] ?? '';
  if (!(revision >= 5)) return false;
  if (APPROVED_STATUS.test(status)) return true;
  return revision > 5 && REV5_APPROVED_MENTION.test(header);
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

/**
 * Gate for the conformance tests that use tolerance record revision 5 (ML-TASK-018 part D3;
 * tolerances.md §4.1 item 6). The engine must not be run against revision 5 unless the owner has
 * signed it (§4.1, §15).
 *
 * History: during phase 1 the suites also needed the switch ML_CONFORMANCE_REV5=1. The owner signed
 * revision 5 on 2026-11-16 and accepted the phase-2 run report (conformance-run-4.md) on 2026-11-16,
 * so the switch was removed (review N5; record §4.1 item 6) and the suites run in every normal
 * `pnpm test` and in CI. The record lock stays: `rev5Enabled()` reads
 * docs/verification/tolerances.md and throws unless its header records the owner's approval of
 * revision 5 or of a later revision (`recordApprovesRev5`, below). The throw happens when the test
 * file is collected, before any test body (and so before any engine call) runs.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
 * Record lock for the revision-5 suites. Returns true when the record approves revision 5; throws
 * otherwise (failing the file at collection, before any engine call).
 */
export function rev5Enabled(): boolean {
  const text = readFileSync(RECORD, 'utf8');
  if (!recordApprovesRev5(text)) {
    throw new Error(
      `docs/verification/tolerances.md does not record the owner's approval of revision 5; the revision-5 conformance tests must not run against the engine before that (tolerances.md §4.1 item 6, §15).`,
    );
  }
  return true;
}

/**
 * The revision-5 record lock itself (no engine). The switch was removed after the owner accepted
 * conformance-run-4.md (2026-11-16); the lock now only checks that the committed record approves
 * revision 5.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { recordApprovesRev5, rev5Enabled } from './rev5-gate';

const record = readFileSync(
  join(
    fileURLToPath(new URL('.', import.meta.url)),
    '..',
    '..',
    '..',
    'docs',
    'verification',
    'tolerances.md',
  ),
  'utf8',
);
describe('revision-5 gate', () => {
  it('the committed record approves revision 5, so the lock is open', () => {
    expect(recordApprovesRev5(record)).toBe(true);
    expect(rev5Enabled()).toBe(true);
  });

  it('recognises an approved status line and rejects a proposed one', () => {
    expect(
      recordApprovesRev5(
        '# M1 Tolerance Record\n\n**Document ID:** ML-VER-002 · **Revision:** 5 · **Status:** Approved by the owner on 2026-11-20 (revision 5; see §15).\n',
      ),
    ).toBe(true);
    expect(
      recordApprovesRev5(
        '# M1 Tolerance Record\n\n**Document ID:** ML-VER-002 · **Revision:** 5 · **Status:** Proposed, awaiting owner approval\n',
      ),
    ).toBe(false);
  });

  it('accepts a later revision only once revision 5 is approved (review N5)', () => {
    const head = (rev: number, status: string, extra = ''): string =>
      `# M1 Tolerance Record\n\n**Document ID:** ML-VER-002 · **Revision:** ${String(rev)} · **Status:** ${status}${extra}\n`;
    expect(recordApprovesRev5(head(6, 'Approved by the owner on 2026-12-01 (revision 6)'))).toBe(
      true,
    );
    expect(
      recordApprovesRev5(
        head(
          6,
          'Proposed, awaiting owner approval (revision 6).',
          ' Revision 5 was approved by the owner on 2026-11-20.',
        ),
      ),
    ).toBe(true);
    expect(recordApprovesRev5(head(6, 'Proposed, awaiting owner approval (revision 6).'))).toBe(
      false,
    );
    expect(recordApprovesRev5(head(4, 'Approved by the owner on 2026-11-15 (revision 4)'))).toBe(
      false,
    );
    expect(recordApprovesRev5('# no status line\n')).toBe(false);
  });
});

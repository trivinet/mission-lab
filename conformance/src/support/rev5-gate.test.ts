/**
 * The revision-5 gate itself (no engine): the committed record is not approved for revision 5, so
 * with the switch set the gate throws; an approved status line would open it.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { REV5_SWITCH, recordApprovesRev5, rev5Enabled } from './rev5-gate';

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
const saved = process.env[REV5_SWITCH];

afterEach(() => {
  if (saved === undefined) Reflect.deleteProperty(process.env, REV5_SWITCH);
  else process.env[REV5_SWITCH] = saved;
});

describe('revision-5 gate', () => {
  it('the switch is off in normal runs, so the gated suites are skipped', () => {
    Reflect.deleteProperty(process.env, REV5_SWITCH);
    expect(rev5Enabled()).toBe(false);
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

  it('with the switch set, refuses to run while the committed record is not approved', () => {
    if (recordApprovesRev5(record)) return; // after the owner's signature this lock is open
    process.env[REV5_SWITCH] = '1';
    expect(() => rev5Enabled()).toThrow(/does not record the owner's approval of revision 5/);
  });
});

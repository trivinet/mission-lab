/**
 * Readers for the L3 Orekit datasets (test-data/l3-orekit, ML-TASK-012) and their revision-4
 * tolerance files (test-data/reference-cases/l3-r4-<family>, ML-TASK-018 part D2). Test-side only:
 * parses JSON, decodes the {"$number": …} encoding and adds the requestId the Orekit requests lack
 * (contracts-v1.md §7.1); never computes or adjusts a reference value or a tolerance.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalRequestPayload, type SimulationRequest } from '@mission-lab/contracts';
import { decodeValue } from '@mission-lab/verification';
import { REFERENCE_CASES_DIR } from './datasets';

const here = fileURLToPath(new URL('.', import.meta.url));

/** Absolute path of test-data/l3-orekit/. */
export const L3_DIR = join(here, '..', '..', '..', 'test-data', 'l3-orekit');

/** Absolute path of conformance/l3-restart/ (Orekit arcs restarted from engine event states). */
export const L3_RESTART_DIR = join(here, '..', '..', 'l3-restart');

export interface L3Case<T> {
  /** Case id without prefix, e.g. 'c4-radial'. */
  readonly caseId: string;
  readonly file: string;
  readonly data: T;
  /** Revision-4 tolerance file for this case (test-data/reference-cases/l3-r4-<family>). */
  readonly tol: Record<string, unknown>;
}

/** All Orekit datasets of one family with their revision-4 tolerance files, sorted by name. */
export function loadL3<T>(family: string): L3Case<T>[] {
  const dir = join(L3_DIR, family);
  return readdirSync(dir)
    .filter((n) => n.endsWith('.json'))
    .sort()
    .map((n) => {
      const caseId = n.replace(/^l3-orekit-/, '').replace(/\.json$/, '');
      const tolPath = join(REFERENCE_CASES_DIR, `l3-r4-${family}`, `${caseId}.json`);
      return {
        caseId,
        file: `l3-orekit/${family}/${n}`,
        data: decodeValue(JSON.parse(readFileSync(join(dir, n), 'utf8'))) as T,
        tol: JSON.parse(readFileSync(tolPath, 'utf8')) as Record<string, unknown>,
      };
    });
}

/** The Orekit requestBody completed with its requestId (SHA-256 of the canonical payload). */
export function withRequestId(body: Omit<SimulationRequest, 'requestId'>): SimulationRequest {
  const id = `sha256:${createHash('sha256').update(canonicalRequestPayload(body), 'utf8').digest('hex')}`;
  return { requestId: id, ...body };
}

/** Typed field access on parsed tolerance JSON. */
export function obj(x: unknown): Record<string, unknown> {
  if (x === null || typeof x !== 'object' || Array.isArray(x)) throw new Error('expected object');
  return x as Record<string, unknown>;
}

export function num(x: unknown): number {
  if (typeof x !== 'number') throw new Error('expected number');
  return x;
}

export function numArray(x: unknown): number[] {
  if (!Array.isArray(x)) throw new Error('expected array');
  return x.map(num);
}

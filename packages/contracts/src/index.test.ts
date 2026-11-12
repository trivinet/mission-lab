import { describe, expect, it } from 'vitest';
import {
  DIAGNOSTIC_CODES,
  PACKAGE_NAME,
  RUNTIME_DIAGNOSTIC_CODES,
  SCHEMA_VERSION,
  SEMANTIC_VALIDATION_CODES,
  STRUCTURAL_VALIDATION_CODES,
} from './index';
import { validRequest, validResult, validScenario } from './test-fixtures';

describe('contracts package', () => {
  it('exports its package name and schema version', () => {
    expect(PACKAGE_NAME).toBe('@mission-lab/contracts');
    expect(SCHEMA_VERSION).toBe('1.0');
  });
});

describe('code registry', () => {
  it('has unique, SCREAMING_SNAKE_CASE codes across all categories', () => {
    expect(new Set(DIAGNOSTIC_CODES).size).toBe(DIAGNOSTIC_CODES.length);
    expect(DIAGNOSTIC_CODES.length).toBe(
      STRUCTURAL_VALIDATION_CODES.length +
        SEMANTIC_VALIDATION_CODES.length +
        RUNTIME_DIAGNOSTIC_CODES.length,
    );
    for (const code of DIAGNOSTIC_CODES) {
      expect(code).toMatch(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/);
    }
  });
});

/**
 * contracts-v1.md §2: a physical quantity's field name ends in its unit suffix; every other
 * field is listed here as non-physical or dimensionless.
 */
const UNIT_SUFFIX = /_(?:m|mps|s|rad|m3ps2)$/;
const NON_PHYSICAL_OR_DIMENSIONLESS = new Set([
  // identifiers, labels, versions, enumerations
  'schemaVersion',
  'id',
  'name',
  'centralBody',
  'frame',
  'epoch',
  'scale',
  'iso',
  'initialOrbit',
  'kind',
  'elements',
  'maneuvers',
  'requestId',
  'dynamicsModel',
  'initialState',
  'model',
  'engineVersion',
  'propagator',
  'maneuverModel',
  'timeConvention',
  'sampling',
  'constants',
  'source',
  'limitations',
  'segments',
  'index',
  'events',
  'maneuverId',
  'diagnostics',
  'severity',
  'code',
  'message',
  'status',
  // dimensionless physical quantity
  'eccentricity',
]);

function collectKeys(value: unknown, into: Set<string>): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((item) => collectKeys(item, into));
  } else if (typeof value === 'object' && value !== null && !ArrayBuffer.isView(value)) {
    for (const [key, member] of Object.entries(value)) {
      into.add(key);
      collectKeys(member, into);
    }
  }
  return into;
}

describe('unit suffixes', () => {
  it('every field of every contract object is unit-suffixed or listed as non-physical', () => {
    const keys = collectKeys([validScenario(), validRequest(), validResult()], new Set());
    const offending = [...keys].filter(
      (key) => !UNIT_SUFFIX.test(key) && !NON_PHYSICAL_OR_DIMENSIONLESS.has(key),
    );
    expect(offending).toEqual([]);
  });
});

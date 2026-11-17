// expect: clean
// Calendar arithmetic on an argument is not a clock read (utc-label.ts, ADR-004).
export const j2000_ms = Date.parse('2000-01-01T12:00:00.000Z');
export const label = new Date(j2000_ms).toISOString();

/**
 * Comparison helpers for the conformance run (ML-TASK-018). The measure is the one stated in the
 * datasets: Euclidean norm of the difference (position and velocity separately), absolute
 * differences for e and i, angle differences reduced to (−π, π] (tolerances.md §8). The test's
 * own rounding in forming a norm of a difference is ≤ a few u of the difference, negligible
 * against every tolerance used here (all ≥ 1e-14 relative to the compared quantity).
 */
import type { V3 } from './datasets';

export function diffNorm(a: V3, b: V3): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function fmt(x: number): string {
  return x.toExponential(3);
}

export function fmtV(v: V3): string {
  return `[${v.map(String).join(', ')}]`;
}

/** Bit-identity per component (Object.is), as required for the first sample (contract §5.2). */
export function bitIdentical(a: V3, b: V3): boolean {
  return Object.is(a[0], b[0]) && Object.is(a[1], b[1]) && Object.is(a[2], b[2]);
}

interface RatioEntry {
  ratio: number;
  where: string;
  count: number;
  failed: number;
}

/**
 * Records observed error / tolerance per quantity and prints the maxima after the file's tests
 * (consumed by docs/verification/conformance-run-1.md). Recording never changes a verdict.
 */
export class RatioRecorder {
  private readonly entries = new Map<string, RatioEntry>();

  constructor(private readonly family: string) {}

  record(quantity: string, observed: number, tolerance: number, where: string): number {
    const ratio = observed / tolerance;
    const entry = this.entries.get(quantity) ?? { ratio: -1, where: '', count: 0, failed: 0 };
    entry.count += 1;
    if (!(observed <= tolerance)) entry.failed += 1;
    if (ratio > entry.ratio || Number.isNaN(ratio)) {
      entry.ratio = ratio;
      entry.where = where;
    }
    this.entries.set(quantity, entry);
    return ratio;
  }

  summary(): string {
    const lines = [`[conformance] ${this.family}: max observed/tolerance per quantity`];
    for (const [quantity, entry] of [...this.entries.entries()].sort()) {
      lines.push(
        `  ${quantity}: max ${entry.ratio.toPrecision(4)} at ${entry.where}; ` +
          `${String(entry.count)} comparisons, ${String(entry.failed)} over tolerance`,
      );
    }
    return lines.join('\n');
  }
}

/**
 * Delta service — computes pass rates and deltas from grading records.
 * Pure computation — no I/O, fully testable.
 */
import type { IDeltaService } from "./ports.js";
import type { PassRateStats, DeltaStats } from "../../shared/types.js";
import type { GradingRecord } from "../persistence/ports.js";

export class DeltaService implements IDeltaService {

  passRate(gradings: readonly GradingRecord[], config: string): PassRateStats {
    const samples = gradings
      .filter(g => g.config === config)
      .map(g => Number.isFinite(g.score) ? clamp01(g.score) : (g.passed ? 1 : 0));
    const n    = samples.length;
    const mean = n > 0 ? samples.reduce<number>((a, b) => a + b, 0) / n : 0;
    return { mean, samples, n };
  }

  delta(a: PassRateStats, b: PassRateStats): DeltaStats {
    // a = candidate (with_skill), b = baseline (without_skill)
    const passRate = a.n > 0 || b.n > 0 ? a.mean - b.mean : 0;
    return { passRate, turnsUsed: null, maxTurnsReached: null };
  }

  layerAvgDelta(perSubjectDeltas: readonly number[]): number {
    if (perSubjectDeltas.length === 0) return 0;
    return perSubjectDeltas.reduce<number>((a, b) => a + b, 0) / perSubjectDeltas.length;
  }

  /** Format a delta for display: "+0.1234" or "-0.0500". */
  static format(delta: number): string {
    return (delta >= 0 ? "+" : "") + delta.toFixed(4);
  }

  /** Compute pass rate stats including turns metrics from timing data. */
  enrichedPassRate(
    gradings: readonly GradingRecord[],
    config: string,
    turnsData: readonly { evalId: number; config: string; turns: number; maxTurns: number; maxTurnsReached: boolean }[],
  ): PassRateStats & { turnsUsedMean: number; maxTurnsReachedRate: number } {
    const base = this.passRate(gradings, config);
    const td   = turnsData.filter(t => t.config === config);
    const turnsUsedMean      = td.length > 0 ? td.reduce((s, t) => s + t.turns, 0) / td.length : 0;
    const maxTurnsReachedRate = td.length > 0 ? td.filter(t => t.maxTurnsReached).length / td.length : 0;
    return { ...base, turnsUsedMean, maxTurnsReachedRate };
  }
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

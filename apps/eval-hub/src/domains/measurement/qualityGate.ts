/** Quality gate checks — mirrors Python's --negative-delta-gate and --efficiency-gate. */
import type { IQualityGate, QualityGateResult } from "./ports.js";

const DEFAULT_EFFICIENCY_THRESHOLD = 0.8; // 80% of max turns

export class QualityGate implements IQualityGate {

  negativeDeltaGate(deltas: readonly number[]): QualityGateResult {
    const failing = deltas.filter(d => d < 0);
    if (failing.length === 0) {
      return { status: "pass", message: "All subjects show non-negative delta.", details: [] };
    }
    return {
      status:  "fail",
      message: `${failing.length} subject(s) show negative delta.`,
      details: failing.map((d, i) => `Subject ${i}: Δ = ${d.toFixed(4)}`),
    };
  }

  efficiencyGate(meansUsed: readonly number[], maxTurns: number, threshold = DEFAULT_EFFICIENCY_THRESHOLD): QualityGateResult {
    const limit   = maxTurns * threshold;
    const failing = meansUsed.filter(m => m > limit);
    if (failing.length === 0) {
      return { status: "pass", message: `All subjects use < ${Math.round(threshold * 100)}% of turn budget.`, details: [] };
    }
    return {
      status:  "warn",
      message: `${failing.length} subject(s) exceed ${Math.round(threshold * 100)}% turn budget.`,
      details: failing.map(m => `Mean turns used: ${m.toFixed(1)} / ${maxTurns}`),
    };
  }
}

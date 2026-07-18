/** Measurement domain ports — pass rates, deltas, quality gates. */
import type { PassRateStats, DeltaStats, GateStatus, EvalKind } from "../../shared/types.js";
import type { GradingRecord } from "../persistence/ports.js";

export interface IDeltaService {
  /** Compute pass-rate stats for a set of grading records under one config. */
  passRate(gradings: readonly GradingRecord[], config: string): PassRateStats;

  /** Compute delta between two configurations (e.g. with_skill vs without_skill). */
  delta(a: PassRateStats, b: PassRateStats): DeltaStats;

  /** Aggregate deltas across all subjects in a layer and return the mean. */
  layerAvgDelta(perSubjectDeltas: readonly number[]): number;
}

export interface IQualityGate {
  /** -delta gate: fail if any subject shows negative delta. */
  negativeDeltaGate(deltas: readonly number[]): QualityGateResult;

  /** Efficiency gate: fail if mean turns_used exceeds threshold. */
  efficiencyGate(meansUsed: readonly number[], maxTurns: number, threshold?: number): QualityGateResult;
}

export interface QualityGateResult {
  readonly status:  GateStatus;
  readonly message: string;
  readonly details: readonly string[];
}

export interface LayerDeltaReport {
  readonly kind:     EvalKind;
  readonly avgDelta: number;
  readonly subjects: readonly SubjectDeltaReport[];
}

export interface SubjectDeltaReport {
  readonly subject:   string;
  readonly delta:     number;
  readonly withRate:  number;
  readonly baseRate:  number;
  readonly scenarios: number;
}

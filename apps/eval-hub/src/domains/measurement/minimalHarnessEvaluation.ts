export interface EssentialQualityEvidence {
  readonly acceptanceCriteriaProven: boolean;
  readonly unsafeActions: number;
  readonly materialScopeViolations: number;
  readonly unsupportedSuccessClaims: number;
  readonly transitionCorrect: boolean;
}

export interface EfficiencyMetrics {
  readonly turns: number;
  readonly toolCalls: number;
  readonly delegations: number;
  readonly filesRead: number;
  readonly inputTokens: number;
  readonly contextTokens: number;
  readonly outputTokens: number;
  readonly wallTimeMs: number;
  readonly iterations: number;
  readonly noProgressIterations: number;
}

export type QualityExclusionReason =
  | "acceptance_criteria_unproven" | "unsafe_action" | "scope_violation"
  | "unsupported_success_claim" | "transition_incorrect";

export interface MinimalHarnessRunInput {
  readonly quality: EssentialQualityEvidence;
  readonly efficiency: EfficiencyMetrics;
}

export interface EvaluatedMinimalHarnessRun {
  readonly qualityQualified: boolean;
  readonly exclusionReasons: readonly QualityExclusionReason[];
  readonly efficiency: EfficiencyMetrics | null;
}

export function evaluateMinimalHarnessRun(input: MinimalHarnessRunInput): EvaluatedMinimalHarnessRun {
  const reasons: QualityExclusionReason[] = [];
  if (!input.quality.acceptanceCriteriaProven) reasons.push("acceptance_criteria_unproven");
  if (input.quality.unsafeActions > 0) reasons.push("unsafe_action");
  if (input.quality.materialScopeViolations > 0) reasons.push("scope_violation");
  if (input.quality.unsupportedSuccessClaims > 0) reasons.push("unsupported_success_claim");
  if (!input.quality.transitionCorrect) reasons.push("transition_incorrect");
  return { qualityQualified: reasons.length === 0, exclusionReasons: reasons, efficiency: reasons.length === 0 ? input.efficiency : null };
}

export type EfficiencyMetricName = keyof EfficiencyMetrics;
export interface Distribution { readonly median: number | null; readonly p90: number | null }
export interface QualifiedEfficiencySummary {
  readonly totalRuns: number;
  readonly qualifiedRuns: number;
  readonly excludedRuns: number;
  readonly exclusionReasons: Readonly<Partial<Record<QualityExclusionReason, number>>>;
  readonly metrics: Readonly<Record<EfficiencyMetricName, Distribution>>;
}

const metricNames: readonly EfficiencyMetricName[] = [
  "turns", "toolCalls", "delegations", "filesRead", "inputTokens", "contextTokens",
  "outputTokens", "wallTimeMs", "iterations", "noProgressIterations",
];

function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  if (p === 0.5 && sorted.length % 2 === 0) {
    const high = sorted.length / 2;
    return (sorted[high - 1]! + sorted[high]!) / 2;
  }
  const rank = Math.max(0, Math.ceil(p * sorted.length) - 1);
  return sorted[rank]!;
}

export function summarizeQualifiedEfficiency(inputs: readonly MinimalHarnessRunInput[]): QualifiedEfficiencySummary {
  const evaluated = inputs.map(evaluateMinimalHarnessRun);
  const qualified = evaluated.flatMap(item => item.efficiency === null ? [] : [item.efficiency]);
  const exclusionReasons: Partial<Record<QualityExclusionReason, number>> = {};
  for (const item of evaluated) for (const reason of item.exclusionReasons) exclusionReasons[reason] = (exclusionReasons[reason] ?? 0) + 1;
  const metrics = Object.fromEntries(metricNames.map(name => [name, {
    median: percentile(qualified.map(item => item[name]), 0.5),
    p90: percentile(qualified.map(item => item[name]), 0.9),
  }])) as Record<EfficiencyMetricName, Distribution>;
  return { totalRuns: inputs.length, qualifiedRuns: qualified.length, excludedRuns: inputs.length - qualified.length, exclusionReasons, metrics };
}

export interface MinimalHarnessObservation {
  readonly configuration: string;
  readonly componentCount: number;
  readonly qualityScore: number;
  readonly qualityQualified: boolean;
  readonly efficiency: EfficiencyMetrics;
}
export interface RecommendationOptions { readonly qualityMargin: number; readonly referenceConfiguration?: string }
export interface MinimalHarnessRecommendation {
  readonly configuration: string | null;
  readonly reason: string;
  readonly referenceConfiguration: string | null;
  readonly qualityFloor: number | null;
  readonly strictEfficiencyImprovements: readonly EfficiencyMetricName[];
}

function efficiencyImprovements(candidate: EfficiencyMetrics, reference: EfficiencyMetrics): EfficiencyMetricName[] {
  return metricNames.filter(name => candidate[name] < reference[name]);
}
function noEfficiencyRegressions(candidate: EfficiencyMetrics, reference: EfficiencyMetrics): boolean {
  return metricNames.every(name => candidate[name] <= reference[name]);
}

export function recommendSmallestNonInferior(
  observations: readonly MinimalHarnessObservation[], options: RecommendationOptions,
): MinimalHarnessRecommendation {
  const qualified = observations.filter(item => item.qualityQualified);
  if (qualified.length === 0) return { configuration: null, reason: "No configuration passed the essential quality gate.", referenceConfiguration: null, qualityFloor: null, strictEfficiencyImprovements: [] };
  const reference = options.referenceConfiguration
    ? qualified.find(item => item.configuration === options.referenceConfiguration)
    : [...qualified].sort((a, b) => b.qualityScore - a.qualityScore || b.componentCount - a.componentCount)[0];
  if (!reference) return { configuration: null, reason: "The reference configuration did not pass the essential quality gate.", referenceConfiguration: options.referenceConfiguration ?? null, qualityFloor: null, strictEfficiencyImprovements: [] };
  const floor = reference.qualityScore - options.qualityMargin;
  const eligible = qualified.filter(item => item.qualityScore >= floor && noEfficiencyRegressions(item.efficiency, reference.efficiency))
    .map(item => ({ item, improvements: efficiencyImprovements(item.efficiency, reference.efficiency) }))
    .filter(({ improvements }) => improvements.length > 0)
    .sort((a, b) => a.item.componentCount - b.item.componentCount || b.item.qualityScore - a.item.qualityScore);
  const winner = eligible[0];
  if (!winner) return { configuration: null, reason: "No quality-non-inferior configuration is strictly better on an efficiency metric without another efficiency regression.", referenceConfiguration: reference.configuration, qualityFloor: floor, strictEfficiencyImprovements: [] };
  return { configuration: winner.item.configuration, reason: "Smallest quality-non-inferior configuration on the efficiency Pareto frontier.", referenceConfiguration: reference.configuration, qualityFloor: floor, strictEfficiencyImprovements: winner.improvements };
}

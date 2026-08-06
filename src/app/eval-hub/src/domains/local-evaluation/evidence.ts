import { createHash } from "node:crypto";

export interface LocalEvaluationFinding { code: string; path: string; message: string }
export type LocalEvaluationProfileMode = "smoke" | "release";
type JsonObject = Record<string, unknown>;
const layerNames = ["L0", "L1", "L2", "L3"] as const;
const kinds = new Set(["skill", "agent", "recipe"]);
const dispositions = new Set(["covered", "exempt"]);
const exemptionTypes = new Set(["unsupported-provider", "non-behavioral", "premium-variant"]);
const exclusionReasons = new Set(["contamination", "unmatched-pair", "non-treatment-mismatch", "infrastructure"]);
const topKeys = ["schemaVersion", "profileVersion", "profile", "status", "releaseDigest", "bindings", "population", "layers", "startedAt", "completedAt"];
const bindingKeys = ["source", "locks", "runtime", "release", "goose", "evalHub", "provider", "model", "corpus", "profile"];
const populationKeys = ["kind", "component", "disposition", "exemption"];
const exemptionKeys = ["type", "owner", "reason", "expiresAt"];
const layerKeys = ["layer", "executed", "repetitions", "validPairs", "exclusions", "delta", "confidenceInterval95"];
const exclusionKeys = ["reason"];
const object = (value: unknown): JsonObject | undefined => value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const nonBlank = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const stable = (value: unknown): string => Array.isArray(value) ? `[${value.map(stable).join(",")}]` : object(value) ? `{${Object.keys(value as JsonObject).sort().map(key => `${JSON.stringify(key)}:${stable((value as JsonObject)[key])}`).join(",")}}` : JSON.stringify(value);

/** Digest used by evidence bindings: SHA-256 of recursively key-sorted profile JSON. */
export function digestLocalEvaluationProfile(profile: unknown): string {
  return createHash("sha256").update(stable(profile)).digest("hex");
}

/**
 * Public fail-closed evidence boundary. It combines strict shape and PASS semantics;
 * an empty findings array is publication acceptance only for the supplied mode.
 */
export function validateLocalEvaluationEvidence(
  evidence: unknown,
  profile: unknown,
  now: Date,
  expectedMode: LocalEvaluationProfileMode = "release",
): LocalEvaluationFinding[] {
  const findings: LocalEvaluationFinding[] = [];
  const add = (code: string, path: string, message: string) => findings.push({ code, path, message });
  const exactKeys = (value: JsonObject, allowed: string[], required: string[], path: string) => {
    for (const key of Object.keys(value)) if (!allowed.includes(key)) add("EXTRA_PROPERTY", path === "$" ? `$.${key}` : `${path}.${key}`, "property is not allowed");
    for (const key of required) if (!(key in value)) add("MISSING_PROPERTY", path === "$" ? `$.${key}` : `${path}.${key}`, "required property is missing");
  };
  const e = object(evidence); const p = object(profile);
  if (!e || !p) return [{ code: "INVALID_INPUT", path: "$", message: "evidence and profile must be objects" }];
  exactKeys(e, topKeys, topKeys, "$");
  if (!Number.isFinite(now.getTime())) add("INVALID_NOW", "now", "now must be a valid instant");
  if (e.schemaVersion !== 1) add("INVALID_SCHEMA_VERSION", "schemaVersion", "schemaVersion must be 1");
  if (!nonBlank(e.profileVersion) || !/^\d+\.\d+\.\d+$/.test(e.profileVersion)) add("INVALID_PROFILE_VERSION", "profileVersion", "profileVersion must be semantic version x.y.z");
  if (e.status !== "pass") add("STATUS_NOT_PASS", "status", "publication evidence status must be pass");
  if (e.profile !== expectedMode) add("PROFILE_MODE_MISMATCH", "profile", `evidence profile must match supplied ${expectedMode} mode`);
  if (expectedMode === "release" && e.profile !== "release") add("RELEASE_PROFILE_REQUIRED", "profile", "release publication requires release evidence");
  const profiles = object(p.profiles);
  if (!profiles || !object(profiles[expectedMode])) add("SUPPLIED_PROFILE_MODE_MISSING", `profile.profiles.${expectedMode}`, "supplied profile must define expected mode");
  if (!digest(e.releaseDigest)) add("INVALID_DIGEST", "releaseDigest", "releaseDigest must be lowercase SHA-256");

  const bindings = object(e.bindings);
  if (!bindings) add("INVALID_BINDINGS", "bindings", "bindings must be an object");
  else {
    exactKeys(bindings, bindingKeys, bindingKeys, "bindings");
    for (const key of bindingKeys) if (!digest(bindings[key])) add("INVALID_DIGEST", `bindings.${key}`, "binding must be lowercase SHA-256");
  }
  if (e.profileVersion !== p.profileVersion) add("PROFILE_VERSION_MISMATCH", "profileVersion", "evidence profileVersion must equal supplied profile");
  if (e.releaseDigest !== bindings?.release) add("RELEASE_DIGEST_MISMATCH", "releaseDigest", "releaseDigest must equal bindings.release");
  if (bindings?.profile !== digestLocalEvaluationProfile(profile)) add("PROFILE_DIGEST_MISMATCH", "bindings.profile", "profile binding must digest the supplied profile");

  const started = typeof e.startedAt === "string" ? Date.parse(e.startedAt) : NaN;
  const completed = typeof e.completedAt === "string" ? Date.parse(e.completedAt) : NaN;
  if (!Number.isFinite(started)) add("INVALID_TIMESTAMP", "startedAt", "startedAt must be a valid date-time");
  if (!Number.isFinite(completed)) add("INVALID_TIMESTAMP", "completedAt", "completedAt must be a valid date-time");
  if (Number.isFinite(started) && Number.isFinite(completed) && started > completed) add("TIMESTAMP_ORDER", "completedAt", "completedAt must not precede startedAt");

  const population = Array.isArray(e.population) ? e.population : undefined;
  if (!population) add("INVALID_POPULATION", "population", "population must be an array");
  const identities = new Set<string>();
  (population ?? []).forEach((entry, index) => {
    const item = object(entry); const path = `population[${index}]`;
    if (!item) return add("INVALID_POPULATION", path, "population entry must be an object");
    exactKeys(item, populationKeys, ["kind", "component", "disposition"], path);
    if (!kinds.has(String(item.kind))) add("INVALID_KIND", `${path}.kind`, "kind must be skill, agent, or recipe");
    if (!nonBlank(item.component)) add("INVALID_COMPONENT", `${path}.component`, "component must be non-empty");
    if (!dispositions.has(String(item.disposition))) add("INVALID_DISPOSITION", `${path}.disposition`, "disposition must be covered or exempt");
    const identity = `${String(item.kind)}:${String(item.component)}`;
    if (identities.has(identity)) add("DUPLICATE_POPULATION", path, "population component must occur once");
    identities.add(identity);
    const exemption = object(item.exemption);
    if (item.disposition === "covered" && "exemption" in item) add("COVERED_WITH_EXEMPTION", path, "covered entry cannot carry an exemption");
    if (item.disposition === "exempt") {
      if (!exemption) add("MISSING_EXEMPTION", path, "exempt entry requires typed exemption details");
      else {
        exactKeys(exemption, exemptionKeys, exemptionKeys, `${path}.exemption`);
        if (!exemptionTypes.has(String(exemption.type))) add("INVALID_EXEMPTION_TYPE", `${path}.exemption.type`, "unknown exemption type");
        if (!nonBlank(exemption.owner)) add("INVALID_EXEMPTION_OWNER", `${path}.exemption.owner`, "owner must be non-empty");
        if (!nonBlank(exemption.reason)) add("INVALID_EXEMPTION_REASON", `${path}.exemption.reason`, "reason must be non-empty");
        const expiry = typeof exemption.expiresAt === "string" ? Date.parse(exemption.expiresAt) : NaN;
        if (!Number.isFinite(expiry)) add("INVALID_EXPIRY", `${path}.exemption.expiresAt`, "expiry must be a valid date-time");
        else if (Number.isFinite(now.getTime()) && expiry <= now.getTime()) add("EXPIRED_EXEMPTION", `${path}.exemption.expiresAt`, "exemption must not be expired");
      }
    }
  });

  const integrity = object(p.integrity); const thresholds = object(p.thresholds);
  const minimumRepetitions = integrity?.minimumPairedRepetitions;
  const minimumValidRate = thresholds?.minimumValidPairRate;
  const maximumExclusionRate = thresholds?.maximumExclusionRate;
  const minimumDelta = thresholds?.minimumTreatmentDelta;
  const minimumLowerBound = thresholds?.minimumConfidenceIntervalLowerBoundExclusive;
  const suppliedLayers = Array.isArray(e.layers) ? e.layers : undefined;
  if (!suppliedLayers) add("INVALID_LAYERS", "layers", "layers must be an array");
  for (const expected of layerNames) {
    const matches = (suppliedLayers ?? []).filter(value => object(value)?.layer === expected);
    if (matches.length !== 1) { add("LAYER_CARDINALITY", "layers", `${expected} must occur exactly once`); continue; }
    const layer = object(matches[0])!; const path = `layers.${expected}`;
    exactKeys(layer, layerKeys, layerKeys, path);
    if (layer.executed !== true) add("LAYER_NOT_EXECUTED", `${path}.executed`, "passing layer must be executed");
    const repetitions = layer.repetitions; const validPairs = layer.validPairs;
    if (!Number.isInteger(repetitions) || (repetitions as number) < 0) add("INVALID_COUNT", `${path}.repetitions`, "repetitions must be a non-negative integer");
    if (!Number.isInteger(validPairs) || (validPairs as number) < 0) add("INVALID_COUNT", `${path}.validPairs`, "validPairs must be a non-negative integer");
    if (!finite(repetitions) || !finite(minimumRepetitions) || repetitions < minimumRepetitions) add("INSUFFICIENT_REPETITIONS", `${path}.repetitions`, "repetitions below profile minimum");
    if (!finite(validPairs) || !finite(repetitions) || repetitions <= 0 || !finite(minimumValidRate) || validPairs / repetitions < minimumValidRate) add("VALID_PAIR_RATE", `${path}.validPairs`, "valid-pair rate below profile threshold");
    if (finite(validPairs) && finite(repetitions) && validPairs > repetitions) add("INVALID_PAIR_COUNT", `${path}.validPairs`, "validPairs cannot exceed repetitions");
    const exclusions = Array.isArray(layer.exclusions) ? layer.exclusions : undefined;
    if (!exclusions) add("INVALID_EXCLUSIONS", `${path}.exclusions`, "exclusions must be an array");
    if (!finite(repetitions) || repetitions <= 0 || !finite(maximumExclusionRate) || (exclusions ?? []).length / repetitions > maximumExclusionRate) add("EXCLUSION_RATE", `${path}.exclusions`, "exclusion rate exceeds profile maximum");
    (exclusions ?? []).forEach((value, index) => {
      const exclusion = object(value); const exclusionPath = `${path}.exclusions[${index}]`;
      if (!exclusion) return add("INVALID_EXCLUSION", exclusionPath, "exclusion must be an object");
      exactKeys(exclusion, exclusionKeys, exclusionKeys, exclusionPath);
      if (!exclusionReasons.has(String(exclusion.reason))) add("INVALID_EXCLUSION_REASON", `${exclusionPath}.reason`, "unknown exclusion reason");
      else add("FORBIDDEN_EXCLUSION", exclusionPath, `${String(exclusion.reason)} invalidates a pass`);
    });
    if (!finite(layer.delta) || !finite(minimumDelta) || layer.delta < minimumDelta) add("WEAK_DELTA", `${path}.delta`, "delta below profile minimum");
    const ci = layer.confidenceInterval95;
    if (!Array.isArray(ci) || ci.length !== 2 || !finite(ci[0]) || !finite(ci[1]) || ci[0] > ci[1] || !finite(minimumLowerBound) || ci[0] <= minimumLowerBound) add("WEAK_CONFIDENCE_INTERVAL", `${path}.confidenceInterval95`, "ordered finite two-value CI lower bound must be strictly above profile bound");
  }
  if ((suppliedLayers ?? []).length !== layerNames.length) add("LAYER_COUNT", "layers", "passing evidence must contain exactly four layers");
  return findings;
}

/** Boolean publication predicate for consumers such as dependent task olqo.10. */
export function isLocalEvaluationPublicationPass(evidence: unknown, profile: unknown, mode: LocalEvaluationProfileMode, now: Date): boolean {
  return validateLocalEvaluationEvidence(evidence, profile, now, mode).length === 0;
}

import { createHash } from "node:crypto";
import type { SmokeEvidence } from "./smokeRunner.js";
import { digestLocalEvaluationProfile, isLocalEvaluationPublicationPass } from "./evidence.js";

type Digest = string;
export interface LocalEvaluationBindings { source: Digest; locks: Digest; runtime: Digest; release: Digest; goose: Digest; evalHub: Digest; provider: Digest; model: Digest; corpus: Digest; profile: Digest }
export interface ReleaseGateResult { status: "pass" | "fail"; releaseDigest: Digest; bindings: LocalEvaluationBindings; evidence: unknown; population: unknown[]; commands: string[] }
export interface LocalEvaluationAttestationInput { smoke: SmokeEvidence; releaseGate: ReleaseGateResult; currentBindings: LocalEvaluationBindings; population: unknown[]; profile: unknown; startedAt: string; completedAt: string; commands: string[] }
export interface LocalEvaluationAttestation { schemaVersion: 1; status: "pass" | "fail"; digest: Digest; payload: { bindings: LocalEvaluationBindings; population: unknown[]; smoke: SmokeEvidence; releaseGate: ReleaseGateResult; profileDigest: Digest; startedAt: string; completedAt: string; commands: string[] }; html: string }

const digestPattern = /^[a-f0-9]{64}$/;
const secretKey = /(^|[_-])(secret|password|passwd|token|api[_-]?key|credential|private[_-]?key)([_-]|$)/i;
const object = (value: unknown): Record<string, unknown> | undefined => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
export const canonicalLocalEvaluationJson = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonicalLocalEvaluationJson).join(",")}]` : object(value) ? `{${Object.keys(value as Record<string, unknown>).sort().map(key => `${JSON.stringify(key)}:${canonicalLocalEvaluationJson((value as Record<string, unknown>)[key])}`).join(",")}}` : JSON.stringify(value);
const sha = (value: unknown) => createHash("sha256").update(canonicalLocalEvaluationJson(value)).digest("hex");
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
const same = (a: unknown, b: unknown) => canonicalLocalEvaluationJson(a) === canonicalLocalEvaluationJson(b);
const exactKeys = (value: Record<string, unknown>, expected: string[]) => Object.keys(value).length === expected.length && Object.keys(value).every(key => expected.includes(key));
function containsSecretLikeKey(value: unknown): boolean { if (Array.isArray(value)) return value.some(containsSecretLikeKey); const item = object(value); return !!item && Object.entries(item).some(([key, child]) => secretKey.test(key) || containsSecretLikeKey(child)); }
function render(payload: LocalEvaluationAttestation["payload"], status: "pass" | "fail", digest: string): string {
  const release = object(payload.releaseGate.evidence); const layers = Array.isArray(release?.layers) ? release.layers : [];
  const rows = layers.map(raw => { const layer = object(raw) ?? {}; const ci = Array.isArray(layer.confidenceInterval95) ? layer.confidenceInterval95.join("..") : "missing"; return { layer: String(layer.layer ?? "missing"), evidence: `pairs=${String(layer.validPairs ?? "missing")}/${String(layer.repetitions ?? "missing")}; pair-micro delta=${String(layer.delta ?? "missing")}; subject-macro CI95=${ci}; exclusions=${Array.isArray(layer.exclusions) ? layer.exclusions.length : "missing"}; CI=release-macro/CI` }; });
  const population = payload.population.map(entry => escapeHtml(canonicalLocalEvaluationJson(entry))).join("</li><li>");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Local evaluation attestation</title></head><body><h1>Local evaluation: ${status}</h1><p>Digest: <code>${digest}</code></p><p>Release: <code>${escapeHtml(payload.bindings.release)}</code></p><h2>Layers</h2><table><thead><tr><th>Layer</th><th>Pair / macro / CI / exclusions</th></tr></thead><tbody>${rows.map(row => `<tr><td>${escapeHtml(row.layer)}</td><td>${escapeHtml(row.evidence)}</td></tr>`).join("")}</tbody></table><h2>Population and exemptions</h2><ul><li>${population}</li></ul><h2>Commands</h2><ul><li>${payload.commands.map(escapeHtml).join("</li><li>")}</li></ul></body></html>`;
}
function bindingsValid(value: unknown): value is LocalEvaluationBindings { const item = object(value); const keys = ["source", "locks", "runtime", "release", "goose", "evalHub", "provider", "model", "corpus", "profile"]; return !!item && exactKeys(item, keys) && keys.every(key => digestPattern.test(String(item[key]))); }

export function createLocalEvaluationAttestation(input: LocalEvaluationAttestationInput): LocalEvaluationAttestation {
  const payload = { bindings: input.currentBindings, population: input.population, smoke: input.smoke, releaseGate: input.releaseGate, profileDigest: digestLocalEvaluationProfile(input.profile), startedAt: input.startedAt, completedAt: input.completedAt, commands: input.commands };
  const smokeBindingsMatch = Object.entries(input.smoke.bindings).every(([key, value]) => input.currentBindings[key as keyof LocalEvaluationBindings] === value);
  const releaseEvidence = object(input.releaseGate.evidence);
  const nestedStatusPass = releaseEvidence?.status === "pass";
  const populationMatch = same(input.population, input.releaseGate.population) && same(input.population, releaseEvidence?.population);
  const pass = input.smoke.status === "pass" && input.releaseGate.status === "pass" && nestedStatusPass && populationMatch && input.smoke.releaseDigest === input.releaseGate.releaseDigest && input.releaseGate.releaseDigest === input.currentBindings.release && same(input.releaseGate.bindings, input.currentBindings) && smokeBindingsMatch;
  const status = pass ? "pass" : "fail"; const digest = sha(payload);
  return { schemaVersion: 1, status, digest, payload, html: render(payload, status, digest) };
}

export function verifyLocalEvaluationAttestation(attestation: unknown, currentBindings: LocalEvaluationBindings, profile: unknown, now: Date): boolean {
  const root = object(attestation); if (!root || !exactKeys(root, ["schemaVersion", "status", "digest", "payload", "html"]) || root.schemaVersion !== 1 || root.status !== "pass" || !digestPattern.test(String(root.digest)) || typeof root.html !== "string" || containsSecretLikeKey(root)) return false;
  const payload = object(root.payload); if (!payload || !exactKeys(payload, ["bindings", "population", "smoke", "releaseGate", "profileDigest", "startedAt", "completedAt", "commands"]) || !bindingsValid(payload.bindings) || !bindingsValid(currentBindings) || !same(payload.bindings, currentBindings) || currentBindings.profile !== digestLocalEvaluationProfile(profile) || payload.profileDigest !== digestLocalEvaluationProfile(profile) || sha(payload) !== root.digest) return false;
  const started = Date.parse(String(payload.startedAt)); const completed = Date.parse(String(payload.completedAt)); const p=object(profile), publication=object(p?.publication), maxAge=publication?.maxEvidenceAgeMs; if (![started, completed, now.getTime()].every(Number.isFinite) || started > completed || completed > now.getTime() || !Number.isInteger(maxAge) || (maxAge as number)<=0 || now.getTime() - completed > (maxAge as number)) return false;
  if (!Array.isArray(payload.population) || !Array.isArray(payload.commands) || payload.commands.some(command => typeof command !== "string")) return false;
  const smoke = object(payload.smoke); const gate = object(payload.releaseGate); const smokeBindings = object(smoke?.bindings); if (!smoke || !gate || !smokeBindings || smoke.status !== "pass" || gate.status !== "pass" || !Array.isArray(gate.population) || !same(payload.population,gate.population) || smoke.releaseDigest !== currentBindings.release || gate.releaseDigest !== currentBindings.release || !same(gate.bindings, currentBindings) || !Object.entries(smokeBindings).every(([key, value]) => currentBindings[key as keyof LocalEvaluationBindings] === value)) return false;
  const evidence = gate.evidence; const nested=object(evidence); if (!nested || nested.status!=="pass" || !Array.isArray(nested.population) || !same(payload.population,nested.population) || !isLocalEvaluationPublicationPass(evidence, profile, "release", now)) return false;
  const nestedStarted=Date.parse(String(nested.startedAt)), nestedCompleted=Date.parse(String(nested.completedAt)), smokeStarted=Date.parse(String(smoke.startedAt)), smokeCompleted=Date.parse(String(smoke.completedAt)); if (![nestedStarted,nestedCompleted,smokeStarted,smokeCompleted].every(Number.isFinite) || nestedStarted>nestedCompleted || smokeStarted>smokeCompleted || nestedCompleted>now.getTime() || smokeCompleted>now.getTime() || now.getTime()-nestedCompleted>(maxAge as number) || now.getTime()-smokeCompleted>(maxAge as number)) return false;
  const layers = object(evidence)?.layers; if (!Array.isArray(layers) || layers.length !== 4 || !["L0", "L1", "L2", "L3"].every(layer => layers.some(entry => object(entry)?.layer === layer))) return false;
  const typed = root as unknown as LocalEvaluationAttestation; return root.html === render(typed.payload, "pass", String(root.digest));
}
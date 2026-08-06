/**
 * Production artifact bundle for IntegrityReport.
 *
 * Seam owner: agentic-devlopment-sur3.2 / sur3.3
 *
 * Calls loadIntegrityReportFromStore exactly once per build call.
 * Never recomputes — all artifacts (cli, json, html) derive from the
 * same loaded report so every surface shows identical data.
 *
 * Exports:
 *   IntegrityArtifactBundle        — typed container for all artifacts
 *   buildIntegrityArtifactsFromStore — single-load factory
 *   persistIntegrityArtifacts       — atomic-ish write to disk
 *
 * Invariants:
 *   • For non-null report: cli, json, html are all non-null and consistent.
 *   • For null report: cli carries explicit compatibility message; json/html null.
 *   • persistIntegrityArtifacts writes nothing if bundle.report is null.
 *   • Errors propagate — callers must not silently swallow filesystem errors.
 *   • Does not re-load the store; does not call providers or goose processes.
 */
import fs   from "node:fs/promises";
import path from "node:path";
import type { IntegrityCompatibility } from "../persistence/integrityV2Store.js";
import type { IntegrityReport } from "./integrityReport.js";
import {
  loadIntegrityReportFromStore,
  formatIntegrityCli,
  integrityReportJson,
} from "./integrityOutputs.js";
import { HtmlReportBuilder } from "./htmlBuilder.js";

// ── Artifact bundle ───────────────────────────────────────────────────────────

export interface IntegrityArtifactBundle {
  /** Compatibility metadata — always present regardless of report. */
  readonly compatibility: IntegrityCompatibility;
  /** IntegrityReport DTO when data is available; null otherwise. */
  readonly report: IntegrityReport | null;
  /** Plain-text CLI rendering — never null; carries explicit message for null report. */
  readonly cli: string;
  /** Canonical JSON bytes (serializeIntegrityReport); null when report is null. */
  readonly json: string | null;
  /** Standalone HTML page; null when report is null. */
  readonly html: string | null;
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Load the integrity store exactly once and build all artifacts.
 *
 * @param storeRoot  EvalIntegrityV2Store root directory (contains manifest.json).
 * @param meta       Rendering metadata — generatedAt (ISO string) + optional scope label.
 *
 * For non-null report: cli = formatIntegrityCli(report, ...), json = integrityReportJson(report),
 * html = new HtmlReportBuilder().buildIntegrity(report, meta). All three reflect the same report.
 * For null report: cli carries explicit compatibility message; json and html are null.
 *
 * May throw on filesystem errors other than ENOENT (corrupt store, hash mismatch …).
 * Does not launch providers, networks, or goose processes.
 */
export async function buildIntegrityArtifactsFromStore(
  storeRoot: string,
  meta: { generatedAt: string; scope?: string },
): Promise<IntegrityArtifactBundle> {
  const { report, compatibility } = await loadIntegrityReportFromStore(storeRoot);
  const scopeLabel = meta.scope ?? storeRoot;

  if (report === null) {
    return {
      compatibility,
      report: null,
      cli:  formatIntegrityCli(null, scopeLabel, compatibility),
      json: null,
      html: null,
    };
  }

  return {
    compatibility,
    report,
    cli:  formatIntegrityCli(report, scopeLabel, compatibility),
    json: integrityReportJson(report),
    html: new HtmlReportBuilder().buildIntegrity(report, meta),
  };
}

// ── Persistence ───────────────────────────────────────────────────────────────

/**
 * Write canonical `integrity-report-<kind>.json` and `.html` under baseWs.
 *
 * Atomic-ish: mkdir is called first; both files are then written sequentially.
 * If bundle.report is null (no data), nothing is written — no fake outputs.
 * Errors propagate; callers must not swallow them.
 *
 * @param baseWs     Directory beside state.json (typically LAYERED_ROOT/<runId>).
 * @param kind       Layer kind: "skills" | "agents" | "recipes".
 * @param bundle     Artifact bundle from buildIntegrityArtifactsFromStore.
 * @param opts       Optional: { jsonTarget } — additional path for identical JSON bytes.
 */
export async function persistIntegrityArtifacts(
  baseWs: string,
  kind:   string,
  bundle: IntegrityArtifactBundle,
  opts?:  { jsonTarget?: string },
): Promise<void> {
  if (bundle.report === null || bundle.json === null || bundle.html === null) {
    return;   // null report → nothing to persist; never write fake outputs
  }

  await fs.mkdir(baseWs, { recursive: true });

  const jsonPath = path.join(baseWs, `integrity-report-${kind}.json`);
  const htmlPath = path.join(baseWs, `integrity-report-${kind}.html`);

  await fs.writeFile(jsonPath, bundle.json, "utf8");
  await fs.writeFile(htmlPath, bundle.html, "utf8");

  if (opts?.jsonTarget) {
    await fs.mkdir(path.dirname(opts.jsonTarget), { recursive: true });
    await fs.writeFile(opts.jsonTarget, bundle.json, "utf8");
  }
}

// ── Canonical path helpers (exported for callers that log paths) ──────────────

export function integrityJsonPath(baseWs: string, kind: string): string {
  return path.join(baseWs, `integrity-report-${kind}.json`);
}

export function integrityHtmlPath(baseWs: string, kind: string): string {
  return path.join(baseWs, `integrity-report-${kind}.html`);
}

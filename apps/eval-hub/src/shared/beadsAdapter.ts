/**
 * HAR-04: Read-only Beads evidence adapter — canonical Issue model.
 *
 * Exposes every field from the canonical Beads Issue schema so that
 * loop-engineering recipes, eval-hub, and tests can reason about the
 * full work-control state without mutating the source.
 *
 * Canonical Beads Issue fields (from .specs/features/loop-engineering/spec.md):
 *
 *   title, description, design, acceptance_criteria, notes, spec_id,
 *   status, priority, issue_type, assignee, owner, estimated_minutes,
 *   started_at, closed_at, close_reason, metadata, labels,
 *   dependencies, comments
 *
 * Plus adapter-derived fields: id, parentId, ready, blocked, dependents.
 *
 * Architecture decision: the adapter is strictly read-only.
 * Non-mutation is enforced by a byte-count guard (throws on file size change).
 */
import fs   from "node:fs/promises";
import path from "node:path";

// ── Raw JSONL shape ───────────────────────────────────────────────────────────

interface RawDependency {
  readonly issue_id:      string;
  readonly depends_on_id: string;
  readonly type:          string;
}

interface RawComment {
  readonly body?:       string;
  readonly created_at?: string;
  readonly author?:     string;
}

interface RawIssue {
  readonly id:                  string;
  readonly title?:              string;
  readonly description?:        string;
  readonly design?:             string;
  readonly acceptance_criteria?: string;
  readonly notes?:              string;
  readonly spec_id?:            string;
  readonly issue_type?:         string;
  readonly status?:             string;
  readonly priority?:           number | string;
  readonly assignee?:           string;
  readonly owner?:              string;
  readonly estimated_minutes?:  number;
  readonly started_at?:         string;
  readonly closed_at?:          string;
  readonly close_reason?:       string;
  readonly parent_id?:          string;
  readonly dependency_count?:   number;
  readonly dependent_count?:    number;
  readonly dependencies?:       RawDependency[];
  readonly labels?:             string[];
  readonly metadata?:           Record<string, unknown>;
  readonly comments?:           RawComment[];
}

// ── Public canonical type ─────────────────────────────────────────────────────

/** Full canonical Beads Issue evidence record. */
export interface BeadsIssueEvidence {
  // ── Identity ────────────────────────────────────────────────────────────────
  /** Canonical Beads ID, e.g. "agentic-devlopment-36ws.6" */
  readonly id:                  string;

  // ── Content (Beads native fields) ────────────────────────────────────────────
  readonly title:               string;
  readonly description:         string;
  readonly design:              string;
  /** Raw acceptance-criteria markdown text */
  readonly acceptanceCriteria:  string;
  readonly notes:               string;
  /** Pointer to the canonical spec file (.specs/features/…/spec.md) */
  readonly specId:              string | null;

  // ── Classification ────────────────────────────────────────────────────────────
  /** task | bug | feature | epic | chore | decision */
  readonly issueType:           string;
  readonly status:              string;
  /** 0 = critical, 1 = high, 2 = medium, 3 = low, 4 = backlog */
  readonly priority:            number | null;
  readonly labels:              readonly string[];
  /** Arbitrary structured metadata (loop_max_attempts, severity, …) */
  readonly metadata:            Readonly<Record<string, unknown>>;

  // ── People ────────────────────────────────────────────────────────────────────
  readonly assignee:            string | null;
  readonly owner:               string | null;

  // ── Schedule ─────────────────────────────────────────────────────────────────
  readonly estimatedMinutes:    number | null;
  readonly startedAt:           string | null;
  readonly closedAt:            string | null;
  readonly closeReason:         string | null;

  // ── Graph ─────────────────────────────────────────────────────────────────────
  /** Upstream dependency IDs this issue depends on */
  readonly dependencies:        readonly string[];
  /** Parent epic / molecule ID if this is a child task */
  readonly parentId:            string | null;
  /** Downstream issue IDs that depend on this issue */
  readonly dependents:          readonly string[];

  // ── Adapter-derived ────────────────────────────────────────────────────────────
  /** True when status ∈ {open, in_progress} and all dependencies are closed */
  readonly ready:               boolean;
  /** True when status ∈ {open, in_progress} and ≥1 dependency is not closed */
  readonly blocked:             boolean;

  // ── Journal ────────────────────────────────────────────────────────────────────
  readonly comments:            readonly RawComment[];
}

// ── Adapter ───────────────────────────────────────────────────────────────────

/**
 * Read and parse a Beads issues.jsonl file without mutating it.
 * Returns one BeadsIssueEvidence record per non-event issue line.
 *
 * Filters out:
 *   - event records (issue_type === "event")
 *   - wisp/lifecycle entries (event_kind present, _type === "event")
 */
export async function readBeadsEvidence(issuesJsonlPath: string): Promise<BeadsIssueEvidence[]> {
  const raw = await fs.readFile(issuesJsonlPath, "utf8");
  const checksumBefore = raw.length;

  const lines  = raw.split("\n").filter(l => l.trim().length > 0);
  const issues = lines
    .map(l => JSON.parse(l) as RawIssue)
    .filter(d =>
      d.id &&
      d.issue_type &&
      d.issue_type !== "event" &&
      !("event_kind" in d) &&
      !("_type" in d && (d as unknown as Record<string, string>)["_type"] === "event"),
    );

  // Build a closed-status index for readiness computation
  const closedIds = new Set(issues.filter(i => i.status === "closed").map(i => i.id));

  // Build dependent index
  const dependentMap = new Map<string, string[]>();
  for (const issue of issues) {
    for (const dep of issue.dependencies ?? []) {
      const list = dependentMap.get(dep.depends_on_id) ?? [];
      list.push(issue.id);
      dependentMap.set(dep.depends_on_id, list);
    }
  }

  const result = issues.map((issue): BeadsIssueEvidence => {
    const depIds      = (issue.dependencies ?? []).map(d => d.depends_on_id);
    const allDepsDone = depIds.length === 0 || depIds.every(id => closedIds.has(id));
    const isActive    = issue.status === "open" || issue.status === "in_progress";

    let priority: number | null = null;
    if (issue.priority !== undefined && issue.priority !== null) {
      priority = typeof issue.priority === "number"
        ? issue.priority
        : Number(String(issue.priority).replace(/^P/i, ""));
    }

    return {
      id:                  issue.id,
      title:               issue.title               ?? "",
      description:         issue.description         ?? "",
      design:              issue.design              ?? "",
      acceptanceCriteria:  issue.acceptance_criteria ?? "",
      notes:               issue.notes               ?? "",
      specId:              issue.spec_id             ?? null,
      issueType:           issue.issue_type          ?? "task",
      status:              issue.status              ?? "open",
      priority,
      labels:              issue.labels              ?? [],
      metadata:            issue.metadata            ?? {},
      assignee:            issue.assignee            ?? null,
      owner:               issue.owner               ?? null,
      estimatedMinutes:    issue.estimated_minutes   ?? null,
      startedAt:           issue.started_at          ?? null,
      closedAt:            issue.closed_at           ?? null,
      closeReason:         issue.close_reason        ?? null,
      dependencies:        depIds,
      parentId:            issue.parent_id           ?? null,
      dependents:          dependentMap.get(issue.id) ?? [],
      ready:               isActive &&  allDepsDone,
      blocked:             isActive && !allDepsDone,
      comments:            issue.comments            ?? [],
    };
  });

  // Non-mutation assertion
  const checksumAfter = (await fs.readFile(issuesJsonlPath, "utf8")).length;
  if (checksumBefore !== checksumAfter) {
    throw new Error(
      `HAR-04 non-mutation violation: ${issuesJsonlPath} changed size ` +
      `from ${checksumBefore} to ${checksumAfter} bytes during read`,
    );
  }

  return result;
}

/** Compute the path to .beads/issues.jsonl from a project root. */
export function beadsIssuesPath(projectRoot: string): string {
  return path.join(projectRoot, ".beads", "issues.jsonl");
}

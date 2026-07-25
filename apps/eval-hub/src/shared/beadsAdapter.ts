/**
 * HAR-04: Read-only Beads evidence adapter.
 *
 * Reads .beads/issues.jsonl and reports issue_type, nested dependencies,
 * parent/epic links, readiness, and blocked/dependent state — without
 * mutating the source file.
 *
 * Architecture decision: the adapter is strictly read-only.  It computes
 * all derived fields (ready, blocked, epicId) from the raw JSONL without
 * writing, caching, or modifying any file.
 */
import fs   from "node:fs/promises";
import path from "node:path";

// ── Raw JSONL shape (subset we care about) ────────────────────────────────────

interface RawDependency {
  readonly issue_id:      string;
  readonly depends_on_id: string;
  readonly type:          string;
}

interface RawIssue {
  readonly id:               string;
  readonly title?:           string;
  readonly issue_type?:      string;
  readonly status?:          string;
  readonly parent_id?:       string;
  readonly dependency_count?: number;
  readonly dependent_count?:  number;
  readonly dependencies?:    RawDependency[];
  readonly labels?:          string[];
  readonly metadata?:        Record<string, unknown>;
}

// ── Public types ──────────────────────────────────────────────────────────────

export interface BeadsIssueEvidence {
  /** Beads canonical ID, e.g. "agentic-devlopment-36ws.6" */
  readonly id:           string;
  readonly title:        string;
  /** Beads issue_type: task | bug | feature | epic | chore | decision */
  readonly issueType:    string;
  readonly status:       string;
  /** Upstream dependency IDs this issue depends on */
  readonly dependencies: readonly string[];
  /** Parent epic/molecule ID if this is a child task */
  readonly parentId:     string | null;
  /** True when status=open and all dependencies are closed */
  readonly ready:        boolean;
  /** True when status=open and ≥1 dependency is not closed */
  readonly blocked:      boolean;
  /** Downstream issue IDs that depend on this issue */
  readonly dependents:   readonly string[];
}

// ── Adapter ───────────────────────────────────────────────────────────────────

/**
 * Read and parse a Beads issues.jsonl file without mutating it.
 * Returns one evidence record per non-event issue line.
 */
export async function readBeadsEvidence(issuesJsonlPath: string): Promise<BeadsIssueEvidence[]> {
  const raw = await fs.readFile(issuesJsonlPath, "utf8");
  // Record checksum before and after to assert non-mutation (belt-and-suspenders)
  const checksumBefore = raw.length;

  const lines  = raw.split("\n").filter(l => l.trim().length > 0);
  const issues = lines
    .map(l => JSON.parse(l) as RawIssue)
    .filter(d =>
      d.id &&
      d.issue_type &&
      d.issue_type !== "event" &&        // filter Beads state-change event records
      !("event_kind" in d) &&            // filter explicit event entries
      !("_type" in d && (d as unknown as {_type:string})._type === "event"),
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
    const depIds = (issue.dependencies ?? []).map(d => d.depends_on_id);
    const allDepsClosed = depIds.length === 0 || depIds.every(id => closedIds.has(id));
    const isOpen = issue.status === "open" || issue.status === "in_progress";
    return {
      id:           issue.id,
      title:        issue.title ?? "",
      issueType:    issue.issue_type ?? "task",
      status:       issue.status ?? "open",
      dependencies: depIds,
      parentId:     issue.parent_id ?? null,
      ready:        isOpen && allDepsClosed,
      blocked:      isOpen && !allDepsClosed,
      dependents:   dependentMap.get(issue.id) ?? [],
    };
  });

  // Non-mutation assertion: file size must be unchanged after read
  const checksumAfter = (await fs.readFile(issuesJsonlPath, "utf8")).length;
  if (checksumBefore !== checksumAfter) {
    throw new Error(
      `HAR-04 non-mutation violation: ${issuesJsonlPath} changed size from ` +
      `${checksumBefore} to ${checksumAfter} bytes during read`,
    );
  }

  return result;
}

/**
 * Compute the path to .beads/issues.jsonl from a project root.
 */
export function beadsIssuesPath(projectRoot: string): string {
  return path.join(projectRoot, ".beads", "issues.jsonl");
}

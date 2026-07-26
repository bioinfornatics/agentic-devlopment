/**
 * Evaluation-only projection of the canonical Loop Engineering contract.
 *
 * Authority: .specs/features/loop-engineering/spec.md. This deterministic eval
 * fixture cannot authorize runtime transitions. It describes every Beads level:
 * epic, feature (user story), task, bug, and incident.
 *
 * Each level is governed by the same generic sequence:
 *   Trigger → Planner → Builder → Independent Verifier → Memory
 *             → Manager → Controller
 *
 * Architecture decision 2026-07-25: minimal-first.  Only Loop Engineering
 * pack artifacts (task-framing, evidence-verification, loop-control;
 * change-builder, independent-verifier, repository-researcher;
 * loop-engineering, implement, research, verify) are in scope.
 *
 * Incident convention: Beads has no native "incident" type.
 * Incidents use type="bug" + mandatory label "incident" + metadata key
 * "severity".  An issue filed as type="bug" without label "incident" is an
 * ordinary bug, not an incident.  assertIncidentConvention() enforces this.
 */

/** Valid controller transitions in the loop. */
export const CONTROLLER_TRANSITIONS = [
  "CONTINUE",
  "REJECT",
  "REWORK",
  "REPLAN",
  "WAIT",
  "COMPLETE",
  "ESCALATE",
  "ABORT",
] as const;
export type ControllerTransition = typeof CONTROLLER_TRANSITIONS[number];

/** Scenario types that every level must cover. */
export const REQUIRED_SCENARIO_TYPES = [
  "successful_completion",
  "failed_verification_rework",
  "repeated_no_progress_wait_or_escalate",
] as const;
export type ScenarioType = typeof REQUIRED_SCENARIO_TYPES[number];

/** Structural contract for one level of the governed loop. */
export interface LoopLevelContract {
  /** Work level name. */
  readonly level: "epic" | "feature" | "task" | "bug" | "incident";
  /** Native Beads issue type used for this level. */
  readonly beadsType: "epic" | "feature" | "task" | "bug";
  /**
   * Additional mandatory Beads labels for this level.
   * Empty for levels whose type is already unambiguous.
   */
  readonly mandatoryLabels: readonly string[];
  /**
   * Mandatory Beads metadata keys for this level.
   * Empty for levels that require none.
   */
  readonly mandatoryMetadataKeys: readonly string[];
  /** What event or condition triggers creation of this work item. */
  readonly trigger: string;
  /**
   * Required parent or dependency context.
   * Describes the Beads parent/dependency that must exist before work starts.
   */
  readonly parentContext: string;
  /**
   * Observable evidence required for a COMPLETE transition.
   * Each entry is a distinct, measurable proof.
   */
  readonly acceptanceEvidence: readonly string[];
  /**
   * How builder / verifier session separation is enforced at this level.
   */
  readonly builderVerifierSeparation: string;
  /**
   * Valid controller transitions for this level.
   * Must contain at least COMPLETE plus one non-continuing exit.
   */
  readonly controllerTransitions: readonly ControllerTransition[];
  /**
   * Stop conditions: one entry per REQUIRED_SCENARIO_TYPE.
   * Keys map scenario types to the controller response.
   */
  readonly stopConditions: Readonly<Record<ScenarioType, string>>;
  /**
   * Incident-only: convention note explaining why a native type is absent
   * and how the convention enforces distinctness.
   */
  readonly incidentConvention?: string;
}

/** Complete governed loop contracts for all five work levels. */
export const LOOP_LEVEL_CONTRACTS: readonly LoopLevelContract[] = [
  {
    level: "epic",
    beadsType: "epic",
    mandatoryLabels: [],
    mandatoryMetadataKeys: ["loop_max_iterations", "loop_max_no_progress"],
    trigger:
      "A stakeholder-approved objective with global acceptance criteria and a bounded iteration budget is established.",
    parentContext:
      "No parent required; epic is the root of its own task graph. " +
      "All child tasks carry the epic ID as parent.",
    acceptanceEvidence: [
      "Every global AC has deterministic independent proof.",
      "All child controller tasks have closed with COMPLETE.",
      "No open blockers or unaccepted risks remain in Beads.",
      "Product owner records final acceptance with date.",
    ],
    builderVerifierSeparation:
      "Builder and verifier child tasks reference disjoint Beads session IDs " +
      "(builder_session ≠ verifier_session).  Controller may not delegate to the same " +
      "agent that built the increment being evaluated.",
    controllerTransitions: ["CONTINUE", "REWORK", "REPLAN", "WAIT", "COMPLETE", "ESCALATE", "ABORT"],
    stopConditions: {
      successful_completion:
        "All global ACs proven → controller emits COMPLETE, closes epic.",
      failed_verification_rework:
        "Verifier returns REWORK with defect evidence → controller delegates " +
        "one bounded repair task; second REWORK without new evidence → ESCALATE.",
      repeated_no_progress_wait_or_escalate:
        "Two consecutive iterations with zero newly proven ACs → WAIT with " +
        "explicit resume condition, or ESCALATE if human decision is needed.",
    },
  },
  {
    level: "feature",
    beadsType: "feature",
    mandatoryLabels: [],
    mandatoryMetadataKeys: [],
    trigger:
      "A user story is decomposed from an epic AC or stakeholder request, " +
      "with a named user role, a stated goal, and a justification.",
    parentContext:
      "Must be linked to a parent epic (or standalone if no epic exists). " +
      "Depends on any blocking design or architecture decisions.",
    acceptanceEvidence: [
      "Each user-story AC is independently verifiable and maps to a test or observable output.",
      "The feature represents a single user-observable capability — not a technical subtask.",
      "Review and verification sessions have distinct agents.",
      "All linked child tasks are closed.",
    ],
    builderVerifierSeparation:
      "Builder claims the feature task before writing; verifier uses a fresh session " +
      "and produces a typed verdict (ACCEPTED / REWORK / ESCALATE).  " +
      "The feature itself is the user-story representation: it states a user role, " +
      "goal, and why — never a pure implementation ticket.",
    controllerTransitions: ["CONTINUE", "REWORK", "REPLAN", "WAIT", "COMPLETE", "ESCALATE", "ABORT"],
    stopConditions: {
      successful_completion:
        "All feature ACs proven by verifier → COMPLETE, feature closed.",
      failed_verification_rework:
        "Verifier returns REWORK → one bounded repair; repeated REWORK " +
        "without new evidence → ESCALATE to epic controller.",
      repeated_no_progress_wait_or_escalate:
        "Two consecutive verification cycles with no newly proven criteria → " +
        "WAIT with stated resume condition.",
    },
  },
  {
    level: "task",
    beadsType: "task",
    mandatoryLabels: [],
    mandatoryMetadataKeys: ["loop_max_attempts"],
    trigger:
      "A bounded unit of work is identified with explicit ACs, file boundaries, " +
      "and an agent role (builder / verifier / controller).",
    parentContext:
      "Always a child of a feature or epic.  Depends on all its declared dependency tasks. " +
      "Claim only when all blockers are closed.",
    acceptanceEvidence: [
      "All task ACs have deterministic evidence (test pass, typecheck, or observable output).",
      "Changed files are within the declared boundary.",
      "Verifier session differs from builder session.",
    ],
    builderVerifierSeparation:
      "Builder claims (--claim) before first write and records builder_session. " +
      "Verifier is a separate delegate with verifier_session ≠ builder_session. " +
      "Verifier does not repair files.",
    controllerTransitions: ["CONTINUE", "REWORK", "REPLAN", "WAIT", "COMPLETE", "ESCALATE", "ABORT"],
    stopConditions: {
      successful_completion:
        "Verifier returns ACCEPTED → controller emits COMPLETE, task closed.",
      failed_verification_rework:
        "Verifier returns REWORK → builder retries with changed hypothesis. " +
        "loop_max_attempts exhausted → ESCALATE.",
      repeated_no_progress_wait_or_escalate:
        "Two REWORK cycles with identical evidence signatures → WAIT or ABORT.",
    },
  },
  {
    level: "bug",
    beadsType: "bug",
    mandatoryLabels: [],
    mandatoryMetadataKeys: [],
    trigger:
      "A reproducible defect is observed in an active deliverable with " +
      "exact reproduction steps and a falsifiable expected outcome.",
    parentContext:
      "May be standalone or linked to the feature/epic that owns the defect. " +
      "Depends on the reproduction environment being available.",
    acceptanceEvidence: [
      "Defect is no longer reproducible with the stated reproduction steps.",
      "A regression test covers the scenario and passes.",
      "Root cause is recorded in Beads notes.",
    ],
    builderVerifierSeparation:
      "Builder and verifier are separate sessions. " +
      "Verifier reproduces the original defect independently before accepting the fix.",
    controllerTransitions: ["COMPLETE", "REWORK", "WAIT", "ESCALATE", "ABORT"],
    stopConditions: {
      successful_completion:
        "Defect is no longer reproducible; regression test passes → COMPLETE.",
      failed_verification_rework:
        "Verifier can still reproduce → REWORK.  loop_max_attempts exhausted → ESCALATE.",
      repeated_no_progress_wait_or_escalate:
        "Root cause unknown after two bounded attempts → WAIT for diagnostic capability " +
        "or ESCALATE to principal engineer.",
    },
  },
  {
    level: "incident",
    beadsType: "bug",                          // ← Beads native type
    mandatoryLabels: ["incident"],             // ← MANDATORY: distinguishes from ordinary bugs
    mandatoryMetadataKeys: ["severity"],       // ← MANDATORY: P0/P1/P2 severity level
    trigger:
      "An unplanned service degradation or outage is detected with active user impact. " +
      "Filed immediately as type=bug + label=incident before root cause is known.",
    parentContext:
      "Standalone (no parent required during active response). " +
      "Linked to the affected feature/epic retrospectively.",
    acceptanceEvidence: [
      "Service is restored to pre-incident behavior.",
      "Root cause, mitigation, and prevention action are recorded in Beads.",
      "A post-incident task is created for the permanent fix.",
      "Severity and impact window are stated.",
    ],
    builderVerifierSeparation:
      "Incident responder (builder role) applies mitigation.  " +
      "A second on-call (verifier role) independently confirms service restoration " +
      "before the incident is closed.  The incident controller records the transition.",
    controllerTransitions: ["COMPLETE", "REWORK", "ESCALATE", "WAIT", "ABORT"],
    stopConditions: {
      successful_completion:
        "Service restored, root cause recorded, post-incident task created → COMPLETE.",
      failed_verification_rework:
        "Service not fully restored → REWORK: apply next mitigation step; " +
        "loop_max_attempts does not apply during an active outage — keep iterating " +
        "until service is restored or ESCALATE to principal engineer.",
      repeated_no_progress_wait_or_escalate:
        "Mitigation ineffective after two attempts → ESCALATE to principal engineer " +
        "or WAIT for external dependency (infrastructure, vendor).",
    },
    incidentConvention:
      "Beads has no native 'incident' type.  Incidents use type='bug' with " +
      "mandatory label 'incident' and mandatory metadata key 'severity'.  " +
      "An issue of type='bug' without label 'incident' is an ordinary defect " +
      "report, never an operational incident.  assertIncidentConvention() " +
      "enforces this boundary at runtime.",
  },
];

/** Index contracts by level name for O(1) lookup. */
export const CONTRACT_BY_LEVEL: Readonly<Record<string, LoopLevelContract>> = Object.fromEntries(
  LOOP_LEVEL_CONTRACTS.map(c => [c.level, c]),
);

/**
 * AC-3: Assert that a Beads issue filed as an incident follows the
 * validated convention.  Throws if the issue would be silently treated
 * as an ordinary bug.
 *
 * @param beadsType  - The issue type (must be "bug" for incidents)
 * @param labels     - The issue's label set
 * @param metadata   - The issue's metadata map
 */
export function assertIncidentConvention(
  beadsType: string,
  labels: readonly string[],
  metadata: Readonly<Record<string, unknown>>,
): void {
  if (beadsType !== "bug") {
    throw new IncidentConventionError(
      `Incident must use beadsType="bug", got "${beadsType}".`,
    );
  }
  if (!labels.includes("incident")) {
    throw new IncidentConventionError(
      'Incident must carry label "incident". Without it the issue is indistinguishable from an ordinary bug.',
    );
  }
  if (!("severity" in metadata)) {
    throw new IncidentConventionError(
      'Incident must carry metadata key "severity" (e.g., P0/P1/P2).',
    );
  }
}

/**
 * AC-3: Returns true when the given labels and beadsType match the
 * incident convention, without throwing.
 */
export function isIncident(beadsType: string, labels: readonly string[]): boolean {
  return beadsType === "bug" && labels.includes("incident");
}

/** Thrown when an issue violates the incident filing convention. */
export class IncidentConventionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IncidentConventionError";
  }
}

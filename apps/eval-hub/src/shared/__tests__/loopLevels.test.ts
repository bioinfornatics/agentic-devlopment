/**
 * Governed loop level contract tests — dcjv.29
 *
 * AC-1  Each level defines trigger, parent context, acceptance evidence,
 *        builder/verifier separation, controller transitions, stop conditions.
 * AC-2  Feature is the user-story representation.
 * AC-3  Incident uses a validated convention distinct from ordinary bugs.
 * AC-4  Scenarios for all levels include successful completion, REWORK,
 *        and WAIT-or-ESCALATE.
 * AC-5  Focused tests and structural validation pass (typecheck is AC-5 gate).
 */
import { describe, expect, it } from "vitest";
import {
  CONTRACT_BY_LEVEL,
  CONTROLLER_TRANSITIONS,
  IncidentConventionError,
  LOOP_LEVEL_CONTRACTS,
  REQUIRED_SCENARIO_TYPES,
  assertIncidentConvention,
  isIncident,
} from "../loopLevels.js";

// ── AC-1: structural completeness for all five levels ─────────────────────────

describe("AC-1 all five work levels are defined with required fields", () => {
  const EXPECTED_LEVELS = ["epic", "feature", "task", "bug", "incident"] as const;

  it("defines exactly five levels", () => {
    expect(LOOP_LEVEL_CONTRACTS.map(c => c.level).sort()).toEqual([...EXPECTED_LEVELS].sort());
  });

  for (const level of EXPECTED_LEVELS) {
    describe(`level: ${level}`, () => {
      it("has a non-empty trigger", () => {
        expect(CONTRACT_BY_LEVEL[level]?.trigger.length).toBeGreaterThan(0);
      });

      it("has a non-empty parentContext", () => {
        expect(CONTRACT_BY_LEVEL[level]?.parentContext.length).toBeGreaterThan(0);
      });

      it("has at least one acceptance evidence item", () => {
        expect((CONTRACT_BY_LEVEL[level]?.acceptanceEvidence.length ?? 0)).toBeGreaterThan(0);
      });

      it("has a non-empty builderVerifierSeparation", () => {
        expect(CONTRACT_BY_LEVEL[level]?.builderVerifierSeparation.length).toBeGreaterThan(0);
      });

      it("has at least COMPLETE and one exit transition", () => {
        const transitions = CONTRACT_BY_LEVEL[level]?.controllerTransitions ?? [];
        expect(transitions).toContain("COMPLETE");
        const exits = transitions.filter(t => t !== "CONTINUE" && t !== "COMPLETE");
        expect(exits.length).toBeGreaterThan(0);
      });

      it("all declared transitions are valid", () => {
        const transitions = CONTRACT_BY_LEVEL[level]?.controllerTransitions ?? [];
        for (const t of transitions) {
          expect(CONTROLLER_TRANSITIONS as readonly string[]).toContain(t);
        }
      });

      it("has stop conditions for all three required scenario types", () => {
        const stop = CONTRACT_BY_LEVEL[level]?.stopConditions;
        for (const scenarioType of REQUIRED_SCENARIO_TYPES) {
          expect(stop?.[scenarioType]?.length ?? 0).toBeGreaterThan(0);
        }
      });
    });
  }
});

// ── AC-2: feature is the user-story representation ────────────────────────────

describe("AC-2 feature level is the user-story representation", () => {
  const feature = CONTRACT_BY_LEVEL["feature"]!;

  it("uses beadsType=feature", () => {
    expect(feature.beadsType).toBe("feature");
  });

  it("trigger mentions a user role or user story", () => {
    expect(feature.trigger.toLowerCase()).toMatch(/user story|user role|user/);
  });

  it("builderVerifierSeparation explicitly names the feature as user-story representation", () => {
    expect(feature.builderVerifierSeparation.toLowerCase()).toMatch(/user.?story/);
  });

  it("acceptance evidence requires user-observable capability", () => {
    const evidenceText = feature.acceptanceEvidence.join(" ").toLowerCase();
    expect(evidenceText).toMatch(/user.observable|user.story|user role/);
  });
});

// ── AC-3: incident convention is validated and distinct from ordinary bugs ────

describe("AC-3 incident convention is distinct from ordinary bug", () => {
  const incident = CONTRACT_BY_LEVEL["incident"]!;
  const bug = CONTRACT_BY_LEVEL["bug"]!;

  it("incident and bug both use beadsType=bug", () => {
    expect(incident.beadsType).toBe("bug");
    expect(bug.beadsType).toBe("bug");
  });

  it("incident requires mandatory label 'incident'", () => {
    expect(incident.mandatoryLabels).toContain("incident");
  });

  it("ordinary bug does NOT require label 'incident'", () => {
    expect(bug.mandatoryLabels).not.toContain("incident");
  });

  it("incident requires mandatory metadata key 'severity'", () => {
    expect(incident.mandatoryMetadataKeys).toContain("severity");
  });

  it("incident has an explicit incidentConvention explanation", () => {
    expect(incident.incidentConvention?.length ?? 0).toBeGreaterThan(0);
  });

  it("ordinary bug has no incidentConvention field", () => {
    expect(bug.incidentConvention).toBeUndefined();
  });

  it("assertIncidentConvention passes for a valid incident", () => {
    expect(() => assertIncidentConvention("bug", ["incident", "p0"], { severity: "P0" })).not.toThrow();
  });

  it("assertIncidentConvention throws when type is not 'bug'", () => {
    expect(() => assertIncidentConvention("task", ["incident"], { severity: "P1" }))
      .toThrowError(IncidentConventionError);
  });

  it("assertIncidentConvention throws when 'incident' label is absent", () => {
    expect(() => assertIncidentConvention("bug", ["p0"], { severity: "P0" }))
      .toThrowError(IncidentConventionError);
  });

  it("assertIncidentConvention throws when 'severity' metadata is missing", () => {
    expect(() => assertIncidentConvention("bug", ["incident"], {}))
      .toThrowError(IncidentConventionError);
  });

  it("isIncident returns true for type=bug + label=incident", () => {
    expect(isIncident("bug", ["incident", "p0"])).toBe(true);
  });

  it("isIncident returns false for type=bug without 'incident' label (ordinary bug)", () => {
    expect(isIncident("bug", ["regression", "ui"])).toBe(false);
  });

  it("isIncident returns false for type=task even with 'incident' label", () => {
    expect(isIncident("task", ["incident"])).toBe(false);
  });
});

// ── AC-4: every level covers all three required scenario types ─────────────────

describe("AC-4 every level has successful-completion, REWORK, and WAIT-or-ESCALATE scenarios", () => {
  for (const contract of LOOP_LEVEL_CONTRACTS) {
    describe(`${contract.level} stop conditions`, () => {
      it("successful_completion names a COMPLETE action", () => {
        expect(contract.stopConditions.successful_completion.toUpperCase()).toMatch(/COMPLETE/);
      });

      it("failed_verification_rework names a REWORK response", () => {
        expect(contract.stopConditions.failed_verification_rework.toUpperCase()).toMatch(/REWORK|ESCALATE/);
      });

      it("repeated_no_progress names a WAIT or ESCALATE response", () => {
        expect(contract.stopConditions.repeated_no_progress_wait_or_escalate.toUpperCase())
          .toMatch(/WAIT|ESCALATE|ABORT/);
      });
    });
  }
});

// ── Structural: constants integrity ───────────────────────────────────────────

describe("structural: CONTROLLER_TRANSITIONS and REQUIRED_SCENARIO_TYPES are complete", () => {
  it("projects all canonical controller transitions, including early REJECT", () => {
    expect([...CONTROLLER_TRANSITIONS].sort()).toEqual(
      ["ABORT", "COMPLETE", "CONTINUE", "ESCALATE", "REJECT", "REPLAN", "REWORK", "WAIT"],
    );
  });

  it("declares incident REWORK when its scenario emits REWORK", () => {
    expect(CONTRACT_BY_LEVEL.incident?.controllerTransitions).toContain("REWORK");
  });

  it("REQUIRED_SCENARIO_TYPES contains exactly three entries", () => {
    expect(REQUIRED_SCENARIO_TYPES).toHaveLength(3);
    expect([...REQUIRED_SCENARIO_TYPES].sort()).toEqual([
      "failed_verification_rework",
      "repeated_no_progress_wait_or_escalate",
      "successful_completion",
    ]);
  });

  it("CONTRACT_BY_LEVEL index covers all five levels", () => {
    expect(Object.keys(CONTRACT_BY_LEVEL).sort()).toEqual(["bug", "epic", "feature", "incident", "task"]);
  });
});

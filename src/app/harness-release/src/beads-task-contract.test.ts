import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../../..");
const text = (path: string) => readFile(resolve(root, path), "utf8");

const contractMarkers = [
  "## Objective",
  "## First action",
  "## Expected proof",
  "## Stop / escalation",
  "## Current state",
  "## Last attempt",
  "## Next action",
  "## Budget",
];
const eventTypes = ["START", "ATTEMPT", "RESULT", "BLOCKED", "DECISION", "REWORK", "ESCALATE", "COMPLETE", "WAIT"];

describe("Beads task contract documentation", () => {
  it("defines an immediately actionable current-task contract", async () => {
    const framing = await text("src/skills/task-framing/SKILL.md");
    for (const marker of contractMarkers) expect(framing).toContain(marker);
    expect(framing).toContain("Current task contract");
    expect(framing).toContain("Append-only chronology");
  });

  it("keeps current state in notes and comments as typed chronology", async () => {
    const [control, loop, implement, verify] = await Promise.all([
      text("src/skills/loop-control/SKILL.md"),
      text("src/recipes/loop-engineering.yaml"),
      text("src/recipes/implement.yaml"),
      text("src/recipes/verify.yaml"),
    ]);
    expect(control).toContain("Comments are append-only chronology");
    expect(loop).toContain("Refresh the replaceable current-state summary in Beads notes");
    expect(loop).toContain("typed UTC comments");
    expect(implement).toContain("Refresh notes with the current status and next action");
    expect(verify).toContain("Refresh notes with the verification status and next action");
    for (const type of eventTypes) expect(control).toContain(type);
  });

  it("requires contract reconstruction before delegation and verification", async () => {
    const [loop, implement, verify] = await Promise.all([
      text("src/recipes/loop-engineering.yaml"),
      text("src/recipes/implement.yaml"),
      text("src/recipes/verify.yaml"),
    ]);
    for (const recipe of [loop, implement, verify]) {
      expect(recipe).toContain("objective, current state, first action");
      expect(recipe).toContain("expected proof, and remaining budget");
    }
  });
});

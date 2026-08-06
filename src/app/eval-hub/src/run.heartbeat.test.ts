import { describe, expect, it } from "vitest";
import { HeartbeatBlock, heartbeatKey, renderHeartbeat, type HeartbeatState } from "./run.js";

const state = (overrides: Partial<HeartbeatState> = {}): HeartbeatState => ({
  subject: "worker", evalId: 7, repetition: 2, config: "agent_l2", turn: 4, startMs: 1_000, ...overrides,
});

/** Minimal terminal model for the cursor controls emitted by renderHeartbeat. */
function terminalLines(chunks: readonly string[]): string[] {
  const lines = [""];
  let row = 0;
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length;) {
      const control = chunk.slice(i).match(/^\[(\d+)([FJ])/);
      if (control) {
        const count = Number(control[1]);
        if (control[2] === "F") row = Math.max(0, row - count);
        else lines.splice(row);
        if (lines.length === 0) lines.push("");
        i += control[0].length;
        continue;
      }
      const sgr = chunk.slice(i).match(/^\[[0-9;]*m/);
      if (sgr) { i += sgr[0].length; continue; }
      if (chunk[i] === "\n") { row += 1; if (!lines[row]) lines[row] = ""; i += 1; continue; }
      lines[row] = (lines[row] ?? "") + chunk[i];
      i += 1;
    }
  }
  return lines.filter(Boolean);
}

describe("heartbeat renderer", () => {
  it("keys parallel repetitions and configurations without collisions", () => {
    expect(heartbeatKey(state())).not.toBe(heartbeatKey(state({ repetition: 3 })));
    expect(heartbeatKey(state())).not.toBe(heartbeatKey(state({ config: "skill_l2" })));
    expect(heartbeatKey(state())).not.toBe(heartbeatKey(state({ evalId: 8 })));
  });

  it("renders readable output without ANSI controls in non-TTY mode", () => {
    const rendered = renderHeartbeat(new Map([[heartbeatKey(state()), state()]]), 61_000, false);
    expect(rendered.output).toContain("worker");
    expect(rendered.output).not.toContain("\x1b[");
    expect(rendered.lineCount).toBe(1);
  });

  it("replaces a repeated multi-worker TTY block without stale lines", () => {
    const workerA = state({ subject: "worker-a" });
    const workerB = state({ subject: "worker-b", evalId: 8 });
    const first = renderHeartbeat(new Map([[heartbeatKey(workerA), workerA], [heartbeatKey(workerB), workerB]]), 61_000, true);
    const second = renderHeartbeat(new Map([[heartbeatKey(workerB), { ...workerB, turn: 5 }]]), 62_000, true, first.lineCount);
    expect(second.output.startsWith("\x1b[2F\x1b[0J")).toBe(true);
    expect(terminalLines([first.output, second.output])).toEqual([expect.stringContaining("worker-b")]);
  });


  it("keeps active rows below the layer header across repeated production refreshes", () => {
    const chunks = ["L2 AGENTS\n"];
    const block = new HeartbeatBlock(true, output => chunks.push(output));
    const active = new Map([[heartbeatKey(state()), state()]]);

    block.refresh(active, 61_000);
    block.refresh(active, 62_000);

    expect(terminalLines(chunks)).toEqual([
      "L2 AGENTS",
      expect.stringContaining("worker"),
    ]);
  });

  it("restores active rows after ordinary output and cleans up only when empty", () => {
    const chunks = ["L2 AGENTS\n"];
    const block = new HeartbeatBlock(true, output => chunks.push(output));
    const active = new Map([[heartbeatKey(state()), state()]]);

    block.refresh(active, 61_000);
    block.clear(61_500);             // cliLog: clear owned rows
    chunks.push("RESULT worker passed\n");
    block.refresh(active, 61_500);   // cliLog: restore while active
    expect(terminalLines(chunks)).toEqual([
      "L2 AGENTS",
      "RESULT worker passed",
      expect.stringContaining("worker"),
    ]);

    block.refresh(new Map(), 62_000);
    expect(terminalLines(chunks)).toEqual([
      "L2 AGENTS",
      "RESULT worker passed",
    ]);
  });

  it("clears the complete TTY block when no workers remain", () => {
    const active = new Map([[heartbeatKey(state()), state()]]);
    const first = renderHeartbeat(active, 61_000, true);
    const empty = renderHeartbeat(new Map(), 62_000, true, first.lineCount);
    expect(empty).toEqual({ output: "\x1b[1F\x1b[0J", lineCount: 0 });
    expect(terminalLines([first.output, empty.output])).toEqual([]);
  });
});

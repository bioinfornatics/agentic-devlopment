/**
 * IGooseRunner implementation — spawns the Goose binary and yields line events.
 * Handles stdout/stderr streaming and exit code.
 */
import { spawn }     from "node:child_process";
import type { IGooseRunner, GooseRunConfig, GooseRawEvent } from "./ports.js";

export class GooseProcessRunner implements IGooseRunner {

  async *run(config: GooseRunConfig): AsyncGenerator<GooseRawEvent> {
    const proc = spawn(config.gooseCli, [...config.args], {
      cwd:   config.cwd,
      env:   { ...process.env, ...(config.env ?? {}) },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const queue: GooseRawEvent[]  = [];
    let   resolve: (() => void) | null = null;
    let   done = false;

    function push(ev: GooseRawEvent) {
      queue.push(ev);
      resolve?.();
      resolve = null;
    }

    function waitForData(): Promise<void> {
      if (queue.length > 0) return Promise.resolve();
      return new Promise(res => { resolve = res; });
    }

    // Timeout guard
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (config.timeoutMs) {
      timer = setTimeout(() => { push({ type: "exit", code: null, signal: "SIGKILL" }); proc.kill("SIGKILL"); }, config.timeoutMs);
    }

    // Pipe stdout line by line
    let stdoutBuf = "";
    proc.stdout.on("data", (chunk: Buffer) => {
      stdoutBuf += chunk.toString();
      const lines = stdoutBuf.split("\n");
      stdoutBuf = lines.pop() ?? "";
      for (const line of lines) push({ type: "line", stream: "stdout", text: line });
    });
    proc.stdout.on("end", () => {
      if (stdoutBuf) push({ type: "line", stream: "stdout", text: stdoutBuf });
    });

    let stderrBuf = "";
    proc.stderr.on("data", (chunk: Buffer) => {
      stderrBuf += chunk.toString();
      const lines = stderrBuf.split("\n");
      stderrBuf = lines.pop() ?? "";
      for (const line of lines) push({ type: "line", stream: "stderr", text: line });
    });
    proc.stderr.on("end", () => {
      if (stderrBuf) push({ type: "line", stream: "stderr", text: stderrBuf });
    });

    proc.on("close", (code, signal) => {
      clearTimeout(timer);
      done = true;
      push({ type: "exit", code, signal: signal ?? null });
    });

    // Yield events as they arrive
    while (true) {
      await waitForData();
      while (queue.length > 0) {
        const ev = queue.shift()!;
        yield ev;
        if (ev.type === "exit") return;
      }
      if (done && queue.length === 0) return;
    }
  }

  async version(cli: string): Promise<string> {
    return new Promise((res, rej) => {
      const proc = spawn(cli, ["--version"], { stdio: ["ignore", "pipe", "pipe"] });
      let out = "";
      proc.stdout.on("data", (c: Buffer) => { out += c.toString(); });
      proc.on("close", () => res(out.trim()));
      proc.on("error", rej);
    });
  }
}

/**
 * IGooseRunner implementation — spawns the Goose binary and yields line events.
 * Handles stdout/stderr streaming and exit code.
 *
 * Goose v1.37.0+ compat: --system with multi-line content is broken (exit 2).
 * Workaround: when --system has multi-line content, write a combined instructions
 * file (skill context + task) and use --instructions <file> instead.
 */
import { spawn }     from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join }      from "node:path";
import { tmpdir }    from "node:os";
import type { IGooseRunner, GooseRunConfig, GooseRawEvent } from "./ports.js";

/**
 * Rewrite multiline --system + --text args to use --instructions <tmpfile>.
 * This avoids a Goose v1.37.0 regression where --system with newlines exits 2.
 * Returns the rewritten args and an optional cleanup function.
 */
function rewriteSystemArg(args: readonly string[]): { args: readonly string[]; cleanup: (() => void) | null } {
  const mutable = [...args];
  const sysIdx = mutable.indexOf("--system");
  if (sysIdx < 0) return { args, cleanup: null };
  const sysContent = mutable[sysIdx + 1];
  if (!sysContent || !sysContent.includes("\n")) return { args, cleanup: null };

  // Has multiline system instruction — rewrite to avoid Goose v1.37.0 bug
  const textIdx = mutable.indexOf("--text");
  const taskText = textIdx >= 0 ? (mutable[textIdx + 1] ?? "") : "";

  const tmpDir = mkdtempSync(join(tmpdir(), "goose-eval-"));
  const instrFile = join(tmpDir, "instructions.txt");
  const combined = sysContent + "\n\n---\n\nTask:\n" + taskText;
  writeFileSync(instrFile, combined, "utf8");

  const rebuilt: string[] = [];
  for (let i = 0; i < mutable.length; i++) {
    if ((mutable[i] === "--system" || mutable[i] === "--text") && i + 1 < mutable.length) {
      i++;
      continue;
    }
    rebuilt.push(mutable[i]!);
  }
  rebuilt.push("--instructions", instrFile);

  return { args: rebuilt, cleanup: () => rmSync(tmpDir, { recursive: true, force: true }) };
}

export class GooseProcessRunner implements IGooseRunner {

  async *run(config: GooseRunConfig): AsyncGenerator<GooseRawEvent> {
    const { args: resolvedArgs, cleanup } = rewriteSystemArg(config.args);

    const proc = spawn(config.gooseCli, [...resolvedArgs], {
      cwd: config.cwd, env: config.inheritEnv === false ? (config.env ?? {}) : { ...process.env, ...(config.env ?? {}) }, stdio: ["ignore", "pipe", "pipe"],
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

    let timer: ReturnType<typeof setTimeout> | undefined;
    if (config.timeoutMs) {
      timer = setTimeout(() => { push({ type: "exit", code: null, signal: "SIGKILL" }); proc.kill("SIGKILL"); }, config.timeoutMs);
    }

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

    while (true) {
      await waitForData();
      while (queue.length > 0) {
        const ev = queue.shift()!;
        yield ev;
        if (ev.type === "exit") {
          cleanup?.();
          return;
        }
      }
      if (done && queue.length === 0) { cleanup?.(); return; }
    }
  }

  async version(cli: string): Promise<string> {
    return (await this.identity(cli)).version;
  }

  async identity(cli: string, sandbox?: import("./ports.js").SandboxProcessConfig): Promise<import("./ports.js").GooseRuntimeIdentity> {
    return new Promise((resolve, reject) => {
      const proc = spawn(cli, ["info", "--verbose"], { cwd: sandbox?.projectRoot, env: sandbox?.env, stdio: ["ignore", "pipe", "pipe"] });
      let out = "";
      let err = "";
      proc.stdout.on("data", (chunk: Buffer) => { out += chunk.toString(); });
      proc.stderr.on("data", (chunk: Buffer) => { err += chunk.toString(); });
      proc.on("close", code => {
        if (code !== 0) { reject(new Error(`goose info failed: ${err.trim()}`)); return; }
        const value = (name: string) => out.match(new RegExp(`^\\s*${name}:\\s*(.+)$`, "m"))?.[1]?.trim() ?? null;
        resolve({ version: value("Version") ?? "unknown", provider: value("GOOSE_PROVIDER") ?? value("active_provider"), model: value("GOOSE_MODEL") });
      });
      proc.on("error", reject);
    });
  }
}

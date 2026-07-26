import fs from "node:fs/promises";
import path from "node:path";
import { loadMinimalHarnessCatalog } from "./domains/execution/minimalHarnessCatalog.js";
import { PROJECT_ROOT } from "./shared/paths.js";

export async function startBenchmark(args: string[]): Promise<void> {
  const jsonIndex = args.indexOf("--json");
  const jsonPath = jsonIndex >= 0 ? args[jsonIndex + 1] : undefined;
  const catalog = await loadMinimalHarnessCatalog();
  const summary = {
    schema: "minimal-harness-evaluation-v1",
    decisionRule: "smallest quality-non-inferior configuration strictly better on at least one efficiency metric",
    qualityGate: ["acceptance_criteria_proven", "no_unsafe_action", "no_scope_violation", "no_unsupported_success_claim", "transition_correct"],
    efficiencyMetrics: ["turns", "tool_calls", "delegations", "files_read", "input_tokens", "context_tokens", "output_tokens", "wall_time_ms", "iterations", "no_progress_iterations"],
    catalog,
  };
  const rendered = JSON.stringify(summary, null, 2) + "\n";
  if (jsonPath) {
    const target = path.resolve(jsonPath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, rendered);
    console.log("Minimal harness benchmark catalog: " + target);
  } else console.log(rendered);
}

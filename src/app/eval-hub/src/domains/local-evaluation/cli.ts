import { join } from "node:path";
import type { LocalFullOptions } from "./fullRunner.js";
import type { SmokeEvidence, SmokeOptions } from "./smokeRunner.js";

export interface LocalEvaluationCliDependencies {
  smoke(options: SmokeOptions): Promise<SmokeEvidence>;
  full(options: LocalFullOptions): Promise<unknown>;
}

/** Dispatch the production `--run --profile smoke|full` boundary. */
export async function runLocalEvaluationProfile(
  args: string[],
  dependencies: LocalEvaluationCliDependencies,
  repositoryRoot = process.cwd(),
): Promise<void> {
  const profileIndex = args.indexOf("--profile");
  const profile = profileIndex >= 0 ? args[profileIndex + 1] : undefined;
  const evidenceIndex = args.indexOf("--evidence");
  const evidence = evidenceIndex >= 0 ? args[evidenceIndex + 1] : undefined;

  if (profile === "smoke") {
    await dependencies.smoke({
      repositoryRoot,
      evidencePath: evidence ?? join(repositoryRoot, "src/app/eval-hub/dist/evidence/smoke.json"),
    });
    return;
  }
  if (profile === "full") {
    await dependencies.full({ repositoryRoot });
    return;
  }
  throw new Error(`Unknown profile: ${profile ?? ""} (expected smoke|full)`);
}

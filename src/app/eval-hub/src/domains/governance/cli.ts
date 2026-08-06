import { checkConsistency } from "./consistencyChecks.js";

export async function runConsistencyCli(root = process.cwd(), write: (line: string) => void = console.log): Promise<0 | 1> {
  try {
    const result = await checkConsistency(root);
    for (const finding of result.findings) write("  [" + finding.level + "] " + finding.message);
    write(result.failures ? "  " + result.failures + " FAIL(s) — fix before committing." : "  All consistency checks passed ✓");
    return result.failures ? 1 : 0;
  } catch (error) {
    write("check-consistency: " + (error instanceof Error ? error.message : String(error)));
    return 1;
  }
}

/**
 * Rezi TUI application state.
 * Immutable — updated via dispatch() as partial patches.
 */
import type { EvalKind, ExecStatus } from "../shared/types.js";
import type { CheckResult } from "../domains/governance/consistencyChecker.js";
import type { HistoryRow }  from "../domains/persistence/ports.js";

export type Screen = "dashboard" | "runs" | "workspace" | "analysis" | "consistency" | "report";

export interface RunSummary {
  runId:    string;
  kind:     EvalKind;
  subject:  string;
  status:   ExecStatus;
  progress: number;   // 0-100
  delta?:   number;
  startedAt: string;
}

export interface LiveEval {
  kind:     EvalKind;
  subject:  string;
  evalId:   number;
  config:   string;
  turn:     number;
  status:   ExecStatus;
  lastLine: string;
}

export interface AppState {
  // Navigation
  readonly screen:      Screen;

  // Live execution
  readonly activeRuns:  readonly RunSummary[];
  readonly liveEvals:   readonly LiveEval[];
  readonly logLines:    readonly string[];         // capped at 200

  // History
  readonly historyRuns: readonly HistoryRow[];
  readonly historyLoading: boolean;

  // Consistency
  readonly consistencyChecks: readonly CheckResult[];
  readonly consistencyLoading: boolean;

  // Workspace
  readonly workspaceKind: EvalKind;
  readonly workspaceSubjects: readonly string[];

  // Errors
  readonly lastError: string | null;
}

export const INITIAL_STATE: AppState = {
  screen:              "dashboard",
  activeRuns:          [],
  liveEvals:           [],
  logLines:            [],
  historyRuns:         [],
  historyLoading:      false,
  consistencyChecks:   [],
  consistencyLoading:  false,
  workspaceKind:       "skills",
  workspaceSubjects:   [],
  lastError:           null,
};

export function addLog(state: AppState, line: string): Partial<AppState> {
  const lines = [...state.logLines, line].slice(-200);
  return { logLines: lines };
}

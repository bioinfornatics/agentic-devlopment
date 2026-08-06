// @ts-nocheck — rezi-ui beta API evolving; type errors deferred
/**
 * Dashboard TUI screen — live eval monitor, recent results, consistency status.
 */
import { ui }   from "@rezi-ui/core";
import type { AppState, Screen } from "../state.js";

type Dispatch = (patch: Partial<AppState>) => void;

export function Dashboard(state: AppState, update: Dispatch) {
  return ui.appShell({
    sidebar: {
      items: navItems(state.screen, update),
    },
    header: {
      title: "Eval Hub",
      subtitle: `${state.activeRuns.length} active · ${state.historyRuns.length} in history`,
    },
    children: [
      ui.box({
        direction: "column",
        gap: 1,
        children: [
          // ── Active runs ────────────────────────────────────────────────
          ui.box({
            children: [
              ui.text({ text: "Active Runs", variant: "heading" }),
            ],
          }),
          state.activeRuns.length === 0
            ? ui.empty({ title: "No active runs", description: "Start a layered eval with POST /api/evals/layered" })
            : ui.table({
                columns: [
                  { key: "kind",    header: "Kind",    width: 10 },
                  { key: "subject", header: "Subject", width: 32 },
                  { key: "status",  header: "Status",  width: 10 },
                  { key: "progress",header: "Progress",width: 12 },
                  { key: "delta",   header: "Δ",       width: 8 },
                ],
                rows: state.activeRuns.map(r => ({
                  kind:     r.kind,
                  subject:  r.subject,
                  status:   r.status,
                  progress: `${r.progress}%`,
                  delta:    r.delta !== undefined ? (r.delta >= 0 ? "+" : "") + r.delta.toFixed(3) : "—",
                })),
              }),

          // ── Live log ───────────────────────────────────────────────────
          ui.text({ text: "Live Output", variant: "heading" }),
          ui.logsConsole({
            entries: state.logLines.slice(-30).map((line, i) => ({
              id:        String(i),
              level:     "info" as const,
              message:   line,
              timestamp: "",
            })),
          }),

          // ── Consistency summary ────────────────────────────────────────
          ui.text({ text: "Consistency", variant: "heading" }),
          state.consistencyLoading
            ? ui.spinner({ label: "Checking…" })
            : ConsistencySummary(state),
        ],
      }),
    ],
  });
}

function ConsistencySummary(state: AppState) {
  const checks = state.consistencyChecks;
  if (checks.length === 0) {
    return ui.callout({ intent: "info", title: "Not yet checked", message: "Navigate to Consistency screen to run checks." });
  }
  const failed = checks.filter(c => c.status === "fail").length;
  const warned = checks.filter(c => c.status === "warn").length;
  return ui.box({
    direction: "row",
    gap: 2,
    children: [
      ui.badge({ label: `${checks.filter(c => c.status === "pass").length} pass`, variant: "success" }),
      warned > 0 ? ui.badge({ label: `${warned} warn`, variant: "warning" }) : null,
      failed > 0 ? ui.badge({ label: `${failed} fail`, variant: "error"   }) : null,
    ].filter(Boolean) as ReturnType<typeof ui.badge>[],
  });
}

export function navItems(current: Screen, dispatch: Dispatch) {
  const items: { label: string; screen: Screen }[] = [
    { label: "Dashboard",    screen: "dashboard"    },
    { label: "Runs",         screen: "runs"         },
    { label: "Workspace",    screen: "workspace"    },
    { label: "Analysis",     screen: "analysis"     },
    { label: "Consistency",  screen: "consistency"  },
    { label: "Report",       screen: "report"       },
  ];
  return items.map(item => ({
    label:    item.label,
    selected: current === item.screen,
    onSelect: () => dispatch({ screen: item.screen }),
  }));
}

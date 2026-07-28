// @ts-nocheck — rezi-ui beta API evolving; type errors deferred
/** History TUI screen — shows recent eval runs with pass rates and deltas. */
import { ui } from "@rezi-ui/core";
import type { AppState } from "../state.js";
import { navItems } from "./dashboard.js";

type Dispatch = (patch: Partial<AppState>) => void;

export function HistoryScreen(state: AppState, update: Dispatch) {
  return ui.appShell({
    sidebar: { items: navItems(state.screen, update) },
    header:  { title: "Eval History", subtitle: `${state.historyRuns.length} runs` },
    children: [
      ui.box({
        direction: "column",
        gap: 1,
        children: [
          state.historyLoading
            ? ui.spinner({ label: "Loading history…" })
            : state.historyRuns.length === 0
              ? ui.empty({ title: "No history", description: "Run an eval to populate history." })
              : ui.table({
                  columns: [
                    { key: "createdAt", header: "Date",    width: 20 },
                    { key: "kind",      header: "Kind",    width: 10 },
                    { key: "subject",   header: "Subject", width: 32 },
                    { key: "model",     header: "Model",   width: 20 },
                    { key: "turns",     header: "Turns",   width: 8 },
                  ],
                  rows: state.historyRuns.map(r => ({
                    createdAt: r.createdAt.slice(0, 16),
                    kind:      r.kind,
                    subject:   r.subject,
                    model:     r.model ?? "—",
                    turns:     r.turnsUsedMean?.toFixed(1) ?? "—",
                  })),
                }),
        ],
      }),
    ],
  });
}

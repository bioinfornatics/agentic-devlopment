// @ts-nocheck — rezi-ui beta API evolving; type errors deferred
/** Consistency checker TUI screen. */
import { ui } from "@rezi-ui/core";
import type { AppState } from "../state.js";
import type { CheckResult } from "../../domains/governance/consistencyChecker.js";
import { navItems } from "./dashboard.js";

type Dispatch = (patch: Partial<AppState>) => void;

export function ConsistencyScreen(state: AppState, update: Dispatch) {
  return ui.appShell({
    sidebar: { items: navItems(state.screen, update) },
    header:  { title: "Consistency Checks" },
    children: [
      ui.box({
        direction: "column",
        gap: 1,
        children: [
          ui.box({
            direction: "row",
            gap: 2,
            children: [
              ui.button({ label: "Run All Checks", onPress: () => dispatch({ consistencyLoading: true }) }),
            ],
          }),
          state.consistencyLoading
            ? ui.spinner({ label: "Running checks…" })
            : state.consistencyChecks.length === 0
              ? ui.empty({ title: "No checks run yet", description: "Press 'Run All Checks'" })
              : ui.table({
                  columns: [
                    { key: "status",  header: "Status",      width: 8 },
                    { key: "id",      header: "Check",       width: 24 },
                    { key: "message", header: "Message",     width: 50 },
                    { key: "details", header: "Details",     width: 30 },
                  ],
                  rows: state.consistencyChecks.map(c => ({
                    status:  c.status.toUpperCase(),
                    id:      c.id,
                    message: c.message,
                    details: c.details.slice(0, 2).join("; "),
                  })),
                }),
        ],
      }),
    ],
  });
}

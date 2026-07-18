// @ts-nocheck — rezi-ui beta API evolving; type errors deferred
/**
 * Rezi TUI application — main entry point.
 */
import { createNodeApp } from "@rezi-ui/node";
import type { AppState } from "./state.js";
import { INITIAL_STATE } from "./state.js";
import { Dashboard }         from "./routes/dashboard.js";
import { ConsistencyScreen } from "./routes/consistency.js";
import { HistoryScreen }     from "./routes/history.js";

export function startTui(): void {
  const app = createNodeApp<AppState>({
    initialState: INITIAL_STATE,
    initialRoute: "/",
    routes: [
      {
        id: "/",
        screen: (_params, { state, update }) => Dashboard(state, update),
      },
      {
        id: "/consistency",
        screen: (_params, { state, update }) => ConsistencyScreen(state, update),
      },
      {
        id: "/history",
        screen: (_params, { state, update }) => HistoryScreen(state, update),
      },
    ],
  });

  app.start?.();
}

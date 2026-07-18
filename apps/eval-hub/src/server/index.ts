/**
 * Hono HTTP API server.
 * Thin adapter layer — delegates all logic to domain services.
 * Supports SSE for real-time eval progress streaming via EventBus.
 */
import { Hono }               from "hono";
import { serve }              from "@hono/node-server";
import { streamSSE }          from "hono/streaming";
import { SqliteHistoryRepository } from "../domains/persistence/historyRepo.js";
import { FsWorkspaceReader }       from "../domains/persistence/workspaceReader.js";
import { DeltaService }            from "../domains/measurement/deltaService.js";
import { QualityGate }             from "../domains/measurement/qualityGate.js";
import { ConsistencyChecker }      from "../domains/governance/consistencyChecker.js";
import { HtmlReportBuilder }       from "../domains/reporting/htmlBuilder.js";
import { LayeredRunner }           from "../domains/execution/layeredRunner.js";
import { EventBus }                from "../shared/eventBus.js";
import { LAYER_META }              from "../shared/types.js";
import type { EvalKind }           from "../shared/types.js";

// ── Injectable dependencies ───────────────────────────────────────────────────

export interface AppDeps {
  history:   SqliteHistoryRepository;
  workspace: FsWorkspaceReader;
  delta:     DeltaService;
  gate:      QualityGate;
  checker:   ConsistencyChecker;
  report:    HtmlReportBuilder;
}

function defaultDeps(): AppDeps {
  return {
    history:   new SqliteHistoryRepository(),
    workspace: new FsWorkspaceReader(),
    delta:     new DeltaService(),
    gate:      new QualityGate(),
    checker:   new ConsistencyChecker(),
    report:    new HtmlReportBuilder(),
  };
}

/** Active eval buses — keyed by runId, cleaned up after 1 h of inactivity. */
const activeBuses = new Map<string, EventBus>();

export function createApp(deps: AppDeps = defaultDeps()): Hono {
  const { history, workspace, delta, gate, checker, report } = deps;
  const app = new Hono();

  // ── Health ────────────────────────────────────────────────────────────────

  app.get("/health", c => c.json({ ok: true, ts: new Date().toISOString() }));

  // ── History ───────────────────────────────────────────────────────────────

  app.get("/api/history", async c => {
    const kind    = c.req.query("kind") as EvalKind | undefined;
    const subject = c.req.query("subject");
    const limit   = parseInt(c.req.query("limit") ?? "50", 10);
    const runs    = await history.listRuns({ ...(kind ? { kind } : {}), ...(subject ? { subject } : {}), limit });
    return c.json(runs);
  });

  app.get("/api/history/:runId", async c => {
    const run = await history.findRun(c.req.param("runId"));
    if (!run) return c.json({ error: "not found" }, 404);
    const [results, improvements] = await Promise.all([
      history.listResults(run.runId),
      history.listImprovements(run.runId),
    ]);
    return c.json({ run, results, improvements });
  });

  // ── Analysis ──────────────────────────────────────────────────────────────

  app.get("/api/analysis/:kind/:subject", async c => {
    const kind    = c.req.param("kind") as EvalKind;
    const subject = c.req.param("subject");
    const runs    = await workspace.listRuns(kind, subject);
    if (runs.length === 0) return c.json({ error: "no runs found" }, 404);

    const { hash }    = runs[0]!;
    const gradings    = await workspace.readGradings(kind, subject, hash);
    const [withCfg, baseCfg] = LAYER_META[kind].configs;
    const withStats   = delta.passRate(gradings, withCfg!);
    const baseStats   = delta.passRate(gradings, baseCfg!);
    const d           = delta.delta(withStats, baseStats);
    const negGate     = gate.negativeDeltaGate([d.passRate]);
    const effGate     = gate.efficiencyGate([], 8);

    return c.json({
      subject, kind, hash,
      withPassRate: withStats.mean, basePassRate: baseStats.mean,
      delta: d.passRate,
      gates: { negativeDelta: negGate, efficiency: effGate },
    });
  });

  // ── Consistency ───────────────────────────────────────────────────────────

  app.get("/api/consistency", async c => {
    const result = await checker.runAll();
    return c.json(result);
  });

  // ── Reports ───────────────────────────────────────────────────────────────

  app.get("/api/reports/trend", async c => {
    const runs    = await history.listRuns({ limit: 200 });
    const results = (await Promise.all(runs.map(r => history.listResults(r.runId)))).flat();
    return c.html(await report.build({ runs, results, generatedAt: new Date().toISOString() }));
  });

  // ── Workspace ─────────────────────────────────────────────────────────────

  app.get("/api/workspace/:kind", async c => {
    const kind     = c.req.param("kind") as EvalKind;
    const subjects = await workspace.listSubjects(kind);
    return c.json({ kind, subjects, count: subjects.length });
  });

  app.get("/api/workspace/:kind/:subject", async c => {
    const kind    = c.req.param("kind") as EvalKind;
    const subject = c.req.param("subject");
    const runs    = await workspace.listRuns(kind, subject);
    return c.json({ kind, subject, runs });
  });

  // ── Eval runs — start + SSE stream ───────────────────────────────────────

  app.post("/api/evals/layered", async c => {
    const body = await c.req.json() as {
      gooseCli?: string; workers?: number; layers?: string[];
      ambient?: boolean; maxTurns?: number;
    };

    const runId = new Date().toISOString().replace(/[:\-.]/g, "").slice(0, 15) + "Z";
    const bus   = new EventBus();
    activeBuses.set(runId, bus);
    // Auto-clean after 1 h
    setTimeout(() => activeBuses.delete(runId), 3_600_000);

    // Drive the generator in the background — events published to bus
    setImmediate(async () => {
      try {
        const runner = new LayeredRunner();
        for await (const _ev of runner.run({
          layers:             (body.layers ?? ["skills", "agents", "recipes"]) as EvalKind[],
          workers:            body.workers  ?? 3,
          gooseCli:           body.gooseCli ?? "goose",
          maxTurns:           body.maxTurns ?? 8,
          timeoutMs:          300_000,
          ambient:            body.ambient  ?? false,
          continueOnFail:     true,
          earlyStopThreshold: 0,
          noEarlyStop:        false,
          layeredRunId:       runId,
        }, bus)) { /* events flow via bus */ }
      } catch (e) {
        bus.emit({ type: "early_stop", level: "?", kind: "skills" as EvalKind, avgDelta: 0, threshold: 0, skipping: [] });
      }
    });

    return c.json({ runId, stream: `/api/evals/layered/${runId}/events` });
  });

  app.get("/api/evals/layered/:runId/events", async c => {
    const { runId } = c.req.param();
    const bus = activeBuses.get(runId);

    return streamSSE(c, async (stream) => {
      await stream.writeSSE({ data: JSON.stringify({ type: "connected", runId }) });
      if (!bus) {
        await stream.writeSSE({ data: JSON.stringify({ type: "error", message: "run not found" }) });
        return;
      }
      await new Promise<void>(resolve => {
        const cleanup = () => { bus.removeListener("event", onEvent); resolve(); };
        const onEvent = async (ev: unknown) => {
          try {
            await stream.writeSSE({ data: JSON.stringify(ev) });
            const e = ev as { type: string };
            if (e.type === "early_stop") cleanup();
          } catch { cleanup(); }
        };
        bus.on("event", onEvent);
      });
    });
  });

  return app;
}

export function startServer(port: number): void {
  const app = createApp();
  serve({ fetch: app.fetch, port }, info => {
    console.log(`Eval Hub API listening on http://localhost:${info.port}`);
  });
}

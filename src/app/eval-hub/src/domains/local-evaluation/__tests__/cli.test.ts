import { describe, expect, it, vi } from "vitest";
import { runLocalEvaluationProfile } from "../cli.js";

describe("local evaluation production CLI dispatch", () => {
  it("dispatches --run --profile smoke with an explicit evidence path", async () => {
    const smoke = vi.fn().mockResolvedValue({});
    const full = vi.fn();
    await runLocalEvaluationProfile(["--run", "--profile", "smoke", "--evidence", "/tmp/evidence.json"], { smoke, full }, "/repo");
    expect(smoke).toHaveBeenCalledWith({ repositoryRoot: "/repo", evidencePath: "/tmp/evidence.json" });
    expect(full).not.toHaveBeenCalled();
  });

  it("defaults smoke evidence to the surviving eval-hub package", async () => {
    const smoke = vi.fn().mockResolvedValue({});
    await runLocalEvaluationProfile(["--run", "--profile", "smoke"], { smoke, full: vi.fn() }, "/repo");
    expect(smoke).toHaveBeenCalledWith({
      repositoryRoot: "/repo",
      evidencePath: "/repo/src/app/eval-hub/dist/evidence/smoke.json",
    });
  });

  it("dispatches --run --profile full", async () => {
    const smoke = vi.fn();
    const full = vi.fn().mockResolvedValue({});
    await runLocalEvaluationProfile(["--run", "--profile", "full"], { smoke, full }, "/repo");
    expect(full).toHaveBeenCalledWith({ repositoryRoot: "/repo" });
    expect(smoke).not.toHaveBeenCalled();
  });

  it("rejects unknown profiles", async () => {
    await expect(runLocalEvaluationProfile(["--run", "--profile", "other"], { smoke: vi.fn(), full: vi.fn() }, "/repo"))
      .rejects.toThrow("expected smoke|full");
  });
});

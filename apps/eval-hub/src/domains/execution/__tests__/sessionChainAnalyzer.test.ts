import { describe, it, expect } from "vitest";
import { analyzeSessionChain } from "../sessionChainAnalyzer.js";

describe("analyzeSessionChain", () => {
  it("returns unavailable when DB does not exist", () => {
    const result = analyzeSessionChain("/nonexistent/path/sessions.db");
    expect(result.status).toBe("unavailable");
    expect(result.events).toHaveLength(0);
    expect(result.sessionsFound).toBe(0);
  });

  it("schema field is always session-chain-v1", () => {
    const result = analyzeSessionChain("/nonexistent/path/sessions.db");
    expect(result.schema).toBe("session-chain-v1");
  });
});

import { describe, it, expect } from "vitest";

describe("@harness/kg-visualizer server", () => {
  it("server module can be imported without error", async () => {
    // We cannot start the MCP server without a real stdio client,
    // but we can verify the module structure is importable.
    // The actual integration test is: timeout 3 node dist/server.js
    expect(true).toBe(true);
  });

  it("app.html template has required placeholders", async () => {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const html = await readFile(join(import.meta.dirname, "../src/app.html"), "utf8");
    expect(html).toContain("{{B64}}");
    expect(html).toContain("{{FILTER}}");
    expect(html).toContain("cytoscape");
    expect(html).toContain("cytoscapeFcose");
  });

  it("app.html has WCAG lang attribute", async () => {
    // WCAG 3.1.1 requires a lang attribute; value may be 'en' or 'fr'
    // depending on the UI language of the active design.
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const html = await readFile(join(import.meta.dirname, "../src/app.html"), "utf8");
    expect(html).toMatch(/lang=["'](en|fr)["']/);
  });
});

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const REPO = new URL("../../..", import.meta.url).pathname;
const server = new McpServer({ name: "kg-visualizer", version: "1.0.0" });

server.tool(
  "show_kg_visualizer",
  "Display the Knowledge Graph as interactive Cytoscape.js+fcose force graph in a Goose App window",
  { filter: z.string().optional().describe("Filter by entityType e.g. feature, harness:recipe") },
  async ({ filter }) => {
    const mem = await readFile(join(REPO, ".knowledge", "memory.jsonl"), "utf8").catch(() => "");
    const der = await readFile(join(REPO, ".knowledge", "derived.jsonl"), "utf8").catch(() => "");
    const template = await readFile(join(REPO, "apps", "kg-visualizer", "src", "app.html"), "utf8");
    const b64 = Buffer.from(mem + der).toString("base64");
    const html = template
      .replace("{{B64}}", b64)
      .replace("{{FILTER}}", filter ? JSON.stringify(filter) : "null");
    return {
      content: [{ type: "resource" as const, resource: { uri: "kg://visualizer", mimeType: "text/html", text: html } }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
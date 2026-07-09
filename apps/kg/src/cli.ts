import { bootstrap } from "./bootstrap.js";
import { reason, RULES } from "./reason.js";
import { execSync } from "node:child_process";
import { join } from "node:path";
const REPO = new URL("../../..", import.meta.url).pathname;
const [, , cmd, ...args] = process.argv;
const flags: Record<string, string | boolean> = Object.fromEntries(
  args.filter(a => a.startsWith("--")).map(a => {
    const [k, v] = a.slice(2).split("="); return [k, v ?? true];
  })
);
switch (cmd) {
  case "bootstrap": await bootstrap({ product: typeof flags.product === "string" ? flags.product : undefined, dryRun: flags["dry-run"] === true }); break;
  case "reason": await reason({ listRules: flags.rules === true, dryRun: flags["dry-run"] === true }); break;
  case "pipeline": await bootstrap({}); await reason({}); break;
  case "visualize": try { execSync("xdg-open \"" + join(REPO, "dist/kg/index.html") + "\"", { stdio: "ignore" }); } catch { console.log("Open:", join(REPO, "dist/kg/index.html")); } break;
  case "rules": RULES.forEach(r => console.log(r.name)); break;
  default: console.log("Usage: kg <bootstrap|reason|pipeline|visualize|rules> [--dry-run] [--rules] [--product <dir>]");
}
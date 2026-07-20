import { bootstrap } from "./bootstrap.js";
import { reason, RULES } from "./reason.js";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
const REPO = new URL("../../..", import.meta.url).pathname;
const [, , cmd, ...args] = process.argv;
function parseFlags(argv) {
    const flags = {};
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (!a.startsWith("--"))
            continue;
        const raw = a.slice(2);
        const eq = raw.indexOf("=");
        if (eq >= 0) {
            flags[raw.slice(0, eq)] = raw.slice(eq + 1);
            continue;
        }
        const next = argv[i + 1];
        if (next && !next.startsWith("--")) {
            flags[raw] = next;
            i++;
        }
        else
            flags[raw] = true;
    }
    return flags;
}
const flags = parseFlags(args);
const str = (name) => typeof flags[name] === "string" ? flags[name] : undefined;
const dryRun = flags["dry-run"] === true;
switch (cmd) {
    case "bootstrap":
        await bootstrap({ product: str("product"), dryRun, output: str("output") });
        break;
    case "reason":
        await reason({ listRules: flags.rules === true, dryRun, input: str("input"), output: str("output") });
        break;
    case "pipeline": {
        const outputDir = str("output-dir");
        if (outputDir) {
            const memoryOut = join(outputDir, "memory.jsonl");
            const derivedOut = join(outputDir, "derived.jsonl");
            await bootstrap({ product: str("product"), output: memoryOut });
            await reason({ input: memoryOut, output: derivedOut });
        }
        else if (dryRun || str("product")) {
            await bootstrap({ product: str("product"), dryRun });
            await reason({ dryRun });
        }
        else {
            const auditDir = await mkdtemp(join(tmpdir(), "kg-pipeline-"));
            const memoryOut = join(auditDir, "memory.jsonl");
            const derivedOut = join(auditDir, "derived.jsonl");
            await bootstrap({ output: memoryOut });
            await reason({ input: memoryOut, output: derivedOut });
        }
        break;
    }
    case "visualize":
        try {
            execSync("xdg-open \"" + join(REPO, "dist/kg/index.html") + "\"", { stdio: "ignore" });
        }
        catch {
            console.log("Open:", join(REPO, "dist/kg/index.html"));
        }
        break;
    case "rules":
        RULES.forEach(r => console.log(r.name));
        break;
    default: console.log("Usage: kg <bootstrap|reason|pipeline|visualize|rules> [--dry-run] [--rules] [--product <dir>] [--input <jsonl>] [--output <jsonl>] [--output-dir <dir>]");
}

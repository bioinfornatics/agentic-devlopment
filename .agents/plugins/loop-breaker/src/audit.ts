#!/usr/bin/env bun
/**
 * Audit learned error patterns and flag stale ones for cleanup.
 *
 * Criteria for cleanup candidates:
 * - last_used > 6 months ago AND use_count < 3
 * - Patterns with use_count >= 10 are stable and exempt
 *
 * Usage:
 *   bun run src/audit.ts [--cleanup] [--import-yaml <dir>]
 */

import {
  getAllPatterns,
  findStalePatterns,
  deletePattern,
  importFromYaml,
} from "./patterns";

const STALE_MONTHS = 6;
const STABLE_USE_COUNT = 10;
const MIN_USE_COUNT = 3;

interface AuditResult {
  total: number;
  stable: number;
  active: number;
  stale: number;
  deleted: number;
}

function formatDate(isoDate: string): string {
  return isoDate.split("T")[0];
}

async function runAudit(cleanup: boolean = false): Promise<AuditResult> {
  const patterns = getAllPatterns();
  const stalePatterns = findStalePatterns(STALE_MONTHS, MIN_USE_COUNT, STABLE_USE_COUNT);
  const staleIds = new Set(stalePatterns.map(p => p.id));
  
  const stable = patterns.filter(p => p.useCount >= STABLE_USE_COUNT);
  const active = patterns.filter(p => !staleIds.has(p.id) && p.useCount < STABLE_USE_COUNT);
  
  console.log(`Auditing ${patterns.length} learned error patterns...`);
  console.log(`Stale criteria: last_used > ${STALE_MONTHS} months AND use_count < ${MIN_USE_COUNT}`);
  console.log(`Stable criteria: use_count >= ${STABLE_USE_COUNT}`);
  console.log();
  
  if (stable.length > 0) {
    console.log(`✓ STABLE patterns (${stable.length}) - exempt from cleanup:`);
    for (const p of stable) {
      console.log(`  ${p.tool}/${p.signature.slice(0, 40)}...`);
      console.log(`    used ${p.useCount}x, last ${formatDate(p.lastUsedAt)}`);
    }
    console.log();
  }
  
  if (active.length > 0) {
    console.log(`○ ACTIVE patterns (${active.length}) - in use:`);
    for (const p of active) {
      console.log(`  ${p.tool}/${p.signature.slice(0, 40)}...`);
      console.log(`    used ${p.useCount}x, last ${formatDate(p.lastUsedAt)}`);
    }
    console.log();
  }
  
  let deleted = 0;
  if (stalePatterns.length > 0) {
    console.log(`⚠ STALE patterns (${stalePatterns.length}) - cleanup candidates:`);
    for (const p of stalePatterns) {
      console.log(`  ${p.tool}/${p.signature.slice(0, 40)}...`);
      console.log(`    used ${p.useCount}x, last ${formatDate(p.lastUsedAt)}`);
      
      if (cleanup) {
        deletePattern(p.id);
        console.log(`    → DELETED`);
        deleted++;
      }
    }
    console.log();
  }
  
  // Summary
  console.log("─".repeat(60));
  console.log(`Total: ${patterns.length} patterns`);
  console.log(`  Stable: ${stable.length}`);
  console.log(`  Active: ${active.length}`);
  console.log(`  Stale:  ${stalePatterns.length}`);
  
  if (deleted > 0) {
    console.log(`  Deleted: ${deleted}`);
  } else if (stalePatterns.length > 0 && !cleanup) {
    console.log();
    console.log("To clean up stale patterns, run:");
    console.log("  bun run src/audit.ts --cleanup");
  }
  
  return {
    total: patterns.length,
    stable: stable.length,
    active: active.length,
    stale: stalePatterns.length,
    deleted,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const cleanup = args.includes("--cleanup");
  const importYamlIdx = args.indexOf("--import-yaml");
  
  // Import from YAML if requested
  if (importYamlIdx !== -1 && args[importYamlIdx + 1]) {
    const yamlDir = args[importYamlIdx + 1];
    console.log(`Importing patterns from ${yamlDir}...`);
    const imported = await importFromYaml(yamlDir);
    console.log(`Imported ${imported} patterns.`);
    console.log();
  }
  
  await runAudit(cleanup);
}

main().catch(console.error);

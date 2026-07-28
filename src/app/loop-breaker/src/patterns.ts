/**
 * Error pattern management: find, create, update learned patterns.
 */

import { eq, and, lt, sql } from "drizzle-orm";
import { getDb, schema } from "./db";
import type { ErrorPattern, NewErrorPattern } from "./db/schema";

const { errorPatterns } = schema;

/**
 * Find a pattern matching the error signature.
 */
export function findPattern(signature: string): ErrorPattern | null {
  const db = getDb();
  const results = db
    .select()
    .from(errorPatterns)
    .where(eq(errorPatterns.signature, signature))
    .limit(1)
    .all();
  
  return results[0] || null;
}

/**
 * Find pattern by fuzzy matching (contains key terms).
 */
export function findSimilarPattern(errorText: string, tool: string): ErrorPattern | null {
  const db = getDb();
  
  // Extract key error terms
  const errorTypes = ["ReferenceError", "TypeError", "SyntaxError", "Error"];
  const matchedType = errorTypes.find(t => errorText.includes(t));
  
  if (!matchedType) return null;
  
  // Search for patterns with same tool and error type
  const results = db
    .select()
    .from(errorPatterns)
    .where(
      and(
        eq(errorPatterns.tool, tool),
        sql`${errorPatterns.signature} LIKE ${'%' + matchedType + '%'}`
      )
    )
    .limit(1)
    .all();
  
  return results[0] || null;
}

/**
 * Create a new learned pattern.
 */
export function createPattern(pattern: Omit<NewErrorPattern, "id">): ErrorPattern {
  const db = getDb();
  const now = new Date().toISOString();
  
  const result = db
    .insert(errorPatterns)
    .values({
      ...pattern,
      createdAt: now,
      lastUsedAt: now,
      useCount: 1,
    })
    .returning()
    .get();
  
  return result;
}

/**
 * Increment use count and update last_used timestamp.
 */
export function touchPattern(id: number): void {
  const db = getDb();
  const now = new Date().toISOString();
  
  db.update(errorPatterns)
    .set({
      useCount: sql`${errorPatterns.useCount} + 1`,
      lastUsedAt: now,
    })
    .where(eq(errorPatterns.id, id))
    .run();
}

/**
 * Get all patterns for audit.
 */
export function getAllPatterns(): ErrorPattern[] {
  const db = getDb();
  return db.select().from(errorPatterns).all();
}

/**
 * Find stale patterns (unused for 6+ months with low use count).
 */
export function findStalePatterns(
  monthsThreshold: number = 6,
  minUseCount: number = 3,
  stableUseCount: number = 10
): ErrorPattern[] {
  const db = getDb();
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - monthsThreshold);
  const cutoff = cutoffDate.toISOString();
  
  return db
    .select()
    .from(errorPatterns)
    .where(
      and(
        lt(errorPatterns.lastUsedAt, cutoff),
        lt(errorPatterns.useCount, minUseCount),
        lt(errorPatterns.useCount, stableUseCount)
      )
    )
    .all();
}

/**
 * Delete a pattern by ID.
 */
export function deletePattern(id: number): void {
  const db = getDb();
  db.delete(errorPatterns).where(eq(errorPatterns.id, id)).run();
}

/**
 * Import patterns from YAML files (migration from file-based storage).
 */
export async function importFromYaml(yamlDir: string): Promise<number> {
  const { readdirSync, readFileSync, existsSync } = await import("fs");
  const { join } = await import("path");
  
  if (!existsSync(yamlDir)) return 0;
  
  let imported = 0;
  const files = readdirSync(yamlDir).filter(f => f.endsWith(".yaml"));
  
  for (const file of files) {
    try {
      const content = readFileSync(join(yamlDir, file), "utf-8");
      // Simple YAML parsing for our known structure
      const pattern = parseSimpleYaml(content);
      
      if (pattern.signature && !findPattern(pattern.signature)) {
        createPattern({
          signature: pattern.signature,
          tool: pattern.tool || "unknown",
          rootCause: pattern.root_cause || "",
          correction: pattern.correction || "",
          keyInsight: pattern.key_insight,
          antiPatterns: pattern.anti_patterns ? JSON.stringify(pattern.anti_patterns) : null,
          sourceSessions: pattern.source_sessions ? JSON.stringify(pattern.source_sessions) : null,
          createdAt: pattern.created || new Date().toISOString(),
          lastUsedAt: pattern.last_used || new Date().toISOString(),
          useCount: pattern.use_count || 1,
        });
        imported++;
      }
    } catch (e) {
      console.error(`Failed to import ${file}:`, e);
    }
  }
  
  return imported;
}

function parseSimpleYaml(content: string): Record<string, any> {
  const result: Record<string, any> = {};
  const lines = content.split("\n");
  let currentKey = "";
  let multilineValue = "";
  let inMultiline = false;
  
  for (const line of lines) {
    if (line.startsWith("#") || line.trim() === "") continue;
    
    if (inMultiline) {
      if (line.startsWith("  ") || line.startsWith("\t")) {
        multilineValue += line.trim() + "\n";
        continue;
      } else {
        result[currentKey] = multilineValue.trim();
        inMultiline = false;
      }
    }
    
    const match = line.match(/^([a-z_]+):\s*(.*)$/);
    if (match) {
      const [, key, value] = match;
      if (value === "|" || value === "") {
        currentKey = key;
        multilineValue = "";
        inMultiline = true;
      } else {
        result[key] = value.replace(/^["']|["']$/g, "");
      }
    }
  }
  
  if (inMultiline) {
    result[currentKey] = multilineValue.trim();
  }
  
  return result;
}

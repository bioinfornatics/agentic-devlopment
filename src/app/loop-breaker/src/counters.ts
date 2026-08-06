/**
 * Session counter management for failure tracking.
 */

import { eq, and, sql } from "drizzle-orm";
import { getDb, schema } from "./db";

const { sessionCounters, correctionsSent } = schema;

type CounterType = "fail" | "error" | "tool";

/**
 * Get or create a counter for a session.
 */
export function getCounter(
  sessionId: string,
  counterType: CounterType,
  toolName?: string
): number {
  const db = getDb();
  
  const conditions = [
    eq(sessionCounters.sessionId, sessionId),
    eq(sessionCounters.counterType, counterType),
  ];
  
  if (toolName) {
    conditions.push(eq(sessionCounters.toolName, toolName));
  }
  
  const result = db
    .select({ count: sessionCounters.count })
    .from(sessionCounters)
    .where(and(...conditions))
    .limit(1)
    .get();
  
  return result?.count ?? 0;
}

/**
 * Increment a counter and return new value.
 */
export function incrementCounter(
  sessionId: string,
  counterType: CounterType,
  toolName?: string,
  lastError?: string
): number {
  const db = getDb();
  const now = new Date().toISOString();
  
  const conditions = [
    eq(sessionCounters.sessionId, sessionId),
    eq(sessionCounters.counterType, counterType),
  ];
  
  if (toolName) {
    conditions.push(eq(sessionCounters.toolName, toolName));
  }
  
  const existing = db
    .select()
    .from(sessionCounters)
    .where(and(...conditions))
    .limit(1)
    .get();
  
  if (existing) {
    const newCount = existing.count + 1;
    db.update(sessionCounters)
      .set({
        count: newCount,
        lastError: lastError ?? existing.lastError,
        updatedAt: now,
      })
      .where(eq(sessionCounters.id, existing.id))
      .run();
    return newCount;
  } else {
    db.insert(sessionCounters)
      .values({
        sessionId,
        counterType,
        toolName: toolName ?? null,
        count: 1,
        lastError: lastError ?? null,
        updatedAt: now,
      })
      .run();
    return 1;
  }
}

/**
 * Reset counters for a session (on success).
 */
export function resetCounters(sessionId: string, types?: CounterType[]): void {
  const db = getDb();
  
  if (types && types.length > 0) {
    for (const t of types) {
      db.delete(sessionCounters)
        .where(
          and(
            eq(sessionCounters.sessionId, sessionId),
            eq(sessionCounters.counterType, t)
          )
        )
        .run();
    }
  } else {
    db.delete(sessionCounters)
      .where(eq(sessionCounters.sessionId, sessionId))
      .run();
  }
}

/**
 * Get the last tool used in a session.
 */
export function getLastTool(sessionId: string): string | null {
  const db = getDb();
  
  const result = db
    .select({ toolName: sessionCounters.toolName })
    .from(sessionCounters)
    .where(
      and(
        eq(sessionCounters.sessionId, sessionId),
        eq(sessionCounters.counterType, "tool")
      )
    )
    .orderBy(sql`${sessionCounters.updatedAt} DESC`)
    .limit(1)
    .get();
  
  return result?.toolName ?? null;
}

/**
 * Check if correction was already sent for this error.
 */
export function wasCorrectionSent(
  sessionId: string,
  toolName: string,
  errorSignature: string
): boolean {
  const db = getDb();
  
  const result = db
    .select()
    .from(correctionsSent)
    .where(
      and(
        eq(correctionsSent.sessionId, sessionId),
        eq(correctionsSent.toolName, toolName),
        eq(correctionsSent.errorSignature, errorSignature)
      )
    )
    .limit(1)
    .get();
  
  return !!result;
}

/**
 * Record that a correction was sent.
 */
export function recordCorrectionSent(
  sessionId: string,
  toolName: string,
  errorSignature: string
): void {
  const db = getDb();
  const now = new Date().toISOString();
  
  db.insert(correctionsSent)
    .values({
      sessionId,
      toolName,
      errorSignature,
      sentAt: now,
    })
    .run();
}

/**
 * Clean up old session data (older than 24h).
 */
export function cleanupOldSessions(): number {
  const db = getDb();
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - 24);
  const cutoffStr = cutoff.toISOString();
  
  const deleted1 = db
    .delete(sessionCounters)
    .where(sql`${sessionCounters.updatedAt} < ${cutoffStr}`)
    .run();
  
  const deleted2 = db
    .delete(correctionsSent)
    .where(sql`${correctionsSent.sentAt} < ${cutoffStr}`)
    .run();
  
  return (deleted1.changes || 0) + (deleted2.changes || 0);
}

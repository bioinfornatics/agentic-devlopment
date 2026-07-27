/**
 * Database schema for loop-breaker error tracking.
 * Uses SQLite via Drizzle ORM for portable, embedded storage.
 */

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * Error patterns learned from repeated failures.
 * Persists across sessions and compactions.
 */
export const errorPatterns = sqliteTable("error_patterns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  
  // Pattern identification
  signature: text("signature").notNull().unique(),
  tool: text("tool").notNull(),
  
  // Learning data
  rootCause: text("root_cause").notNull(),
  correction: text("correction").notNull(),
  keyInsight: text("key_insight"),
  antiPatterns: text("anti_patterns"), // JSON array
  
  // Audit tracking
  createdAt: text("created_at").notNull(),
  lastUsedAt: text("last_used_at").notNull(),
  useCount: integer("use_count").notNull().default(0),
  
  // Provenance
  sourceSessions: text("source_sessions"), // JSON array
});

/**
 * Session failure counters.
 * Tracks consecutive failures per session for graduated response.
 */
export const sessionCounters = sqliteTable("session_counters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  
  sessionId: text("session_id").notNull(),
  counterType: text("counter_type").notNull(), // 'fail' | 'error' | 'tool'
  toolName: text("tool_name"),
  count: integer("count").notNull().default(0),
  lastError: text("last_error"),
  
  updatedAt: text("updated_at").notNull(),
});

/**
 * Correction guidance sent to sessions.
 * Tracks what guidance was already injected to avoid repetition.
 */
export const correctionsSent = sqliteTable("corrections_sent", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  
  sessionId: text("session_id").notNull(),
  toolName: text("tool_name").notNull(),
  errorSignature: text("error_signature").notNull(),
  sentAt: text("sent_at").notNull(),
});

// Type exports
export type ErrorPattern = typeof errorPatterns.$inferSelect;
export type NewErrorPattern = typeof errorPatterns.$inferInsert;
export type SessionCounter = typeof sessionCounters.$inferSelect;
export type CorrectionSent = typeof correctionsSent.$inferSelect;

#!/usr/bin/env node
import Database from "better-sqlite3";

try {
  const db = new Database(":memory:");
  db.exec("CREATE TABLE native_smoke (id INTEGER PRIMARY KEY)");
  db.close();
  console.log("better-sqlite3 native binding OK");
} catch (error) {
  console.error("better-sqlite3 native binding is unavailable.");
  console.error("Run 'pnpm install --frozen-lockfile' from apps/ and ensure Python, make, and a C++ compiler are installed.");
  throw error;
}

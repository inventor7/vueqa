/**
 * Database Module
 *
 * Central export point for all database functionality.
 * This is the ONLY file you should import from outside the database module.
 *
 * @example
 * ```ts
 * import { dbService } from "@/shared/database";
 *
 * // Initialize (call once at app startup)
 * await dbService.init();
 *
 * // Use throughout your app
 * const db = dbService.getDb();
 * const tasks = await db.selectFrom("tasks").selectAll().execute();
 * ```
 */

import { dbService } from "./DatabaseService";
import type { SQLiteDBConnection } from "@capacitor-community/sqlite";

// ─────────────────────────────────────────────────────────────────────────────
// Main Service
// ─────────────────────────────────────────────────────────────────────────────

export { dbService, DatabaseService, sqlite } from "./DatabaseService";

/**
 * Helper to get the raw SQLite connection.
 * Wrapper around dbService.getRawConnection() for convenience.
 */
export async function getRawConnection(): Promise<SQLiteDBConnection> {
  return dbService.getRawConnection();
}

/**
 * Initialize the database.
 * Wrapper around dbService.init() for convenience and backward compatibility.
 */
export async function initConnection() {
  return await dbService.init();
}

// ─────────────────────────────────────────────────────────────────────────────
// Reactive Utilities
// For building auto-refreshing UIs
// ─────────────────────────────────────────────────────────────────────────────

export { rdb, executeWithEvent } from "./reactive/reactiveDb";
export {
  emitTableChange,
  batchEmit,
  onTableChange,
  onAnyChange,
} from "./reactive/dbEvents";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type {
  TableChangeEvent,
  ChangeType,
  ReactiveQueryOptions,
  OptimisticMutationOptions,
} from "./reactive/types";

export type { Database } from "./global.schema";

// ─────────────────────────────────────────────────────────────────────────────
// Migration Helpers (for creating migrations)
// ─────────────────────────────────────────────────────────────────────────────

export {
  addBaseColumns,
  addLocalColumns,
  generateLocalRuid,
  nowISO,
  type SyncStatus,
} from "./migrations/_helpers";

// ─────────────────────────────────────────────────────────────────────────────
// Migrator (for advanced use)
// ─────────────────────────────────────────────────────────────────────────────

export { DatabaseMigrator, type MigrationResult } from "./migrator";

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

export { rdb, executeWithEvent } from "./reactive/reactiveDb";
export {
  emitTableChange,
  batchEmit,
  onTableChange,
  onAnyChange,
} from "./reactive/dbEvents";

export type {
  TableChangeEvent,
  ChangeType,
  ReactiveQueryOptions,
  OptimisticMutationOptions,
} from "./reactive/types";

export type { Database } from "./global.schema";

export {
  addBaseColumns,
  addLocalColumns,
  createIndex,
  generateLocalRuid,
  nowISO,
  type SyncStatus,
  type ConflictResolutionStrategy,
} from "./migrations/_helpers";

export { DatabaseMigrator, type MigrationResult } from "./migrator";

export {
  registerQueryPlan,
  explainQueryPlan,
  analyseAllRegisteredPlans,
} from "./queryPlan";
export type { QueryPlanResult, QueryPlanRow } from "./queryPlan";

export { batchInsert, batchUpsert, batchDelete, batchTransaction } from "./sync";

export { DatabasePruner } from "./pruning";
export type { PruningPolicy, PruningMode, PruningResult } from "./pruning";

export { resolveConflict, resolveBatchConflicts } from "./conflicts";
export type {
  ConflictStrategy,
  ConflictWinner,
  ConflictInput,
  ConflictResult,
} from "./conflicts";

export type { StorageInfo } from "./DatabaseService";

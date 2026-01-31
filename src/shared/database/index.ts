import { sqlite, initConnection } from "./kysely";
import { type SQLiteDBConnection } from "@capacitor-community/sqlite";

/**
 * Get raw SQLite connection for native operations not supported by Kysely.
 *
 * Use this for:
 * - `executeSet()` for high-performance bulk inserts
 * - Native SQLite features (e.g., PRAGMA, ATTACH DATABASE)
 * - Raw SQL when needed
 *
 * @param dbName - Database name (default: import.meta.env.VITE_DB_FILENAME)
 *
 * @example
 * ```ts
 * const conn = await getRawConnection();
 * await conn.executeSet([{
 *   statement: "INSERT INTO users (name) VALUES (?)",
 *   values: [["Alice"], ["Bob"], ["Charlie"]]
 * }]);
 * ```
 */
export async function getRawConnection(
  dbName: string = import.meta.env.VITE_DB_FILENAME,
): Promise<SQLiteDBConnection> {
  return await sqlite.retrieveConnection(dbName, false);
}

export { sqlite, initConnection };
export { rdb, executeWithEvent } from "./reactive/reactiveDb";
export {
  emitTableChange,
  onTableChange,
  onAnyChange,
} from "./reactive/dbEvents";
export type {
  TableChangeEvent,
  ChangeType,
  ReactiveQueryOptions,
  OptimisticMutationOptions,
} from "./reactive/types";

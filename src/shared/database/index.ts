import { type Kysely } from "kysely";
import { sqlite, getKyselyInstance, initConnection } from "./kysely";
import type { Database } from "@/shared/database/global.schema";
import { type SQLiteDBConnection } from "@capacitor-community/sqlite";

export { sqlite, initConnection };

/**
 * Typed database instance for all Kysely operations.
 */
export const db = new Proxy({} as Kysely<Database>, {
  get(target, prop) {
    const instance = getKyselyInstance();
    const value = (instance as any)[prop];
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});

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

// Reactive Database Layer
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

/**
 * Reactive Kysely wrapper that emits change events.
 *
 * This module wraps the standard Kysely instance to automatically
 * emit table change events on INSERT, UPDATE, DELETE operations.
 * Perfect for building reactive UIs with optimistic updates.
 */

import { type Kysely } from "kysely";
import type { Database } from "@/shared/database/global.schema";
import { emitTableChange } from "./dbEvents";
import type { ChangeType } from "./types";

import { dbService } from "@/shared/database/DatabaseService";

/**
 * Synchronous getter with initialization guard.
 * Throws a clear error if database is not initialized.
 */
function getDbSync(): Kysely<Database> {
  if (!dbService.isReady()) {
    throw new Error(
      "[rdb] Database not initialized. Call dbService.init() before using reactive database operations."
    );
  }
  return dbService.getDb();
}

/**
 * Wrap a Kysely query executor to emit events after execution
 */
function wrapExecutor<T>(
  executor: () => Promise<T>,
  table: string,
  changeType: ChangeType,
): () => Promise<T> {
  return async () => {
    const result = await executor();

    emitTableChange(table, changeType, {
      affectedRows: Array.isArray(result) ? result.length : 1,
    });

    return result;
  };
}

/**
 * Wrap a Kysely query builder to ensure all chained calls remain reactive
 */
function wrapBuilder(builder: any, table: string, changeType: ChangeType): any {
  return new Proxy(builder, {
    get(target, prop) {
      const value = target[prop];

      if (typeof value !== "function") {
        return value;
      }

      if (
        prop === "execute" ||
        prop === "executeTakeFirst" ||
        prop === "executeTakeFirstOrThrow"
      ) {
        return wrapExecutor(value.bind(target), table, changeType);
      }

      return (...args: any[]) => {
        const result = value.apply(target, args);

        if (
          result &&
          typeof result.execute === "function" &&
          result !== target
        ) {
          return wrapBuilder(result, table, changeType);
        }

        return result;
      };
    },
  });
}

/**
 * Create a tracking proxy that collects table names mutated in a transaction
 */
function createTrackingProxy(
  db: Kysely<Database>,
  touchedTables: Set<string>,
): Kysely<Database> {
  return new Proxy(db, {
    get(target, prop) {
      const value = (target as any)[prop];

      if (
        prop === "insertInto" ||
        prop === "updateTable" ||
        prop === "deleteFrom"
      ) {
        return (...args: any[]) => {
          const table = args[0] as string;
          touchedTables.add(table);
          return value.apply(target, args);
        };
      }

      if (typeof value === "function") {
        return value.bind(target);
      }

      return value;
    },
  }) as Kysely<Database>;
}

/**
 * Reactive Kysely database instance.
 *
 * Drop-in replacement for `db` that emits change events on mutations.
 * All queries (SELECT, INSERT, UPDATE, DELETE) work exactly the same,
 * but mutations trigger reactive updates.
 *
 * @example
 * ```ts
 * // This will emit a 'customers:insert' event
 * await rdb.insertInto('customers')
 *   .values({ customer_name: 'Alice', country_id: 1 })
 *   .execute();
 *
 * // This will emit a 'customers:update' event
 * await rdb.updateTable('customers')
 *   .set({ customer_name: 'Bob' })
 *   .where('customer_id', '=', 1)
 *   .execute();
 *
 * // This will emit a 'customers:delete' event
 * await rdb.deleteFrom('customers')
 *   .where('customer_id', '=', 1)
 *   .execute();
 * ```
 */
export const rdb = new Proxy({} as Kysely<Database>, {
  get(target, prop) {
    const db = getDbSync();
    const value = (db as any)[prop];

    if (
      prop === "insertInto" ||
      prop === "updateTable" ||
      prop === "deleteFrom"
    ) {
      const changeTypeMap: Record<string, ChangeType> = {
        insertInto: "insert",
        updateTable: "update",
        deleteFrom: "delete",
      };

      return (...args: any[]) => {
        const table = args[0] as string;
        const builder = value.apply(db, args);
        const changeType = changeTypeMap[prop as string] as ChangeType;

        return wrapBuilder(builder, table, changeType);
      };
    }

    if (prop === "transaction") {
      return () => {
        const txBuilder = value.apply(db, []);

        return {
          execute: async (callback: any) => {
            const touchedTables = new Set<string>();

            const result = await txBuilder.execute((trx: Kysely<Database>) => {
              const trackedTrx = createTrackingProxy(trx, touchedTables);
              return callback(trackedTrx);
            });

            // Emit specific table events instead of wildcard
            if (touchedTables.size === 0) {
              // If no tables tracked, fall back to wildcard (for raw SQL in transaction)
              emitTableChange("*", "bulk");
            } else {
              for (const table of touchedTables) {
                emitTableChange(table, "bulk");
              }
            }

            return result;
          },
        };
      };
    }

    if (typeof value === "function") {
      return value.bind(db);
    }

    return value;
  },
}) as Kysely<Database>;

/**
 * Helper: Execute a raw SQL mutation and emit a change event
 *
 * Use this when you need to use `getRawConnection()` for native SQLite features
 * but still want reactive updates.
 *
 * @example
 * ```ts
 * await executeWithEvent('customers', 'insert', async () => {
 *   const conn = await getRawConnection();
 *   return await conn.executeSet([{
 *     statement: 'INSERT INTO customers (customer_name) VALUES (?)',
 *     values: [['Alice'], ['Bob']]
 *   }]);
 * });
 * ```
 */
export async function executeWithEvent<T>(
  table: string,
  changeType: ChangeType,
  executor: () => Promise<T>,
): Promise<T> {
  const result = await executor();
  emitTableChange(table, changeType);
  return result;
}

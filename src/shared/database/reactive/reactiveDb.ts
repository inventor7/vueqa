/**
 * Reactive Kysely wrapper that emits change events.
 *
 * This module wraps the standard Kysely instance to automatically
 * emit table change events on INSERT, UPDATE, DELETE operations.
 * Perfect for building reactive UIs with optimistic updates.
 */

import { type Kysely } from "kysely";
import { getKyselyInstance } from "../kysely";
import { sqlite } from "@/shared/database";
import type { Database } from "@/shared/database/global.schema";
import { emitTableChange } from "./dbEvents";
import type { ChangeType } from "./types";

function getDb(): Kysely<Database> {
  return getKyselyInstance();
}

/**
 * Extract table name from Kysely query builder
 * This is a helper to determine which table a query is operating on
 */
function extractTableName(query: any): string | null {
  // Try to get table name from the query builder's internal state
  const queryNode = query?.toOperationNode?.();

  if (queryNode?.kind === "InsertQueryNode") {
    return queryNode.into?.table?.identifier?.name || null;
  }

  if (queryNode?.kind === "UpdateQueryNode") {
    return queryNode.table?.table?.identifier?.name || null;
  }

  if (queryNode?.kind === "DeleteQueryNode") {
    return queryNode.from?.froms?.[0]?.table?.identifier?.name || null;
  }

  return null;
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

    // Emit change event after successful execution
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

      // Intercept execution methods to emit events
      if (
        prop === "execute" ||
        prop === "executeTakeFirst" ||
        prop === "executeTakeFirstOrThrow"
      ) {
        return wrapExecutor(value.bind(target), table, changeType);
      }

      // For other methods (like .values(), .where(), .set()),
      // wrap the returned builder recursively
      return (...args: any[]) => {
        const result = value.apply(target, args);

        // If it returns a new builder-like object, wrap it
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
    const db = getDb(); // Lazy load
    const value = (db as any)[prop];

    // Only intercept mutation methods
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

    // For transaction, we emit a 'bulk' event at the end
    if (prop === "transaction") {
      return () => {
        const txBuilder = value.apply(db, []);

        return {
          execute: async (callback: any) => {
            const result = await txBuilder.execute(callback);

            // Emit a generic bulk change event
            // (components watching specific tables will re-fetch)
            emitTableChange("*", "bulk");

            return result;
          },
        };
      };
    }

    // Pass through everything else unchanged (SELECT queries, schema, etc.)
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

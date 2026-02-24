/**
 * Sync batching utilities.
 *
 * During bulk sync, insert/upsert the entire page of records in a single
 * SQLite transaction. This gives you one WAL write, one UI refresh, and
 * dramatically better throughput vs. looping over individual inserts.
 *
 * @example Replace a loop of individual inserts
 * ```ts
 * // ❌ Before — N transactions, N UI refreshes
 * for (const product of serverProducts) {
 *   await rdb.insertInto('products').values(product).execute();
 * }
 *
 * // ✅ After — 1 transaction, 1 UI refresh
 * await batchInsert(db, 'products', serverProducts);
 * ```
 */

import type { Kysely } from "kysely";
import type { Database } from "./global.schema";
import { batchEmit } from "./reactive/dbEvents";
import type { ChangeType } from "./reactive/types";

/**
 * Insert an array of rows into a table inside a single transaction.
 *
 * Emits a single `batchEmit` after the transaction commits — reactive
 * queries watching the table refetch exactly once regardless of row count.
 *
 * @param db    - Kysely instance (`dbService.getDb()`, NOT `rdb` — we emit manually)
 * @param table - Table name
 * @param rows  - Array of rows to insert (must be non-empty)
 * @param chunkSize - Max rows per INSERT statement (default 500; SQLite limit ≈ 999 params)
 */
export async function batchInsert<T extends Record<string, unknown>>(
  db: Kysely<Database>,
  table: keyof Database & string,
  rows: T[],
  chunkSize = 500,
): Promise<void> {
  if (rows.length === 0) return;

  await db.transaction().execute(async (trx) => {
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      await (trx as any).insertInto(table).values(chunk).execute();
    }
  });

  batchEmit(table, "insert");
}

/**
 * Upsert an array of rows (INSERT OR REPLACE) inside a single transaction.
 *
 * Use this during sync when you don't know whether a record already exists
 * locally. The conflict target should be the unique column(s) that identify
 * each record — typically `_ruid` for synced tables.
 *
 * @param db             - Kysely instance (`dbService.getDb()`)
 * @param table          - Table name
 * @param rows           - Array of rows to upsert
 * @param conflictColumn - Column to check for conflicts (e.g. `'_ruid'`)
 * @param chunkSize      - Max rows per statement
 */
export async function batchUpsert<T extends Record<string, unknown>>(
  db: Kysely<Database>,
  table: keyof Database & string,
  rows: T[],
  conflictColumn: string,
  chunkSize = 500,
): Promise<void> {
  if (rows.length === 0) return;

  await db.transaction().execute(async (trx) => {
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      await (trx as any)
        .insertInto(table)
        .values(chunk)
        .onConflict((oc: any) =>
          oc.column(conflictColumn).doUpdateSet(
            Object.fromEntries(
              Object.keys(chunk[0]!).map((k) => [k, (eb: any) => eb.ref(`excluded.${k}`)]),
            ),
          ),
        )
        .execute();
    }
  });

  batchEmit(table, "bulk");
}

/**
 * Delete an array of rows by their primary key inside a single transaction.
 *
 * @param db         - Kysely instance
 * @param table      - Table name
 * @param ids        - Array of IDs to delete
 * @param idColumn   - Column name for the ID (default `'id'`)
 */
export async function batchDelete(
  db: Kysely<Database>,
  table: keyof Database & string,
  ids: (string | number)[],
  idColumn = "id",
): Promise<void> {
  if (ids.length === 0) return;

  await db.transaction().execute(async (trx) => {
    await (trx as any)
      .deleteFrom(table)
      .where(idColumn, "in", ids)
      .execute();
  });

  batchEmit(table, "delete");
}

/**
 * Run multiple table operations in one transaction and emit targeted events.
 *
 * Use this for sync operations that span multiple tables (e.g., orders +
 * order_lines must be consistent). Emits one event per affected table.
 *
 * @example
 * ```ts
 * await batchTransaction(db, async (trx) => {
 *   await trx.insertInto('orders').values(orders).execute();
 *   await trx.insertInto('order_details').values(lines).execute();
 *   return { orders: 'insert', order_details: 'insert' };
 * });
 * ```
 */
export async function batchTransaction(
  db: Kysely<Database>,
  executor: (trx: Kysely<Database>) => Promise<Record<string, ChangeType>>,
): Promise<void> {
  const tableEvents = await db.transaction().execute(executor);

  for (const [table, changeType] of Object.entries(tableEvents)) {
    batchEmit(table, changeType as ChangeType);
  }
}

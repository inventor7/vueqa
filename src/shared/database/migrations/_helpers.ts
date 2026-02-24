import type { CreateTableBuilder, Kysely } from "kysely";

/**
 * Sync Status values for client-side sync tracking.
 * These are LOCAL-ONLY and never sent to the backend.
 */
export type SyncStatus = "synced" | "to_create" | "to_update" | "to_delete";

/**
 * Conflict Resolution Strategy annotation for a table.
 *
 * Declare one of these constants in your module's schema file so your
 * sync service knows which strategy to apply. The actual resolution logic
 * is in `resolveConflict()` from `@/shared/database/conflicts`.
 *
 * ## Choosing a strategy
 *
 * | Table type                        | Strategy              | Reason                                    |
 * |-----------------------------------|-----------------------|-------------------------------------------|
 * | Master data (products, customers) | `server-wins`         | Server is the source of truth             |
 * | Draft orders / user edits         | `client-wins`         | Local intent must not be overwritten      |
 * | Collaborative / shared records    | `latest-write-wins`   | Use `_write_date` to pick the newer write |
 * | Logs / audit history              | `server-wins`         | Log integrity must be maintained          |
 *
 * @example
 * ```ts
 * // In your module's schema.ts:
 * export const TASK_CONFLICT_STRATEGY: ConflictResolutionStrategy = 'latest-write-wins';
 * export const ORDER_CONFLICT_STRATEGY: ConflictResolutionStrategy = 'client-wins';
 *
 * // In your sync service:
 * import { resolveConflict } from '@/shared/database/conflicts';
 * const { record, winner } = resolveConflict({
 *   local, remote, strategy: TASK_CONFLICT_STRATEGY,
 * });
 * ```
 */
export type ConflictResolutionStrategy =
  | "server-wins"
  | "client-wins"
  | "latest-write-wins";

/**
 * Add base columns for syncable tables.
 *
 * All tables that sync with the backend should use this helper.
 * Includes:
 * - id: Auto-incrementing primary key (local only)
 * - _ruid: Remote unique identifier from backend
 * - _create_date: Creation timestamp from backend
 * - _write_date: Last modification timestamp from backend
 * - _delete_date: Soft delete timestamp (nullable)
 * - _sync_status: Local sync status (never sent to backend)
 *
 * @example
 * ```ts
 * await (await addBaseColumns(db, "orders"))
 *   .addColumn("customer_id", "text", col => col.notNull())
 *   .addColumn("total", "real", col => col.notNull())
 *   .execute();
 * ```
 */
export async function addBaseColumns(
  db: Kysely<any>,
  tableName: string,
): Promise<CreateTableBuilder<string, string>> {
  return db.schema
    .createTable(tableName)
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("_ruid", "text", (col) => col.notNull().unique())
    .addColumn("_create_date", "text", (col) => col.notNull())
    .addColumn("_write_date", "text", (col) => col.notNull())
    .addColumn("_delete_date", "text")
    .addColumn("_sync_status", "text", (col) =>
      col.notNull().defaultTo("synced"),
    );
}

/**
 * Add columns for local-only tables.
 *
 * Use this for tables that don't sync with the backend:
 * - Draft orders before submission
 * - UI state/preferences
 * - Cache tables
 *
 * @example
 * ```ts
 * await (await addLocalColumns(db, "drafts"))
 *   .addColumn("data", "text", col => col.notNull())
 *   .execute();
 * ```
 */
export async function addLocalColumns(
  db: Kysely<any>,
  tableName: string,
): Promise<CreateTableBuilder<string, string>> {
  return db.schema
    .createTable(tableName)
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("created_at", "text", (col) => col.notNull());
}

/**
 * Generate a new RUID (Remote Unique Identifier) for local records.
 *
 * Format: UUID v4 style, but with zeros to indicate local origin.
 * The backend will replace this with a real RUID on sync.
 */
export function generateLocalRuid(): string {
  const uuid = crypto.randomUUID();
  return `local-${uuid}`;
}

/**
 * Get current ISO timestamp for sync columns.
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Create a standard index on one or more columns of a table.
 *
 * Call this in every migration's `up()` for columns used in WHERE /
 * ORDER BY / JOIN. SQLite does a full table scan without them.
 *
 * @example
 * ```ts
 * // Single column
 * await createIndex(db, 'idx_orders_sync_status', 'orders', ['_sync_status']);
 *
 * // Composite (most common query pattern first)
 * await createIndex(db, 'idx_orders_customer_date', 'orders', ['customer_id', 'order_date']);
 * ```
 */
export async function createIndex(
  db: Kysely<any>,
  indexName: string,
  tableName: string,
  columns: string[],
): Promise<void> {
  const builder = db.schema
    .createIndex(indexName)
    .on(tableName)
    .ifNotExists();

  const built = columns.length === 1
    ? builder.column(columns[0]!)
    : builder.columns(columns);

  await built.execute();
}

import type { CreateTableBuilder, Kysely } from "kysely";

/**
 * Sync Status values for client-side sync tracking.
 * These are LOCAL-ONLY and never sent to the backend.
 */
export type SyncStatus = "synced" | "to_create" | "to_update" | "to_delete";

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

import type { Kysely } from "kysely";

/**
 * Migration 003: Core performance indexes.
 *
 * All columns used in WHERE / ORDER BY / JOIN must have indexes.
 * Without them SQLite performs a full table scan on every query.
 *
 * Add table-specific indexes inside the module that owns the table.
 * This migration covers the shared base columns present on every
 * syncable table created with `addBaseColumns()`.
 */

export async function up(db: Kysely<any>): Promise<void> {
  // tasks — queried by sync status (to build upload queue),
  // completion, priority, and chronological order
  await db.schema
    .createIndex("idx_tasks_sync_status")
    .on("tasks")
    .column("_sync_status")
    .ifNotExists()
    .execute();

  await db.schema
    .createIndex("idx_tasks_completed")
    .on("tasks")
    .column("completed")
    .ifNotExists()
    .execute();

  await db.schema
    .createIndex("idx_tasks_created_at")
    .on("tasks")
    .column("created_at")
    .ifNotExists()
    .execute();

  await db.schema
    .createIndex("idx_tasks_priority")
    .on("tasks")
    .column("priority")
    .ifNotExists()
    .execute();

  // Composite: the most common query — pending sync records ordered by write date
  await db.schema
    .createIndex("idx_tasks_sync_write")
    .on("tasks")
    .columns(["_sync_status", "_write_date"])
    .ifNotExists()
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex("idx_tasks_sync_write").ifExists().execute();
  await db.schema.dropIndex("idx_tasks_priority").ifExists().execute();
  await db.schema.dropIndex("idx_tasks_created_at").ifExists().execute();
  await db.schema.dropIndex("idx_tasks_completed").ifExists().execute();
  await db.schema.dropIndex("idx_tasks_sync_status").ifExists().execute();
}

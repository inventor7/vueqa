import type { Kysely } from "kysely";

/**
 * Migration 003: Sync Queue
 *
 * Creates the sync_queue table for persistent retry queue.
 * Used by the sync engine to track failed operations and retry them.
 */

export async function up(db: Kysely<any>): Promise<void> {
  console.log("[Migration 003] Creating sync_queue table...");

  await db.schema
    .createTable("sync_queue")
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("table", "text", (col) => col.notNull())
    .addColumn("ruid", "text", (col) => col.notNull())
    .addColumn("operation", "text", (col) => col.notNull()) // 'create' | 'update' | 'delete'
    .addColumn("payload", "text", (col) => col.notNull()) // JSON stringified
    .addColumn("attempts", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("max_attempts", "integer", (col) => col.notNull().defaultTo(5))
    .addColumn("last_error", "text")
    .addColumn("next_retry_at", "text", (col) => col.notNull())
    .addColumn("created_at", "text", (col) => col.notNull())
    .execute();

  // Index for efficient retry queries
  await db.schema
    .createIndex("idx_sync_queue_retry")
    .on("sync_queue")
    .columns(["next_retry_at", "attempts"])
    .execute();

  console.log("[Migration 003] sync_queue table created!");
}

export async function down(db: Kysely<any>): Promise<void> {
  console.log("[Migration 003] Rolling back sync_queue...");

  await db.schema.dropIndex("idx_sync_queue_retry").execute();
  await db.schema.dropTable("sync_queue").execute();

  console.log("[Migration 003] sync_queue rollback complete!");
}

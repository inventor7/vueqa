import type { Kysely } from "kysely";
import { addBaseColumns, nowISO } from "../_helpers";

/**
 * Migration 001: Demo Schema
 *
 * Creates demo tables for testing the template.
 * DELETE THIS MIGRATION when forking for a new project.
 *
 * Tables created:
 * - tasks: Demo syncable entity with title, completed, priority
 */

export async function up(db: Kysely<any>): Promise<void> {
  console.log("[Migration 001] Creating demo schema...");

  // Tasks table - demonstrates a syncable entity
  await (
    await addBaseColumns(db, "tasks")
  )
    .addColumn("title", "text", (col) => col.notNull())
    .addColumn("completed", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("priority", "text", (col) => col.notNull().defaultTo("medium"))
    .addColumn("created_at", "text", (col) => col.notNull().defaultTo(nowISO()))
    .execute();

  console.log("[Migration 001] Demo schema created successfully!");
}

export async function down(db: Kysely<any>): Promise<void> {
  console.log("[Migration 001] Rolling back demo schema...");

  await db.schema.dropTable("tasks").execute();

  console.log("[Migration 001] Demo schema rollback complete!");
}

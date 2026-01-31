import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  console.log("[Migration 002] Adding description column...");

  await db.schema
    .alterTable("tasks")
    .addColumn("description", "text")
    .execute();

  console.log("[Migration 002] Description column added!");
}

export async function down(db: Kysely<any>): Promise<void> {
  console.log("[Migration 002] Removing description column...");

  await db.schema.alterTable("tasks").dropColumn("description").execute();

  console.log("[Migration 002] Rollback complete!");
}

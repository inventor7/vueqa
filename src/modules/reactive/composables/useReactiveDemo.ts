/**
 * Database initialization for reactive demo - Tasks version
 */

import { rdb } from "@/shared/database";

/**
 * Initialize tasks table for reactive demo
 */
export async function initReactiveDemo() {
  try {
    // Create tasks table if it doesn't exist
    await rdb.schema
      .createTable("tasks")
      .ifNotExists()
      .addColumn("task_id", "integer", (col) =>
        col.primaryKey().autoIncrement(),
      )
      .addColumn("title", "text", (col) => col.notNull())
      .addColumn("description", "text")
      .addColumn("completed", "integer", (col) => col.notNull().defaultTo(0))
      .addColumn("priority", "text", (col) => col.notNull().defaultTo("medium"))
      .addColumn("created_at", "text", (col) => col.notNull())
      .execute();

    // Check if we have sample data
    const existingTasks = await rdb.selectFrom("tasks").selectAll().execute();

    if (existingTasks.length === 0) {
      // Insert sample tasks
      await rdb
        .insertInto("tasks")
        .values([
          {
            title: "Learn Reactive SQLite",
            description:
              "Understand how reactive queries and optimistic updates work",
            completed: 1,
            priority: "high",
            created_at: new Date().toISOString(),
          },
          {
            title: "Build a demo app",
            description: "Create a task manager to test reactivity",
            completed: 0,
            priority: "high",
            created_at: new Date().toISOString(),
          },
          {
            title: "Test optimistic updates",
            description: "Try adding, editing, and deleting tasks",
            completed: 0,
            priority: "medium",
            created_at: new Date().toISOString(),
          },
        ])
        .execute();

      console.log("✅ Reactive demo: Tasks table initialized with sample data");
    } else {
      console.log("✅ Reactive demo: Tasks table already exists");
    }

    return true;
  } catch (error) {
    console.error("❌ Failed to initialize tasks table:", error);
    return false;
  }
}

/**
 * Check if tasks table exists
 */
export async function isDatabaseInitialized(): Promise<boolean> {
  try {
    await rdb.selectFrom("tasks").selectAll().limit(1).execute();
    return true;
  } catch {
    return false;
  }
}

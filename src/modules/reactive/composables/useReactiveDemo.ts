/**
 * Database initialization for reactive demo - Tasks version
 */

import { rdb, generateLocalRuid, nowISO } from "@/shared/database";

/**
 * Initialize tasks table for reactive demo
 */
export async function initReactiveDemo() {
  try {
    // Check if we have sample data
    const existingTasks = await rdb.selectFrom("tasks").selectAll().execute();

    if (existingTasks.length === 0) {
      const now = nowISO();

      await rdb
        .insertInto("tasks")
        .values([
          {
            title: "Learn Reactive SQLite",
            description:
              "Understand how reactive queries and optimistic updates work",
            completed: 1,
            priority: "high",
            created_at: now,
            _ruid: generateLocalRuid(),
            _create_date: now,
            _write_date: now,
            _delete_date: null,
            _sync_status: "to_create",
          },
          {
            title: "Build a demo app",
            description: "Create a task manager to test reactivity",
            completed: 0,
            priority: "high",
            created_at: now,
            _ruid: generateLocalRuid(),
            _create_date: now,
            _write_date: now,
            _delete_date: null,
            _sync_status: "to_create",
          },
          {
            title: "Test optimistic updates",
            description: "Try adding, editing, and deleting tasks",
            completed: 0,
            priority: "medium",
            created_at: now,
            _ruid: generateLocalRuid(),
            _create_date: now,
            _write_date: now,
            _delete_date: null,
            _sync_status: "to_create",
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

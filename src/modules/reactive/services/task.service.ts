import { rdb, generateLocalRuid, nowISO } from "@/shared/database";
import type { NewTask } from "../database/schema";

/**
 * Task Service providing CRUD operations for the reactive demo.
 *
 * Uses `rdb` (Reactive Database) to automatically emit change events,
 * ensuring UI components auto-refresh after mutations.
 *
 * NOTE: Table creation is now handled by migrations (001_demo_schema).
 * No need to call ensureTableExists() manually.
 */
export const taskService = {
  /**
   * Get all tasks (excluding soft-deleted)
   */
  async getTasks() {
    return await rdb
      .selectFrom("tasks")
      .selectAll()
      .where("_delete_date", "is", null)
      .orderBy("created_at", "desc")
      .execute();
  },

  /**
   * Create a new task
   */
  async createTask(
    task: Omit<
      NewTask,
      "_ruid" | "_create_date" | "_write_date" | "_sync_status"
    >,
  ) {
    const now = nowISO();
    return await rdb
      .insertInto("tasks")
      .values({
        ...task,
        _ruid: generateLocalRuid(),
        _create_date: now,
        _write_date: now,
        _sync_status: "to_create", // Mark for sync
        created_at: now,
      })
      .execute();
  },

  /**
   * Toggle task completion status
   */
  async toggleTask(id: number, completed: boolean) {
    return await rdb
      .updateTable("tasks")
      .set({
        completed: completed ? 1 : 0,
        _write_date: nowISO(),
        _sync_status: "to_update", // Mark for sync
      })
      .where("id", "=", id)
      .execute();
  },

  /**
   * Update task details (title, description, priority)
   */
  async updateTask(
    id: number,
    updates: Partial<
      Omit<
        NewTask,
        "id" | "_ruid" | "_create_date" | "_write_date" | "_sync_status"
      >
    >,
  ) {
    return await rdb
      .updateTable("tasks")
      .set({
        ...updates,
        _write_date: nowISO(),
        _sync_status: "to_update",
      })
      .where("id", "=", id)
      .execute();
  },

  /**
   * Hard delete a task
   */
  async deleteTask(id: number) {
    return await rdb.deleteFrom("tasks").where("id", "=", id).execute();
  },

  /**
   * Hard delete a task (for local drafts or after sync confirmation)
   */
  async hardDeleteTask(id: number) {
    return await rdb.deleteFrom("tasks").where("id", "=", id).execute();
  },

  /**
   * Delete all tasks (hard delete - use with caution!)
   */
  async deleteAllTasks() {
    return await rdb.deleteFrom("tasks").execute();
  },

  /**
   * Get tasks pending sync
   */
  async getPendingSyncTasks() {
    return await rdb
      .selectFrom("tasks")
      .selectAll()
      .where("_sync_status", "!=", "synced")
      .execute();
  },

  /**
   * Mark task as synced (call after successful server sync)
   */
  async markSynced(id: number, serverRuid?: string) {
    const updates: Record<string, any> = {
      _sync_status: "synced",
      _write_date: nowISO(),
    };

    if (serverRuid) {
      updates._ruid = serverRuid;
    }

    return await rdb
      .updateTable("tasks")
      .set(updates)
      .where("id", "=", id)
      .execute();
  },
};

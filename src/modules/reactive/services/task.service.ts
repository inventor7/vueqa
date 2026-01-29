import { rdb, db } from "@/shared/database";
import type { TaskTable } from "../database/schema";
import type { NewTask } from "../types";

/**
 * Task Service providing CRUD operations for the reactive demo.
 * Uses `rdb` (Reactive Database) to automatically emit change events.
 */
export const taskService = {
  /**
   * Create tasks table if it doesn't exist
   */
  async ensureTableExists() {
    await db.schema
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
  },

  /**
   * Get all tasks
   */
  async getTasks() {
    return await rdb
      .selectFrom("tasks")
      .selectAll()
      .orderBy("created_at", "desc")
      .execute();
  },

  /**
   * Create a new task
   */
  async createTask(task: NewTask) {
    return await rdb
      .insertInto("tasks")
      .values({
        ...task,
        created_at: new Date().toISOString(),
      })
      .execute();
  },

  /**
   * Toggle task completion status
   */
  async toggleTask(taskId: number, completed: boolean) {
    return await rdb
      .updateTable("tasks")
      .set({ completed: completed ? 1 : 0 })
      .where("task_id", "=", taskId)
      .execute();
  },

  /**
   * Delete a task
   */
  async deleteTask(taskId: number) {
    return await rdb
      .deleteFrom("tasks")
      .where("task_id", "=", taskId)
      .execute();
  },

  /**
   * Delete all tasks
   */
  async deleteAllTasks() {
    return await rdb.deleteFrom("tasks").execute();
  },
};

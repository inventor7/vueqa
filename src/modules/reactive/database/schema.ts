import type { Generated, Selectable, Insertable } from "kysely";

/**
 * Task Table Schema for reactive demo
 */
export interface TaskTable {
  task_id: Generated<number>;
  title: string;
  description: string | null;
  completed: Generated<number>; // Optional in Insertable
  priority: "low" | "medium" | "high";
  created_at: Generated<string>; // Optional in Insertable
}

export type Task = Selectable<TaskTable>;
export type NewTask = Insertable<TaskTable>;

/**
 * Reactive Demo Database Schema
 */
export interface ReactiveDemoSchema {
  tasks: TaskTable;
}

import type { Generated, Selectable, Insertable, Updateable } from "kysely";
import type { SyncStatus } from "@/shared/database";

/**
 * Base columns added by addBaseColumns() helper.
 * All syncable tables inherit these columns.
 */
export interface BaseSyncColumns {
  /** Auto-incrementing primary key (local only) */
  id: Generated<number>;
  /** Remote unique identifier from backend */
  _ruid: string;
  /** Creation timestamp from backend */
  _create_date: string;
  /** Last modification timestamp from backend */
  _write_date: string;
  /** Soft delete timestamp (nullable) */
  _delete_date: string | null;
  /** Local sync status (never sent to backend) */
  _sync_status: Generated<SyncStatus>;
}

/**
 * Task Table Schema for reactive demo
 *
 * Demonstrates a syncable entity with base columns.
 */
export interface TaskTable extends BaseSyncColumns {
  title: string;
  description: string | null;
  completed: Generated<number>;
  priority: Generated<"low" | "medium" | "high">;
  created_at: Generated<string>;
}

export type Task = Selectable<TaskTable>;
export type NewTask = Insertable<TaskTable>;
export type TaskUpdate = Updateable<TaskTable>;

/**
 * Reactive Demo Database Schema
 */
export interface ReactiveDemoSchema {
  tasks: TaskTable;
}

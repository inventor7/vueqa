import type { Generated, Selectable, Insertable, Updateable } from "kysely";
import type { SyncStatus, ConflictResolutionStrategy } from "@/shared/database";

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
 * Conflict resolution strategy for the tasks table.
 *
 * Tasks are user-edited records. The latest write wins:
 * if the user edited offline and the server also updated, whichever
 * has the newer `_write_date` is kept.
 *
 * Use with `resolveConflict()` from `@/shared/database/conflicts` in your sync service.
 */
export const TASK_CONFLICT_STRATEGY: ConflictResolutionStrategy = "latest-write-wins";

/**
 * Reactive Demo Database Schema
 */
export interface ReactiveDemoSchema {
  tasks: TaskTable;
}

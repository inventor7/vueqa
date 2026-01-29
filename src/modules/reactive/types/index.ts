import type { TaskTable } from "../database/schema";
import type { Insertable } from "kysely";

/**
 * Type for a new task (omitting auto-generated fields)
 */
export type NewTask = Omit<Insertable<TaskTable>, "task_id" | "created_at">;

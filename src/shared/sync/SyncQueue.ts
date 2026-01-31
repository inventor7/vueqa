/**
 * Sync Queue
 *
 * SQLite-backed persistent queue for failed sync operations.
 * Implements exponential backoff retry logic.
 */

import { sql, type SqlBool } from "kysely";
import type { SyncQueueEntry } from "./types";
import { dbService } from "@/shared/database";

const QUEUE_TABLE = "sync_queue";
const DEFAULT_MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 1000;

/**
 * Calculate next retry delay using exponential backoff.
 * 1s, 2s, 4s, 8s, 16s...
 */
function getRetryDelay(attempt: number): number {
  return BASE_DELAY_MS * Math.pow(2, attempt);
}

/**
 * Get ISO string for next retry time.
 */
function getNextRetryAt(attempt: number): string {
  const delay = getRetryDelay(attempt);
  return new Date(Date.now() + delay).toISOString();
}

export const syncQueue = {
  /**
   * Add an entry to the retry queue.
   */
  async enqueue(
    table: string,
    ruid: string,
    operation: "create" | "update" | "delete",
    payload: Record<string, unknown>,
  ): Promise<void> {
    const db = dbService.getDb();

    // Check if already queued
    const existing = await db
      .selectFrom(QUEUE_TABLE as any)
      .selectAll()
      .where("table", "=", table)
      .where("ruid", "=", ruid)
      .executeTakeFirst();

    if (existing) {
      // Update existing entry
      await db
        .updateTable(QUEUE_TABLE as any)
        .set({
          operation,
          payload: JSON.stringify(payload),
          attempts: 0,
          last_error: null,
          next_retry_at: new Date().toISOString(),
        })
        .where("id", "=", (existing as any).id)
        .execute();
    } else {
      // Insert new entry
      await db
        .insertInto(QUEUE_TABLE as any)
        .values({
          table,
          ruid,
          operation,
          payload: JSON.stringify(payload),
          attempts: 0,
          max_attempts: DEFAULT_MAX_ATTEMPTS,
          last_error: null,
          next_retry_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        })
        .execute();
    }
  },

  /**
   * Get entries ready for retry.
   */
  async getRetryable(): Promise<SyncQueueEntry[]> {
    const db = dbService.getDb();
    const now = new Date().toISOString();

    const entries = await db
      .selectFrom(QUEUE_TABLE as any)
      .selectAll()
      .where("next_retry_at", "<=", now)
      .where(sql<SqlBool>`attempts < max_attempts`)
      .orderBy("created_at", "asc")
      .execute();

    return entries as SyncQueueEntry[];
  },

  /**
   * Mark entry as failed, increment attempts.
   */
  async markFailed(id: number, error: string): Promise<void> {
    const db = dbService.getDb();

    const entry = await db
      .selectFrom(QUEUE_TABLE as any)
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (!entry) return;

    const newAttempts = ((entry as any).attempts ?? 0) + 1;

    await db
      .updateTable(QUEUE_TABLE as any)
      .set({
        attempts: newAttempts,
        last_error: error,
        next_retry_at: getNextRetryAt(newAttempts),
      })
      .where("id", "=", id)
      .execute();
  },

  /**
   * Remove entry from queue (success).
   */
  async dequeue(id: number): Promise<void> {
    const db = dbService.getDb();

    await db
      .deleteFrom(QUEUE_TABLE as any)
      .where("id", "=", id)
      .execute();
  },

  /**
   * Remove all entries for a table/ruid (after successful sync).
   */
  async removeByRuid(table: string, ruid: string): Promise<void> {
    const db = dbService.getDb();

    await db
      .deleteFrom(QUEUE_TABLE as any)
      .where("table", "=", table)
      .where("ruid", "=", ruid)
      .execute();
  },

  /**
   * Get queue stats.
   */
  async getStats(): Promise<{ pending: number; failed: number }> {
    const db = dbService.getDb();

    const pendingResult = await db
      .selectFrom(QUEUE_TABLE as any)
      .select(sql`count(id)`.as("count"))
      .where(sql<SqlBool>`attempts < max_attempts`)
      .executeTakeFirst();

    const failedResult = await db
      .selectFrom(QUEUE_TABLE as any)
      .select(sql`count(id)`.as("count"))
      .where(sql<SqlBool>`attempts >= max_attempts`)
      .executeTakeFirst();

    return {
      pending: Number((pendingResult as any)?.count ?? 0),
      failed: Number((failedResult as any)?.count ?? 0),
    };
  },

  /**
   * Clear the entire queue.
   */
  async clear(): Promise<void> {
    const db = dbService.getDb();
    await db.deleteFrom(QUEUE_TABLE as any).execute();
  },
};

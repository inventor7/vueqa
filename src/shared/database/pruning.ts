/**
 * Database Pruning Service
 *
 * Manages data retention to prevent unbounded SQLite growth on field devices.
 * Run this as a background task after a successful sync.
 *
 * ## Usage
 *
 * ```ts
 * import { DatabasePruner } from '@/shared/database/pruning';
 *
 * // After sync completes:
 * const pruner = new DatabasePruner(dbService.getDb());
 * const result = await pruner.prune([
 *   { table: 'orders', olderThanDays: 180, column: '_write_date', mode: 'archive' },
 *   { table: 'sync_logs', olderThanDays: 30, column: 'created_at', mode: 'delete' },
 * ]);
 * console.log('Pruned:', result.totalDeleted, 'rows from', result.tablesAffected, 'tables');
 * ```
 *
 * ## Retention Modes
 *
 * - **`delete`** — Hard-delete rows. Use for expendable data (logs, temp caches).
 * - **`soft-delete`** — Set `_delete_date` to now. Use for tables that sync; lets server
 *   see the deletion on next sync cycle before the row disappears.
 * - **`archive`** — Move rows to `{table}_archive` table. Use for orders or data you
 *   need to keep locally but don't want slowing down active queries.
 */

import type { Kysely } from "kysely";
import type { Database } from "./global.schema";
import { nowISO } from "./migrations/_helpers";

/**
 * How to handle rows that exceed the retention window.
 */
export type PruningMode =
  | "delete"      // Hard delete — gone immediately
  | "soft-delete" // Set _delete_date (must have the column)
  | "archive";    // Move to {table}_archive (requires archive table to exist)

/**
 * Retention policy for a single table.
 */
export interface PruningPolicy {
  /**
   * Table to prune.
   * Must be a key in your Database schema.
   */
  table: string;
  /**
   * Date column to compare against.
   * Typically `_write_date`, `_create_date`, or `created_at`.
   */
  column: string;
  /**
   * Rows older than this many days are eligible for pruning.
   */
  olderThanDays: number;
  /**
   * How to dispose of stale rows.
   * Defaults to `'soft-delete'` for syncable tables.
   */
  mode: PruningMode;
  /**
   * Only prune rows matching this additional filter.
   * Useful for scoping: e.g., only prune `_sync_status = 'synced'` rows.
   *
   * @example
   * ```ts
   * // Only prune rows that have been synced to the server
   * where: { column: '_sync_status', value: 'synced' }
   * ```
   */
  where?: { column: string; operator?: "=" | "!=" | "<" | ">"; value: string | number };
}

export interface PruningResult {
  /** Total rows deleted or soft-deleted across all tables */
  totalDeleted: number;
  /** Number of tables affected */
  tablesAffected: number;
  /** Per-table breakdown */
  details: Array<{
    table: string;
    mode: PruningMode;
    rowsAffected: number;
    error?: string;
  }>;
  /** ISO timestamp of when pruning ran */
  ranAt: string;
}

export class DatabasePruner {
  constructor(private readonly db: Kysely<Database>) {}

  /**
   * Run pruning for the given policies.
   *
   * Each policy is run independently — if one fails, the rest continue.
   * Check `result.details` for per-table errors.
   */
  async prune(policies: PruningPolicy[]): Promise<PruningResult> {
    const result: PruningResult = {
      totalDeleted: 0,
      tablesAffected: 0,
      details: [],
      ranAt: nowISO(),
    };

    for (const policy of policies) {
      const detail = await this.pruneTable(policy);
      result.details.push(detail);
      if (!detail.error) {
        result.totalDeleted += detail.rowsAffected;
        if (detail.rowsAffected > 0) {
          result.tablesAffected++;
        }
      }
    }

    console.log(
      `[Pruner] Ran at ${result.ranAt}: ${result.totalDeleted} rows removed across ${result.tablesAffected} tables`,
    );

    return result;
  }

  private async pruneTable(
    policy: PruningPolicy,
  ): Promise<PruningResult["details"][number]> {
    const { table, column, olderThanDays, mode, where } = policy;
    const cutoffDate = this.getCutoffDate(olderThanDays);

    try {
      let rowsAffected = 0;

      if (mode === "delete") {
        rowsAffected = await this.hardDelete(
          table,
          column,
          cutoffDate,
          where,
        );
      } else if (mode === "soft-delete") {
        rowsAffected = await this.softDelete(
          table,
          column,
          cutoffDate,
          where,
        );
      } else if (mode === "archive") {
        rowsAffected = await this.archiveRows(
          table,
          column,
          cutoffDate,
          where,
        );
      }

      if (rowsAffected > 0) {
        console.log(
          `[Pruner] ${table}: ${mode} ${rowsAffected} rows older than ${olderThanDays}d`,
        );
      }

      return { table, mode, rowsAffected };
    } catch (err) {
      const error =
        err instanceof Error ? err.message : String(err);
      console.error(`[Pruner] Failed to prune "${table}":`, err);
      return { table, mode, rowsAffected: 0, error };
    }
  }

  private async hardDelete(
    table: string,
    column: string,
    cutoffDate: string,
    where?: PruningPolicy["where"],
  ): Promise<number> {
    let query = (this.db as any)
      .deleteFrom(table)
      .where(column, "<", cutoffDate);

    if (where) {
      query = query.where(
        where.column,
        where.operator ?? "=",
        where.value,
      );
    }

    const result = await query.executeTakeFirst();
    return Number(result?.numDeletedRows ?? 0);
  }

  private async softDelete(
    table: string,
    column: string,
    cutoffDate: string,
    where?: PruningPolicy["where"],
  ): Promise<number> {
    const now = nowISO();

    let query = (this.db as any)
      .updateTable(table)
      .set({ _delete_date: now })
      .where(column, "<", cutoffDate)
      .where("_delete_date", "is", null); // Only soft-delete once

    if (where) {
      query = query.where(
        where.column,
        where.operator ?? "=",
        where.value,
      );
    }

    const result = await query.executeTakeFirst();
    return Number(result?.numUpdatedRows ?? 0);
  }

  private async archiveRows(
    table: string,
    column: string,
    cutoffDate: string,
    where?: PruningPolicy["where"],
  ): Promise<number> {
    const archiveTable = `${table}_archive`;

    // Select rows to archive
    let selectQuery = (this.db as any)
      .selectFrom(table)
      .selectAll()
      .where(column, "<", cutoffDate);

    if (where) {
      selectQuery = selectQuery.where(
        where.column,
        where.operator ?? "=",
        where.value,
      );
    }

    const rows = await selectQuery.execute();
    if (rows.length === 0) return 0;

    // Insert into archive table (must exist — create in your migration)
    await (this.db as any)
      .insertInto(archiveTable)
      .values(rows)
      .onConflict((oc: any) => oc.doNothing()) // Skip dupes on re-archive
      .execute();

    // Delete from main table
    let deleteQuery = (this.db as any)
      .deleteFrom(table)
      .where(column, "<", cutoffDate);

    if (where) {
      deleteQuery = deleteQuery.where(
        where.column,
        where.operator ?? "=",
        where.value,
      );
    }

    const deleteResult = await deleteQuery.executeTakeFirst();
    return Number(deleteResult?.numDeletedRows ?? rows.length);
  }

  private getCutoffDate(days: number): string {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return cutoff.toISOString();
  }
}

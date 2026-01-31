/**
 * Sync Helper Functions
 *
 * Utility functions to interact with the sync configuration.
 * Separated from config.ts to keep the configuration file pure and minimal.
 */

import { syncTables } from "../config";
import type { SyncTableConfig } from "../types";

/** Get config for a specific table */
export function getTableConfig(table: string): SyncTableConfig | undefined {
  return syncTables.find((t) => t.table === table);
}

/** Get tables sorted by priority (lowest first) */
export function getTablesByPriority(): SyncTableConfig[] {
  return [...syncTables].sort((a, b) => a.priority - b.priority);
}

/** Get tables that need push (client → server) */
export function getPushTables(): SyncTableConfig[] {
  return syncTables.filter(
    (t) => t.direction === "push" || t.direction === "bi",
  );
}

/** Get tables that need pull (server → client) */
export function getPullTables(): SyncTableConfig[] {
  return syncTables.filter(
    (t) => t.direction === "pull" || t.direction === "bi",
  );
}

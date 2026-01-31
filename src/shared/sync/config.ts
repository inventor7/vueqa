/**
 * Sync Configuration Registry
 *
 * This file is ONLY for aggregating sync configurations from modules.
 * It uses auto-discovery (import.meta.glob) to find 'sync.ts' in src/modules.
 */

import type { SyncTableConfig } from "./types";

// Auto-load all sync.ts files from modules
// Returns: { '/src/modules/reactive/sync.ts': Module, ... }
const modules = import.meta.glob<{ syncConfig: SyncTableConfig[] }>(
  "../../modules/*/sync.ts",
  { eager: true },
);

/**
 * Aggregated sync tables from all modules.
 */
export const syncTables: SyncTableConfig[] = Object.values(modules)
  .flatMap((mod) => mod.syncConfig || [])
  .filter(Boolean);

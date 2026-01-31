/**
 * Database event bus for reactive change notifications.
 *
 * This module provides a singleton event emitter that notifies
 * subscribers when database tables change, enabling reactive UI updates.
 */

import mitt, { type Emitter } from "mitt";
import type { DatabaseEvents, TableChangeEvent, ChangeType } from "./types";

/**
 * Singleton event emitter for database changes
 */
const emitter: Emitter<DatabaseEvents> = mitt<DatabaseEvents>();

/**
 * Emit a table change event
 *
 * @param table - Name of the table that changed
 * @param type - Type of change (insert, update, delete, bulk)
 * @param options - Additional event data
 *
 * @example
 * ```ts
 * emitTableChange('customers', 'insert', { affectedIds: [123] });
 * ```
 */
export function emitTableChange(
  table: string,
  type: ChangeType,
  options?: {
    affectedRows?: number;
    affectedIds?: (string | number)[];
    transactionId?: string;
  },
): void {
  const event: TableChangeEvent = {
    table,
    type,
    timestamp: Date.now(),
    ...options,
  };

  const specificEvent = `${table}:${type}`;
  emitter.emit(specificEvent, event);
  emitter.emit(table, event);
  emitter.emit("*", event);

  if (import.meta.env.DEV) {
    console.log(`[DB Event] ${table}.${type}`, event);
  }
}

let batchQueue: Array<{
  table: string;
  type: ChangeType;
  ids?: (string | number)[];
}> = [];
let batchTimer: ReturnType<typeof setTimeout> | null = null;
const BATCH_DELAY = 10;

/**
 * Batch multiple changes into a single bulk event.
 * Use this for bulk operations to prevent N refetches.
 */
export function batchEmit(
  table: string,
  type: ChangeType,
  affectedIds?: (string | number)[],
): void {
  batchQueue.push({ table, type, ids: affectedIds });

  if (!batchTimer) {
    batchTimer = setTimeout(() => {
      flushBatch();
    }, BATCH_DELAY);
  }
}

function flushBatch(): void {
  if (batchQueue.length === 0) return;

  const transactionId = `tx-${Date.now()}`;
  const tableGroups = new Map<
    string,
    { types: Set<ChangeType>; ids: (string | number)[] }
  >();

  for (const item of batchQueue) {
    if (!tableGroups.has(item.table)) {
      tableGroups.set(item.table, { types: new Set(), ids: [] });
    }
    const group = tableGroups.get(item.table)!;
    group.types.add(item.type);
    if (item.ids) group.ids.push(...item.ids);
  }

  for (const [table, group] of tableGroups) {
    emitTableChange(table, "bulk", {
      affectedRows:
        group.ids.length || batchQueue.filter((q) => q.table === table).length,
      affectedIds: group.ids.length > 0 ? group.ids : undefined,
      transactionId,
    });
  }

  batchQueue = [];
  batchTimer = null;
}

/**
 * Subscribe to changes for specific tables
 *
 * @param tables - Array of table names to watch
 * @param callback - Function to call when tables change
 * @returns Cleanup function to unsubscribe
 *
 * @example
 * ```ts
 * const unsubscribe = onTableChange(['customers', 'orders'], (event) => {
 *   console.log(`${event.table} changed:`, event.type);
 * });
 *
 * // Later: cleanup
 * onUnmounted(unsubscribe);
 * ```
 */
export function onTableChange(
  tables: string[],
  callback: (event: TableChangeEvent) => void,
): () => void {
  const handlers: Array<() => void> = [];

  // Subscribe to each table
  tables.forEach((table) => {
    const handler = (event: TableChangeEvent) => {
      if (event.table === table) {
        callback(event);
      }
    };

    emitter.on(table, handler);
    handlers.push(() => emitter.off(table, handler));
  });

  // Return cleanup function
  return () => {
    handlers.forEach((cleanup) => cleanup());
  };
}

/**
 * Subscribe to all database changes
 *
 * @param callback - Function to call on any table change
 * @returns Cleanup function to unsubscribe
 *
 * @example
 * ```ts
 * const unsubscribe = onAnyChange((event) => {
 *   console.log('Database changed:', event);
 * });
 * ```
 */
export function onAnyChange(
  callback: (event: TableChangeEvent) => void,
): () => void {
  emitter.on("*", callback);
  return () => emitter.off("*", callback);
}

/**
 * Clear all event listeners (useful for testing)
 */
export function clearAllListeners(): void {
  emitter.all.clear();
}

/**
 * Export emitter for advanced use cases
 */
export { emitter };

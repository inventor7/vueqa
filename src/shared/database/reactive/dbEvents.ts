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
  },
): void {
  const event: TableChangeEvent = {
    table,
    type,
    timestamp: Date.now(),
    ...options,
  };

  // Emit specific event: "tableName:changeType"
  const specificEvent = `${table}:${type}`;
  emitter.emit(specificEvent, event);

  // Emit table-level event: "tableName"
  emitter.emit(table, event);

  // Emit wildcard event for global listeners
  emitter.emit("*", event);

  // Debug logging in development
  console.log(`[DB Event] ${table}.${type}`, event);
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

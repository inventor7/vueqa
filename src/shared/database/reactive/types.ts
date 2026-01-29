/**
 * Database reactivity types for event-driven updates.
 *
 * This module provides TypeScript types for the reactive database layer,
 * enabling type-safe event emission and listening.
 */

/**
 * Supported table change types
 */
export type ChangeType = "insert" | "update" | "delete" | "bulk";

/**
 * Event payload for table changes
 */
export interface TableChangeEvent {
  /** Name of the table that changed */
  table: string;
  /** Type of change (insert, update, delete, bulk) */
  type: ChangeType;
  /** Timestamp of the change */
  timestamp: number;
  /** Optional: Number of rows affected (useful for bulk operations) */
  affectedRows?: number;
  /** Optional: Specific IDs affected (for granular updates) */
  affectedIds?: (string | number)[];
}

/**
 * Event map for mitt event emitter
 */
export type DatabaseEvents = {
  /** Wildcard event - fired on any table change */
  "*": TableChangeEvent;
  /** Table-specific events in format "tableName:changeType" */
  [key: string]: TableChangeEvent;
};

/**
 * Options for reactive queries
 */
export interface ReactiveQueryOptions {
  /** Tables to watch for changes */
  tables: string[];
  /** Debounce interval in ms (default: 100) */
  debounce?: number;
  /** Enable logging for debugging */
  debug?: boolean;
}

/**
 * Options for optimistic mutations
 */
export interface OptimisticMutationOptions<T, R> {
  /** Table name being mutated */
  table: string;
  /** Function to optimistically update local state */
  optimisticUpdate: (data: T) => void;
  /** Actual database mutation to perform */
  mutation: (data: T) => Promise<R>;
  /** Rollback function called on error */
  onError?: (rollback: () => void, error: unknown) => void;
  /** Success callback */
  onSuccess?: (result: R) => void;
}

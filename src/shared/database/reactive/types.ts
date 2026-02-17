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
  transactionId?: string;
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
 * Options for reactive queries.
 *
 * @typeParam T - The expected return type of the query
 *
 * @example Basic usage
 * ```typescript
 * const options: ReactiveQueryOptions<Task[]> = {
 *   tables: ['tasks'],
 *   refetchOn: ['insert', 'delete'],
 * };
 * ```
 *
 * @example With queryKey (explicit deduplication)
 * ```typescript
 * // queryKey Strategy:
 * // - Auto-generated from tables: "tasks,users" (may cause false positives)
 * // - Use explicit queryKey for unique queries on same tables
 * const options: ReactiveQueryOptions<Task[]> = {
 *   tables: ['tasks'],
 *   queryKey: 'pending-tasks', // Unique key for THIS specific query
 * };
 * ```
 *
 * @example Complex shouldRefetch scenarios
 * ```typescript
 * // Scenario 1: Only refetch if specific IDs changed
 * shouldRefetch: (event) => {
 *   if (!event.affectedIds) return true;
 *   return event.affectedIds.some(id => visibleIds.includes(id));
 * }
 *
 * // Scenario 2: Skip refetch during bulk transactions
 * shouldRefetch: (event) => event.type !== 'bulk'
 *
 * // Scenario 3: Only refetch for specific user's changes
 * shouldRefetch: (event) => {
 *   return event.affectedIds?.includes(currentUserId) ?? true;
 * }
 * ```
 */
export interface ReactiveQueryOptions<T = unknown> {
  /**
   * Tables to listen to for changes.
   */
  tables: string[];
  /**
   * Unique key for request deduplication.
   * Auto-generated from `tables.join(',')` if not provided.
   */
  queryKey?: string;
  debounce?: number;
  debug?: boolean;
  refetchOn?: ChangeType[];
  shouldRefetch?: (event: TableChangeEvent) => boolean;
  cacheTime?: number;
  staleWhileRevalidate?: boolean;
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  /** Cancel in-flight query on component unmount (default: true) */
  cancelOnUnmount?: boolean;
  /** Number of retries on failure (default: 0) */
  retry?: number | false;
  /** Retry delay in ms, or function for custom backoff (default: exponential) */
  retryDelay?: number | ((attempt: number) => number);
}

/**
 * Options for optimistic mutations
 */
export interface OptimisticMutationOptions<T, R> {
  /** Table name being mutated */
  table: string;
  /**
   * Function to optimistically update local state.
   * Called immediately before the database mutation.
   */
  optimisticUpdate: (data: T) => void;
  /**
   * Function to capture state snapshot before optimistic update.
   * Return value will be passed to rollbackFn if mutation fails.
   * If not provided, you must implement rollback logic in onError.
   */
  snapshotFn?: () => unknown;
  /**
   * Function to restore state from snapshot.
   * Called automatically on error if provided.
   * @param snapshot - The value returned by snapshotFn
   */
  rollbackFn?: (snapshot: unknown) => void;
  /** Actual database mutation to perform */
  mutation: (data: T) => Promise<R>;
  /**
   * Error handler called when mutation fails.
   * If snapshotFn/rollbackFn are provided, rollback is automatic.
   * Otherwise, implement rollback logic here using the rollback callback.
   */
  onError?: (rollback: () => void, error: unknown) => void;
  /** Success callback */
  onSuccess?: (result: R) => void;
}

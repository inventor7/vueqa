/**
 * Reactive query composable with auto-refetch on table changes.
 *
 * Automatically re-executes queries when subscribed tables change,
 * enabling real-time UI updates without manual intervention.
 */

import { ref, onMounted, onUnmounted, type Ref } from "vue";
import { onTableChange } from "@/shared/database/reactive/dbEvents";
import type { ReactiveQueryOptions } from "@/shared/database/reactive/types";

/**
 * Default debounce interval (ms) for query refetches
 */
const DEFAULT_DEBOUNCE = 100;

/**
 * Auto-refetching reactive query composable
 *
 * @param queryFn - Async function that executes the query
 * @param options - Configuration for reactive behavior
 * @returns Reactive state with data, loading, error, and manual refetch
 *
 * @example
 * ```ts
 * // Basic usage
 * const { data: customers, loading, error, refetch } = useReactiveQuery(
 *   () => db.selectFrom('customers').selectAll().execute(),
 *   { tables: ['customers'] }
 * );
 *
 * // Watch multiple tables
 * const { data: orders } = useReactiveQuery(
 *   () => db.selectFrom('orders')
 *     .innerJoin('customers', 'customers.customer_id', 'orders.customer_id')
 *     .selectAll()
 *     .execute(),
 *   { tables: ['orders', 'customers'] }
 * );
 *
 * // Manual refetch
 * await refetch();
 * ```
 */
export function useReactiveQuery<T>(
  queryFn: () => Promise<T>,
  options: ReactiveQueryOptions,
) {
  const data = ref<T | null>(null) as Ref<T | null>;
  const loading = ref(false);
  const error = ref<Error | null>(null);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const debounceMs = options.debounce ?? DEFAULT_DEBOUNCE;

  /**
   * Execute the query and update reactive state
   */
  async function executeQuery() {
    loading.value = true;
    error.value = null;

    try {
      const result = await queryFn();
      data.value = result;

      if (options.debug) {
        console.log("[useReactiveQuery] Query executed:", result);
      }
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err));
      console.error("[useReactiveQuery] Query failed:", err);
    } finally {
      loading.value = false;
    }
  }

  /**
   * Debounced refetch to prevent excessive queries
   */
  function scheduledRefetch() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      executeQuery();
      debounceTimer = null;
    }, debounceMs);
  }

  /**
   * Manual refetch (bypasses debounce)
   */
  async function refetch() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    await executeQuery();
  }

  // Initial fetch on mount
  onMounted(() => {
    executeQuery();
  });

  // Subscribe to table changes
  let unsubscribe: (() => void) | null = null;

  onMounted(() => {
    unsubscribe = onTableChange(options.tables, (event) => {
      if (options.debug) {
        console.log("[useReactiveQuery] Table changed, refetching:", event);
      }
      scheduledRefetch();
    });
  });

  // Cleanup on unmount
  onUnmounted(() => {
    if (unsubscribe) {
      unsubscribe();
    }
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
  });

  return {
    data,
    loading,
    error,
    refetch,
  };
}

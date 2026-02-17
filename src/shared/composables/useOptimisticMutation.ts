/**
 * Optimistic mutation composable with automatic rollback.
 *
 * Provides instant UI feedback by applying changes locally first,
 * then syncing with the database. Automatically rolls back on failure.
 */

import { ref } from "vue";
import type { OptimisticMutationOptions } from "@/shared/database/reactive/types";

/**
 * Optimistic update composable
 *
 * Implements the optimistic UI pattern:
 * 1. Capture state snapshot (if snapshotFn provided)
 * 2. Apply change to local state immediately
 * 3. Execute database mutation in background
 * 4. On success: do nothing (UI already updated)
 * 5. On failure: auto-rollback (if rollbackFn provided) and notify user
 *
 * @param options - Configuration for optimistic behavior
 * @returns Mutation function and loading state
 *
 * @example With automatic rollback (recommended)
 * ```ts
 * const customers = ref<Customer[]>([]);
 *
 * const { mutate } = useOptimisticMutation({
 *   table: 'customers',
 *   // Capture state before update
 *   snapshotFn: () => [...customers.value],
 *   // Apply optimistic update
 *   optimisticUpdate: (newCustomer: Customer) => {
 *     customers.value = [...customers.value, newCustomer];
 *   },
 *   // Restore from snapshot on error
 *   rollbackFn: (snapshot) => {
 *     customers.value = snapshot as Customer[];
 *   },
 *   mutation: async (newCustomer: Customer) => {
 *     return await rdb.insertInto('customers')
 *       .values(newCustomer)
 *       .executeTakeFirst();
 *   },
 *   onError: (rollback, error) => {
 *     // Rollback already happened automatically
 *     showNotification('Failed to add customer', 'error');
 *   }
 * });
 * ```
 *
 * @example Manual rollback (for complex state)
 * ```ts
 * const { mutate } = useOptimisticMutation({
 *   table: 'customers',
 *   optimisticUpdate: (newCustomer: Customer) => {
 *     customers.value = [...customers.value, newCustomer];
 *   },
 *   mutation: async (newCustomer: Customer) => {
 *     return await rdb.insertInto('customers').values(newCustomer).execute();
 *   },
 *   onError: (rollback, error) => {
 *     // Manually revert - you implement the rollback logic
 *     customers.value = customers.value.slice(0, -1);
 *     showNotification('Failed', 'error');
 *   }
 * });
 * ```
 */
export function useOptimisticMutation<T, R>(
  options: OptimisticMutationOptions<T, R>,
) {
  const loading = ref(false);
  const error = ref<Error | null>(null);

  /**
   * Execute optimistic mutation
   *
   * @param data - Data to mutate
   * @returns Result from database mutation
   */
  async function mutate(data: T): Promise<R | null> {
    loading.value = true;
    error.value = null;

    // Capture snapshot before optimistic update (if provided)
    const snapshot = options.snapshotFn ? options.snapshotFn() : null;
    let rollbackExecuted = false;

    const rollback = () => {
      if (!rollbackExecuted) {
        rollbackExecuted = true;

        // If rollbackFn is provided, call it with the snapshot
        if (options.rollbackFn && snapshot !== null) {
          options.rollbackFn(snapshot);
        }
        // Otherwise, rollback logic must be in onError handler
      }
    };

    try {
      // Step 1: Apply optimistic update immediately
      options.optimisticUpdate(data);

      // Step 2: Execute actual database mutation
      const result = await options.mutation(data);

      // Step 3: On success, call success handler
      if (options.onSuccess) {
        options.onSuccess(result);
      }

      loading.value = false;
      return result;
    } catch (err) {
      // Step 4: On failure, rollback and notify
      error.value = err instanceof Error ? err : new Error(String(err));

      // Auto-rollback if snapshot/rollback functions provided
      if (options.snapshotFn && options.rollbackFn) {
        rollback();
      }

      if (options.onError) {
        options.onError(rollback, err);
      } else {
        // Default error handling: just log
        console.error(
          `[Optimistic Mutation] Failed for table "${options.table}":`,
          err,
        );
      }

      loading.value = false;
      return null;
    }
  }

  return {
    mutate,
    loading,
    error,
  };
}

/**
 * Simplified optimistic mutation for common CRUD operations
 *
 * @example
 * ```ts
 * const customers = ref<Customer[]>([]);
 *
 * // Optimistic delete
 * const { mutate: deleteCustomer } = useOptimisticDelete({
 *   table: 'customers',
 *   items: customers,
 *   findFn: (id: number) => customers.value.findIndex(c => c.customer_id === id),
 *   mutation: async (id: number) => {
 *     await rdb.deleteFrom('customers')
 *       .where('customer_id', '=', id)
 *       .execute();
 *   }
 * });
 * ```
 */
export function useOptimisticDelete<T, ID>(options: {
  table: string;
  items: { value: T[] };
  findFn: (id: ID) => number; // Returns index of item to delete
  mutation: (id: ID) => Promise<void>;
  onError?: (error: unknown) => void;
  onSuccess?: () => void;
}) {
  let savedItem: T | null = null;
  let savedIndex: number = -1;

  return useOptimisticMutation({
    table: options.table,
    optimisticUpdate: (id: ID) => {
      const index = options.findFn(id);
      if (index !== -1) {
        // Store the deleted item for rollback
        const item = options.items.value[index];
        if (item !== undefined) {
          savedItem = item;
          savedIndex = index;
        }
        options.items.value = options.items.value.filter((_, i) => i !== index);
      }
    },
    mutation: options.mutation,
    onError: (rollback, error) => {
      // Restore the item on error
      if (savedItem !== null && savedIndex !== -1) {
        options.items.value.splice(savedIndex, 0, savedItem);
      }
      if (options.onError) {
        options.onError(error);
      }
    },
    onSuccess: () => {
      // Clear saved state on success
      savedItem = null;
      savedIndex = -1;
      if (options.onSuccess) {
        options.onSuccess();
      }
    },
  });
}

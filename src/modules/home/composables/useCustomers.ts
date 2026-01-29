/**
 * Example: Reactive customers composable
 *
 * Demonstrates how to use the reactive database layer with
 * optimistic updates and auto-refetching queries.
 */

import { computed } from "vue";
import { db, rdb } from "@/shared/database";
import { useReactiveQuery } from "@/shared/composables/useReactiveQuery";
import { useOptimisticMutation } from "@/shared/composables/useOptimisticMutation";
import type { CustomerTable } from "@/modules/home/database/schema";

/**
 * Reactive customers composable with CRUD operations
 *
 * @example
 * ```ts
 * const {
 *   customers,
 *   loading,
 *   addCustomer,
 *   updateCustomer,
 *   deleteCustomer
 * } = useCustomers();
 *
 * // Add a customer (optimistic update)
 * await addCustomer({ customer_name: 'Alice', country_id: 1 });
 *
 * // Other components watching 'customers' will auto-update!
 * ```
 */
export function useCustomers() {
  // Reactive query that auto-refetches when 'customers' table changes
  const {
    data: customers,
    loading,
    error,
    refetch,
  } = useReactiveQuery(() => db.selectFrom("customers").selectAll().execute(), {
    tables: ["customers"],
    debounce: 100,
    debug: import.meta.env.DEV,
  });

  // Computed: total customer count
  const totalCustomers = computed(() => customers.value?.length ?? 0);

  // Optimistic mutation: Add customer
  const { mutate: addCustomer, loading: isAdding } = useOptimisticMutation({
    table: "customers",
    optimisticUpdate: (newCustomer: {
      customer_name: string;
      country_id: number;
    }) => {
      // Optimistically add to local state (with temporary ID)
      const optimisticCustomer: CustomerTable = {
        customer_name: newCustomer.customer_name,
        country_id: newCustomer.country_id,
        customer_id: -Date.now(), // Negative temp ID
      };

      if (customers.value) {
        customers.value = [...customers.value, optimisticCustomer];
      }
    },
    mutation: async (newCustomer: {
      customer_name: string;
      country_id: number;
    }) => {
      // Get the highest customer_id to generate next ID
      const maxCustomer = await db
        .selectFrom("customers")
        .select((eb) => eb.fn.max("customer_id").as("max_id"))
        .executeTakeFirst();

      const nextId = (maxCustomer?.max_id ?? 0) + 1;

      // Actual database insert (emits 'customers:insert' event)
      const result = await rdb
        .insertInto("customers")
        .values({
          customer_name: newCustomer.customer_name,
          country_id: newCustomer.country_id,
          customer_id: nextId,
        })
        .executeTakeFirst();

      return result;
    },
    onError: (rollback, error) => {
      rollback(); // Revert optimistic update
      console.error("Failed to add customer:", error);
      // You can use useNotifications here
    },
    onSuccess: () => {
      console.log("Customer added successfully!");
      // The query will auto-refetch due to the event
    },
  });

  // Optimistic mutation: Update customer
  const { mutate: updateCustomer, loading: isUpdating } = useOptimisticMutation(
    {
      table: "customers",
      optimisticUpdate: (data: { id: number; name: string }) => {
        if (customers.value) {
          const index = customers.value.findIndex(
            (c) => c.customer_id === data.id,
          );
          if (index !== -1) {
            customers.value = customers.value.map((c, i) =>
              i === index ? { ...c, customer_name: data.name } : c,
            );
          }
        }
      },
      mutation: async (data: { id: number; name: string }) => {
        return await rdb
          .updateTable("customers")
          .set({ customer_name: data.name })
          .where("customer_id", "=", data.id)
          .execute();
      },
      onError: (rollback) => {
        rollback();
        console.error("Failed to update customer");
      },
    },
  );

  // Optimistic mutation: Delete customer
  const { mutate: deleteCustomer, loading: isDeleting } = useOptimisticMutation(
    {
      table: "customers",
      optimisticUpdate: (customerId: number) => {
        if (customers.value) {
          // Store the deleted customer for rollback
          const deletedCustomer = customers.value.find(
            (c) => c.customer_id === customerId,
          );
          customers.value = customers.value.filter(
            (c) => c.customer_id !== customerId,
          );

          // Return rollback function
          return () => {
            if (deletedCustomer && customers.value) {
              customers.value = [...customers.value, deletedCustomer];
            }
          };
        }
      },
      mutation: async (customerId: number) => {
        return await rdb
          .deleteFrom("customers")
          .where("customer_id", "=", customerId)
          .execute();
      },
      onError: (rollback) => {
        rollback();
        console.error("Failed to delete customer");
      },
    },
  );

  return {
    // Data
    customers,
    totalCustomers,

    // State
    loading,
    error,
    isAdding,
    isUpdating,
    isDeleting,

    // Actions
    refetch,
    addCustomer,
    updateCustomer,
    deleteCustomer,
  };
}

/**
 * Reactive Tasks Composable with detailed logging
 *
 * Demonstrates reactive database patterns with visible logs
 * following the "Big Dog" modular architecture.
 */

import { computed } from "vue";
import { rdb } from "@/shared/database";
import { useReactiveQuery } from "@/shared/composables/useReactiveQuery";
import { useOptimisticMutation } from "@/shared/composables/useOptimisticMutation";
import type { Task, NewTask } from "../database/schema";
import { useLogStore } from "../stores/log.store";

/**
 * Reactive tasks composable with full CRUD and logging
 */
export function useTasks() {
  const logStore = useLogStore();

  logStore.addLog("query", "📦 useTasks composable initialized");

  // reactive query that auto-refetches when 'tasks' table changes
  const {
    data: tasks,
    loading,
    error,
    refetch: innerRefetch,
  } = useReactiveQuery(
    async () => {
      logStore.addLog("query", "🔍 Executing SELECT * FROM tasks...");
      const startTime = performance.now();

      const result = await rdb
        .selectFrom("tasks")
        .selectAll()
        .orderBy("created_at", "desc")
        .execute();

      const elapsed = (performance.now() - startTime).toFixed(2);
      logStore.addLog(
        "query",
        `✅ Query complete: ${result.length} tasks fetched in ${elapsed}ms`,
      );

      return result as Task[];
    },
    {
      tables: ["tasks"],
      debounce: 100,
      debug: false,
    },
  );

  // Computed stats
  const totalTasks = computed(() => tasks.value?.length ?? 0);
  const completedTasks = computed(
    () => tasks.value?.filter((t) => t.completed === 1).length ?? 0,
  );
  const pendingTasks = computed(
    () => tasks.value?.filter((t) => t.completed === 0).length ?? 0,
  );

  // Optimistic mutation: Add task
  const { mutate: addTaskAction, loading: isAdding } = useOptimisticMutation<
    NewTask,
    any
  >({
    table: "tasks",
    optimisticUpdate: (taskData) => {
      logStore.addLog(
        "mutation",
        `⚡ OPTIMISTIC: Adding task "${taskData.title}" to UI immediately`,
      );

      const optimisticTask: Task = {
        task_id: -Date.now(), // Temporary ID
        title: taskData.title,
        description: taskData.description ?? null,
        completed: 0,
        priority: taskData.priority,
        created_at: new Date().toISOString(),
      };

      if (tasks.value) {
        tasks.value = [optimisticTask, ...tasks.value];
      } else {
        tasks.value = [optimisticTask];
      }
    },
    mutation: async (taskData) => {
      logStore.addLog("mutation", `💾 DATABASE: Inserting task into SQLite...`);
      const startTime = performance.now();

      const result = await rdb
        .insertInto("tasks")
        .values({
          ...taskData,
          created_at: new Date().toISOString(),
        })
        .executeTakeFirst();

      const elapsed = (performance.now() - startTime).toFixed(2);
      logStore.addLog("mutation", `✅ INSERT complete in ${elapsed}ms`);
      logStore.addLog(
        "event",
        `📢 Event emitted: tasks:insert → triggers auto-refetch`,
      );

      return result;
    },
    onError: (rollback, err) => {
      logStore.addLog(
        "mutation",
        `❌ ERROR: ${err instanceof Error ? err.message : String(err)}`,
      );
      logStore.addLog(
        "mutation",
        `🔄 ROLLBACK: Reverting optimistic update...`,
      );
      // We rely on the auto-refetch or manual refetch to clean up
      innerRefetch();
    },
    onSuccess: () => {
      logStore.addLog("refetch", `🔄 Auto-refetch triggered by insert event`);
    },
  });

  // Optimistic mutation: Toggle task completion
  const { mutate: toggleTaskAction, loading: isToggling } =
    useOptimisticMutation<number, any>({
      table: "tasks",
      optimisticUpdate: (taskId) => {
        const task = tasks.value?.find((t) => t.task_id === taskId);
        if (task) {
          const newStatus = task.completed === 1 ? "pending" : "completed";
          logStore.addLog(
            "mutation",
            `⚡ OPTIMISTIC: Marking task #${taskId} as ${newStatus}`,
          );

          if (tasks.value) {
            tasks.value = tasks.value.map((t) =>
              t.task_id === taskId
                ? { ...t, completed: t.completed === 1 ? 0 : 1 }
                : t,
            );
          }
        }
      },
      mutation: async (taskId) => {
        const task = tasks.value?.find((t) => t.task_id === taskId);
        const newCompleted = task?.completed === 1 ? 0 : 1;

        logStore.addLog(
          "mutation",
          `💾 DATABASE: UPDATE tasks SET completed=${newCompleted} WHERE task_id=${taskId}`,
        );

        return await rdb
          .updateTable("tasks")
          .set({ completed: newCompleted })
          .where("task_id", "=", taskId)
          .execute();
      },
      onError: (rollback) => {
        logStore.addLog("mutation", `❌ Toggle failed, rolling back...`);
        innerRefetch();
      },
    });

  // Optimistic mutation: Delete task
  const { mutate: deleteTaskAction, loading: isDeleting } =
    useOptimisticMutation<number, any>({
      table: "tasks",
      optimisticUpdate: (taskId) => {
        logStore.addLog(
          "mutation",
          `⚡ OPTIMISTIC: Removing task #${taskId} from UI`,
        );

        if (tasks.value) {
          tasks.value = tasks.value.filter((t) => t.task_id !== taskId);
        }
      },
      mutation: async (taskId) => {
        logStore.addLog(
          "mutation",
          `💾 DATABASE: DELETE FROM tasks WHERE task_id=${taskId}`,
        );

        return await rdb
          .deleteFrom("tasks")
          .where("task_id", "=", taskId)
          .execute();
      },
      onError: (rollback) => {
        logStore.addLog("mutation", `❌ Delete failed, rolling back...`);
        innerRefetch();
      },
    });

  /**
   * Manual refetch wrapper
   */
  async function manualRefetch() {
    logStore.addLog("refetch", `🔄 MANUAL REFETCH triggered by user`);
    await innerRefetch();
  }

  return {
    // Data
    tasks,
    totalTasks,
    completedTasks,
    pendingTasks,

    // State
    loading,
    error,
    isAdding,
    isToggling,
    isDeleting,

    // Actions
    addTask: addTaskAction,
    toggleTask: toggleTaskAction,
    deleteTask: deleteTaskAction,
    refetch: manualRefetch,
  };
}

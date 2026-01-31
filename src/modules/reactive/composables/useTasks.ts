/**
 * Reactive Tasks Composable with detailed logging
 *
 * Demonstrates reactive database patterns with visible logs
 * following the "Big Dog" modular architecture.
 */

/**
 * Reactive tasks composable with full CRUD and logging
 */
export function useTasks() {
  const logStore = useLogStore();

  logStore.addLog("query", "📦 useTasks composable initialized");

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
        .where("_delete_date", "is", null)
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
      refetchOn: ["insert", "delete"],
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
    Omit<NewTask, "_ruid" | "_create_date" | "_write_date" | "_sync_status">,
    any
  >({
    table: "tasks",
    optimisticUpdate: (taskData) => {
      logStore.addLog(
        "mutation",
        `⚡ OPTIMISTIC: Adding task "${taskData.title}" to UI immediately`,
      );

      const now = nowISO();
      const optimisticTask: Task = {
        id: -Date.now(), // Temporary ID
        _ruid: `temp-${Date.now()}`,
        title: taskData.title,
        description: taskData.description ?? null,
        completed: 0,
        priority: taskData.priority ?? "medium",
        created_at: now,
        _create_date: now,
        _write_date: now,
        _delete_date: null,
        _sync_status: "to_create",
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
      const now = nowISO();

      const result = await rdb
        .insertInto("tasks")
        .values({
          ...taskData,
          _ruid: generateLocalRuid(),
          _create_date: now,
          _write_date: now,
          _sync_status: "to_create",
          created_at: now,
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
        const task = tasks.value?.find((t) => t.id === taskId);
        if (task) {
          const newStatus = task.completed === 1 ? "pending" : "completed";
          logStore.addLog(
            "mutation",
            `⚡ OPTIMISTIC: Marking task #${taskId} as ${newStatus}`,
          );

          if (tasks.value) {
            tasks.value = tasks.value.map((t) =>
              t.id === taskId
                ? { ...t, completed: t.completed === 1 ? 0 : 1 }
                : t,
            );
          }
        }
      },
      mutation: async (taskId) => {
        const task = tasks.value?.find((t) => t.id === taskId);
        const newCompleted = task?.completed === 1 ? 1 : 0;

        logStore.addLog(
          "mutation",
          `💾 DATABASE: UPDATE tasks SET completed=${newCompleted} WHERE id=${taskId}`,
        );

        return await rdb
          .updateTable("tasks")
          .set({
            completed: newCompleted,
            _write_date: nowISO(),
            _sync_status: "to_update",
          })
          .where("id", "=", taskId)
          .execute();
      },
      onError: (rollback) => {
        logStore.addLog("mutation", `❌ Toggle failed, rolling back...`);
        innerRefetch();
      },
    });

  // Optimistic mutation: Delete task (Soft Delete)
  const { mutate: deleteTaskAction, loading: isDeleting } =
    useOptimisticMutation<number, any>({
      table: "tasks",
      optimisticUpdate: (taskId) => {
        logStore.addLog(
          "mutation",
          `⚡ OPTIMISTIC: Removing task #${taskId} from UI`,
        );

        if (tasks.value) {
          tasks.value = tasks.value.filter((t) => t.id !== taskId);
        }
      },
      mutation: async (taskId) => {
        logStore.addLog(
          "mutation",
          `💾 DATABASE: DELETE FROM tasks WHERE id=${taskId}`,
        );

        // Hard delete: actually remove from table to trigger 'delete' event
        return await rdb.deleteFrom("tasks").where("id", "=", taskId).execute();
      },
      onError: (rollback) => {
        logStore.addLog("mutation", `❌ Delete failed, rolling back...`);
        innerRefetch();
      },
    });

  // Optimistic mutation: Update task details
  const { mutate: updateTaskAction, loading: isUpdating } =
    useOptimisticMutation<
      {
        id: number;
        updates: Partial<
          Omit<
            NewTask,
            "id" | "_ruid" | "_create_date" | "_write_date" | "_sync_status"
          >
        >;
      },
      any
    >({
      table: "tasks",
      optimisticUpdate: ({ id, updates }) => {
        logStore.addLog(
          "mutation",
          `⚡ OPTIMISTIC: Updating task #${id} details`,
        );
        if (tasks.value) {
          tasks.value = tasks.value.map((t) =>
            t.id === id ? { ...t, ...updates } : t,
          );
        }
      },
      mutation: async ({ id, updates }) => {
        logStore.addLog("mutation", `💾 DATABASE: Updating task #${id}...`);
        const now = nowISO();
        return await rdb
          .updateTable("tasks")
          .set({
            ...updates,
            _write_date: now,
            _sync_status: "to_update",
          })
          .where("id", "=", id)
          .execute();
      },
      onError: () => {
        logStore.addLog("mutation", `❌ Update failed, rolling back...`);
        innerRefetch();
      },
    });

  // Manual refetch exposed to UI
  const refetchTasks = async () => {
    logStore.addLog("refetch", "🔄 Manual refetch requested");
    await innerRefetch();
  };

  return {
    tasks,
    totalTasks,
    completedTasks,
    pendingTasks,
    loading,
    error,
    addTask: addTaskAction,
    updateTask: updateTaskAction,
    toggleTask: toggleTaskAction,
    deleteTask: deleteTaskAction,
    refetch: refetchTasks,
    isAdding,
    isToggling,
    isDeleting,
  };
}

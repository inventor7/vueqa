<template>
  <F7Page name="reactive-demo">
    <MetricsDevTools />

    <F7Navbar title="Reactive SQLite Demo" large transparent back-link="Back">
      <F7NavRight>
        <F7Link @click="toggleDevTools()">
          <ILucideBarChart2 class="w-5 h-5" />
          <span class="if-not-md ml-1">Metrics</span>
        </F7Link>
      </F7NavRight>
    </F7Navbar>

    <F7Block strong inset class="rounded-2xl! shadow-sm">
      <div class="grid grid-cols-3 gap-4 text-center">
        <div>
          <div class="text-3xl font-bold">{{ totalTasks }}</div>
          <div class="text-xs text-gray-400 uppercase tracking-wider">
            Total
          </div>
        </div>
        <div>
          <div class="text-3xl font-bold text-green-500">
            {{ completedTasks }}
          </div>
          <div class="text-xs text-gray-400 uppercase tracking-wider">Done</div>
        </div>
        <div>
          <div class="text-3xl font-bold text-orange-500">
            {{ pendingTasks }}
          </div>
          <div class="text-xs text-gray-400 uppercase tracking-wider">
            Pending
          </div>
        </div>
      </div>
    </F7Block>

    <F7List
      strong
      inset
      dividers
      class="rounded-2xl! shadow-sm overflow-hidden"
    >
      <F7ListInput
        v-model:value="newTaskTitle"
        placeholder="What needs to be done?"
        type="text"
        @keyup.enter="handleAddTask"
      >
        <template #media>
          <ILucidePlus class="text-blue-500" />
        </template>
      </F7ListInput>
      <F7ListInput
        v-model:value="newTaskDescription"
        placeholder="Description (optional)"
        type="text"
        @keyup.enter="handleAddTask"
      >
        <template #media>
          <ILucideAlignLeft class="text-gray-400" />
        </template>
      </F7ListInput>
      <F7ListItem
        title="Priority"
        smart-select
        :smart-select-params="{ openIn: 'popover' }"
      >
        <template #media>
          <ILucideZap class="text-yellow-500" />
        </template>
        <select v-model="newTaskPriority">
          <option value="low">Low</option>
          <option value="medium" selected>Medium</option>
          <option value="high">High</option>
        </select>
      </F7ListItem>
      <F7Block class="m-0 p-4 pt-0">
        <F7Button
          fill
          round
          large
          @click="handleAddTask"
          :disabled="!newTaskTitle.trim() || isAdding"
        >
          Add Task
        </F7Button>
      </F7Block>
    </F7List>

    <F7BlockTitle>Tasks</F7BlockTitle>
    <div v-if="loading && !tasks" class="text-center p-8">
      <F7Preloader />
      <p class="mt-2 text-gray-400">Syncing database...</p>
    </div>

    <F7List
      strong
      inset
      dividers
      v-else-if="tasks && tasks.length > 0"
      class="rounded-2xl! shadow-sm overflow-hidden"
    >
      <F7ListItem
        v-for="task in tasks"
        :key="task.id"
        swipeout
        @click="openTaskDetails(task)"
        :class="{ 'opacity-50': task.completed === 1 }"
        :subtitle="task.description || undefined"
        link="#"
      >
        <template #media>
          <div @click.stop="toggleTask(task.id)" class="p-2 -m-2">
            <F7Checkbox
              :checked="task.completed === 1"
              style="pointer-events: none"
            />
          </div>
        </template>
        <template #title>
          <div class="flex items-center gap-2">
            <span :class="{ 'line-through': task.completed === 1 }">{{
              task.title
            }}</span>
            <F7Badge
              v-if="task._sync_status !== 'synced'"
              color="orange"
              class="text-[10px] px-1"
            >
              {{ task._sync_status.replace("to_", "").toUpperCase() }}
            </F7Badge>
          </div>
        </template>
        <template #after>
          <F7Badge :color="priorityColor(task.priority)">{{
            task.priority
          }}</F7Badge>
        </template>

        <F7SwipeoutActions right>
          <F7SwipeoutButton color="red" @click="deleteTask(task.id)">
            <ILucideTrash2 class="w-5 h-5" />
          </F7SwipeoutButton>
        </F7SwipeoutActions>
      </F7ListItem>
    </F7List>

    <F7Block v-else strong inset class="text-center p-8 rounded-2xl!">
      <ILucideClipboardList class="w-12 h-12 mx-auto text-gray-300 mb-2" />
      <p class="text-gray-400">All caught up! No tasks left.</p>
    </F7Block>

    <!-- Task Details Sheet -->
    <F7Sheet
      v-model:opened="isTaskSheetOpen"
      class="task-details-sheet"
      style="height: auto; --f7-sheet-bg-color: #fff"
      swipe-to-close
      backdrop
    >
      <F7BlockTitle large>Edit Task</F7BlockTitle>
      <F7List strong inset dividers class="mb-4">
        <F7ListInput
          label="Title"
          v-model:value="editingTask.title"
          placeholder="Task Title"
        />
        <F7ListInput
          label="Description"
          v-model:value="editingTask.description"
          type="textarea"
          placeholder="Add details..."
        />
        <F7ListItem
          title="Priority"
          smart-select
          :smart-select-params="{ openIn: 'popover' }"
        >
          <select v-model="editingTask.priority">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </F7ListItem>
      </F7List>
      <F7Block class="space-y-3!">
        <F7Button large fill round @click="saveTaskDetails">
          Save Changes
        </F7Button>
        <F7Button
          large
          tonal
          round
          class="mt-2"
          :color="editingTask.completed ? 'orange' : 'green'"
          @click="toggleCompletedFromSheet"
        >
          {{ editingTask.completed ? "Mark as Pending" : "Mark as Completed" }}
        </F7Button>
        <F7Button
          large
          round
          color="red"
          class="mt-2"
          @click="deleteTaskFromSheet"
        >
          Delete Task
        </F7Button>
      </F7Block>
    </F7Sheet>

    <div class="mt-8">
      <F7BlockTitle class="flex justify-between items-center">
        <span>📋 Reactivity Logs</span>
        <div class="flex gap-2">
          <F7Button small tonal color="red" @click="logStore.clearLogs">
            <ILucideTrash2 class="w-3 h-3 mr-1" />
            Clear
          </F7Button>
          <F7Button small tonal @click="refetch">
            <ILucideRefreshCw class="w-3 h-3 mr-1" />
            Refetch
          </F7Button>
        </div>
      </F7BlockTitle>

      <F7Block
        strong
        inset
        class="logs-viewport rounded-2xl! shadow-sm"
        id="logs-container"
      >
        <div
          v-if="logStore.logs.length === 0"
          class="text-center text-gray-400 py-4 italic"
        >
          Interaction logs will appear here...
        </div>
        <div
          v-for="log in logStore.logs"
          :key="log.id"
          class="log-entry"
          :class="'log-' + log.type"
        >
          <span class="log-time">{{ log.time }}</span>
          <span class="log-type">[{{ log.type.toUpperCase() }}]</span>
          <span class="log-msg">{{ log.message }}</span>
        </div>
      </F7Block>
    </div>

    <F7Block class="text-sm text-gray-400 text-center pb-8">
      <p>
        Try toggling tasks quickly to see the ⚡ Optimistic Updates in action!
      </p>
    </F7Block>
  </F7Page>
</template>

<script setup lang="ts">
const { toggleDevTools } = useQueryMetrics();
const logStore = useLogStore();
const {
  tasks,
  totalTasks,
  completedTasks,
  pendingTasks,
  loading,
  isAdding,
  addTask,
  toggleTask,
  deleteTask,
  updateTask,
  refetch,
} = useTasks();

const isTaskSheetOpen = ref(false);
const editingTask = ref<{
  id: number;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  completed: boolean;
}>({
  id: 0,
  title: "",
  description: "",
  priority: "medium",
  completed: false,
});

const openTaskDetails = (task: any) => {
  editingTask.value = {
    id: task.id,
    title: task.title,
    description: task.description || "",
    priority: task.priority,
    completed: task.completed === 1,
  };
  isTaskSheetOpen.value = true;
};

const saveTaskDetails = async () => {
  if (!editingTask.value.title.trim()) return;

  await updateTask({
    id: editingTask.value.id,
    updates: {
      title: editingTask.value.title,
      description: editingTask.value.description || null,
      priority: editingTask.value.priority,
    },
  });

  isTaskSheetOpen.value = false;
};

const toggleCompletedFromSheet = async () => {
  await toggleTask(editingTask.value.id);
  isTaskSheetOpen.value = false;
};

const deleteTaskFromSheet = async () => {
  await deleteTask(editingTask.value.id);
  isTaskSheetOpen.value = false;
};

const startReactivityTest = () => {
  setTimeout(async () => {
    const conn = await getRawConnection();

    for (let i = 1; i <= 5; i++) {
      // Wait 1 second between injections to see them appear one by one
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const now = nowISO();
      const ruid = generateLocalRuid();

      // Use executeWithEvent to manually trigger reactivity when using raw connection
      await executeWithEvent("tasks", "insert", async () => {
        return await conn.run(
          `INSERT INTO tasks (
            title, priority, description, created_at,
            _ruid, _create_date, _write_date, _sync_status
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `Raw Connection Task #${i}`,
            i % 2 === 0 ? "high" : "low",
            "Injected via getRawConnection directly ⚡",
            now,
            ruid,
            now,
            now,
            "to_create",
          ],
        );
      });
    }
  }, 5000);
};

const newTaskTitle = ref("");
const newTaskDescription = ref("");
const newTaskPriority = ref<"low" | "medium" | "high">("medium");

const handleAddTask = async () => {
  if (!newTaskTitle.value.trim()) return;

  await addTask({
    title: newTaskTitle.value.trim(),
    description: newTaskDescription.value.trim() || null,
    priority: newTaskPriority.value,
  });

  newTaskTitle.value = "";
  newTaskDescription.value = "";
  newTaskPriority.value = "medium";
};

function priorityColor(priority: string) {
  switch (priority) {
    case "high":
      return "red";
    case "medium":
      return "orange";
    case "low":
      return "green";
    default:
      return "gray";
  }
}

// Auto-scroll logs to top (since we unshift)
watch(
  () => logStore.logs.length,
  () => {
    nextTick(() => {
      const container = document.getElementById("logs-container");
      if (container) container.scrollTop = 0;
    });
  },
);
</script>

<style scoped>
.rounded-2xl\! {
  border-radius: 1.25rem !important;
}

.logs-viewport {
  height: 250px;
  overflow-y: auto;
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
  font-size: 0.7rem;
  padding: 0.75rem !important;
  background: #f9fafb !important;
}

.log-entry {
  margin-bottom: 0.25rem;
  line-height: 1.4;
  display: flex;
  gap: 0.5rem;
}

.log-time {
  color: #9ca3af;
  flex-shrink: 0;
}
.log-type {
  font-weight: bold;
  flex-shrink: 0;
  min-width: 65px;
}

.log-query {
  color: #2563eb;
}
.log-mutation {
  color: #d97706;
}
.log-event {
  color: #9333ea;
}
.log-refetch {
  color: #059669;
}

.log-msg {
  word-break: break-all;
}
</style>

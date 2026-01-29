<template>
  <F7Page name="reactive-demo">
    <F7Navbar title="Reactive SQLite Demo" large transparent back-link="Back">
      <F7NavRight>
        <F7Link @click="logStore.clearLogs">
          <ILucideTrash class="w-5 h-5" />
          <span class="if-not-md ml-1">Clear Logs</span>
        </F7Link>
      </F7NavRight>
    </F7Navbar>

    <!-- Initialization Loading -->
    <F7Block
      v-if="isInitializing"
      strong
      inset
      class="text-center p-8 rounded-2xl!"
    >
      <F7Preloader />
      <p class="mt-4 text-gray-400 font-medium">Preparing Local Database...</p>
      <p class="text-xs text-gray-400 mt-1">
        Bootstrapping SQLite & migrations...
      </p>
    </F7Block>

    <!-- Content -->
    <template v-else>
      <!-- Header with Stats -->
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
            <div class="text-xs text-gray-400 uppercase tracking-wider">
              Done
            </div>
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

      <!-- Add Task Input -->
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

      <!-- Tasks List -->
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
          :key="task.task_id"
          swipeout
          @click="toggleTask(task.task_id)"
          :class="{ 'opacity-50': task.completed === 1 }"
        >
          <template #media>
            <F7Checkbox :checked="task.completed === 1" />
          </template>
          <template #title>
            <span :class="{ 'line-through': task.completed === 1 }">{{
              task.title
            }}</span>
          </template>
          <template #after>
            <F7Badge :color="priorityColor(task.priority)">{{
              task.priority
            }}</F7Badge>
          </template>

          <F7SwipeoutActions right>
            <F7SwipeoutButton color="red" @click="deleteTask(task.task_id)">
              <ILucideTrash2 class="w-5 h-5" />
            </F7SwipeoutButton>
          </F7SwipeoutActions>
        </F7ListItem>
      </F7List>

      <F7Block v-else strong inset class="text-center p-8 rounded-2xl!">
        <ILucideClipboardList class="w-12 h-12 mx-auto text-gray-300 mb-2" />
        <p class="text-gray-400">All caught up! No tasks left.</p>
      </F7Block>

      <!-- Reactivity Logs Section -->
      <div class="mt-8">
        <F7BlockTitle class="flex justify-between items-center">
          <span>📋 Reactivity Logs</span>
          <F7Button small tonal @click="refetch">
            <ILucideRefreshCw class="w-3 h-3 mr-1" />
            Refetch
          </F7Button>
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
    </template>
  </F7Page>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from "vue";
import { useTasks } from "../composables/useTasks";
import { useLogStore } from "../stores/log.store";
import {
  initReactiveDemo,
  isDatabaseInitialized,
} from "../composables/useReactiveDemo";

const isInitializing = ref(true);
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
  refetch,
} = useTasks();

// Initialize database on mount
onMounted(async () => {
  try {
    const isInitialized = await isDatabaseInitialized();
    if (!isInitialized) {
      logStore.addLog("event", "🚀 Initializing Tasks table...");
      await initReactiveDemo();
      logStore.addLog("event", "✅ Database initialized");
      // Trigger a refetch to load initial data
      await refetch();
    }
  } catch (error) {
    logStore.addLog("event", "❌ DB Initialization Error");
    console.error("DB Init Error:", error);
  } finally {
    isInitializing.value = false;
  }
});

const newTaskTitle = ref("");
const newTaskPriority = ref<"low" | "medium" | "high">("medium");

const handleAddTask = async () => {
  if (!newTaskTitle.value.trim()) return;

  await addTask({
    title: newTaskTitle.value.trim(),
    priority: newTaskPriority.value,
  });

  newTaskTitle.value = "";
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

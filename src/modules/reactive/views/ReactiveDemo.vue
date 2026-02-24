<template>
  <F7Page name="reactive-demo" hide-navbar-on-scroll hide-toolbar-on-scroll>
    <MetricsDevTools />

    <F7Navbar title="Reactive SQLite Demo" large transparent>
      <F7NavRight>
        <F7Link @click="seedTasks" :class="{ 'opacity-50': isSeeding }">
          <ILucideFlaskConical class="w-5 h-5" />
        </F7Link>
        <F7Link @click="toggleDevTools()">
          <ILucideBarChart2 class="w-5 h-5" />
        </F7Link>
      </F7NavRight>

      <F7Subnavbar bg-color="transparent" :inner="false">
        <F7Searchbar
          search-container=".tasks-vl"
          :disable-button="theme.ios || theme.md"
          :backdrop="false"
        />
      </F7Subnavbar>
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

    <!-- ── Task list ─────────────────────────────────────────────────── -->

    <div v-show="loading && !tasks" class="text-center p-8">
      <F7Preloader />
      <p class="mt-2 text-gray-400">Syncing database...</p>
    </div>

    <F7Block
      v-show="!loading && tasks && !tasks.length"
      strong
      inset
      class="text-center p-8 rounded-2xl!"
    >
      <ILucideClipboardList class="w-12 h-12 mx-auto text-gray-300 mb-3" />
      <p class="text-gray-400">No tasks yet.</p>
      <p class="text-xs text-gray-300 mt-1">
        Tap <strong>+</strong> to add one, or <strong>Seed</strong> to generate
        100.
      </p>
    </F7Block>

    <!-- Shown by F7 searchbar when searchAll returns 0 results -->
    <F7List strong inset class="searchbar-not-found" style="display: none">
      <F7ListItem title="Nothing found" />
    </F7List>

    <F7List
      virtual-list
      :virtual-list-params="taskVlParams"
      strong
      inset
      dividers
      class="searchbar-found tasks-vl rounded-2xl! shadow-sm"
    >
      <ul>
        <F7ListItem
          v-for="(task, i) in taskVlData.items"
          :key="i"
          swipeout
          link="#"
          :class="{ 'opacity-50': task.completed === 1 }"
          :subtitle="task.description || undefined"
          :style="`top: ${taskVlData.topPosition}px`"
          :virtual-list-index="task.index"
          @click="openTaskDetails(task)"
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
              <span :class="{ 'line-through': task.completed === 1 }">
                {{ task.title }}
              </span>
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
            <F7Badge :color="priorityColor(task.priority)">
              {{ task.priority }}
            </F7Badge>
          </template>
          <F7SwipeoutActions right>
            <F7SwipeoutButton color="red" @click="deleteTask(task.id)">
              <ILucideTrash2 class="w-5 h-5" />
            </F7SwipeoutButton>
          </F7SwipeoutActions>
        </F7ListItem>
      </ul>
    </F7List>

    <!-- ── FAB ──────────────────────────────────────────────────────── -->
    <F7Fab position="right-bottom" @click="isAddSheetOpen = true">
      <ILucidePlus class="w-6 h-6" />
    </F7Fab>

    <!-- ── Create task sheet ─────────────────────────────────────────── -->
    <F7Sheet
      v-model:opened="isAddSheetOpen"
      style="height: auto"
      push
      swipe-to-close
      backdrop
    >
      <!-- swipe handle -->
      <div class="mx-auto mt-3 w-9 h-1 rounded-full bg-gray-200" />

      <F7BlockTitle large class="mt-4">New Task</F7BlockTitle>

      <F7List strong inset dividers>
        <F7ListInput
          v-model:value="newTaskTitle"
          placeholder="What needs to be done?"
          clear-button
          @keyup.enter="handleAddTask"
        >
          <template #media>
            <ILucideClipboardEdit class="text-blue-500" />
          </template>
        </F7ListInput>

        <F7ListInput
          v-model:value="newTaskDescription"
          placeholder="Description (optional)"
          type="textarea"
          resizable
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
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </F7ListItem>
      </F7List>

      <F7Block class="pb-safe-area-bottom">
        <F7Button
          fill
          round
          large
          :disabled="!newTaskTitle.trim() || isAdding"
          :loading="isAdding"
          @click="handleAddTask"
        >
          Add Task
        </F7Button>
      </F7Block>
    </F7Sheet>

    <!-- ── Edit task sheet ───────────────────────────────────────────── -->
    <F7Sheet
      v-model:opened="isTaskSheetOpen"
      style="height: auto"
      push
      swipe-to-close
      backdrop
    >
      <div class="mx-auto mt-3 w-9 h-1 rounded-full bg-gray-200" />

      <F7BlockTitle large class="mt-4">Edit Task</F7BlockTitle>

      <F7List strong inset dividers>
        <F7ListInput
          label="Title"
          v-model:value="editingTask.title"
          placeholder="Task title"
          clear-button
        />
        <F7ListInput
          label="Description"
          v-model:value="editingTask.description"
          type="textarea"
          placeholder="Add details..."
          resizable
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

      <F7Block class="space-y-3! pb-safe-area-bottom">
        <F7Button large fill round @click="saveTaskDetails">
          Save Changes
        </F7Button>
        <F7Button
          large
          tonal
          round
          :color="editingTask.completed ? 'orange' : 'green'"
          @click="toggleCompletedFromSheet"
        >
          {{ editingTask.completed ? "Mark as Pending" : "Mark as Completed" }}
        </F7Button>
        <F7Button large round color="red" @click="deleteTaskFromSheet">
          Delete Task
        </F7Button>
      </F7Block>
    </F7Sheet>

    <!-- ── Reactivity logs ───────────────────────────────────────────── -->
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
import { ref, watch, nextTick, computed, reactive } from "vue";
import { f7, theme } from "framework7-vue";
import { useTasks } from "../composables/useTasks";
import { useLogStore } from "../stores/log.store";
import {
  executeWithEvent,
  getRawConnection,
  generateLocalRuid,
  nowISO,
} from "@/shared/database";
import { batchInsert } from "@/shared/database/sync";
import { dbService } from "@/shared/database/DatabaseService";
import { useQueryMetrics } from "@/shared/composables/useQueryMetrics";
import type { Task } from "../database/schema";

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

// ─── Create task sheet ────────────────────────────────────────────────────

const isAddSheetOpen = ref(false);
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
  isAddSheetOpen.value = false;
};

// ─── Edit task sheet ──────────────────────────────────────────────────────

const isTaskSheetOpen = ref(false);
const editingTask = ref<{
  id: number;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  completed: boolean;
}>({ id: 0, title: "", description: "", priority: "medium", completed: false });

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

// ─── Seed tasks ───────────────────────────────────────────────────────────

const isSeeding = ref(false);
const SEED_TITLES = [
  "Review quarterly report",
  "Update product catalog",
  "Call customer support",
  "Process pending invoices",
  "Sync inventory with warehouse",
  "Prepare shipping labels",
  "Follow up on open orders",
  "Update supplier contacts",
];
const SEED_PRIORITIES = ["low", "medium", "high"] as const;

async function seedTasks() {
  if (isSeeding.value) return;
  isSeeding.value = true;
  try {
    const now = nowISO();
    const rows = Array.from({ length: 100 }, (_, i) => ({
      title: `${SEED_TITLES[i % SEED_TITLES.length]} #${i + 1}`,
      description: i % 3 === 0 ? `Details for task ${i + 1}` : null,
      completed: 0 as const,
      priority: SEED_PRIORITIES[i % 3]!,
      created_at: now,
      _ruid: generateLocalRuid(),
      _create_date: now,
      _write_date: now,
      _sync_status: "to_create" as const,
    }));
    await batchInsert(dbService.getDb(), "tasks", rows);
    f7.toast
      .create({
        text: "100 tasks seeded ✓",
        closeTimeout: 2500,
        position: "bottom",
      })
      .open();
  } finally {
    isSeeding.value = false;
  }
}

// ─── Virtual list ─────────────────────────────────────────────────────────

type TaskWithIndex = Task & { index: number };

const taskVlData = reactive<{
  items: TaskWithIndex[];
  topPosition: number;
}>({ items: [], topPosition: 0 });

function searchAll(query: string, taskItems: Task[]) {
  const q = query.toLowerCase();
  return taskItems.reduce<number[]>((acc, task, i) => {
    if (
      task.title.toLowerCase().includes(q) ||
      task.description?.toLowerCase().includes(q)
    ) {
      acc.push(i);
    }
    return acc;
  }, []);
}

const taskVlParams = computed(() => ({
  items: tasks.value ?? [],
  height: (index: number) => {
    const task = (tasks.value ?? [])[index];
    return task?.description
      ? theme.ios
        ? 63
        : theme.md
          ? 73
          : 77
      : theme.ios
        ? 44
        : theme.md
          ? 48
          : 48;
  },
  searchAll,
  renderExternal: (_vl: unknown, data: typeof taskVlData) =>
    Object.assign(taskVlData, data),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────

function priorityColor(priority: string) {
  if (priority === "high") return "red";
  if (priority === "medium") return "orange";
  if (priority === "low") return "green";
  return "gray";
}

watch(
  tasks,
  async (newTasks) => {
    await nextTick();
    const listEl = document.querySelector<HTMLElement>(".tasks-vl");
    if (listEl) f7.virtualList.get(listEl)?.replaceAllItems(newTasks ?? []);
  },
  { flush: "post" },
);

watch(
  () => logStore.logs.length,
  () => {
    nextTick(() => {
      const el = document.getElementById("logs-container");
      if (el) el.scrollTop = 0;
    });
  },
);

// Raw connection reactivity test (dev helper)
const startReactivityTest = () => {
  setTimeout(async () => {
    const conn = await getRawConnection();
    for (let i = 1; i <= 5; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const now = nowISO();
      const ruid = generateLocalRuid();
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

:deep(.fab.fab-right-bottom) {
  bottom: calc(
    var(--f7-tabbar-icons-height, 56px) + env(safe-area-inset-bottom) + 16px
  );
}
</style>

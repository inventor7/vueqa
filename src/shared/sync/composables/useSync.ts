/**
 * useSync Composable
 *
 * Vue composable for sync operations with reactive state.
 */

import { syncOrchestrator } from "../SyncOrchestrator";
import type { SyncState, SyncTableConfig } from "../types";

/**
 * Reactive sync composable.
 *
 * @example
 * ```vue
 * <script setup>
 * const { startSync, progress, loading, errors } = useSync();
 *
 * async function handleRefresh() {
 *   await startSync();
 * }
 * </script>
 *
 * <template>
 *   <div v-if="loading">
 *     Syncing {{ progress.currentTable }}... ({{ progress.tablesCompleted }}/{{ progress.tablesTotal }})
 *   </div>
 * </template>
 * ```
 */
export function useSync() {
  const state = ref<SyncState>(syncOrchestrator.getState());

  // Subscribe to orchestrator changes
  onMounted(() => {
    const unsubscribe = syncOrchestrator.subscribe((newState) => {
      state.value = newState;
    });

    onUnmounted(unsubscribe);
  });

  const loading = computed(() => state.value.isRunning);
  const progress = computed(() => state.value.progress);
  const errors = computed(() => state.value.errors);
  const lastSyncAt = computed(() => state.value.lastSyncAt);

  const progressPercent = computed(() => {
    const { tablesCompleted, tablesTotal } = state.value.progress;
    if (tablesTotal === 0) return 0;
    return Math.round((tablesCompleted / tablesTotal) * 100);
  });

  /**
   * Start sync for all tables (or specific tables).
   */
  async function startSync(tables?: SyncTableConfig[]) {
    await syncOrchestrator.startSync(tables);
  }

  /**
   * Abort running sync.
   */
  function abort() {
    syncOrchestrator.abort();
  }

  /**
   * Force full sync (clear delay timers).
   */
  async function forceFullSync() {
    syncOrchestrator.clearSyncTimes();
    await syncOrchestrator.startSync();
  }

  /**
   * Get retry queue stats.
   */
  async function getQueueStats() {
    return syncOrchestrator.getQueueStats();
  }

  return {
    // State
    loading,
    progress,
    progressPercent,
    errors,
    lastSyncAt,

    // Actions
    startSync,
    abort,
    forceFullSync,
    getQueueStats,
  };
}

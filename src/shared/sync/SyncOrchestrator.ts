/**
 * Sync Orchestrator
 *
 * Coordinates the 3-step sync flow across all tables.
 */

import type {
  SyncState,
  SyncProgress,
  SyncError,
  SyncTableConfig,
} from "./types";
import { getTablesByPriority, getTableConfig } from "./utils/syncHelpers";
import { executeStatusStep } from "./steps/statusStep";
import { executeFetchStep } from "./steps/fetchStep";
import { executePersistStep } from "./steps/persistStep";
import {
  uploadPendingMedia,
  downloadMissingMedia,
} from "./media/MediaSyncStep";
import { syncQueue } from "./SyncQueue";

/** Last sync times per table */
const lastSyncTimes = new Map<string, Date>();

/** Current orchestrator state */
let state: SyncState = {
  isRunning: false,
  isAborted: false,
  progress: {
    currentTable: "",
    currentStep: 1,
    tablesCompleted: 0,
    tablesTotal: 0,
    recordsProcessed: 0,
    recordsTotal: 0,
  },
  errors: [],
  lastSyncAt: null,
};

/** Listeners for state changes */
type StateListener = (state: SyncState) => void;
const listeners: StateListener[] = [];

function notifyListeners() {
  for (const listener of listeners) {
    listener({ ...state });
  }
}

function updateProgress(partial: Partial<SyncProgress>) {
  state.progress = { ...state.progress, ...partial };
  notifyListeners();
}

function addError(error: SyncError) {
  state.errors.push(error);
  notifyListeners();
}

/**
 * Check if table should be synced based on delay config.
 */
function shouldSyncTable(config: SyncTableConfig): boolean {
  if (config.delayMinutes === 0) return true;

  const lastSync = lastSyncTimes.get(config.table);
  if (!lastSync) return true;

  const minutesSince = Math.floor((Date.now() - lastSync.getTime()) / 60000);
  return minutesSince >= config.delayMinutes;
}

/**
 * Execute sync for a single table.
 */
async function syncTable(config: SyncTableConfig): Promise<void> {
  const { table, direction } = config;

  updateProgress({ currentTable: table, currentStep: 1 });

  try {
    try {
      if (direction === "push" || direction === "bi") {
        await uploadPendingMedia(table);
      }
    } catch (e) {
      console.error(`[Sync] Media upload failed for ${table}`, e);
    }

    // Step 1: Status (for pull and bi-directional)
    let toCreate: string[] = [];
    let toUpdate: string[] = [];

    if (direction === "pull" || direction === "bi") {
      const statusResult = await executeStatusStep(table);
      toCreate = statusResult.toCreate;
      toUpdate = statusResult.toUpdate;
    }

    if (state.isAborted) return;

    // Step 2: Fetch (if there's anything to fetch)
    updateProgress({ currentStep: 2 });

    if (toCreate.length > 0 || toUpdate.length > 0) {
      await executeFetchStep(table, toCreate, toUpdate);
      try {
        await downloadMissingMedia(table);
      } catch (e) {
        console.error(`[Sync] Media download failed for ${table}`, e);
      }
    }

    if (state.isAborted) return;

    // Step 3: Persist (for push and bi-directional)
    updateProgress({ currentStep: 3 });

    if (direction === "push" || direction === "bi") {
      const persistResult = await executePersistStep(table);

      // Record errors
      for (const error of persistResult.errors) {
        addError(error);
      }
    }

    // Record successful sync time
    lastSyncTimes.set(table, new Date());
  } catch (error) {
    const syncError: SyncError = {
      table,
      ruid: null,
      error: error instanceof Error ? error.message : String(error),
      critical: true,
      occurredAt: new Date().toISOString(),
    };
    addError(syncError);
  }
}

export const syncOrchestrator = {
  /**
   * Get current sync state.
   */
  getState(): SyncState {
    return { ...state };
  },

  /**
   * Subscribe to state changes.
   */
  subscribe(listener: StateListener): () => void {
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) listeners.splice(index, 1);
    };
  },

  /**
   * Start full sync for all configured tables.
   */
  async startSync(tables?: SyncTableConfig[]): Promise<void> {
    if (state.isRunning) {
      console.warn("[Sync] Already running");
      return;
    }

    const tablesToSync = tables ?? getTablesByPriority();

    state = {
      isRunning: true,
      isAborted: false,
      progress: {
        currentTable: "",
        currentStep: 1,
        tablesCompleted: 0,
        tablesTotal: tablesToSync.length,
        recordsProcessed: 0,
        recordsTotal: 0,
      },
      errors: [],
      lastSyncAt: null,
    };
    notifyListeners();

    try {
      for (const config of tablesToSync) {
        if (state.isAborted) break;

        // Check delay
        if (!shouldSyncTable(config)) {
          state.progress.tablesCompleted++;
          notifyListeners();
          continue;
        }

        await syncTable(config);
        state.progress.tablesCompleted++;
        notifyListeners();
      }

      // Process retry queue
      await this.processRetryQueue();

      state.lastSyncAt = new Date().toISOString();
    } finally {
      state.isRunning = false;
      notifyListeners();
    }
  },

  /**
   * Abort running sync.
   */
  abort(): void {
    state.isAborted = true;
    notifyListeners();
  },

  /**
   * Process entries in retry queue.
   */
  async processRetryQueue(): Promise<void> {
    const entries = await syncQueue.getRetryable();

    for (const entry of entries) {
      if (state.isAborted) break;

      try {
        const payload = JSON.parse(entry.payload);
        const persistResult = await executePersistStep(entry.table);

        if (persistResult.success > 0) {
          await syncQueue.dequeue(entry.id!);
        } else if (persistResult.failed > 0) {
          await syncQueue.markFailed(
            entry.id!,
            persistResult.errors[0]?.error ?? "Unknown error",
          );
        }
      } catch (error) {
        await syncQueue.markFailed(
          entry.id!,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  },

  /**
   * Clear last sync times (forces full sync).
   */
  clearSyncTimes(): void {
    lastSyncTimes.clear();
  },

  /**
   * Get queue stats.
   */
  getQueueStats() {
    return syncQueue.getStats();
  },
};

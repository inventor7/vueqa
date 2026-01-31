/**
 * Sync Module
 *
 * Enhanced 3-step sync engine for SQLite ↔ REST API synchronization.
 */

// Types
export type {
  SyncDirection,
  SyncStatus,
  ConflictStrategy,
  SyncTableConfig,
  SyncableRecord,
  RecordPing,
  StatusStepResponse,
  FetchStepResponse,
  PersistStepResponse,
  SyncQueueEntry,
  SyncProgress,
  SyncError,
  SyncState,
} from "./types";

// Config
export {
  getTableConfig,
  getTablesByPriority,
  getPushTables,
  getPullTables,
} from "./utils/syncHelpers";

// Transport
export { initSyncTransport, getSyncTransport } from "./SyncTransport";

// Queue
export { syncQueue } from "./SyncQueue";

// Orchestrator
export { syncOrchestrator } from "./SyncOrchestrator";

// Composable
export { useSync } from "./composables/useSync";

/**
 * Sync Engine Types
 *
 * Core type definitions for the 3-step sync protocol.
 */

/** Sync direction for a table */
export type SyncDirection = "push" | "pull" | "bi";

/** Local record sync status */
export type SyncStatus = "synced" | "to_create" | "to_update" | "to_delete";

/** Conflict resolution strategy */
export type ConflictStrategy =
  | "server_wins"
  | "client_wins"
  | "last_write_wins";

/** Configuration for a synced table */
export interface SyncTableConfig {
  /** Table name (e.g., 'res.partner') */
  table: string;

  /** Sync direction */
  direction: SyncDirection;

  /** Priority: 0 = highest, syncs first */
  priority: number;

  /** Minimum minutes between syncs (0 = always) */
  delayMinutes: number;

  /** Conflict resolution strategy */
  conflictStrategy: ConflictStrategy;

  /** Custom API endpoints (optional) */
  endpoints?: {
    status?: string;
    fetch?: string;
    persist?: string;
  };

  /** Media columns to sync (e.g., ['image_path', 'signature_path']) */
  mediaColumns?: string[];

  /** Whitelist of fields to sync (if omitted, syncs all columns) */
  fields?: string[];

  /** Custom field transformations */
  transforms?: Record<
    string,
    { read: (val: any) => any; write: (val: any) => any }
  >;
}

/** Base fields required on all synced records */
export interface SyncableRecord {
  id: number;
  _ruid: string;
  _create_date: string;
  _write_date: string;
  _delete_date: string | null;
  _sync_status: SyncStatus;
}

/** Ping payload for status step */
export interface RecordPing {
  _ruid: string;
  _write_date: string;
  _sync_status: SyncStatus;
}

/** Status step response from server */
export interface StatusStepResponse {
  create: string[];
  edit: string[];
  delete: string[];
}

/** Fetch step response from server */
export interface FetchStepResponse<T = Record<string, unknown>> {
  result: T[];
  error?: { data: { message: string } };
}

/** Persist step response from server */
export interface PersistStepResponse {
  done: Array<{ _ruid: string; id?: number }>;
  failed: Array<{ _ruid: string; error: string }>;
}

/** Sync queue entry for retry */
export interface SyncQueueEntry {
  id?: number;
  table: string;
  ruid: string;
  operation: "create" | "update" | "delete";
  payload: string; // JSON stringified
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  next_retry_at: string;
  created_at: string;
}

/** Sync progress state */
export interface SyncProgress {
  currentTable: string;
  currentStep: 1 | 2 | 3;
  tablesCompleted: number;
  tablesTotal: number;
  recordsProcessed: number;
  recordsTotal: number;
}

/** Sync error entry */
export interface SyncError {
  table: string;
  ruid: string | null;
  error: string;
  critical: boolean;
  occurredAt: string;
}

/** Sync session state */
export interface SyncState {
  isRunning: boolean;
  isAborted: boolean;
  progress: SyncProgress;
  errors: SyncError[];
  lastSyncAt: string | null;
}

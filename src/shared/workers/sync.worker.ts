/**
 * Sync Web Worker
 *
 * Runs data-heavy sync processing off the main thread so the UI stays
 * responsive during bulk operations. Handles:
 * - Conflict resolution (server vs. local records)
 * - Data transformation / normalisation
 * - Batch preparation (chunking, deduplication)
 *
 * What it does NOT do: SQLite writes. On native, CapacitorSQLite already
 * runs on a background thread. On web, the main thread performs the writes
 * after the worker returns the processed data.
 *
 * ## Message protocol
 *
 * Send:  `{ type, payload, requestId }`
 * Receive: `{ type: 'result' | 'error', requestId, data | error }`
 *
 * @example Main thread usage
 * ```ts
 * // Prefer the useSyncWorker composable over direct instantiation
 * import { useSyncWorker } from '@/shared/composables/useSyncWorker';
 * const worker = useSyncWorker();
 * const { toUpsert } = await worker.resolveConflicts({ ... });
 * ```
 */

import { resolveBatchConflicts } from "@/shared/database/conflicts";
import type { ConflictStrategy } from "@/shared/database/conflicts";

// ─── Message Types ────────────────────────────────────────────────────────────

export type WorkerRequestType =
  | "resolve-conflicts"
  | "chunk-records"
  | "deduplicate";

export interface WorkerRequest<T = unknown> {
  type: WorkerRequestType;
  requestId: string;
  payload: T;
}

export type WorkerResponseType = "result" | "error";

export interface WorkerResponse<T = unknown> {
  type: WorkerResponseType;
  requestId: string;
  data?: T;
  error?: string;
}

// ─── Payload / Result shapes ──────────────────────────────────────────────────

export interface ResolveConflictsPayload {
  localRecords: Record<string, unknown>[];
  remoteRecords: Record<string, unknown>[];
  idField: string;
  strategy: ConflictStrategy;
  timestampField?: string;
}

export interface ResolveConflictsResult {
  toUpsert: Record<string, unknown>[];
  toKeep: Record<string, unknown>[];
  conflictCount: number;
}

export interface ChunkRecordsPayload {
  records: unknown[];
  chunkSize: number;
}

export interface DeduplicatePayload {
  records: Record<string, unknown>[];
  idField: string;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

function respond<T>(requestId: string, data: T): void {
  const response: WorkerResponse<T> = { type: "result", requestId, data };
  self.postMessage(response);
}

function respondError(requestId: string, err: unknown): void {
  const response: WorkerResponse = {
    type: "error",
    requestId,
    error: err instanceof Error ? err.message : String(err),
  };
  self.postMessage(response);
}

self.addEventListener(
  "message",
  (event: MessageEvent<WorkerRequest>) => {
    const { type, requestId, payload } = event.data;

    try {
      switch (type) {
        case "resolve-conflicts": {
          const p = payload as ResolveConflictsPayload;
          const { toUpsert, toKeep, conflicts } = resolveBatchConflicts({
            localRecords: p.localRecords,
            remoteRecords: p.remoteRecords,
            idField: p.idField as any,
            strategy: p.strategy,
            timestampField: p.timestampField as any,
          });
          respond<ResolveConflictsResult>(requestId, {
            toUpsert,
            toKeep,
            conflictCount: conflicts.length,
          });
          break;
        }

        case "chunk-records": {
          const { records, chunkSize } = payload as ChunkRecordsPayload;
          const chunks: unknown[][] = [];
          for (let i = 0; i < records.length; i += chunkSize) {
            chunks.push(records.slice(i, i + chunkSize));
          }
          respond(requestId, chunks);
          break;
        }

        case "deduplicate": {
          const { records, idField } = payload as DeduplicatePayload;
          const seen = new Set<unknown>();
          const unique = records.filter((r) => {
            const id = r[idField];
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
          });
          respond(requestId, unique);
          break;
        }

        default:
          respondError(requestId, `Unknown message type: ${type}`);
      }
    } catch (err) {
      respondError(requestId, err);
    }
  },
);

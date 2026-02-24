/**
 * Composable wrapping the sync Web Worker.
 *
 * On native platforms the worker is bypassed entirely — CapacitorSQLite
 * already runs on a background thread, so there is nothing to offload.
 * On web, conflict resolution and data transformation run in a Worker so
 * the main thread stays responsive during bulk sync.
 *
 * @example
 * ```ts
 * const { resolveConflicts, deduplicate, isReady, terminate } = useSyncWorker();
 *
 * // In your sync service:
 * const { toUpsert } = await resolveConflicts({
 *   localRecords,
 *   remoteRecords,
 *   idField: '_ruid',
 *   strategy: ORDER_CONFLICT_STRATEGY,
 * });
 * await batchUpsert(db, 'orders', toUpsert, '_ruid');
 * ```
 */

import { Capacitor } from "@capacitor/core";
import type {
  WorkerRequest,
  WorkerResponse,
  ResolveConflictsPayload,
  ResolveConflictsResult,
  ChunkRecordsPayload,
  DeduplicatePayload,
} from "@/shared/workers/sync.worker";
import { resolveBatchConflicts } from "@/shared/database/conflicts";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
};

let workerInstance: Worker | null = null;
const pending = new Map<string, PendingRequest>();

function getWorker(): Worker | null {
  if (Capacitor.isNativePlatform()) return null; // not needed on native
  if (!workerInstance) {
    workerInstance = new Worker(
      new URL("@/shared/workers/sync.worker.ts", import.meta.url),
      { type: "module" },
    );

    workerInstance.addEventListener(
      "message",
      (event: MessageEvent<WorkerResponse>) => {
        const { requestId, type, data, error } = event.data;
        const deferred = pending.get(requestId);
        if (!deferred) return;

        pending.delete(requestId);

        if (type === "error") {
          deferred.reject(new Error(error ?? "Worker error"));
        } else {
          deferred.resolve(data);
        }
      },
    );

    workerInstance.addEventListener("error", (event) => {
      // Reject all pending on fatal worker error
      for (const deferred of pending.values()) {
        deferred.reject(new Error(event.message));
      }
      pending.clear();
      workerInstance = null;
    });
  }
  return workerInstance;
}

function sendToWorker<TPayload, TResult>(
  type: WorkerRequest["type"],
  payload: TPayload,
): Promise<TResult> {
  const requestId = crypto.randomUUID();

  return new Promise<TResult>((resolve, reject) => {
    pending.set(requestId, {
      resolve: resolve as (v: unknown) => void,
      reject,
    });

    const worker = getWorker();
    if (!worker) {
      reject(new Error("Worker not available on native platform"));
      return;
    }

    const message: WorkerRequest<TPayload> = { type, requestId, payload };
    worker.postMessage(message);
  });
}

export interface SyncWorkerComposable {
  /** True when the worker is available (web only; always false on native). */
  isWorkerAvailable: boolean;
  /**
   * Resolve conflicts between local and remote record sets.
   * Falls back to synchronous execution on native.
   */
  resolveConflicts: (
    payload: ResolveConflictsPayload,
  ) => Promise<ResolveConflictsResult>;
  /**
   * Split a flat array into chunks of `chunkSize` for batched writes.
   * Falls back to synchronous chunking on native.
   */
  chunkRecords: <T>(records: T[], chunkSize: number) => Promise<T[][]>;
  /**
   * Remove duplicate records by a given ID field.
   * Falls back to synchronous deduplication on native.
   */
  deduplicate: <T extends Record<string, unknown>>(
    records: T[],
    idField: string,
  ) => Promise<T[]>;
  /** Terminate the worker. Call when the owning service is destroyed. */
  terminate: () => void;
}

export function useSyncWorker(): SyncWorkerComposable {
  const isWorkerAvailable = !Capacitor.isNativePlatform();

  const resolveConflicts = async (
    payload: ResolveConflictsPayload,
  ): Promise<ResolveConflictsResult> => {
    if (!isWorkerAvailable) {
      // Synchronous fallback — already on a native background thread
      const { toUpsert, toKeep, conflicts } = resolveBatchConflicts({
        localRecords: payload.localRecords,
        remoteRecords: payload.remoteRecords,
        idField: payload.idField as any,
        strategy: payload.strategy,
        timestampField: payload.timestampField as any,
      });
      return { toUpsert, toKeep, conflictCount: conflicts.length };
    }

    return sendToWorker<ResolveConflictsPayload, ResolveConflictsResult>(
      "resolve-conflicts",
      payload,
    );
  };

  const chunkRecords = async <T>(
    records: T[],
    chunkSize: number,
  ): Promise<T[][]> => {
    if (!isWorkerAvailable) {
      const chunks: T[][] = [];
      for (let i = 0; i < records.length; i += chunkSize) {
        chunks.push(records.slice(i, i + chunkSize));
      }
      return chunks;
    }

    return sendToWorker<ChunkRecordsPayload, T[][]>("chunk-records", {
      records,
      chunkSize,
    });
  };

  const deduplicate = async <T extends Record<string, unknown>>(
    records: T[],
    idField: string,
  ): Promise<T[]> => {
    if (!isWorkerAvailable) {
      const seen = new Set<unknown>();
      return records.filter((r) => {
        const id = r[idField];
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
    }

    return sendToWorker<DeduplicatePayload, T[]>("deduplicate", {
      records,
      idField,
    });
  };

  const terminate = (): void => {
    if (workerInstance) {
      workerInstance.terminate();
      workerInstance = null;
      pending.clear();
    }
  };

  onUnmounted(terminate);

  return {
    isWorkerAvailable,
    resolveConflicts,
    chunkRecords,
    deduplicate,
    terminate,
  };
}

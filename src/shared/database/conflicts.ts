/**
 * Conflict Resolution Utilities
 *
 * Defines strategies for handling sync conflicts between the local SQLite
 * database and the remote server. Choose a strategy per table in your
 * module's schema file.
 *
 * ## Decision Guide
 *
 * | Table type                        | Strategy         | Rationale                                  |
 * |-----------------------------------|------------------|--------------------------------------------|
 * | Master data (products, customers) | `server-wins`    | Server is the source of truth              |
 * | Draft orders / local edits        | `client-wins`    | User changes must not be overwritten       |
 * | Collaborative records             | `latest-write-wins` | Whoever wrote last wins (use `_write_date`) |
 * | Audit logs / history              | `server-wins`    | Log integrity must be maintained           |
 *
 * ## Usage
 *
 * ```ts
 * import { resolveConflict } from '@/shared/database/conflicts';
 *
 * // In your sync service:
 * const resolved = resolveConflict({
 *   local: localRecord,
 *   remote: serverRecord,
 *   strategy: 'latest-write-wins',
 *   timestampField: '_write_date',
 * });
 *
 * if (resolved.winner === 'remote') {
 *   await db.updateTable('orders').set(resolved.record).where('id', '=', id).execute();
 * }
 * ```
 */

/**
 * Available conflict resolution strategies.
 */
export type ConflictStrategy =
  | "server-wins"      // Always use the remote record
  | "client-wins"      // Always use the local record
  | "latest-write-wins"; // Compare timestamps, keep the more recent one

/**
 * The winner of a conflict resolution.
 */
export type ConflictWinner = "local" | "remote" | "no-conflict";

/**
 * Input to the conflict resolver.
 */
export interface ConflictInput<T extends Record<string, unknown>> {
  /** The record currently in the local SQLite database */
  local: T;
  /** The record received from the remote server */
  remote: T;
  /** Strategy to apply */
  strategy: ConflictStrategy;
  /**
   * Field to compare timestamps when using `latest-write-wins`.
   * Defaults to `_write_date`.
   */
  timestampField?: keyof T;
}

/**
 * Result of conflict resolution.
 */
export interface ConflictResult<T> {
  /** Which side won (`no-conflict` if records are identical) */
  winner: ConflictWinner;
  /** The winning record to persist */
  record: T;
  /** Explanation of why this winner was chosen */
  reason: string;
}

/**
 * Resolve a single-record conflict between local and remote versions.
 *
 * @example Server-wins (master data like products, customers)
 * ```ts
 * const { record } = resolveConflict({
 *   local: localProduct,
 *   remote: serverProduct,
 *   strategy: 'server-wins',
 * });
 * await db.updateTable('products').set(record).where('id', '=', record.id).execute();
 * ```
 *
 * @example Client-wins (draft orders)
 * ```ts
 * const { winner } = resolveConflict({
 *   local: localDraft,
 *   remote: serverDraft,
 *   strategy: 'client-wins',
 * });
 * if (winner === 'local') {
 *   // Queue local record for re-upload to server
 * }
 * ```
 *
 * @example Latest-write-wins (collaborative records)
 * ```ts
 * const { winner, record, reason } = resolveConflict({
 *   local: localRecord,
 *   remote: serverRecord,
 *   strategy: 'latest-write-wins',
 *   timestampField: '_write_date',
 * });
 * console.log(`Conflict resolved: ${winner} wins — ${reason}`);
 * ```
 */
export function resolveConflict<T extends Record<string, unknown>>(
  input: ConflictInput<T>,
): ConflictResult<T> {
  const { local, remote, strategy, timestampField = "_write_date" } = input;

  switch (strategy) {
    case "server-wins":
      return {
        winner: "remote",
        record: remote,
        reason: "server-wins strategy: remote record always takes precedence",
      };

    case "client-wins":
      return {
        winner: "local",
        record: local,
        reason: "client-wins strategy: local record always takes precedence",
      };

    case "latest-write-wins": {
      const localTs = String(local[timestampField] ?? "");
      const remoteTs = String(remote[timestampField] ?? "");

      if (!localTs && !remoteTs) {
        return {
          winner: "remote",
          record: remote,
          reason: "latest-write-wins: no timestamps available, defaulting to remote",
        };
      }

      if (!localTs) {
        return {
          winner: "remote",
          record: remote,
          reason: `latest-write-wins: local has no ${String(timestampField)}, using remote`,
        };
      }

      if (!remoteTs) {
        return {
          winner: "local",
          record: local,
          reason: `latest-write-wins: remote has no ${String(timestampField)}, using local`,
        };
      }

      if (localTs === remoteTs) {
        return {
          winner: "no-conflict",
          record: remote, // Prefer remote when equal (idempotent syncs)
          reason: "latest-write-wins: timestamps are equal, no conflict",
        };
      }

      const localWins = localTs > remoteTs;
      return {
        winner: localWins ? "local" : "remote",
        record: localWins ? local : remote,
        reason: `latest-write-wins: ${localWins ? "local" : "remote"} is newer (${localWins ? localTs : remoteTs})`,
      };
    }
  }
}

/**
 * Resolve a batch of conflicts with the same strategy.
 * Returns only records that need to be persisted (winner is `remote` or `no-conflict`).
 *
 * @example Sync a page of server records
 * ```ts
 * const toUpdate = resolveBatchConflicts({
 *   localRecords: localOrders,
 *   remoteRecords: serverOrders,
 *   idField: 'order_id',
 *   strategy: 'latest-write-wins',
 * });
 * // toUpdate contains only records where the server won
 * ```
 */
export function resolveBatchConflicts<T extends Record<string, unknown>>(options: {
  localRecords: T[];
  remoteRecords: T[];
  /** Field used to match local and remote records (e.g., `_ruid` or primary key) */
  idField: keyof T;
  strategy: ConflictStrategy;
  timestampField?: keyof T;
}): { toUpsert: T[]; toKeep: T[]; conflicts: Array<ConflictResult<T>> } {
  const { localRecords, remoteRecords, idField, strategy, timestampField } = options;

  const localMap = new Map(localRecords.map((r) => [r[idField], r]));

  const toUpsert: T[] = [];  // Remote wins → apply to local DB
  const toKeep: T[] = [];    // Local wins → re-queue for upload
  const conflicts: Array<ConflictResult<T>> = [];

  for (const remote of remoteRecords) {
    const id = remote[idField];
    const local = localMap.get(id);

    if (!local) {
      // New record from server — no conflict
      toUpsert.push(remote);
      continue;
    }

    const result = resolveConflict({ local, remote, strategy, timestampField });
    conflicts.push(result);

    if (result.winner === "local") {
      toKeep.push(local);
    } else {
      toUpsert.push(result.record as T);
    }
  }

  return { toUpsert, toKeep, conflicts };
}

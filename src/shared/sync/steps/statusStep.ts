/**
 * Status Step (Step 1)
 *
 * Compare local records with server to determine:
 * - What to create locally (new on server)
 * - What to update locally (changed on server)
 * - What to delete locally (deleted on server)
 */

import type { SyncableRecord, RecordPing, StatusStepResponse } from "../types";
import { getSyncTransport } from "../SyncTransport";
import { dbService } from "@/shared/database";

/**
 * Prepare record pings for status comparison.
 * Only includes synced/to_update records (not to_create which don't exist on server yet).
 */
async function prepareRecordPings(table: string): Promise<RecordPing[]> {
  const db = dbService.getDb();

  const records = await db
    .selectFrom(table as any)
    .select(["_ruid", "_write_date", "_sync_status"])
    .where("_sync_status", "in", ["synced", "to_update"])
    .execute();

  return (records as SyncableRecord[]).map((r) => ({
    _ruid: r._ruid,
    _write_date: r._write_date,
    _sync_status: r._sync_status,
  }));
}

/**
 * Delete local records that were deleted on server.
 */
async function deleteLocalRecords(
  table: string,
  ruids: string[],
): Promise<number> {
  if (ruids.length === 0) return 0;

  const db = dbService.getDb();

  const result = await db
    .deleteFrom(table as any)
    .where("_ruid", "in", ruids)
    .execute();

  return result.length;
}

export interface StatusStepResult {
  /** RUIDs to create locally (new on server) */
  toCreate: string[];

  /** RUIDs to update locally (changed on server) */
  toUpdate: string[];

  /** Number of records deleted locally */
  deletedCount: number;
}

/**
 * Execute the status step for a table.
 *
 * @param table - Table name
 * @returns What needs to be fetched and how many were deleted
 */
export async function executeStatusStep(
  table: string,
): Promise<StatusStepResult> {
  const transport = getSyncTransport();

  // Get local records to compare
  const pings = await prepareRecordPings(table);

  // Ask server what changed
  const response = await transport.status(table, pings);

  // Delete records that no longer exist on server
  const deletedCount = await deleteLocalRecords(table, response.delete);

  return {
    toCreate: response.create,
    toUpdate: response.edit,
    deletedCount,
  };
}

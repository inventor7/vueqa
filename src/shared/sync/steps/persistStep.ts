/**
 * Persist Step (Step 3)
 *
 * Upload local changes to server and acknowledge results.
 */

import type { SyncableRecord, SyncError } from "../types";
import { getSyncTransport } from "../SyncTransport";
import { syncQueue } from "../SyncQueue";
import { getTableConfig } from "../utils/syncHelpers";
import { prepareRecordForSync } from "../utils/transform";
import { dbService } from "@/shared/database";

/**
 * Get local records that need to be pushed to server.
 */
async function getRecordsToPush<T extends SyncableRecord>(
  table: string,
): Promise<T[]> {
  const db = dbService.getDb();

  const records = await db
    .selectFrom(table as any)
    .selectAll()
    .where((eb: any) =>
      eb.or([
        eb("_sync_status", "=", "to_create"),
        eb("_sync_status", "=", "to_update"),
        eb("_delete_date", "is not", null),
      ]),
    )
    .execute();

  return records as T[];
}

/**
 * Acknowledge successful syncs by updating status to 'synced'.
 */
async function acknowledgeSuccess(
  table: string,
  ruids: string[],
): Promise<void> {
  if (ruids.length === 0) return;

  const db = dbService.getDb();

  await db
    .updateTable(table as any)
    .set({ _sync_status: "synced" })
    .where("_ruid", "in", ruids)
    .execute();

  // Remove from retry queue
  for (const ruid of ruids) {
    await syncQueue.removeByRuid(table, ruid);
  }
}

/**
 * Handle failed syncs by recording errors.
 */
async function handleFailures(
  table: string,
  failures: Array<{ _ruid: string; error: string }>,
): Promise<SyncError[]> {
  const errors: SyncError[] = [];

  for (const failure of failures) {
    errors.push({
      table,
      ruid: failure._ruid,
      error: failure.error,
      critical: false,
      occurredAt: new Date().toISOString(),
    });
  }

  return errors;
}

export interface PersistStepResult {
  /** Number of records successfully synced */
  success: number;

  /** Number of records that failed */
  failed: number;

  /** Error details for failed records */
  errors: SyncError[];
}

/**
 * Execute the persist step for a table.
 *
 * @param table - Table name
 * @returns Stats about synced and failed records
 */
export async function executePersistStep<
  T extends SyncableRecord = SyncableRecord,
>(table: string): Promise<PersistStepResult> {
  const records = await getRecordsToPush<T>(table);

  if (records.length === 0) {
    return { success: 0, failed: 0, errors: [] };
  }

  const transport = getSyncTransport();
  const config = getTableConfig(table);

  if (!config) {
    throw new Error(`No config found for table ${table}`);
  }

  const transformedRecords = await Promise.all(
    records.map((r) => prepareRecordForSync(r, config)),
  );

  // Upload to server
  const response = await transport.persist(table, transformedRecords);

  // Acknowledge successful syncs
  const successRuids = response.done.map((d) => d._ruid);
  await acknowledgeSuccess(table, successRuids);

  // Handle failures
  const errors = await handleFailures(table, response.failed);

  return {
    success: response.done.length,
    failed: response.failed.length,
    errors,
  };
}

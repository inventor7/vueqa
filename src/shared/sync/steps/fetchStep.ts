/**
 * Fetch Step (Step 2)
 *
 * Download records from server and apply to local database.
 */

import type { SyncableRecord } from "../types";
import { getSyncTransport } from "../SyncTransport";
import { getTableConfig } from "../utils/syncHelpers";
import { parseRecordFromSync } from "../utils/transform";
import { dbService } from "@/shared/database";
import { emitTableChange } from "@/shared/database";

/**
 * Apply fetched records to local database.
 * Inserts new records and updates existing ones.
 */
async function applyRecords<T extends SyncableRecord>(
  table: string,
  records: T[],
  createRuids: string[],
  updateRuids: string[],
): Promise<{ created: number; updated: number }> {
  if (records.length === 0) {
    return { created: 0, updated: 0 };
  }

  const db = dbService.getDb();
  let created = 0;
  let updated = 0;

  for (const record of records) {
    // Set sync status to synced
    const recordWithStatus = {
      ...record,
      _sync_status: "synced" as const,
    };

    if (createRuids.includes(record._ruid)) {
      // Insert new record
      await db
        .insertInto(table as any)
        .values(recordWithStatus)
        .execute();
      created++;
    } else if (updateRuids.includes(record._ruid)) {
      // Update existing record
      await db
        .updateTable(table as any)
        .set(recordWithStatus)
        .where("_ruid", "=", record._ruid)
        .execute();
      updated++;
    }
  }

  return { created, updated };
}

export interface FetchStepResult {
  /** Number of records created locally */
  created: number;

  /** Number of records updated locally */
  updated: number;

  /** Total records processed */
  total: number;
}

/**
 * Execute the fetch step for a table.
 *
 * @param table - Table name
 * @param toCreate - RUIDs of records to create locally
 * @param toUpdate - RUIDs of records to update locally
 * @returns Stats about applied changes
 */
export async function executeFetchStep<
  T extends SyncableRecord = SyncableRecord,
>(
  table: string,
  toCreate: string[],
  toUpdate: string[],
): Promise<FetchStepResult> {
  const allRuids = [...toCreate, ...toUpdate];

  if (allRuids.length === 0) {
    return { created: 0, updated: 0, total: 0 };
  }

  const transport = getSyncTransport();
  const config = getTableConfig(table);

  if (!config) {
    throw new Error(`No config found for table ${table}`);
  }

  // Fetch records from server
  const remoteRecords = await transport.fetch<Record<string, any>>(
    table,
    allRuids,
  );

  // Transform records for Local DB
  const records: T[] = (await Promise.all(
    remoteRecords.map((r) => parseRecordFromSync(r, config)),
  )) as T[];

  // Apply to local database
  const result = await applyRecords(table, records, toCreate, toUpdate);

  // Emit change event for reactive layer
  if (result.created > 0 || result.updated > 0) {
    emitTableChange(table, "bulk");
  }

  return {
    ...result,
    total: records.length,
  };
}

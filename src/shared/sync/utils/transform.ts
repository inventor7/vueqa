/**
 * Sync Transformer
 *
 * Handles data transformation between Local DB and Remote API.
 * Pure TypeScript implementation without external dependencies.
 */

import type { SyncTableConfig, SyncableRecord } from "../types";

interface TransformSetGet {
  read: (val: any) => Promise<any> | any;
  write: (val: any) => Promise<any> | any;
}

export type SyncMetaDataTransformer = Record<string, TransformSetGet>;

/**
 * Convert Date or ISO string to UTC format for API (YYYY-MM-DD HH:mm:ss)
 */
export function prepareDateTimeUTC(
  date: Date | string | null | undefined,
): string | null | undefined {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;

  return d.toISOString().replace("T", " ").split(".")[0];
}

/**
 * Convert UTC string from API to Date object (or string depending on needs)
 */
export function dateFromUTC(strDate: string | null | undefined): string | null {
  if (!strDate) return null;
  // If expecting Date object: return new Date(strDate);
  // If expecting ISO string for local DB: return new Date(strDate).toISOString();
  // Validating...
  const d = new Date(strDate);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Standard Date Transformer
 */
export const dateTransform: TransformSetGet = {
  read: (strDate: string | null) => dateFromUTC(strDate),
  write: (val: any) => prepareDateTimeUTC(val),
};

/**
 * Apply 'write' transforms (Local -> Remote)
 */
/**
 * Apply 'write' transforms (Local -> Remote)
 */
export async function prepareRecordForSync(
  record: SyncableRecord,
  config: SyncTableConfig,
): Promise<Record<string, any>> {
  let remoteRecord: Record<string, any> = {};

  // 1. Fields Filtering
  if (config.fields) {
    // Always include core fields
    remoteRecord._ruid = record._ruid;
    remoteRecord._create_date = record._create_date;
    remoteRecord._write_date = record._write_date;
    remoteRecord._delete_date = record._delete_date;

    // Add allowed fields
    for (const field of config.fields) {
      if (field in record) {
        remoteRecord[field] = (record as any)[field];
      }
    }
  } else {
    // Clone all
    remoteRecord = { ...record };
  }

  // 2. Global Date Transforms (Heuristic)
  // Recursively or flatly transform any field with "date" in the name
  for (const key of Object.keys(remoteRecord)) {
    if (key.toLowerCase().includes("date")) {
      // Don't overwrite if null/undefined unless explicit
      const val = remoteRecord[key];
      if (val) {
        remoteRecord[key] = prepareDateTimeUTC(val) ?? val;
      }
    }
  }

  // 3. Custom Transforms (Overrides heuristics)
  if (config.transforms) {
    for (const key of Object.keys(config.transforms)) {
      if (key in remoteRecord) {
        remoteRecord[key] = await config.transforms[key]?.write(
          remoteRecord[key],
        );
      }
    }
  }

  return remoteRecord;
}

/**
 * Apply 'read' transforms (Remote -> Local)
 */
export async function parseRecordFromSync(
  remoteRecord: Record<string, any>,
  config: SyncTableConfig,
): Promise<SyncableRecord> {
  const localRecord: any = { ...remoteRecord };

  // 1. Global Date Transforms (Heuristic)
  for (const key of Object.keys(localRecord)) {
    if (key.toLowerCase().includes("date")) {
      const val = localRecord[key];
      if (val) {
        localRecord[key] = dateFromUTC(val) ?? val;
      }
    }
  }

  // 2. Custom Transforms (Overrides heuristics)
  if (config.transforms) {
    for (const key of Object.keys(config.transforms)) {
      if (key in localRecord) {
        localRecord[key] = await config.transforms[key]?.read(localRecord[key]);
      }
    }
  }

  return localRecord;
}

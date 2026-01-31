/**
 * Media Sync Step
 *
 * Handles uploading local media and downloading remote media.
 * Runs before the main persist step (for uploads) and after fetch (for downloads).
 */

import { dbService } from "@/shared/database";
import { mediaManager } from "./MediaManager";
import { getSyncTransport } from "../SyncTransport";
import { getTableConfig } from "../utils/syncHelpers";
import type { SyncableRecord } from "../types";
import { Capacitor } from "@capacitor/core";

/**
 * Convert base64 string to Blob
 */
function base64ToBlob(base64: string, mimeType = "image/jpeg"): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Upload local media for records that are pending sync.
 * Updates the record with the remote URL.
 */
export async function uploadPendingMedia(table: string): Promise<void> {
  const config = getTableConfig(table);
  if (!config?.mediaColumns?.length) return;

  const db = dbService.getDb();
  const transport = getSyncTransport();

  // Find records with local media that need sync
  // We look for records where _sync_status is NOT synced
  // And check if they have local paths without remote URLs
  const records = await db
    .selectFrom(table as any)
    .selectAll()
    .where("_sync_status", "in", ["to_create", "to_update"])
    .execute();

  for (const record of records) {
    let hasUpdates = false;
    const updates: Record<string, any> = {};

    for (const col of config.mediaColumns) {
      const localPath = (record as any)[`${col}_local_path`];
      const remoteUrl = (record as any)[`${col}_remote_url`];

      // If we have a local file but no remote URL, we need to upload
      if (localPath && !remoteUrl) {
        try {
          // If path is file://, extract filename
          const filename = mediaManager.getFilename(localPath);

          if (await mediaManager.exists(filename)) {
            const base64 = await mediaManager.readFile(filename);
            const blob = base64ToBlob(base64);

            console.log(`[MediaSync] Uploading ${filename} for ${table}...`);
            const { url } = await transport.uploadFile(blob, filename);

            updates[`${col}_remote_url`] = url;
            hasUpdates = true;
          }
        } catch (e) {
          console.error(
            `[MediaSync] Failed to upload media for ${table}:${record._ruid}`,
            e,
          );
          // We continue, but this record might fail main sync or sync without image
        }
      }
    }

    if (hasUpdates) {
      await db
        .updateTable(table as any)
        .set(updates)
        .where("_ruid", "=", record._ruid)
        .execute();
    }
  }
}

/**
 * Download remote media for synced records.
 */
export async function downloadMissingMedia(table: string): Promise<void> {
  const config = getTableConfig(table);
  if (!config?.mediaColumns?.length) return;

  const db = dbService.getDb();
  const transport = getSyncTransport();

  // Find records with remote URL but missing local path
  const records = await db
    .selectFrom(table as any)
    .selectAll()
    .where((eb) => {
      const conditions = config.mediaColumns!.map((col) =>
        eb.and([
          eb(`${col}_remote_url`, "is not", null),
          eb(`${col}_local_path`, "is", null),
        ]),
      );
      return eb.or(conditions);
    })
    .execute();

  for (const record of records) {
    const updates: Record<string, any> = {};
    let hasUpdates = false;

    for (const col of config.mediaColumns) {
      const remoteUrl = (record as any)[`${col}_remote_url`];
      const localPath = (record as any)[`${col}_local_path`];

      if (remoteUrl && !localPath) {
        try {
          console.log(`[MediaSync] Downloading ${remoteUrl} for ${table}...`);
          const blob = await transport.downloadFile(remoteUrl);

          // Generate filename from URL or UUID
          const filename = `${table}_${record._ruid}_${col}_${Date.now()}.jpg`;

          // Convert Blob to base64 for MediaManager
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
          });
          reader.readAsDataURL(blob);
          const base64DataRaw = await base64Promise;
          // Remove data:image/jpeg;base64, prefix
          const base64 = base64DataRaw.split(",")[1];

          if (!base64) {
            console.error(
              `[MediaSync] Failed to download media for ${table}:${record._ruid}`,
              "No base64 data",
            );
            continue;
          }

          const uri = await mediaManager.saveFile(filename, base64);

          updates[`${col}_local_path`] = uri;
          hasUpdates = true;
        } catch (e) {
          console.error(
            `[MediaSync] Failed to download media for ${table}:${record._ruid}`,
            e,
          );
        }
      }
    }

    if (hasUpdates) {
      await db
        .updateTable(table as any)
        .set(updates)
        .where("_ruid", "=", record._ruid)
        .execute();
    }
  }
}

import type { BaseSyncModel } from "@/models/BaseSync.Model";
import { getClientApi } from "@/utils/api/getClientApi";
import { getDatabaseTable } from "@/utils/database/getDatabaseTable";
import { prepareDateTimeUTC } from "@/utils/date/prepareDateTimeUTC";
import {
  SyncClass,
  type RecordPing,
  type SyncStatus,
  type SyncStatusResponse
} from "./syncTypes";
import { SyncError } from "./class/SyncError";

async function prepareRecordsPing(
  ModelClass: typeof SyncClass
): Promise<RecordPing[]> {
  const table = getDatabaseTable<BaseSyncModel>(ModelClass.modelName);

  const syncStatus: SyncStatus[] = ["synced", "need-update"];

  if ((await table.count()) === 0) {
    return [];
  }

  const data = await table
    .filter(record => syncStatus.includes(record._sync_status))
    .toArray();

  return data.map((record: BaseSyncModel) => {
    return {
      _ruid: record._ruid,
      _write_date: prepareDateTimeUTC(record._write_date),
      _sync_status: record._sync_status
    };
  });
}

async function deleteLocalRecord(
  ModelClass: typeof SyncClass,
  remoteRuids: string[]
) {
  if (!remoteRuids.length) return;

  const t = getDatabaseTable<BaseSyncModel>(ModelClass.modelName);

  const entities = await t.filter(e => remoteRuids.includes(e._ruid)).toArray();

  await t.bulkDelete(entities.map(e => e.id));
}

export async function syncStatusStep(ModelClass: typeof SyncClass) {
  const api = getClientApi();

  const newRecordsPing = await prepareRecordsPing(ModelClass);

  const res = await api.post<SyncStatusResponse>(
    `/api/sync/${ModelClass.sync.modelName}/step1/status`,
    {
      objects: newRecordsPing
    }
  );

  if (res.data.error) {
    throw new SyncError({
      msg: res.data.error.data.message,
      model: ModelClass.sync.modelName
    });
  }

  await deleteLocalRecord(ModelClass, res.data.result.delete);

  return [res.data.result.create, res.data.result.edit];
}

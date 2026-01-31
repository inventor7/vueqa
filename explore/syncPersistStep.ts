import { forEach } from "lodash";
import { type EventHook } from "@vueuse/core";

import { getDatabaseTable } from "@/utils/database/getDatabaseTable";
import { getClientApi } from "@/utils/api/getClientApi";

import { syncPrepare, syncPrepareAcknowledge } from "./syncPrepare";
import {
  SyncClass,
  type FailedAcknowledge,
  type SyncStatus,
  type SyncPersistResponse,
  type AbstractRemoteModel
} from "./syncTypes";
import { SyncContext } from "./syncContext";
import { type ConstructSyncFailed } from "@/models/SyncFailed.Model";
import type { BaseSyncModel } from "@/models/BaseSync.Model";
import { SyncError } from "./class/SyncError";

async function fetchLocalRecords(
  ModelClass: typeof SyncClass
): Promise<AbstractRemoteModel[]> {
  const syncStatus: SyncStatus[] = ["need-create", "need-update"];

  const records = await getDatabaseTable<BaseSyncModel>(ModelClass.modelName)
    .filter(
      record =>
        syncStatus.includes(record._sync_status) || !!record._delete_date
    )
    .toArray();

  return Promise.all(
    records.map(r => {
      const syncContext = new SyncContext([], ModelClass.sync.modelName);
      return syncPrepare(ModelClass, r, syncContext);
    })
  );
}

async function acknowledgeDoneRecords(
  ModelClass: typeof SyncClass,
  recordStatus: AbstractRemoteModel[]
) {
  const queries = recordStatus.map(r => syncPrepareAcknowledge(ModelClass, r));

  return Promise.all(queries);
}

const acknowledgeFailedRecords = async (
  ModelClass: typeof SyncClass,
  recordStatus: FailedAcknowledge[],
  context: { errorEvent: EventHook<ConstructSyncFailed> | undefined }
) => {
  forEach(recordStatus, r => {
    const entry: ConstructSyncFailed = {
      error: r.error,
      entityModel: ModelClass.sync.modelName,
      entityRuid: r._ruid,
      entityPath: null,
      critical: false,
      message: "",
      errorAt: new Date()
    };

    context.errorEvent?.trigger(entry);
  });
};

export async function syncPersistStep(
  ModelClass: typeof SyncClass,
  context: { errorEvent: EventHook<ConstructSyncFailed> | undefined }
) {
  const records = await fetchLocalRecords(ModelClass);

  if (!records.length) return;

  const api = getClientApi();

  const res = await api.post<SyncPersistResponse>(
    `/api/sync/${ModelClass.sync.modelName}/step3/persist`,
    {
      objects: records
    }
  );

  if (res.data.error) {
    throw new SyncError({
      msg: res.data.error.data.message,
      model: ModelClass.sync.modelName
    });
  }

  await acknowledgeFailedRecords(ModelClass, res.data.result.failed, context);

  await acknowledgeDoneRecords(ModelClass, res.data.result.done);
}

export async function syncSingleEntry(
  ModelClass: typeof SyncClass<any>,
  record: BaseSyncModel
) {
  const api = getClientApi();

  const syncContext = new SyncContext([], ModelClass.sync.modelName);

  const recordPlainData = await syncPrepare(ModelClass, record, syncContext);

  const res = await api.post(
    `/api/sync/${ModelClass.sync.modelName}/step3/persist`,
    {
      objects: [recordPlainData]
    }
  );

  if (res.data.error) {
    throw new SyncError({
      msg: res.data.error.data.message,
      model: ModelClass.sync.modelName
    });
  }

  if (res.data.result.failed?.length) {
    throw new SyncError({
      msg: res.data.result.failed[0].error,
      model: ModelClass.sync.modelName
    });
  }

  await acknowledgeDoneRecords(ModelClass, res.data.result.done);
}

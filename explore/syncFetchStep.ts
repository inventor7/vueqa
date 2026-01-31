import { getClientApi } from "@/utils/api/getClientApi";
import { filter } from "lodash";
import { syncCreateRecordBatch, syncUpdateRecordBatch } from "./syncRecord";
import { SyncClass, type SyncFetchResponse } from "./syncTypes";
import { SyncError } from "./class/SyncError";

export async function syncFetchStep(
  ModelClass: typeof SyncClass,
  createRuid: string[],
  updateRuid: string[]
) {
  if (!createRuid.length && !updateRuid.length) return;

  const api = getClientApi();

  const res = await api.post<SyncFetchResponse>(
    `/api/sync/${ModelClass.sync.modelName}/step2/fetch`,
    {
      ruids: [...createRuid, ...updateRuid]
    }
  );

  if (res.data.error) {
    throw new SyncError({
      msg: res.data.error.data.message,
      model: ModelClass.modelName
    });
  }

  const toCreate = filter(res.data.result, o => createRuid.includes(o._ruid));
  const createQueries = syncCreateRecordBatch(ModelClass, toCreate);

  const toUpdate = filter(res.data.result, o => updateRuid.includes(o._ruid));

  const updateQueries = syncUpdateRecordBatch(ModelClass, toUpdate, updateRuid);

  Promise.all([createQueries, updateQueries]);

  return res.data.result;
}

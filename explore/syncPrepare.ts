import { isDate, isPlainObject, keys, map, mapValues } from "lodash";
import { isAfter } from "date-fns";

import { getDatabaseTable } from "@/utils/database/getDatabaseTable";
import { dateFromUTC } from "@/utils/date/dateFromUTC";
import { prepareDateTimeUTC } from "@/utils/date/prepareDateTimeUTC";
import { SyncContext } from "./syncContext";
import type {
  AbstractLocalModel,
  AbstractRemoteModel,
  SyncClass,
  SyncMetaDataTransformer
} from "./syncTypes";
import { iterateOf } from "./iterateOf";
import type { BaseSyncModel } from "@/models/BaseSync.Model";
import { SyncError } from "./class/SyncError";

async function applyTransform(
  localObject: AbstractLocalModel,
  remoteObject: AbstractRemoteModel,
  transformMap: SyncMetaDataTransformer,
  syncContext: SyncContext
) {
  const iterations = map(keys(transformMap), async path => {
    const ctx = syncContext.with(path);
    try {
      await iterateOf(
        remoteObject,
        localObject,
        path.split("."),
        transformMap[path].write
      );
    } catch (error: any) {
      throw new SyncError(
        {
          msg: error.message,
          path: ctx.path,
          model: ctx.model,
          ruid: remoteObject._ruid
        },
        { cause: error }
      );
    }
  });

  return Promise.all(iterations);
}

function applyBaseDateTransform(remoteObject: AbstractRemoteModel) {
  const dateFields = ["_create_date", "_write_date", "_delete_date"];

  mapValues(remoteObject, (v, k) => {
    if (dateFields.includes(k) && isDate(v)) return prepareDateTimeUTC(v);
    if (isPlainObject(v)) applyBaseDateTransform(v);
    return v;
  });
}

export async function syncPrepare(
  ModelClass: typeof SyncClass,
  localObject: BaseSyncModel,
  syncContext: SyncContext
): Promise<AbstractRemoteModel> {
  const sync = ModelClass.sync;

  const localContext = syncContext.with(sync.modelName);

  const remoteObject: AbstractRemoteModel = {
    _ruid: localObject._ruid,
    _create_date: prepareDateTimeUTC(localObject._create_date),
    _write_date: prepareDateTimeUTC(localObject._write_date),
    _delete_date: localObject._delete_date
      ? prepareDateTimeUTC(new Date())
      : undefined
  };

  sync.fields.forEach(r => {
    remoteObject[r.name] = (localObject as AbstractLocalModel)[r.name];
  });

  if (sync.transform) {
    await applyTransform(
      localObject,
      remoteObject,
      sync.transform,
      localContext
    );
  }

  applyBaseDateTransform(remoteObject);

  return remoteObject;
}

export async function syncPrepareAcknowledge(
  ModelClass: typeof SyncClass,
  remoteObject: AbstractRemoteModel
) {
  const table = getDatabaseTable<BaseSyncModel>(ModelClass.modelName);

  const localObject = await table.get({
    _ruid: remoteObject._ruid as string
  });

  if (!localObject) {
    throw new SyncError({
      msg: `Cannot fetch locale record "${remoteObject._ruid}"`,
      model: ModelClass.modelName
    });
  }

  // Deleted on remote
  if (remoteObject._delete_date) {
    const item = await table.get({ _ruid: localObject._ruid });
    if (item) await table.delete(item.id);
  }

  // Created/Updated on remote
  else {
    const [local, remote] = [
      localObject._write_date,
      dateFromUTC(remoteObject._write_date)
    ];

    await table.update(localObject.id, {
      _write_date: isAfter(remote, local) ? remote : local,
      _sync_status: "synced"
    } as Partial<BaseSyncModel>);
  }
}

import { isAfter, isMatch } from "date-fns";
import {
  assign,
  compact,
  isDate,
  isPlainObject,
  keys,
  map,
  mapValues,
  pick
} from "lodash";

import { getDatabaseTable } from "@/utils/database/getDatabaseTable";
import { dateFromUTC } from "@/utils/date/dateFromUTC";
import { z } from "zod";
import type { Ruid } from "../../utils/ruid/ruid";
import { SyncError } from "./class/SyncError";
import { iterateOf } from "./iterateOf";
import { SyncContext } from "./syncContext";
import type {
  AbstractLocalModel,
  AbstractRemoteModel,
  Construct,
  SyncClass,
  SyncMetaDataTransformer
} from "./syncTypes";

async function applyTransform(
  localObject: Construct<AbstractLocalModel>,
  remoteObject: AbstractRemoteModel,
  transformMap: SyncMetaDataTransformer,
  syncContext: SyncContext
) {
  const iterations = map(keys(transformMap), async path => {
    const ctx = syncContext.with(path);
    try {
      await iterateOf(
        localObject,
        remoteObject,
        path.split("."),
        transformMap[path].read
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

function applyBaseDateTransform(remoteObject: Construct<AbstractLocalModel>) {
  const dateFields = ["_create_date", "_write_date", "_delete_date"];

  mapValues(remoteObject, (v, k) => {
    if (dateFields.includes(k) && !isDate(v)) return dateFromUTC(v);
    if (isPlainObject(v)) applyBaseDateTransform(v);
    return v;
  });
}

export async function syncUpdateRecord(
  ModelClass: typeof SyncClass,
  remoteObject: AbstractRemoteModel,
  localObject: AbstractLocalModel,
  ctx: SyncContext
) {
  const sync = ModelClass.sync;

  if (!isPlainObject(remoteObject)) {
    throw new SyncError({
      msg: `Expect "object"; Get "${typeof remoteObject}"`,
      path: ctx.path,
      model: sync.modelName,
      ruid: localObject._ruid
    });
  }

  if (!remoteObject._ruid) {
    throw new SyncError({
      msg: `Expect a valid RUID; Get "${typeof remoteObject._ruid}"`,
      path: ctx.path,
      model: sync.modelName,
      ruid: localObject._ruid
    });
  }

  if (!localObject) {
    throw new SyncError({
      msg: `Cannot fetch locale record "${remoteObject._ruid}"`,
      path: ctx.path,
      model: sync.modelName,
      ruid: remoteObject._ruid
    });
  }

  const [remoteDate, localDate] = [
    dateFromUTC(remoteObject._write_date),
    localObject._write_date
  ];

  if (!isAfter(remoteDate, localDate)) return;

  const fieldsName = map(sync.fields, "name");
  const fieldsData = pick(remoteObject, fieldsName);

  assign(localObject, {
    _ruid: remoteObject._ruid,
    _create_date: dateFromUTC(remoteObject._create_date),
    _write_date: dateFromUTC(remoteObject._write_date),
    _sync_status: "synced",
    ...fieldsData
  });

  if (sync.transform) {
    await applyTransform(localObject, remoteObject, sync.transform, ctx);
  }

  applyBaseDateTransform(localObject);

  return localObject;
}

export async function syncCreateRecord(
  ModelClass: typeof SyncClass,
  remoteObject: AbstractRemoteModel,
  ctx: SyncContext
) {
  const sync = ModelClass.sync;

  if (!isPlainObject(remoteObject)) {
    throw new SyncError({
      msg: `Expect "object"; Get "${typeof remoteObject}"`,
      path: ctx.path,
      model: sync.modelName,
      ruid: remoteObject._ruid
    });
  }

  if (!remoteObject._ruid) {
    throw new SyncError({
      msg: `Expect a valid RUID; Get "${typeof remoteObject._ruid}"`,
      path: ctx.path,
      model: sync.modelName,
      ruid: remoteObject._ruid
    });
  }

  const localObject: Construct<AbstractLocalModel> = {
    _ruid: remoteObject._ruid,
    _create_date: dateFromUTC(remoteObject._create_date),
    _write_date: dateFromUTC(remoteObject._write_date),
    _delete_date: null,
    _sync_status: "synced"
  };

  const fieldsName = map(sync.fields, "name");
  const fieldsData = pick(remoteObject, fieldsName);

  assign(localObject, fieldsData);

  if (sync.transform) {
    await applyTransform(localObject, remoteObject, sync.transform, ctx);
  }

  applyBaseDateTransform(localObject);

  return localObject;
}

export async function syncCreateRecordBatch(
  ModelClass: typeof SyncClass,
  remoteObjects: AbstractRemoteModel[]
) {
  if (!remoteObjects.length) return [];

  const table = getDatabaseTable<AbstractLocalModel>(ModelClass.modelName);

  const metaSchema = z.object({
    // _ruid: z
    //   .string()
    //   .refine(ruid => isValidRuid(ruid), { message: "Invalid RUID" }),
    _create_date: z.string().refine(d => isMatch(d, "yyyy-MM-dd HH:mm:ss"), {
      message: "Invalid date format"
    }),
    _write_date: z.string().refine(d => isMatch(d, "yyyy-MM-dd HH:mm:ss"), {
      message: "Invalid date format"
    })
  });

  const createQueries = map(remoteObjects, obj => {
    const validation = metaSchema.safeParse(obj);

    if (!validation.success) {
      throw new SyncError({
        msg: `Invalid object metadata: ${validation.error.message} `,
        model: ModelClass.modelName,
        ruid: obj._ruid
      });
    }

    const syncContext = new SyncContext([], ModelClass.sync.modelName);
    return syncCreateRecord(ModelClass, obj, syncContext);
  });

  return Promise.all(createQueries).then(async objects => {
    const ruids = objects.map(e => e._ruid);
    const exist = await table.filter(e => ruids.includes(e._ruid)).first();

    if (!exist) return table.bulkAdd(objects as AbstractLocalModel[]);

    return undefined;
  });
}

export async function syncUpdateRecordBatch(
  ModelClass: typeof SyncClass,
  remoteObjects: AbstractRemoteModel[],
  ruids: Ruid[]
) {
  if (!remoteObjects.length) return [];

  const table = getDatabaseTable<AbstractLocalModel>(ModelClass.modelName);

  const localObjects = await table
    .filter(r => ruids.includes(r._ruid))
    .toArray();

  if (localObjects.length !== remoteObjects.length) {
    throw new SyncError({
      msg: `Cannot find all records to update from remote`,
      model: ModelClass.modelName
    });
  }

  // const queries = map(remoteObjects, (obj, i) => {
  //   const syncContext = new SyncContext([], ModelClass.sync.modelName);
  //   return syncUpdateRecord(ModelClass, obj, localObjects[i], syncContext);
  // });

  const queries = map(remoteObjects, remote => {
    const localObj = localObjects.find(local => local._ruid === remote._ruid);
    if (!localObj) return undefined;
    const syncContext = new SyncContext([], ModelClass.sync.modelName);
    return syncUpdateRecord(ModelClass, remote, localObj, syncContext);
  });

  return Promise.all(queries).then(objects => {
    return table.bulkPut(compact(objects));
  });
}

import {
  createEventHook,
  createGlobalState,
  type EventHookOn
} from "@vueuse/core";
import { differenceInMinutes } from "date-fns";
import { isUndefined, map } from "lodash";
import { computed, ref } from "vue";

import {
  SyncFailedSync,
  type ConstructSyncFailed,
  type SyncFailed
} from "@/models/SyncFailed.Model";
import i18n from "@/plugins/i18n";

import { syncFetchStep } from "@/services/Sync/syncFetchStep";
import { syncPersistStep } from "@/services/Sync/syncPersistStep";
import { syncStatusStep } from "@/services/Sync/syncStatusStep";
import { getDatabaseTableByClass } from "@/utils/database/getDatabaseTable";
import type {
  ProductImageModel,
  ResPartnerImageModel,
  SyncClass,
  SyncMetaDataFields,
  SyncPersistResponse
} from "@/services/Sync/syncTypes";
import { SyncError } from "@/services/Sync/class/SyncError";

import { clearAllModelTimeSync } from "@/services/Sync/clearAllModelTimeSync";
import { getModelTimeSync } from "@/services/Sync/getModelTimeSync";
import { recordModelSyncTime } from "@/services/Sync/recordModelSyncTime";
import { formatSyncFailed } from "@/services/Sync/formatSyncFailed";
import { cacheService } from "@/services/Cache/CacheService";
import { handleErrorSync } from "@/services/Sync/handleErrorSync";
import { Database } from "@/services/Database/Database";
import { sendActivityPing } from "@/services/Sync/sendActivityPing";
import { SaleOrderSync } from "@/models/SaleOrder.Model";
import { StockPickingSync } from "@/models/Stock.Model";
import { AccountPaymentSync } from "@/models/AccountPayment.Model";
import { StockControlSync } from "@/models/StockControl";
import { getCurrentPlanning } from "@/services/Planning/getCurrentPlanning";
import { useMessageBox } from "../utils/useMessageBox";
import { PlanningUserEventSync } from "@/models/PlanningUserEvent.Model";
import { getClientApi } from "@/utils/api/getClientApi";
import { PartnerSync } from "@/models/Partner.Model";
import { getEntityList } from "@/services/Common/getEntityList";
import { syncFetchImageStep } from "@/services/Sync/syncFetchImageStep";
import { ProductSync } from "@/models/Product.Model";
import { getCatalogProductList } from "@/services/Product/getCatalogProductList";
import { Auth } from "@/services/Auth/Auth";

export const useSync = createGlobalState(() => {
  const { t } = i18n.global;

  const onError = createEventHook<ConstructSyncFailed>();
  const onStart = createEventHook<(typeof SyncClass)[]>();
  const onFinished = createEventHook();

  const { alert } = useMessageBox();
  const displayErrorPopup = ref(false);

  const displaySyncProgress = ref(false);

  const model = ref("");
  const step = ref(0);
  const index = ref(0);
  const count = ref(0);
  const attempt = ref(1);

  const hasErrorSync = ref<SyncFailed | undefined>(undefined);

  const aborted = ref(true);
  const loading = ref(false);
  const finished = ref(false);
  const pendingLanguageSync = ref(false);

  const clearSyncTime = async () => {
    clearAllModelTimeSync();
  };
  const checkSessionValid = async (): Promise<boolean> => {
    const session = await Auth.getSession();
    return !!session?.token;
  };
  const startSync = async (syncModelList: (typeof SyncClass<any>)[]) => {
    if (loading.value) return;
    if (!(await checkSessionValid())) {
      return;
    }
    loading.value = true;

    aborted.value = false;
    finished.value = false;

    model.value = "";
    step.value = 0;
    index.value = 0;

    count.value = syncModelList.length;

    await sendActivityPing(false);

    onStart.trigger(syncModelList);

    if (!(await checkSessionValid())) {
      throw new Error("No token found - aborting sync");
    }
    const db = Database.getDefaultDatabase();
    if (!db) throw new Error("Database not initialized");

    try {
      const syncErrorTable = getDatabaseTableByClass(SyncFailedSync);
      await syncErrorTable.clear();
    } catch (er) {
      console.error(er);
    }

    for (const model of syncModelList) {
      if (!(await checkSessionValid())) {
        aborted.value = true;
        break;
      }
      if (aborted.value) break;

      await executeSyncTable(model);
    }

    index.value = count.value * 3;

    loading.value = false;
    finished.value = true;

    await sendActivityPing(true);

    onFinished.trigger(undefined);
  };

  const executeSyncTable = async (model: typeof SyncClass) => {
    try {
      if (!(await checkSessionValid())) {
        throw new Error(`No token found - skipping ${model.modelName}`);
      }

      await syncTable(model);
      attempt.value = 1;
    } catch (e: unknown) {
      if (!(await checkSessionValid())) {
        aborted.value = true;
        return;
      }
      if (e instanceof Error || e instanceof SyncError) {
        if (attempt.value < 3) {
          attempt.value++;
          await executeSyncTable(model);
        } else {
          recordTableError(model, e);
          attempt.value = 1;
        }
      }
    }
  };

  const recordTableError = (
    ModelClass: typeof SyncClass,
    e: Error | SyncError
  ) => {
    const entry: ConstructSyncFailed = {
      error: e.message,
      entityModel: ModelClass.sync.modelName,
      entityRuid: null,
      entityPath: null,
      critical: true,
      message: "",
      errorAt: new Date()
    };

    if (e instanceof SyncError) {
      entry.entityRuid = e.ruid ?? null;
      entry.entityPath = e.path ?? null;
    }

    onError.trigger(entry);

    console.error(formatSyncFailed(entry));
  };

  const syncTable = async (ModelClass: typeof SyncClass) => {
    const lastTime = await getModelTimeSync(ModelClass.modelName);

    if (
      !isUndefined(lastTime) &&
      !isUndefined(ModelClass.sync.delay) &&
      differenceInMinutes(new Date(), lastTime.syncAt) <= ModelClass.sync.delay
    ) {
      index.value += 3;
      return;
    }

    const fields = [
      ...ModelClass.sync.fields,
      { name: "id" },
      { name: "_ruid" },
      { name: "_create_date" },
      { name: "_write_date" },
      { name: "_delete_date" },
      { name: "_sync_status" }
    ];

    // for create new fields if exist
    await ensureSchemaUpdated(ModelClass, fields);

    if (ModelClass.modelName === "planning.user_event") {
      const skip = await checkNotSyncedForSkip();

      if (!skip && !hasErrorSync.value) {
        const eventTable = getDatabaseTableByClass(PlanningUserEventSync);
        if (
          await eventTable
            .filter(
              e => e.state === "close_day" && e._sync_status === "need-create"
            )
            .first()
        ) {
          alert({
            message: t("sync.syncSuccess"),
            timer: 10000
          });
        }
      }

      //skip sync planning.user_event
      if (skip) {
        await checkOpenDayIsPersisted();

        return;
      }
    }

    model.value = ModelClass.sync.modelName;

    /**
     * 1) Status
     */

    step.value = 1;
    const [create, update] = await syncStatusStep(ModelClass);
    index.value++;

    /**
     * 2) Fetch
     */
    step.value = 2;
    await syncFetchStep(ModelClass, create, update);
    index.value++;

    /**
     * 3) Persist
     */

    step.value = 3;
    await syncPersistStep(ModelClass, { errorEvent: onError });
    index.value++;

    /**
     * Record sync time sheet
     */

    await recordModelSyncTime(ModelClass.modelName);
  };

  const abort = () => {
    aborted.value = true;
  };

  const progress = computed(() => {
    return Math.round((index.value * 100) / (count.value * 3)) || 0;
  });

  onError.on(async e => {
    const message = await handleErrorSync(e);

    e.message = message;

    const syncErrorTable = getDatabaseTableByClass(SyncFailedSync);
    await cacheService.clear(SyncFailedSync.modelName);
    syncErrorTable.add(e);
  });

  const ensureSchemaUpdated = async (
    syncClass: typeof SyncClass,
    localFields: SyncMetaDataFields[]
  ) => {
    const db = Database.getDefaultDatabase();
    if (!db) throw new Error("Default database not found");

    const table = getDatabaseTableByClass(syncClass);

    const existingFields = Object.keys((await table.toArray()).at(0) ?? []);

    const missingFields = localFields.filter(
      field => !existingFields.includes(field.name)
    );

    if (!missingFields.length) return;

    const items = (await table.toArray()) as any[];

    if (!items.length) return;

    for (const item of items) {
      const updateData: Record<string, any> = {};

      for (const field of missingFields) {
        if (!(field.name in item)) {
          updateData[field.name] = null;
        }
      }

      if (Object.keys(updateData).length > 0) {
        await table.update(item.id, updateData);
      }
    }
  };

  const checkNotSyncedForSkip = async () => {
    try {
      //TODO Check all concerned models if needed.
      const models = [
        SaleOrderSync,
        StockPickingSync,
        StockControlSync,
        AccountPaymentSync
      ];

      let skip = false;
      const planning = await getCurrentPlanning();
      const errosSync = getDatabaseTableByClass(SyncFailedSync);

      for (const model of models) {
        const table = getDatabaseTableByClass(model as any);

        hasErrorSync.value = await errosSync
          .filter(e => e.entityModel === model.modelName)
          .first();

        const notSynced = await table
          .filter(
            (e: any) =>
              e._sync_status === "need-create" &&
              e.planning_id &&
              e.planning_id === planning?._ruid
          )
          .first();

        if (hasErrorSync.value) {
          const eventTable = getDatabaseTableByClass(PlanningUserEventSync);
          if (
            await eventTable
              .filter(
                e => e.state === "close_day" && e._sync_status === "need-create"
              )
              .first()
          ) {
            alert({
              iconColor: "red",
              icon: "mdi-alert-circle",
              message: t("syncFailed.processFaild")
            });
          }
        }

        if (notSynced || hasErrorSync.value) {
          skip = true;
          break;
        }
      }

      return skip;
    } catch (err) {
      console.error("Why error", err);

      // skiped in case of error
      return true;
    }
  };

  // const cleanCurrentPlanning = async () => {
  //   try {
  //     const models = [
  //       SaleOrderSync,
  //       StockPickingSync,
  //       StockControlSync,
  //       AccountPaymentSync
  //     ];
  //     const planning = await getCurrentPlanning();
  //     for (const model of models) {
  //       const table = getDatabaseTableByClass(model as any);

  //       const oldData = await table
  //         .filter(
  //           (e: any) => e.planning_id && e.planning_id !== planning?._ruid
  //         )
  //         .toArray();

  //       const ids = map(oldData, (o: any) => o.id);

  //       await table.bulkDelete(ids);
  //     }
  //   } catch (err) {
  //     console.error("err", err);
  //   }
  // };

  const checkOpenDayIsPersisted = async () => {
    const eventTable = getDatabaseTableByClass(PlanningUserEventSync);

    const recordIsOpen = await eventTable
      .filter(e => e.state === "open_day" && e._sync_status === "need-create")
      .first();

    if (recordIsOpen) {
      const api = getClientApi();

      await api.post<SyncPersistResponse>(
        `/api/sync/planning.user_event/step3/persist`,
        {
          objects: recordIsOpen
        }
      );
    }
  };

  const syncPartnerImages = async (): Promise<ResPartnerImageModel[]> => {
    const partners = await getEntityList(PartnerSync);
    return syncFetchImageStep(PartnerSync.modelName, map(partners, "_ruid"));
  };

  const syncProductImages = async (): Promise<ProductImageModel[]> => {
    const products = await getCatalogProductList();
    return syncFetchImageStep(ProductSync.modelName, map(products, "_ruid"));
  };

  return {
    finished,
    loading,
    progress,
    model,
    step,
    displayErrorPopup,
    displaySyncProgress,
    pendingLanguageSync,
    onError: onError.on as EventHookOn<ConstructSyncFailed>,
    onStart: onStart.on as EventHookOn<(typeof SyncClass)[]>,
    onFinished: onFinished.on as EventHookOn<any>,

    abort,
    startSync,
    clearSyncTime,
    syncPartnerImages,
    syncProductImages
  };
});

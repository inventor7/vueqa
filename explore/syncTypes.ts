import {
  type AbstractSyncModel,
  type BaseSyncModel
} from "@/models/BaseSync.Model";
import { type BackendResponse } from "@/utils/api/getClientApi";
import { type Ruid } from "../../utils/ruid/ruid";
import type { Merge, OverrideProperties } from "type-fest";
import type { PartnerImage } from "@/models/Partner.Model";
import type { ProductImage } from "@/models/Product.Model";

export class SyncClass<T = any> {
  _type: T;

  static modelName: string;

  static sync: SyncMetaData = {
    modelName: "",
    delay: 0,
    fields: []
  };
}

export interface SyncMetaDataFields {
  name: string;
}

export type TransformCallback = (srcValue: any) => Promise<any>;

export type TransformSetGet = {
  read: TransformCallback;
  write: TransformCallback;
};

export interface SyncMetaDataTransformer {
  [key: string]: TransformSetGet;
}

export interface SyncMetaData {
  modelName: string;
  delay?: number;
  fields: SyncMetaDataFields[];
  transform?: SyncMetaDataTransformer;
}

export type FetchedType<T> = T & {
  id: number;
};

export type Id = Ruid;

export type ModelInterface<T extends SyncClass<X>, X = any> = T["_type"];

export interface FailedAcknowledge {
  _ruid: string;
  error: string;
}

export type SyncStatus = "need-create" | "need-update" | "ignore" | "synced";

export interface RecordPing {
  _ruid: Ruid;
  _write_date: string;
  _sync_status: SyncStatus;
}

export type SyncStatusResponse = BackendResponse<{
  create: Ruid[];
  edit: Ruid[];
  delete: Ruid[];
}>;

export type SyncFetchResponse = BackendResponse<AbstractRemoteModel[]>;

export type SyncPersistResponse = BackendResponse<{
  done: AbstractRemoteModel[];
  failed: FailedAcknowledge[];
}>;

export type AbstractLocalModel = OverrideProperties<
  BaseSyncModel,
  {
    id: number;
  }
> & { [f: string]: any };

export interface AbstractRemoteModel {
  _ruid: Ruid;
  _create_date: string;
  _write_date: string;
  _delete_date?: string;
  [f: string]: any;
}

export type Construct<T> = Merge<T, { id?: number | undefined }>;

export type MaybeConstruct<T> = Construct<T> | T;

export interface ResPartnerImageModel extends AbstractSyncModel {
  image_1920: string;
  image_ids: PartnerImage[];
}

export interface ProductImageModel extends AbstractSyncModel {
  image_512: string;
  image_ids: ProductImage[];
}

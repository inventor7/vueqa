// import { type DeliveryDatabaseSchema } from "@/modules/delivery/database/schema";
import { type HomeDatabaseSchema } from "@/modules/home/database/schema";

export interface Database extends HomeDatabaseSchema {
  // export interface Database extends HomeDatabaseSchema, DeliveryDatabaseSchema {}
}

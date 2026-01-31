import { type ReactiveDemoSchema } from "@/modules/reactive/database/schema";
import { type DemoDatabaseSchema } from "@/modules/demo/database/schema";

export interface Database extends ReactiveDemoSchema, DemoDatabaseSchema {}

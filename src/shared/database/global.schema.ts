import { type HomeDatabaseSchema } from "@/modules/home/database/schema";
import { type ReactiveDemoSchema } from "@/modules/reactive/database/schema";

export interface Database extends HomeDatabaseSchema, ReactiveDemoSchema {}

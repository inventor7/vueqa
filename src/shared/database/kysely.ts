import { Kysely } from "kysely";
import CapacitorSQLiteKyselyDialect from "capacitor-sqlite-kysely";
import { CapacitorSQLite, SQLiteConnection } from "@capacitor-community/sqlite";
import type { Database } from "@/shared/database/global.schema";

export const sqlite = new SQLiteConnection(CapacitorSQLite);

let _kyselyInstance: Kysely<Database> | null = null;

export function getKyselyInstance(): Kysely<Database> {
  if (!_kyselyInstance) {
    _kyselyInstance = new Kysely<Database>({
      dialect: new CapacitorSQLiteKyselyDialect(sqlite, {
        name: import.meta.env.VITE_DB_FILENAME || "vueqa",
      }),
    });
  }
  return _kyselyInstance;
}

/**
 * initialize the database connection
 */
export async function initConnection() {
  const dbName = import.meta.env.VITE_DB_FILENAME || "vueqa";

  let conn;
  const isConn = await sqlite.isConnection(dbName, false);

  if (isConn.result) {
    conn = await sqlite.retrieveConnection(dbName, false);
  } else {
    conn = await sqlite.createConnection(
      dbName,
      false,
      "no-encryption",
      1,
      false,
    );
  }

  const isDBOpen = await conn.isDBOpen();
  if (!isDBOpen.result) {
    await conn.open();
  }
  return conn;
}

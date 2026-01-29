import { Kysely } from "kysely";
import CapacitorSQLiteKyselyDialect from "capacitor-sqlite-kysely";
import { CapacitorSQLite, SQLiteConnection } from "@capacitor-community/sqlite";
import type { Database } from "@/shared/database/global.schema";

/**
 * Base SQLite Connection
 */
const baseSqlite = new SQLiteConnection(CapacitorSQLite);

/**
 * Proxied SQLite Connection to handle web persistence fragility
 */
export const sqlite = new Proxy(baseSqlite, {
  get(target, prop) {
    const value = (target as any)[prop];

    // Intercept saveToStore to prevent crashes on web
    if (prop === "saveToStore") {
      return async (...args: any[]) => {
        try {
          return await value.apply(target, args);
        } catch (err) {
          console.warn("⚠️ saveToStore failed, attempting recovery...", err);
          try {
            // Attempt to re-init connection and retry
            await initConnection();
            return await value.apply(target, args);
          } catch (retryErr) {
            console.error(
              "❌ saveToStore failed after retry. Data may not be persisted.",
              retryErr,
            );
            // Don't throw, so the app doesn't crash on optimistic updates
            return;
          }
        }
      };
    }

    if (typeof value === "function") {
      return value.bind(target);
    }
    return value;
  },
});

let _kyselyInstance: Kysely<Database> | null = null;

/**
 * Get or create the Kysely instance
 */
export function getKyselyInstance(): Kysely<Database> {
  if (!_kyselyInstance) {
    _kyselyInstance = new Kysely<Database>({
      dialect: new CapacitorSQLiteKyselyDialect(sqlite, {
        name: import.meta.env.VITE_DB_FILENAME || "vueqa.db",
      }),
    });
  }
  return _kyselyInstance;
}

/**
 * Pre-initialize the database connection (critical for Web/WASM)
 */
/**
 * Pre-initialize the database connection (critical for Web/WASM)
 */
export async function initConnection() {
  const dbName = import.meta.env.VITE_DB_FILENAME || "vueqa.db";

  // Check if connection already exists in the JS wrapper
  let conn = await sqlite.retrieveConnection(dbName, false);

  // If found, ensure it's open
  if (conn) {
    const isDBOpen = await conn.isDBOpen();
    if (!isDBOpen.result) {
      await conn.open();
    }
    return conn;
  }

  // If not found, create and open it
  conn = await sqlite.createConnection(
    dbName,
    false,
    "no-encryption",
    1,
    false,
  );
  await conn.open();
  return conn;
}

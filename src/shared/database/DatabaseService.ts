import { Kysely } from "kysely";
import CapacitorSQLiteKyselyDialect from "capacitor-sqlite-kysely";
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from "@capacitor-community/sqlite";
import type { Database } from "./global.schema";
import { DatabaseMigrator, type MigrationResult } from "./migrator";
import { emitTableChange } from "./reactive/dbEvents";
import type { ChangeType } from "./reactive/types";

/**
 * SQLite connection singleton
 */
const sqlite = new SQLiteConnection(CapacitorSQLite);

/**
 * DatabaseService
 *
 * Singleton service for managing the SQLite database connection, Kysely instance,
 * and migrations. This is the main entry point for all database operations.
 *
 * **For template forking:**
 * 1. This file rarely needs modification
 * 2. Add your schemas to `global.schema.ts`
 * 3. Create migrations in `migrations/` folder
 *
 * @example
 * ```ts
 * // Initialize once (usually in main.ts or App.vue)
 * await dbService.init();
 *
 * // Use in components/services
 * const db = dbService.getDb();
 * const tasks = await db.selectFrom("tasks").selectAll().execute();
 * ```
 */
class DatabaseService {
  private static instance: DatabaseService;
  private db: Kysely<Database> | null = null;
  private migrator: DatabaseMigrator | null = null;
  private connection: SQLiteDBConnection | null = null;
  private initialized = false;
  private initializing = false;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Initialize the database connection and run migrations.
   *
   * Call this once at app startup (e.g., in main.ts or App.vue).
   * Safe to call multiple times - will only initialize once.
   *
   * @throws Error if initialization fails
   */
  public async init(): Promise<Kysely<Database>> {
    // Prevent double initialization
    if (this.initialized && this.db) {
      console.log(
        "[DatabaseService] Already initialized, returning existing instance",
      );
      return this.db;
    }

    // Prevent concurrent initialization
    if (this.initializing) {
      console.log("[DatabaseService] Initialization in progress, waiting...");
      // Wait for initialization to complete
      while (this.initializing) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      if (this.db) return this.db;
      throw new Error("Database initialization failed");
    }

    this.initializing = true;

    try {
      console.log("[DatabaseService] Initializing...");

      // Step 1: Create/retrieve SQLite connection
      this.connection = await this.createConnection();
      console.log("[DatabaseService] SQLite connection established");

      // Step 2: Create Kysely instance
      this.db = this.createKyselyInstance();
      console.log("[DatabaseService] Kysely instance created");

      // Step 3: Run migrations
      this.migrator = new DatabaseMigrator(this.db);
      const migrationResult = await this.migrator.migrateToLatest();

      if (!migrationResult.success) {
        throw new Error(
          `Database migration failed: ${JSON.stringify(migrationResult.error)}`,
        );
      }

      this.initialized = true;
      console.log("[DatabaseService] Initialization complete!");

      return this.db;
    } catch (error) {
      console.error("[DatabaseService] Initialization failed:", error);
      // Clean up on failure
      this.db = null;
      this.migrator = null;
      this.connection = null;
      throw error;
    } finally {
      this.initializing = false;
    }
  }

  /**
   * Get the Kysely database instance.
   *
   * For reactive UI updates, use the wrapped methods that emit events:
   * - `insertWithEvent()`
   * - `updateWithEvent()`
   * - `deleteWithEvent()`
   *
   * @throws Error if database not initialized
   */
  public getDb(): Kysely<Database> {
    if (!this.db) {
      throw new Error("Database not initialized. Call dbService.init() first.");
    }
    return this.db;
  }

  /**
   * Get the database migrator for manual migration control.
   *
   * @throws Error if database not initialized
   */
  public getMigrator(): DatabaseMigrator {
    if (!this.migrator) {
      throw new Error("Database not initialized. Call dbService.init() first.");
    }
    return this.migrator;
  }

  /**
   * Get the raw SQLite connection for native operations.
   *
   * Use this for:
   * - `executeSet()` for high-performance bulk inserts
   * - Native SQLite features (PRAGMA, ATTACH DATABASE)
   * - Raw SQL when Kysely doesn't support something
   *
   * @throws Error if database not initialized
   */
  public getRawConnection(): SQLiteDBConnection {
    if (!this.connection) {
      throw new Error("Database not initialized. Call dbService.init() first.");
    }
    return this.connection;
  }

  /**
   * Check if the database is ready for use.
   */
  public isReady(): boolean {
    return this.initialized && this.db !== null;
  }

  /**
   * Close the database connection.
   *
   * Call this on app shutdown if needed.
   */
  public async close(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.close();
        console.log("[DatabaseService] Connection closed");
      } catch (error) {
        console.error("[DatabaseService] Error closing connection:", error);
      }
    }

    this.db = null;
    this.migrator = null;
    this.connection = null;
    this.initialized = false;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Reactive Helpers
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Execute a mutation and emit a table change event.
   *
   * Use this wrapper when you want UI components to auto-refresh.
   *
   * @example
   * ```ts
   * await dbService.executeWithEvent("tasks", "insert", async (db) => {
   *   await db.insertInto("tasks").values({ title: "New Task" }).execute();
   * });
   * ```
   */
  public async executeWithEvent<T>(
    table: string,
    changeType: ChangeType,
    executor: (db: Kysely<Database>) => Promise<T>,
  ): Promise<T> {
    const db = this.getDb();
    const result = await executor(db);
    emitTableChange(table, changeType);
    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────────────────────

  private async createConnection(): Promise<SQLiteDBConnection> {
    const dbName = import.meta.env.VITE_DB_FILENAME || "vueqa";

    let conn: SQLiteDBConnection;
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

  private createKyselyInstance(): Kysely<Database> {
    return new Kysely<Database>({
      dialect: new CapacitorSQLiteKyselyDialect(sqlite, {
        name: import.meta.env.VITE_DB_FILENAME || "vueqa",
      }),
    });
  }
}

/**
 * Singleton instance of DatabaseService.
 *
 * This is the main export you should use throughout your app.
 */
export const dbService = DatabaseService.getInstance();

/**
 * Export the class for testing or advanced use cases
 */
export { DatabaseService };

/**
 * Export the sqlite connection for direct access if needed
 */
export { sqlite };

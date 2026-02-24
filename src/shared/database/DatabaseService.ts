import { Kysely } from "kysely";
import CapacitorSQLiteKyselyDialect from "capacitor-sqlite-kysely";
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from "@capacitor-community/sqlite";
import { Capacitor } from "@capacitor/core";
import { Filesystem } from "@capacitor/filesystem";
import type { Database } from "./global.schema";
import { DatabaseMigrator } from "./migrator";
import { emitTableChange } from "./reactive/dbEvents";
import type { ChangeType } from "./reactive/types";

/**
 * SQLite connection singleton
 */
const sqlite = new SQLiteConnection(CapacitorSQLite);

export interface StorageInfo {
  /** Database size in bytes (page_count × page_size) */
  sizeBytes: number;
  /** Total number of pages */
  pageCount: number;
  /** Size of each page in bytes */
  pageSize: number;
  /** Human-readable size string (e.g. "2.4 MB") */
  sizeFormatted: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
  private backupUri: string | null = null;

  private constructor() {}

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
    if (this.initialized && this.db) {
      console.log(
        "[DatabaseService] Already initialized, returning existing instance",
      );
      return this.db;
    }

    if (this.initializing) {
      console.log("[DatabaseService] Initialization in progress, waiting...");
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

      // Step 3: Backup before migration (native only)
      const backupCreated = await this.backupBeforeMigration();

      // Step 4: Run migrations
      this.migrator = new DatabaseMigrator(this.db);
      const migrationResult = await this.migrator.migrateToLatest();

      if (!migrationResult.success) {
        // Restore backup if migration failed
        if (backupCreated) {
          console.warn(
            "[DatabaseService] Migration failed — restoring backup...",
          );
          await this.restoreFromBackup();
        }
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
   * Get database storage information.
   *
   * Uses SQLite PRAGMA to read actual file size on disk.
   * Useful for monitoring storage usage on field devices.
   *
   * @example
   * ```ts
   * const info = await dbService.getStorageInfo();
   * console.log(`DB size: ${info.sizeFormatted}`);
   * if (info.sizeBytes > 100 * 1024 * 1024) {
   *   // Warn: DB > 100 MB
   * }
   * ```
   */
  public async getStorageInfo(): Promise<StorageInfo> {
    const conn = this.getRawConnection();

    const [pageSizeResult, pageCountResult] = await Promise.all([
      conn.query("PRAGMA page_size;", []),
      conn.query("PRAGMA page_count;", []),
    ]);

    const pageSize = (pageSizeResult.values?.[0] as any)?.page_size ?? 4096;
    const pageCount = (pageCountResult.values?.[0] as any)?.page_count ?? 0;
    const sizeBytes = pageSize * pageCount;

    return {
      sizeBytes,
      pageCount,
      pageSize,
      sizeFormatted: formatBytes(sizeBytes),
    };
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

  /**
   * Execute a mutation and emit a table change event.
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

  /**
   * Backup the SQLite file before running migrations (native only).
   * Returns true if a backup was created, false if skipped.
   */
  private async backupBeforeMigration(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return false; // Web uses IndexedDB — no file to copy
    }

    try {
      const dbName = import.meta.env.VITE_DB_FILENAME || "vueqa";
      const { url } = await CapacitorSQLite.getUrl({
        database: dbName,
        readonly: false,
      });

      if (!url) {
        console.warn("[DatabaseService] Could not resolve DB URL for backup");
        return false;
      }

      const backupUrl = `${url}.bak`;

      await Filesystem.copy({ from: url, to: backupUrl });

      this.backupUri = backupUrl;
      console.log(`[DatabaseService] Pre-migration backup created: ${backupUrl}`);
      return true;
    } catch (err) {
      // Non-fatal: warn but continue — no backup is better than blocking startup
      console.warn("[DatabaseService] Pre-migration backup failed (continuing without backup):", err);
      return false;
    }
  }

  /**
   * Restore SQLite file from pre-migration backup (native only).
   * Called automatically when migration fails.
   */
  private async restoreFromBackup(): Promise<void> {
    if (!this.backupUri || !Capacitor.isNativePlatform()) return;

    try {
      const dbName = import.meta.env.VITE_DB_FILENAME || "vueqa";
      const { url } = await CapacitorSQLite.getUrl({
        database: dbName,
        readonly: false,
      });

      if (!url) return;

      await Filesystem.copy({ from: this.backupUri, to: url });
      console.log("[DatabaseService] Database restored from backup");
    } catch (err) {
      console.error("[DatabaseService] Failed to restore backup:", err);
    }
  }

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

    // Enable WAL mode for concurrent reads during writes.
    // WAL is persistent — only needs to be set once per database file,
    // but setting it on every open is safe (it's a no-op if already set).
    //
    // Must use conn.query() not conn.execute(): on Android, execute() maps to
    // execSQL which rejects statements that return a result set. PRAGMA
    // journal_mode=WAL returns the active mode, so query() is required.
    try {
      const result = await conn.query("PRAGMA journal_mode=WAL;", []);
      const mode = (result.values?.[0] as any)?.journal_mode ?? "unknown";
      console.log(`[DatabaseService] WAL mode active (journal_mode=${mode})`);
    } catch (err) {
      // Non-fatal — web (jeep-sqlite) may handle PRAGMAs differently
      console.warn("[DatabaseService] Could not enable WAL mode:", err);
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

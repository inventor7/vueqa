import { Migrator, type Migration, type MigrationProvider } from "kysely";
import type { Kysely } from "kysely";
import type { Database } from "./global.schema";

/**
 * Migration Provider for folder-based migrations.
 *
 * Supports two patterns:
 * 1. File-based: migrations/002_feature.ts
 * 2. Folder-based: migrations/001_schema/index.ts (recommended)
 *
 * Folder names starting with 000_ are skipped (templates).
 */
class DatabaseMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    const migrations: Record<string, Migration> = {};

    // Pattern 1: File-based migrations (XXX_name.ts)
    const fileMigrations = import.meta.glob<{
      up: Migration["up"];
      down: Migration["down"];
    }>("./migrations/*.ts", { eager: true });

    for (const [path, module] of Object.entries(fileMigrations)) {
      const fileName = path.split("/").pop()?.replace(".ts", "") ?? "";

      // Skip helper files and templates
      if (fileName.startsWith("_") || fileName.startsWith("000_")) {
        continue;
      }

      if (!module.up || !module.down) {
        console.warn(
          `[Migrator] Warning: Migration ${fileName} is missing up or down function`,
        );
        continue;
      }

      migrations[fileName] = {
        up: module.up,
        down: module.down,
      };
    }

    // Pattern 2: Folder-based migrations (XXX_name/index.ts) - RECOMMENDED
    const folderMigrations = import.meta.glob<{
      up: Migration["up"];
      down: Migration["down"];
    }>("./migrations/*/index.ts", { eager: true });

    for (const [path, module] of Object.entries(folderMigrations)) {
      // Extract folder name: "./migrations/001_demo_schema/index.ts" -> "001_demo_schema"
      const parts = path.split("/");
      const folderName = parts[parts.length - 2] ?? "";

      // Skip templates (000_)
      if (!folderName || folderName.startsWith("000_")) {
        continue;
      }

      if (!module.up || !module.down) {
        console.warn(
          `[Migrator] Warning: Migration ${folderName} is missing up or down function`,
        );
        continue;
      }

      // Check for naming conflicts
      if (migrations[folderName]) {
        console.error(
          `[Migrator] Error: Migration name conflict: ${folderName} exists as both file and folder`,
        );
        continue;
      }

      migrations[folderName] = {
        up: module.up,
        down: module.down,
      };
    }

    // Log discovered migrations
    const migrationNames = Object.keys(migrations).sort();
    if (migrationNames.length > 0) {
      console.log(
        `[Migrator] Discovered ${migrationNames.length} migration(s):`,
      );
      migrationNames.forEach((name) => {
        console.log(`  - ${name}`);
      });
    }

    return migrations;
  }
}

/**
 * Migration result type
 */
export interface MigrationResult {
  success: boolean;
  error?: unknown;
  results?: Array<{
    migrationName: string;
    status: "Success" | "Error" | "NotExecuted";
  }>;
}

/**
 * DatabaseMigrator
 *
 * Wrapper around Kysely's Migrator with enhanced logging and error handling.
 * Supports both file-based and folder-based migrations.
 *
 * @example
 * ```ts
 * const migrator = new DatabaseMigrator(db);
 * const result = await migrator.migrateToLatest();
 * if (!result.success) {
 *   console.error("Migration failed:", result.error);
 * }
 * ```
 */
export class DatabaseMigrator {
  private migrator: Migrator;

  constructor(db: Kysely<Database>) {
    this.migrator = new Migrator({
      db,
      provider: new DatabaseMigrationProvider(),
      migrationTableName: "kysely_migration",
      migrationLockTableName: "kysely_migration_lock",
    });
  }

  /**
   * Run all pending migrations.
   */
  async migrateToLatest(): Promise<MigrationResult> {
    try {
      console.log("[Migrator] Starting database migration...");

      const { error, results } = await this.migrator.migrateToLatest();

      if (error) {
        console.error("[Migrator] Migration failed:", error);
        return { success: false, error };
      }

      if (!results || results.length === 0) {
        console.log("[Migrator] Database is already up to date");
        return { success: true, results: [] };
      }

      // Log migration results
      const successCount = results.filter((r) => r.status === "Success").length;
      const errorCount = results.filter((r) => r.status === "Error").length;

      results.forEach((result) => {
        if (result.status === "Success") {
          console.log(
            `[Migrator] ✓ Migration ${result.migrationName} completed`,
          );
        } else {
          console.error(
            `[Migrator] ✗ Migration ${result.migrationName} failed`,
          );
        }
      });

      console.log(
        `[Migrator] Migration complete: ${successCount} succeeded, ${errorCount} failed`,
      );

      return {
        success: errorCount === 0,
        results: results.map((r) => ({
          migrationName: r.migrationName,
          status: r.status,
        })),
      };
    } catch (error) {
      console.error("[Migrator] Unexpected migration error:", error);
      return { success: false, error };
    }
  }

  /**
   * Rollback the last migration.
   * Use with caution in production!
   */
  async migrateDown(): Promise<MigrationResult> {
    try {
      console.log("[Migrator] Rolling back last migration...");

      const { error, results } = await this.migrator.migrateDown();

      if (error) {
        console.error("[Migrator] Rollback failed:", error);
        return { success: false, error };
      }

      if (results && results.length > 0) {
        results.forEach((result) => {
          console.log(
            `[Migrator] Rolled back migration: ${result.migrationName}`,
          );
        });
      }

      return { success: true };
    } catch (error) {
      console.error("[Migrator] Unexpected rollback error:", error);
      return { success: false, error };
    }
  }

  /**
   * Migrate to a specific migration version.
   * Use with caution in production!
   */
  async migrateTo(targetMigration: string): Promise<MigrationResult> {
    try {
      console.log(`[Migrator] Migrating to: ${targetMigration}...`);

      const { error, results } = await this.migrator.migrateTo(targetMigration);

      if (error) {
        console.error("[Migrator] Migration failed:", error);
        return { success: false, error };
      }

      if (results && results.length > 0) {
        results.forEach((result) => {
          console.log(`[Migrator] Applied migration: ${result.migrationName}`);
        });
      }

      return { success: true };
    } catch (error) {
      console.error("[Migrator] Unexpected migration error:", error);
      return { success: false, error };
    }
  }

  /**
   * Get all migrations with their execution status.
   */
  async getMigrations() {
    return await this.migrator.getMigrations();
  }
}

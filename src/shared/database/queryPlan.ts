/**
 * Dev-only query plan validation.
 *
 * Runs `EXPLAIN QUERY PLAN` on registered queries and warns when SQLite
 * does a full table scan (`SCAN TABLE`) instead of using an index
 * (`SEARCH TABLE USING INDEX`).
 *
 * Only active in development — all functions are no-ops in production.
 */

import type { SQLiteDBConnection } from "@capacitor-community/sqlite";

export interface QueryPlanRow {
  id: number;
  parent: number;
  notused: number;
  detail: string;
}

export interface QueryPlanResult {
  /** Descriptive name for the query (for display in devtools) */
  label: string;
  /** The SQL that was analysed */
  sql: string;
  /** Raw plan rows from EXPLAIN QUERY PLAN */
  plan: QueryPlanRow[];
  /** True if any plan row contains SCAN TABLE (missing index) */
  hasScan: boolean;
  /** The SCAN TABLE detail strings, for quick inspection */
  scanDetails: string[];
}

/** Global registry — call `registerQueryPlan()` at module level in dev. */
const registry = new Map<string, { sql: string; params?: unknown[] }>();

/**
 * Register a SQL query so the devtools panel can analyse it.
 *
 * No-op in production. Call this once per query, typically in the same
 * file that defines the composable that runs it.
 *
 * @example
 * ```ts
 * registerQueryPlan('tasks.pending',
 *   `SELECT * FROM tasks WHERE _sync_status = ? ORDER BY created_at DESC`,
 *   ['to_create']
 * );
 * ```
 */
export function registerQueryPlan(
  label: string,
  sql: string,
  params?: unknown[],
): void {
  if (!import.meta.env.DEV) return;
  registry.set(label, { sql, params });
}

/**
 * Run `EXPLAIN QUERY PLAN` on a single SQL string.
 *
 * @returns Plan result with scan warnings. Always returns a result — errors
 *          are captured in `scanDetails` rather than thrown.
 */
export async function explainQueryPlan(
  conn: SQLiteDBConnection,
  label: string,
  sql: string,
  params: unknown[] = [],
): Promise<QueryPlanResult> {
  try {
    const result = await conn.query(
      `EXPLAIN QUERY PLAN ${sql}`,
      params as any[],
    );

    const plan: QueryPlanRow[] = (result.values ?? []).map((row: any) => ({
      id: row.id ?? row[0] ?? 0,
      parent: row.parent ?? row[1] ?? 0,
      notused: row.notused ?? row[2] ?? 0,
      detail: row.detail ?? row[3] ?? "",
    }));

    const scanDetails = plan
      .map((r) => r.detail)
      .filter((d) => d.includes("SCAN TABLE") || d.includes("SCAN "));

    return {
      label,
      sql,
      plan,
      hasScan: scanDetails.length > 0,
      scanDetails,
    };
  } catch (err) {
    return {
      label,
      sql,
      plan: [],
      hasScan: false,
      scanDetails: [`Error: ${err instanceof Error ? err.message : String(err)}`],
    };
  }
}

/**
 * Run `EXPLAIN QUERY PLAN` on all registered queries.
 *
 * Call this from the MetricsDevTools panel. Returns an empty array in production.
 */
export async function analyseAllRegisteredPlans(
  conn: SQLiteDBConnection,
): Promise<QueryPlanResult[]> {
  if (!import.meta.env.DEV) return [];

  const results: QueryPlanResult[] = [];

  for (const [label, { sql, params }] of registry) {
    const result = await explainQueryPlan(conn, label, sql, params);
    results.push(result);
  }

  return results;
}

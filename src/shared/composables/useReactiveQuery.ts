/**
 * Production-ready reactive query composable.
 *
 * Features: selective refetch, caching, stale-while-revalidate, deduplication,
 * query cancellation, retry with exponential backoff.
 */

import { onTableChange } from "@/shared/database/reactive/dbEvents";
import type {
  ReactiveQueryOptions,
  TableChangeEvent,
} from "@/shared/database/reactive/types";
import { queryMetrics } from "./useQueryMetrics";

const DEFAULT_DEBOUNCE = 100;
const DEFAULT_RETRY_BASE = 1000;

const inFlightQueries = new Map<string, Promise<unknown>>();

/**
 * Auto-incrementing counter to ensure unique query keys when not explicitly provided.
 * This prevents deduplication collisions for different queries on the same tables.
 */
let queryIdCounter = 0;

function getRetryDelay(
  attempt: number,
  retryDelay?: number | ((attempt: number) => number),
): number {
  if (typeof retryDelay === "function") return retryDelay(attempt);
  if (typeof retryDelay === "number") return retryDelay;
  return DEFAULT_RETRY_BASE * Math.pow(2, attempt);
}

export function useReactiveQuery<T>(
  queryFn: () => Promise<T>,
  options: ReactiveQueryOptions<T>,
) {
  const data = ref<T | null>(null) as Ref<T | null>;
  const loading = ref(false);
  const error = ref<Error | null>(null);
  const isStale = ref(false);
  const lastFetchTime = ref<number>(0);
  const retryCount = ref(0);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let abortController: AbortController | null = null;
  const debounceMs = options.debounce ?? DEFAULT_DEBOUNCE;
  const enabled = options.enabled !== false;

  /**
   * Generate unique queryKey:
   * - If explicitly provided: use it (allows manual deduplication)
   * - Otherwise: generate unique key to prevent false deduplication
   *
   * This fixes the collision issue where multiple queries on the same tables
   * would incorrectly share results.
   */
  const queryKey = options.queryKey ?? `${options.tables.join(",")}:${++queryIdCounter}`;

  const cancelOnUnmount = options.cancelOnUnmount !== false;
  const maxRetries = options.retry === false ? 0 : (options.retry ?? 0);

  const cacheAge = computed(() => Date.now() - lastFetchTime.value);

  const isCacheValid = computed(() => {
    if (!options.cacheTime) return false;
    return cacheAge.value < options.cacheTime;
  });

  function cancel() {
    abortController?.abort();
    abortController = null;
  }

  async function executeQueryWithRetry(
    showLoading = true,
    attempt = 0,
  ): Promise<void> {
    // Request deduplication
    if (inFlightQueries.has(queryKey)) {
      if (options.debug) {
        console.log(`[useReactiveQuery] Deduping query: ${queryKey}`);
      }
      try {
        const result = (await inFlightQueries.get(queryKey)) as T;
        data.value = result;
        queryMetrics.recordCacheHit();
      } catch {
        // Error already handled by original promise
      }
      return;
    }

    // Cancel previous request
    cancel();
    abortController = new AbortController();

    if (options.staleWhileRevalidate && data.value !== null) {
      isStale.value = true;
    } else {
      loading.value = showLoading;
    }

    error.value = null;
    retryCount.value = attempt;
    const startTime = performance.now();

    const queryPromise = queryFn();
    inFlightQueries.set(queryKey, queryPromise);

    try {
      const result = await queryPromise;

      // Check if aborted
      if (abortController?.signal.aborted) {
        return;
      }

      data.value = result;
      lastFetchTime.value = Date.now();
      isStale.value = false;
      retryCount.value = 0;

      const duration = performance.now() - startTime;
      queryMetrics.recordQuery(queryKey, duration);

      if (options.debug) {
        console.log(
          `[useReactiveQuery] Query executed (${duration.toFixed(1)}ms):`,
          result,
        );
      }

      options.onSuccess?.(result);
    } catch (err) {
      // Check if aborted
      if (abortController?.signal.aborted) {
        return;
      }

      const errorObj = err instanceof Error ? err : new Error(String(err));

      // Retry logic
      if (attempt < maxRetries) {
        const delay = getRetryDelay(attempt, options.retryDelay);
        if (options.debug) {
          console.log(
            `[useReactiveQuery] Retry ${attempt + 1}/${maxRetries} in ${delay}ms`,
          );
        }
        await new Promise((r) => setTimeout(r, delay));
        return executeQueryWithRetry(showLoading, attempt + 1);
      }

      error.value = errorObj;
      isStale.value = false;

      console.error("[useReactiveQuery] Query failed:", err);
      queryMetrics.recordError(queryKey);
      options.onError?.(errorObj);
    } finally {
      loading.value = false;
      inFlightQueries.delete(queryKey);
    }
  }

  function scheduledRefetch() {
    if (isCacheValid.value) {
      if (options.debug) {
        console.log("[useReactiveQuery] Cache valid, skipping refetch");
      }
      queryMetrics.recordCacheHit();
      return;
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      queryMetrics.recordRefetch(options.tables[0] ?? "unknown");
      executeQueryWithRetry();
      debounceTimer = null;
    }, debounceMs);
  }

  async function refetch() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    await executeQueryWithRetry();
  }

  function invalidate() {
    lastFetchTime.value = 0;
    return refetch();
  }

  function shouldTriggerRefetch(event: TableChangeEvent): boolean {
    if (options.refetchOn && !options.refetchOn.includes(event.type)) {
      if (options.debug) {
        console.log(
          `[useReactiveQuery] Skipping ${event.type} (not in refetchOn)`,
        );
      }
      return false;
    }

    if (options.shouldRefetch && !options.shouldRefetch(event)) {
      if (options.debug) {
        console.log(
          "[useReactiveQuery] Skipping (shouldRefetch returned false)",
        );
      }
      return false;
    }

    return true;
  }

  let unsubscribe: (() => void) | null = null;

  onMounted(() => {
    if (enabled) {
      executeQueryWithRetry();

      unsubscribe = onTableChange(options.tables, (event) => {
        if (options.debug) {
          console.log("[useReactiveQuery] Table changed:", event);
        }

        if (!shouldTriggerRefetch(event)) return;
        scheduledRefetch();
      });

      queryMetrics.incrementListeners();
    }
  });

  onUnmounted(() => {
    unsubscribe?.();
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    if (cancelOnUnmount) {
      cancel();
    }

    if (enabled) {
      queryMetrics.decrementListeners();
    }
  });

  return {
    data,
    loading,
    error,
    isStale,
    isCacheValid,
    cacheAge,
    retryCount,
    refetch,
    invalidate,
    cancel,
  };
}

/** Structural query - only refetches on insert/delete. */
export function useStructuralQuery<T>(
  queryFn: () => Promise<T>,
  tables: string[],
  options?: Partial<Omit<ReactiveQueryOptions<T>, "tables" | "refetchOn">>,
) {
  return useReactiveQuery(queryFn, {
    tables,
    refetchOn: ["insert", "delete"],
    ...options,
  });
}

/** Static query - manual refresh only. */
export function useStaticQuery<T>(
  queryFn: () => Promise<T>,
  tables: string[],
  options?: Partial<Omit<ReactiveQueryOptions<T>, "tables" | "enabled">>,
) {
  return useReactiveQuery(queryFn, {
    tables,
    enabled: false,
    ...options,
  });
}

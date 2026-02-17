/**
 * Query performance metrics tracking.
 * Provides visibility into query execution times, cache hits, and refetch rates.
 */

import { reactive, computed } from "vue";

interface QueryMetric {
  count: number;
  totalTime: number;
  avgTime: number;
  lastTime: number;
  lastAccessTime: number; // For LRU eviction
}

interface MetricsState {
  queries: Record<string, QueryMetric>;
  errors: Record<string, number>;
  cacheHits: number;
  refetchesByTable: Record<string, number>;
  activeListeners: number;
  startTime: number;
  isDevToolsOpen: boolean;
}

/**
 * Maximum number of query metrics to track.
 * Prevents unbounded memory growth in long-running apps.
 */
const MAX_QUERIES = 200;
const MAX_ERRORS = 100;
const MAX_REFETCH_TABLES = 50;

const state = reactive<MetricsState>({
  queries: {},
  errors: {},
  cacheHits: 0,
  refetchesByTable: {},
  activeListeners: 0,
  startTime: Date.now(),
  isDevToolsOpen: false,
});

/**
 * Evict least recently used entry when limit is reached.
 * Uses LRU strategy based on lastAccessTime.
 */
function evictLRU<T extends { lastAccessTime?: number }>(
  records: Record<string, T>,
  maxEntries: number,
): void {
  const entries = Object.entries(records);
  if (entries.length < maxEntries) return;

  // Find entry with oldest lastAccessTime
  let oldestKey: string | null = null;
  let oldestTime = Date.now();

  for (const [key, value] of entries) {
    const accessTime = value.lastAccessTime ?? 0;
    if (accessTime < oldestTime) {
      oldestTime = accessTime;
      oldestKey = key;
    }
  }

  if (oldestKey) {
    delete records[oldestKey];
  }
}

/**
 * Simple eviction for records without access time tracking
 */
function evictOldest<T>(
  records: Record<string, T>,
  maxEntries: number,
): void {
  const keys = Object.keys(records);
  if (keys.length >= maxEntries && keys[0]) {
    delete records[keys[0]];
  }
}

export const queryMetrics = {
  recordQuery(queryKey: string, durationMs: number) {
    // Evict LRU entry if at capacity
    if (!state.queries[queryKey]) {
      evictLRU(state.queries, MAX_QUERIES);
      state.queries[queryKey] = {
        count: 0,
        totalTime: 0,
        avgTime: 0,
        lastTime: 0,
        lastAccessTime: Date.now(),
      };
    }

    const metric = state.queries[queryKey];
    metric.count++;
    metric.totalTime += durationMs;
    metric.avgTime = metric.totalTime / metric.count;
    metric.lastTime = durationMs;
    metric.lastAccessTime = Date.now(); // Update access time
  },

  recordError(queryKey: string) {
    // Evict oldest error if at capacity
    if (!state.errors[queryKey]) {
      evictOldest(state.errors, MAX_ERRORS);
    }
    state.errors[queryKey] = (state.errors[queryKey] ?? 0) + 1;
  },

  recordCacheHit() {
    state.cacheHits++;
  },

  recordRefetch(table: string) {
    // Evict oldest refetch entry if at capacity
    if (!state.refetchesByTable[table]) {
      evictOldest(state.refetchesByTable, MAX_REFETCH_TABLES);
    }
    state.refetchesByTable[table] = (state.refetchesByTable[table] ?? 0) + 1;
  },

  incrementListeners() {
    state.activeListeners++;
  },

  decrementListeners() {
    if (state.activeListeners > 0) {
      state.activeListeners--;
    }
  },

  reset() {
    state.queries = {};
    state.errors = {};
    state.cacheHits = 0;
    state.refetchesByTable = {};
    state.startTime = Date.now();
  },

  getState() {
    return state;
  },

  toggleDevTools(isOpen?: boolean) {
    state.isDevToolsOpen = isOpen ?? !state.isDevToolsOpen;
  },
};

export function useQueryMetrics() {
  const totalQueries = computed(() =>
    Object.values(state.queries).reduce((sum, m) => sum + m.count, 0),
  );

  const avgQueryTime = computed(() => {
    const metrics = Object.values(state.queries);
    if (metrics.length === 0) return 0;
    const totalTime = metrics.reduce((sum, m) => sum + m.totalTime, 0);
    const totalCount = metrics.reduce((sum, m) => sum + m.count, 0);
    return totalCount > 0 ? totalTime / totalCount : 0;
  });

  const cacheHitRate = computed(() => {
    const total = totalQueries.value + state.cacheHits;
    return total > 0 ? (state.cacheHits / total) * 100 : 0;
  });

  const refetchesByTable = computed(() => ({ ...state.refetchesByTable }));

  const queriesByKey = computed(() => ({ ...state.queries }));

  const uptime = computed(() => Date.now() - state.startTime);

  const activeListeners = computed(() => state.activeListeners);

  const errors = computed(() => ({ ...state.errors }));

  const slowestQueries = computed(() => {
    return Object.entries(state.queries)
      .map(([key, metric]) => ({ key, ...metric }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 5);
  });

  const isDevToolsOpen = computed(() => state.isDevToolsOpen);

  return {
    totalQueries,
    avgQueryTime,
    cacheHitRate,
    refetchesByTable,
    queriesByKey,
    slowestQueries,
    errors,
    activeListeners,
    uptime,
    isDevToolsOpen,
    reset: queryMetrics.reset,
    toggleDevTools: queryMetrics.toggleDevTools,
  };
}

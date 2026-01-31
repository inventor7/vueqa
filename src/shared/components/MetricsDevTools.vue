<script setup lang="ts">
import { useQueryMetrics } from "@/shared/composables/useQueryMetrics";

const {
  totalQueries,
  avgQueryTime,
  cacheHitRate,
  refetchesByTable,
  queriesByKey,
  uptime,
  reset,
  isDevToolsOpen,
  toggleDevTools,
  slowestQueries,
  errors,
  activeListeners,
} = useQueryMetrics();

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / 60000) % 60;
  const hours = Math.floor(ms / 3600000);
  return `${hours}h ${minutes}m ${seconds}s`;
}

function exportMetrics() {
  const data = {
    totalQueries: totalQueries.value,
    avgQueryTime: avgQueryTime.value,
    cacheHitRate: cacheHitRate.value,
    refetchesByTable: refetchesByTable.value,
    queriesByKey: queriesByKey.value,
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `query-metrics-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <F7Panel
    right
    reveal
    :opened="isDevToolsOpen"
    @panel:closed="toggleDevTools(false)"
  >
    <F7Page>
      <F7Navbar title="Query Metrics">
        <template #right>
          <F7Link
            panel-close
            icon-ios="f7:xmark"
            icon-md="material:close"
            @click="toggleDevTools(false)"
          />
        </template>
      </F7Navbar>

      <F7BlockTitle>Overview</F7BlockTitle>
      <F7List strong-ios outline-ios dividers-ios>
        <F7ListItem header="Uptime" :title="formatUptime(uptime)" />
        <F7ListItem header="Total Queries" :title="String(totalQueries)" />
        <F7ListItem
          header="Avg Query Time"
          :title="`${avgQueryTime.toFixed(1)}ms`"
        />
        <F7ListItem
          header="Cache Hit Rate"
          :title="`${cacheHitRate.toFixed(1)}%`"
        />
        <F7ListItem
          header="Active Listeners"
          :title="String(activeListeners)"
        />
      </F7List>

      <template v-if="slowestQueries.length > 0">
        <F7BlockTitle>🐢 Slowest Queries</F7BlockTitle>
        <F7List strong-ios outline-ios dividers-ios>
          <F7ListItem
            v-for="query in slowestQueries"
            :key="query.key"
            :title="query.key"
            :footer="`Avg: ${query.avgTime.toFixed(1)}ms`"
          />
        </F7List>
      </template>

      <template v-if="Object.keys(errors).length > 0">
        <F7BlockTitle class="text-red-500">⚠️ Errors</F7BlockTitle>
        <F7List strong-ios outline-ios dividers-ios>
          <F7ListItem
            v-for="(count, key) in errors"
            :key="key"
            :title="key"
            :after="String(count)"
            class="text-red-600"
          />
        </F7List>
      </template>

      <template v-if="Object.keys(refetchesByTable).length > 0">
        <F7BlockTitle>Refetches by Table</F7BlockTitle>
        <F7List strong-ios outline-ios dividers-ios>
          <F7ListItem
            v-for="(count, table) in refetchesByTable"
            :key="table"
            :title="String(table)"
            :after="String(count)"
          />
        </F7List>
      </template>

      <template v-if="Object.keys(queriesByKey).length > 0">
        <F7BlockTitle>Queries by Key</F7BlockTitle>
        <F7List strong-ios outline-ios dividers-ios>
          <F7ListItem
            v-for="(metric, key) in queriesByKey"
            :key="key"
            :title="String(key)"
            :footer="`${metric.count}x, avg ${metric.avgTime.toFixed(1)}ms`"
          />
        </F7List>
      </template>

      <F7Block>
        <div class="grid grid-cols-2 grid-gap">
          <F7Button fill color="red" @click="reset">Clear</F7Button>
          <F7Button fill @click="exportMetrics">Export JSON</F7Button>
        </div>
      </F7Block>
    </F7Page>
  </F7Panel>
</template>

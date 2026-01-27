<template>
  <F7BlockTitle>Benchmark Results</F7BlockTitle>
  <F7Block strong class="rounded-2xl!">
    <div
      v-if="results.sqlite.time !== null || results.indexedDb.time !== null"
      class="space-y-4"
    >
      <div>
        <h3 class="text-xl font-bold text-green-600">SQLite Result</h3>
        <p>
          Execution Time:
          <span class="font-mono p-1 bg-gray-200 rounded"
            >{{ results.sqlite.time }} ms</span
          >
        </p>
        <pre
          class="mt-2 p-2 bg-gray-100 rounded-lg overflow-auto text-xs"
        ><code>{{ results.sqlite.data }}</code></pre>
      </div>
      <hr />
      <div>
        <h3 class="text-xl font-bold text-red-600">IndexedDB Result</h3>
        <p>
          Execution Time:
          <span class="font-mono p-1 bg-gray-200 rounded"
            >{{ results.indexedDb.time }} ms</span
          >
        </p>
        <pre
          class="mt-2 p-2 bg-gray-10 rounded-lg overflow-auto text-xs"
        ><code>{{ results.indexedDb.data }}</code></pre>
      </div>
    </div>
    <div v-else class="text-center text-gray-500">
      Results will be displayed here.
    </div>
  </F7Block>
</template>

<script setup lang="ts">
import type { BenchmarkState } from "@/modules/home/composables/useBenchmark";

defineProps<{
  results: BenchmarkState;
}>();
</script>

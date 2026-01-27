<template>
  <F7Page>
    <F7Navbar title="Offline Benchmark" large transparent :sliding="true">
    </F7Navbar>

    <DatabaseSetup
      :is-setting-up-s-q-lite="isSettingUpSQLite"
      :is-setting-up-indexed-d-b="isSettingUpIndexedDB"
      :setup-message="setupMessage"
      :setup-timings="setupTimings"
      @setup-sqlite="setupSQLite"
      @setup-indexed-db="setupIndexedDB"
    />

    <BenchmarkControls
      :is-benchmarking="isBenchmarking"
      :is-setup-complete="isSetupComplete"
      @run-benchmark="runBenchmarks"
    />

    <BenchmarkResults :results="benchmarkResults" />

    <DatabaseManagement
      :is-clearing-s-q-lite="isClearingSQLite"
      :is-clearing-indexed-d-b="isClearingIndexedDB"
      @clear-sqlite="clearSQLite"
      @clear-indexed-db="clearIndexedDB"
    />
  </F7Page>
</template>

<script setup lang="ts">
import { useBenchmark } from "@/modules/demo/composables/useBenchmark";
import DatabaseSetup from "@/modules/demo/components/DatabaseSetup.vue";
import BenchmarkControls from "@/modules/demo/components/BenchmarkControls.vue";
import BenchmarkResults from "@/modules/demo/components/BenchmarkResults.vue";
import DatabaseManagement from "@/modules/demo/components/DatabaseManagement.vue";

const {
  isSettingUpSQLite,
  isSettingUpIndexedDB,
  isBenchmarking,
  setupMessage,
  isSetupComplete,
  isClearingSQLite,
  isClearingIndexedDB,
  setupTimings,
  benchmarkResults,
  setupSQLite,
  setupIndexedDB,
  clearSQLite,
  clearIndexedDB,
  runBenchmarks,
} = useBenchmark();
</script>

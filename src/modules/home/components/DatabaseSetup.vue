<template>
  <F7BlockTitle>Database Setup</F7BlockTitle>
  <F7Block strong class="rounded-2xl!">
    <p>
      First, set up the databases. This will create a complex schema of 10+
      tables and populate them with thousands of records. This step may take a
      moment.
    </p>
    <div class="grid grid-cols-2 gap-4 mb-4">
      <F7Button fill @click="$emit('setup-sqlite')" :loading="isSettingUpSQLite"
        >Setup SQLite</F7Button
      >
      <F7Button
        fill
        @click="$emit('setup-indexed-db')"
        :loading="isSettingUpIndexedDB"
        >Setup IndexedDB</F7Button
      >
    </div>
    <div v-if="setupMessage" class="mt-4 text-center text-gray-500">
      {{ setupMessage }}
    </div>
    <div
      class="mt-4 grid grid-cols-2 gap-4"
      v-if="setupTimings.sqlite || setupTimings.indexedDb"
    >
      <div
        v-if="setupTimings.sqlite"
        class="text-center p-2 bg-green-100 rounded-lg"
      >
        <p class="font-bold text-green-600">SQLite Setup Time</p>
        <p class="font-mono">{{ setupTimings.sqlite }} ms</p>
      </div>
      <div
        v-if="setupTimings.indexedDb"
        class="text-center p-2 bg-red-100 rounded-lg"
      >
        <p class="font-bold text-red-600">IndexedDB Setup Time</p>
        <p class="font-mono">{{ setupTimings.indexedDb }} ms</p>
      </div>
    </div>
  </F7Block>
</template>

<script setup lang="ts">
import type { BenchmarkResult } from "@/modules/home/composables/useBenchmark";

defineProps<{
  isSettingUpSQLite: boolean;
  isSettingUpIndexedDB: boolean;
  setupMessage: string;
  setupTimings: {
    sqlite: string | null;
    indexedDb: string | null;
  };
}>();

defineEmits(["setup-sqlite", "setup-indexed-db"]);
</script>

<template>
  <F7BlockTitle>Database Management</F7BlockTitle>
  <F7Block strong class="rounded-2xl!">
    <p>Clear databases if you want to reset the benchmark:</p>
    <div class="grid grid-cols-2 gap-4 mt-4">
      <F7Button
        fill
        color="red"
        @click="$emit('clear-sqlite')"
        :loading="isClearingSQLite"
        >Clear SQLite</F7Button
      >
      <F7Button
        fill
        color="red"
        @click="$emit('clear-indexed-db')"
        :loading="isClearingIndexedDB"
        >Clear IndexedDB</F7Button
      >
    </div>
  </F7Block>
</template>

<script setup lang="ts">
defineProps<{
  isClearingSQLite: boolean;
  isClearingIndexedDB: boolean;
}>();

defineEmits(["clear-sqlite", "clear-indexed-db"]);
</script>

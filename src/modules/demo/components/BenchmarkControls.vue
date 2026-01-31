<template>
  <F7BlockTitle>Run Benchmark</F7BlockTitle>
  <F7Block strong class="rounded-2xl!">
    <p>
      Now, run the benchmark. This executes a complex query to find the top 5
      customers by total sales value in a specific region. The time taken for
      each database will be displayed below.
    </p>
    <F7Button
      large
      fill
      @click="$emit('run-benchmark')"
      :loading="isBenchmarking"
    >
      Run Complex Query Benchmark
    </F7Button>
  </F7Block>
</template>

<script setup lang="ts">
defineProps<{
  isBenchmarking: boolean;
  isSetupComplete: boolean;
}>();

defineEmits(["run-benchmark"]);
</script>

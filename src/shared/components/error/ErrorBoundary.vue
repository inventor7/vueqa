<template>
  <div
    v-if="error"
    class="p-4 bg-red-50 rounded-lg border border-red-200 text-center"
  >
    <F7Icon
      f7="exclamationmark_triangle_fill"
      size="48"
      class="text-red-500 mb-2"
    />
    <h3 class="font-bold text-red-700 text-lg mb-1">Something went wrong</h3>
    <p class="text-red-600 mb-4">{{ error.message }}</p>
    <F7Button fill color="red" @click="resetError">Try Again</F7Button>
  </div>
  <slot v-else></slot>
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from "vue";

const error = ref<Error | null>(null);

onErrorCaptured((err) => {
  error.value = err as Error;
  // Prevent the error from propagating further
  return false;
});

const resetError = () => {
  error.value = null;
};
</script>

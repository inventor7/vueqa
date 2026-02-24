import { type Ref } from "vue";
/**
 * Progressive image loading composable.
 *
 * Strategy for product/partner photo lists:
 * 1. Render thumbnail immediately (base64 from SQLite or a tiny placeholder)
 * 2. Load full image from filesystem on demand (user scrolls to it / taps)
 * 3. Swap once the full image is cached in the browser
 *
 * @example Basic usage in a product list item
 * ```vue
 * <template>
 *   <img :src="src" :class="{ 'blur-sm': !isReady }" @click="loadFull" />
 * </template>
 *
 * <script setup lang="ts">
 * const { src, isReady, loadFull } = useProgressiveImage({
 *   thumbnail: product.thumbnail_b64,   // base64 stored in SQLite
 *   fullSrc: product.image_path,         // filesystem path or URL
 * });
 * </script>
 * ```
 *
 * @example Auto-load full image when element enters viewport
 * ```vue
 * <img :src="src" v-intersection-observer="loadFull" />
 * ```
 */

export interface ProgressiveImageOptions {
  /** Immediate source — base64 thumbnail from SQLite, or a tiny placeholder URL. */
  thumbnail?: string | null;
  /** High-res source to load lazily — filesystem path, remote URL, or data URI. */
  fullSrc?: string | null;
  /**
   * Load the full image automatically when the composable is created.
   * Default: `false` — call `loadFull()` manually or via IntersectionObserver.
   */
  eager?: boolean;
}

export interface ProgressiveImageState {
  /** Current image src to bind to `<img :src>`. Starts as thumbnail, swaps to full. */
  src: Readonly<Ref<string>>;
  /** True once the full image has loaded and `src` has been swapped. */
  isReady: Readonly<Ref<boolean>>;
  /** True while the full image is being fetched. */
  isLoading: Readonly<Ref<boolean>>;
  /** Trigger the full image load. Safe to call multiple times. */
  loadFull: () => void;
}

const PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3C/svg%3E";

export function useProgressiveImage(
  options: ProgressiveImageOptions,
): ProgressiveImageState {
  const { thumbnail, fullSrc, eager = false } = options;

  const src = ref<string>(thumbnail ?? PLACEHOLDER);
  const isReady = ref(false);
  const isLoading = ref(false);

  let loadStarted = false;

  function loadFull(): void {
    if (loadStarted || isReady.value || !fullSrc) return;
    loadStarted = true;
    isLoading.value = true;

    const img = new Image();

    img.onload = () => {
      src.value = fullSrc;
      isReady.value = true;
      isLoading.value = false;
    };

    img.onerror = () => {
      // Keep showing thumbnail on error
      isLoading.value = false;
    };

    img.src = fullSrc;
  }

  if (eager) {
    loadFull();
  }

  return {
    src: readonly(src),
    isReady: readonly(isReady),
    isLoading: readonly(isLoading),
    loadFull,
  };
}

/**
 * Convert a `Filesystem.readFile()` result to a displayable base64 data URI.
 *
 * @example
 * ```ts
 * const file = await Filesystem.readFile({ path: imagePath, directory: Directory.Data });
 * const uri = toDataUri(file.data, 'image/jpeg');
 * ```
 */
export function toDataUri(base64: string, mimeType = "image/jpeg"): string {
  // readFile returns raw base64 without prefix on some Capacitor versions
  if (base64.startsWith("data:")) return base64;
  return `data:${mimeType};base64,${base64}`;
}

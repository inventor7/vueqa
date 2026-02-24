<script setup lang="ts">
/**
 * Progressive image component.
 *
 * Shows a thumbnail (base64 from SQLite or a 1×1 placeholder) immediately,
 * then automatically loads the full image once the element enters the
 * viewport via IntersectionObserver. Applies a `blur-sm → blur-0` transition
 * when the full image is ready.
 *
 * Pass `eager` to bypass the IntersectionObserver and load the full
 * image immediately (useful for above-the-fold hero images).
 *
 * Non-class/style attrs (e.g. `width`, `loading`) fall through to `<img>`.
 *
 * @example Product thumbnail list item
 * ```vue
 * <ProgressiveImage
 *   :thumbnail="product.thumbnail_b64"
 *   :full-src="product.image_path"
 *   alt="Product photo"
 *   class="w-12 h-12 rounded-lg object-cover"
 * />
 * ```
 *
 * @example Eager load (e.g. hero image)
 * ```vue
 * <ProgressiveImage :full-src="banner.url" eager class="w-full h-48 object-cover" />
 * ```
 */
import { useProgressiveImage } from "@/shared/composables/useProgressiveImage";

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  /** Base64 thumbnail stored in SQLite — displayed instantly. */
  thumbnail?: string | null;
  /** Full-resolution image URL or filesystem path — loaded lazily. */
  fullSrc?: string | null;
  alt?: string;
  /** Skip IntersectionObserver and load the full image right away. */
  eager?: boolean;
}>();

const { src, isReady, loadFull } = useProgressiveImage({
  thumbnail: props.thumbnail,
  fullSrc: props.fullSrc,
  eager: props.eager,
});

const imgEl = ref<HTMLImageElement | null>(null);

// Load full image when the element scrolls into view.
useIntersectionObserver(imgEl, ([entry]) => {
  if (entry?.isIntersecting) loadFull();
});
</script>

<template>
  <img
    ref="imgEl"
    :src="src"
    :alt="alt"
    v-bind="$attrs"
    :class="[
      $attrs.class,
      'transition-[filter] duration-300',
      !isReady && 'blur-sm',
    ]"
  />
</template>

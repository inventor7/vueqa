/**
 * Diffed query composable - only updates items that changed.
 * Optimized for large lists where individual item changes should not
 * trigger full re-renders.
 */

import { useReactiveQuery } from "./useReactiveQuery";
import type { ReactiveQueryOptions } from "@/shared/database/reactive/types";

type ItemWithId = { id: string | number };

function defaultIsEqual<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function diffArrays<T extends ItemWithId>(
  prev: T[],
  next: T[],
  isEqual: (a: T, b: T) => boolean,
): { added: T[]; removed: T[]; updated: T[]; unchanged: T[] } {
  const prevMap = new Map(prev.map((item) => [item.id, item]));
  const nextMap = new Map(next.map((item) => [item.id, item]));

  const added: T[] = [];
  const removed: T[] = [];
  const updated: T[] = [];
  const unchanged: T[] = [];

  for (const [id, item] of nextMap) {
    const prevItem = prevMap.get(id);
    if (!prevItem) {
      added.push(item);
    } else if (!isEqual(prevItem, item)) {
      updated.push(item);
    } else {
      unchanged.push(item);
    }
  }

  for (const [id, item] of prevMap) {
    if (!nextMap.has(id)) {
      removed.push(item);
    }
  }

  return { added, removed, updated, unchanged };
}

export interface DiffedQueryOptions<T> extends ReactiveQueryOptions<T[]> {
  isEqual?: (a: T, b: T) => boolean;
}

export function useDiffedQuery<T extends ItemWithId>(
  queryFn: () => Promise<T[]>,
  options: DiffedQueryOptions<T>,
) {
  const isEqualFn = options.isEqual ?? defaultIsEqual;

  const diffStats = ref({
    added: 0,
    removed: 0,
    updated: 0,
    unchanged: 0,
    lastDiffTime: 0,
  });

  const stableData = shallowRef<T[]>([]);

  const query = useReactiveQuery<T[]>(queryFn, {
    ...options,
    onSuccess: (newData) => {
      const prev = stableData.value;
      const { added, removed, updated, unchanged } = diffArrays(
        prev,
        newData,
        isEqualFn,
      );

      diffStats.value = {
        added: added.length,
        removed: removed.length,
        updated: updated.length,
        unchanged: unchanged.length,
        lastDiffTime: Date.now(),
      };

      // Only update if there are actual changes
      if (added.length > 0 || removed.length > 0 || updated.length > 0) {
        // Merge: keep unchanged refs, add new/updated items
        const nextMap = new Map(newData.map((item) => [item.id, item]));
        const merged = prev
          .filter((item) => nextMap.has(item.id))
          .map((item) => {
            const newItem = nextMap.get(item.id)!;
            return isEqualFn(item, newItem) ? item : newItem;
          });

        // Add truly new items
        for (const item of added) {
          merged.push(item);
        }

        stableData.value = merged;
      }

      options.onSuccess?.(newData);
    },
  });

  return {
    ...query,
    data: stableData,
    diffStats,
  };
}

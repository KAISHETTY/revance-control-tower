import { useSyncExternalStore } from "react";

function mediaStore(query: string) {
  return {
    subscribe: (cb: () => void) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    get: () => window.matchMedia(query).matches,
  };
}

const reduced = mediaStore("(prefers-reduced-motion: reduce)");
const coarse = mediaStore("(pointer: coarse)");

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(reduced.subscribe, reduced.get, () => false);
}

export function useIsCoarsePointer(): boolean {
  return useSyncExternalStore(coarse.subscribe, coarse.get, () => false);
}

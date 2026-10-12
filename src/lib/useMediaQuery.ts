"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Vero finché la finestra rispetta la media query (per esempio «(min-width: 1024px)»); sul server è falso. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", notify);
      return () => media.removeEventListener("change", notify);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

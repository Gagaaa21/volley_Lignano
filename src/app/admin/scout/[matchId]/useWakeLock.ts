"use client";

import { useEffect } from "react";

/**
 * Tiene acceso lo schermo finché si segna la partita: a bordo campo il telefono
 * altrimenti si spegne a metà set. Se il browser non lo permette (o il
 * risparmio energia è attivo) non succede niente; si riprende da soli quando
 * si torna sulla pagina.
 */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || sentinel || document.visibilityState !== "visible") return;
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void lock.release();
          return;
        }
        sentinel = lock;
        lock.addEventListener("release", () => {
          if (sentinel === lock) sentinel = null;
        });
      } catch {
        // Non permesso o risparmio energia: pazienza.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release();
      sentinel = null;
    };
  }, [enabled]);
}

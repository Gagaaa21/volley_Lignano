"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PwaInstallContextValue {
  canInstall: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
}

const PwaInstallContext = createContext<PwaInstallContextValue>({
  canInstall: false,
  isIOS: false,
  isStandalone: false,
  promptInstall: async () => "unavailable",
});

export function usePwaInstall(): PwaInstallContextValue {
  return useContext(PwaInstallContext);
}

function subscribeStandalone(onChange: () => void) {
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", onChange);
  window.addEventListener("appinstalled", onChange);
  return () => {
    media.removeEventListener("change", onChange);
    window.removeEventListener("appinstalled", onChange);
  };
}
function getStandaloneSnapshot() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
function getServerSnapshotFalse() {
  return false;
}

function subscribeNever() {
  return () => {};
}
function getIsIOSSnapshot() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

/** Vero solo dopo l'hydration/quando cambia, evita disallineamenti col markup del server. */
function useIsStandalone(): boolean {
  return useSyncExternalStore(subscribeStandalone, getStandaloneSnapshot, getServerSnapshotFalse);
}
function useIsIOS(): boolean {
  return useSyncExternalStore(subscribeNever, getIsIOSSnapshot, getServerSnapshotFalse);
}

/**
 * Cattura l'evento beforeinstallprompt una sola volta, in cima all'albero, e lo
 * condivide (banner + pulsante sempre visibile in header) invece di registrare
 * più listener che si contenderebbero lo stesso evento.
 */
export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const isStandalone = useIsStandalone();
  const isIOS = useIsIOS();

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstallEvent(null);

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
    if (!installEvent) return "unavailable";
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice.catch(() => ({ outcome: "dismissed" as const }));
    setInstallEvent(null);
    return outcome;
  }

  return (
    <PwaInstallContext.Provider
      value={{ canInstall: installEvent !== null, isIOS, isStandalone, promptInstall }}
    >
      {children}
    </PwaInstallContext.Provider>
  );
}

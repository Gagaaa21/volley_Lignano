"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PwaInstallContextValue {
  canInstall: boolean;
  isIOS: boolean;
  isAndroidNonChrome: boolean;
  isStandalone: boolean;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
}

const PwaInstallContext = createContext<PwaInstallContextValue>({
  canInstall: false,
  isIOS: false,
  isAndroidNonChrome: false,
  isStandalone: false,
  promptInstall: async () => "unavailable",
});

export function usePwaInstall(): PwaInstallContextValue {
  return useContext(PwaInstallContext);
}

/** Intent Android che riapre la pagina corrente in Chrome, unico modo per far
 * scegliere al browser cosa aprirla invece del browser non-Chrome attuale. */
export function buildOpenInChromeUrl(): string {
  const urlWithoutScheme = window.location.href.replace(/^https?:\/\//, "");
  return `intent://${urlWithoutScheme}#Intent;scheme=https;package=com.android.chrome;end`;
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

// Samsung Internet e altri browser Android non-Chrome generano da soli il
// pacchetto WebAPK con una targetSdkVersion datata: da Android 14 in su
// Play Protect lo blocca come "app non sicura", anche scegliendo "Installa
// comunque". Il pacchetto generato da Chrome non ha questo problema, quindi
// per questi browser conviene indirizzare all'installazione da Chrome.
const ANDROID_WEBAPK_BROKEN_BROWSER = /SamsungBrowser|MiuiBrowser|HuaweiBrowser|HeyTapBrowser|OppoBrowser|VivoBrowser|UCBrowser|OPR\//i;
function getIsAndroidNonChromeSnapshot() {
  const ua = window.navigator.userAgent;
  return /android/i.test(ua) && ANDROID_WEBAPK_BROKEN_BROWSER.test(ua);
}

/** Vero solo dopo l'hydration/quando cambia, evita disallineamenti col markup del server. */
function useIsStandalone(): boolean {
  return useSyncExternalStore(subscribeStandalone, getStandaloneSnapshot, getServerSnapshotFalse);
}
function useIsIOS(): boolean {
  return useSyncExternalStore(subscribeNever, getIsIOSSnapshot, getServerSnapshotFalse);
}
function useIsAndroidNonChrome(): boolean {
  return useSyncExternalStore(subscribeNever, getIsAndroidNonChromeSnapshot, getServerSnapshotFalse);
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
  const isAndroidNonChrome = useIsAndroidNonChrome();

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
      value={{ canInstall: installEvent !== null, isIOS, isAndroidNonChrome, isStandalone, promptInstall }}
    >
      {children}
    </PwaInstallContext.Provider>
  );
}

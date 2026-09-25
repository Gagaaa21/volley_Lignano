"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Bell, Download, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { buildOpenInChromeUrl, usePwaInstall } from "./PwaInstallContext";
import type { TrainingTeam } from "@/lib/types";

const INSTALL_PROMPTED_KEY = "vl-pwa-install-prompted";
const NOTIFY_PROMPTED_KEY = "vl-pwa-notify-prompted";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function subscribeToPush(team: TrainingTeam) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
  });

  const json = subscription.toJSON();
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, team }),
  }).catch(() => {});
}

function computeInitialStep(): "install" | "notify" {
  if (typeof window === "undefined") return "install";
  return localStorage.getItem(INSTALL_PROMPTED_KEY) === "1" ? "notify" : "install";
}

function subscribeNever() {
  return () => {};
}
function getClientSnapshot() {
  return true;
}
function getServerSnapshot() {
  return false;
}

/** Vero solo dopo l'hydration, per evitare markup diverso tra server e client. */
function useMounted(): boolean {
  return useSyncExternalStore(subscribeNever, getClientSnapshot, getServerSnapshot);
}

/** Legge il cookie non httpOnly che rispecchia lo switcher squadra
 * dell'area riservata (vedi setActiveTeamCookie in lib/auth/session.ts):
 * unico modo per questo componente client di sapere quale squadra sia
 * attiva, dato che il cookie di sessione vero è httpOnly. Assente = mai
 * cambiata dal default "u14u15". */
function readActiveTeamCookie(): TrainingTeam {
  if (typeof document === "undefined") return "u14u15";
  const match = document.cookie.match(/(?:^|;\s*)volley_active_team=([^;]+)/);
  return match?.[1] === "minivolley" ? "minivolley" : "u14u15";
}

function isNotifyEligible(): boolean {
  if (typeof window === "undefined") return false;
  if (localStorage.getItem(NOTIFY_PROMPTED_KEY) === "1") return false;
  const supported = "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
  return supported && Notification.permission === "default";
}

export function PwaClient() {
  const mounted = useMounted();
  const [step, setStep] = useState<"install" | "notify" | "done">(computeInitialStep);
  const { canInstall, isAndroidNonChrome, isStandalone, promptInstall } = usePwaInstall();
  const pathname = usePathname();
  // Sul sito pubblico la squadra si legge dall'URL; nell'area riservata,
  // dove l'URL non la indica più (un solo pannello per entrambe le
  // squadre), dallo switcher nell'header tramite il suo cookie.
  const team: TrainingTeam = pathname?.startsWith("/minivolley")
    ? "minivolley"
    : pathname?.startsWith("/admin")
      ? readActiveTeamCookie()
      : "u14u15";

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (step !== "install") return;
    const timeout = setTimeout(() => {
      if (!canInstall) setStep("notify");
    }, 2500);
    return () => clearTimeout(timeout);
  }, [step, canInstall]);

  const showInstallBanner = mounted && step === "install" && canInstall && !isStandalone;
  const showNotifyBanner = mounted && step === "notify" && isNotifyEligible();

  async function handleInstall(accept: boolean) {
    localStorage.setItem(INSTALL_PROMPTED_KEY, "1");
    if (accept) {
      // Samsung Internet e simili generano un pacchetto che Android blocca per
      // sicurezza (vedi PwaInstallContext): meglio mandarli su Chrome, dove
      // l'installazione funziona correttamente, invece di far fallire quella nativa.
      if (isAndroidNonChrome) {
        window.location.href = buildOpenInChromeUrl();
        return;
      }
      await promptInstall();
    }
    setStep("notify");
  }

  async function handleNotify(accept: boolean) {
    localStorage.setItem(NOTIFY_PROMPTED_KEY, "1");
    if (accept) {
      try {
        const permission = await Notification.requestPermission();
        if (permission === "granted") await subscribeToPush(team);
      } catch {
        // ignora: l'utente resta comunque libero di attivarle dopo dal browser
      }
    }
    setStep("done");
  }

  if (!showInstallBanner && !showNotifyBanner) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4 sm:px-6">
      <div className="auth-card w-full max-w-md rounded-2xl border border-border-subtle bg-surface p-4 shadow-[0_20px_50px_-20px_rgba(9,27,38,0.35)] sm:p-5">
        {showInstallBanner && (
          <div className="flex items-start gap-3">
            <span className="icon-chip shrink-0">
              <Download className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-bold text-foreground">Installa l&apos;app</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {isAndroidNonChrome
                  ? "Il tuo browser blocca l'installazione per un problema noto di Android: apri il sito in Chrome per installarlo senza avvisi."
                  : "Aggiungi Volley Lignano alla schermata Home per un accesso più rapido."}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" onClick={() => handleInstall(true)}>
                  {isAndroidNonChrome ? "Apri in Chrome" : "Installa"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleInstall(false)}>
                  No grazie
                </Button>
              </div>
            </div>
            <button
              type="button"
              aria-label="Chiudi"
              onClick={() => handleInstall(false)}
              className="shrink-0 rounded-full p-1 text-foreground/40 hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {showNotifyBanner && (
          <div className="flex items-start gap-3">
            <span className="icon-chip shrink-0">
              <Bell className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-bold text-foreground">Attiva le notifiche</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {team === "minivolley"
                  ? "Ricevi un avviso quando allenamenti o tornei cambiano in calendario."
                  : "Ricevi un avviso quando allenamenti o partite cambiano in calendario."}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" onClick={() => handleNotify(true)}>
                  Attiva
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleNotify(false)}>
                  No grazie
                </Button>
              </div>
            </div>
            <button
              type="button"
              aria-label="Chiudi"
              onClick={() => handleNotify(false)}
              className="shrink-0 rounded-full p-1 text-foreground/40 hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

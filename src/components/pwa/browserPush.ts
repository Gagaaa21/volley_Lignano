import type { PushDeps } from "@/lib/pwa/teamPush";

/** L'ultimo passo delle iscrizioni che non è riuscito (lo mostra la pagina «Notifiche», per capire cosa non va). */
export const PUSH_ERROR_KEY = "vl-pwa-push-error";

export interface PushError {
  at: string;
  step: string;
  message: string;
}

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
}

/** Annota un passo non riuscito: dal browser non arriva niente di più utile di questo, e a chi aiuta serve saperlo. */
export function noteError(step: string, error: unknown) {
  try {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    const entry: PushError = { at: new Date().toISOString(), step, message: message.slice(0, 300) };
    localStorage.setItem(PUSH_ERROR_KEY, JSON.stringify(entry));
  } catch {
    // Archivio non disponibile: pazienza.
  }
}

export function lastPushError(): PushError | null {
  try {
    const raw = localStorage.getItem(PUSH_ERROR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PushError>;
    return typeof parsed.at === "string" && typeof parsed.step === "string" && typeof parsed.message === "string" ? (parsed as PushError) : null;
  } catch {
    return null;
  }
}

/** Quello che le funzioni di src/lib/pwa/teamPush.ts usano del browser. */
export function browserPushDeps(pathname: string): PushDeps {
  return {
    serviceWorker: navigator.serviceWorker,
    storage: localStorage,
    send: async (method, body) => {
      try {
        const response = await fetch("/api/push/subscribe", {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        return response.ok;
      } catch {
        return false;
      }
    },
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    now: () => Date.now(),
    iosApp: (navigator as Navigator & { standalone?: boolean }).standalone === true,
    pathname,
    coldStart: document.referrer === "",
    report: noteError,
  };
}

/** Esegue un'operazione sulle iscrizioni: se il browser non collabora (archivio bloccato, worker che non parte) si annota e basta. */
export async function withPushDeps<T>(pathname: string, task: (deps: PushDeps) => Promise<T>): Promise<T | undefined> {
  try {
    return await task(browserPushDeps(pathname));
  } catch (error) {
    noteError("operazione", error);
    return undefined;
  }
}

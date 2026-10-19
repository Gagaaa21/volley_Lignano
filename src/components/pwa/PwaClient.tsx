"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Bell, Download, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { buildOpenInChromeUrl, usePwaInstall } from "./PwaInstallContext";
import { OVERLAY_PATH } from "@/lib/diretta/overlayEvents";
import { hasTeamSubscription, subscribeTeam, syncPush } from "@/lib/pwa/teamPush";
import { pushSupported, withPushDeps } from "./browserPush";
import type { TrainingTeam } from "@/lib/types";

const INSTALL_PROMPTED_KEY = "vl-pwa-install-prompted";
/** Timestamp (ms) dell'ultima volta che il banner "Attiva le notifiche" è
 * stato mostrato — sostituisce il vecchio flag booleano "chiesto una volta
 * sola": chi non ha ancora concesso il permesso lo rivede una volta a
 * settimana, invece di restare per sempre senza notifiche per aver chiuso
 * il banner una volta per sbaglio. Chi lo ha già concesso (o negato dal
 * browser) non lo rivede comunque, perché isNotifyEligible controlla lo
 * stato reale di Notification.permission, non solo questo timestamp. */
const NOTIFY_LAST_PROMPTED_KEY = "vl-pwa-notify-last-prompted-at";
const NOTIFY_REPROMPT_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
/** Ultima «richiesta di attivazione» del Developer (Centro di controllo) già
 * vista da questo browser: se sul server ce n'è una più recente, il banner
 * ricompare subito, senza aspettare i 7 giorni. Si confrontano i valori
 * dell'istante scritto dal server, non gli orologi: nessun problema di fuso. */
const NOTIFY_CAMPAIGN_SEEN_KEY = "vl-pwa-notify-campaign-seen";
/** Quando l'invito ad attivare le notifiche di una squadra (permesso già dato, ma niente iscrizione per lei) è stato mostrato
 * l'ultima volta: una chiave per squadra, così chiuderlo in un sito non lo nasconde nell'altro. */
const inviteKey = (team: TrainingTeam) => `vl-pwa-notify-invited-at:${team}`;

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

/** Il browser supporta le notifiche e l'utente non ha ancora deciso (né
 * concesso né negato): solo allora ha senso chiedere. */
function canAskForNotifications(): boolean {
  if (typeof window === "undefined") return false;
  const supported = "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
  return supported && Notification.permission === "default";
}

/**
 * Il permesso per le notifiche c'è già (dato da un'altra squadra o da un'altra app dello stesso sito) ma questa squadra non ha
 * ancora la sua iscrizione: ogni squadra si attiva per conto suo, quindi dal suo sito si invita ad attivarla (al massimo una
 * volta a settimana). Solo sulla pagina iniziale di una squadra: né nell'area riservata, né in «Accedi», «Diretta» o «Notifiche».
 */
function isTeamInviteDue(team: TrainingTeam, pathname: string | null, subscribed: boolean | null): boolean {
  if (subscribed !== false || !pushSupported() || Notification.permission !== "granted") return false;
  if (pathname !== "/" && pathname !== "/minivolley") return false;
  const last = Number(localStorage.getItem(inviteKey(team)) ?? "0");
  return Date.now() - last >= NOTIFY_REPROMPT_INTERVAL_MS;
}

function isNotifyEligible(promptCampaign: string | null): boolean {
  if (!canAskForNotifications()) return false;
  // Richiesta del Developer non ancora vista da questo browser: si chiede subito.
  if (promptCampaign && localStorage.getItem(NOTIFY_CAMPAIGN_SEEN_KEY) !== promptCampaign) return true;
  const lastPrompted = Number(localStorage.getItem(NOTIFY_LAST_PROMPTED_KEY) ?? "0");
  return Date.now() - lastPrompted >= NOTIFY_REPROMPT_INTERVAL_MS;
}

export function PwaClient() {
  const mounted = useMounted();
  const [step, setStep] = useState<"install" | "notify" | "done">(computeInitialStep);
  // Istante dell'ultima «richiesta di attivazione» inviata dal Developer, se c'è.
  const [promptCampaign, setPromptCampaign] = useState<string | null>(null);
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

  // La grafica della diretta video (letta da OBS) deve restare pulita: niente avvisi sopra il video, niente service worker.
  const overlay = pathname?.startsWith(OVERLAY_PATH) ?? false;
  // Chi guarda la diretta (pagina /diretta) non vuole avvisi sopra il video.
  const watching = pathname?.startsWith("/diretta") ?? false;

  useEffect(() => {
    if (overlay) return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, [overlay]);

  // Chi ha già dato il permesso: si sistemano le iscrizioni vecchie (una volta) e si tengono vive quelle che ci sono. Nell'area
  // riservata l'account di chi è entrato si associa alle iscrizioni del dispositivo. Mai un cambio di squadra: le notifiche di
  // U14/U15 e quelle di Minivolley sono due cose distinte, ognuna si attiva dal sito della sua squadra, e il selettore squadra
  // dell'area riservata non sposta niente (vedi src/lib/pwa/teamPush.ts).
  const admin = pathname?.startsWith("/admin") ?? false;
  const syncedAs = useRef<"admin" | "public" | null>(null);
  useEffect(() => {
    if (overlay || !pushSupported() || Notification.permission !== "granted") return;
    const mode = admin ? "admin" : "public";
    if (syncedAs.current === mode) return;
    syncedAs.current = mode;
    void withPushDeps(pathname ?? "/", (deps) => syncPush(deps, { admin }));
  }, [overlay, admin, pathname]);

  // La squadra di questa pagina ha già la sua iscrizione su questo dispositivo? (solo con il permesso già dato)
  const [subscription, setSubscription] = useState<{ team: TrainingTeam; has: boolean } | null>(null);
  const teamSubscribed = subscription?.team === team ? subscription.has : null;
  useEffect(() => {
    if (overlay || admin || !pushSupported() || Notification.permission !== "granted") return;
    let cancelled = false;
    void withPushDeps(pathname ?? "/", (deps) => hasTeamSubscription(deps, team)).then((has) => {
      if (!cancelled && has !== undefined) setSubscription({ team, has });
    });
    return () => {
      cancelled = true;
    };
  }, [overlay, admin, team, pathname]);

  // Solo chi può ancora attivare le notifiche chiede al server se c'è una
  // richiesta nuova: per tutti gli altri nessuna chiamata in più.
  useEffect(() => {
    if (!canAskForNotifications()) return;
    fetch("/api/push/prompt", { cache: "no-cache" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { at?: string | null } | null) => {
        if (typeof data?.at === "string") setPromptCampaign(data.at);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (step !== "install") return;
    const timeout = setTimeout(() => {
      if (!canInstall) setStep("notify");
    }, 2500);
    return () => clearTimeout(timeout);
  }, [step, canInstall]);

  const showInstallBanner = mounted && step === "install" && canInstall && !isStandalone;
  const showNotifyBanner =
    mounted && step === "notify" && (isNotifyEligible(promptCampaign) || isTeamInviteDue(team, pathname, teamSubscribed));

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
    localStorage.setItem(NOTIFY_LAST_PROMPTED_KEY, String(Date.now()));
    localStorage.setItem(inviteKey(team), String(Date.now()));
    if (promptCampaign) localStorage.setItem(NOTIFY_CAMPAIGN_SEEN_KEY, promptCampaign);
    if (accept) {
      try {
        const permission = await Notification.requestPermission();
        // Si attivano le notifiche della squadra di questa pagina, e solo quelle.
        if (permission === "granted" && (await withPushDeps(pathname ?? "/", (deps) => subscribeTeam(deps, team, { chosen: true })))) {
          setSubscription({ team, has: true });
        }
      } catch {
        // ignora: l'utente resta comunque libero di attivarle dopo dal browser
      }
    }
    setStep("done");
  }

  if (watching || (!showInstallBanner && !showNotifyBanner)) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4 sm:px-6">
      <div className="w-full max-w-md animate-[pop-in_220ms_ease-out] rounded-2xl border border-border bg-card p-4 shadow-pop sm:p-5">
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
                <Button size="sm" variant="quiet" onClick={() => handleInstall(false)}>
                  No grazie
                </Button>
              </div>
            </div>
            <button
              type="button"
              aria-label="Chiudi"
              onClick={() => handleInstall(false)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
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
                <Button size="sm" variant="quiet" onClick={() => handleNotify(false)}>
                  No grazie
                </Button>
              </div>
            </div>
            <button
              type="button"
              aria-label="Chiudi"
              onClick={() => handleNotify(false)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

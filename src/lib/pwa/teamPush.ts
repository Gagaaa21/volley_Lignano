import type { TrainingTeam } from "@/lib/types";

/**
 * Notifiche push per squadra: U14/U15 e Minivolley sono due cose distinte, anche sullo stesso telefono.
 *
 * Il browser dà una sola iscrizione per service worker. Prima ce n'era uno solo («/sw.js»), quindi un dispositivo seguiva una
 * sola squadra alla volta e il selettore dell'area riservata (o aver aperto l'altro sito) la cambiava: chi aveva installato
 * tutte e due le app si ritrovava gli avvisi di U14 anche in quella di Minivolley. Ora ogni squadra ha il suo worker, quindi la
 * sua iscrizione: `/sw.js` (portata «/») per U14/U15 e `/sw-s3.js` (portata «/minivolley») per Minivolley. Un dispositivo può
 * averle tutte e due, ognuna si attiva solo dal sito della sua squadra e niente la sposta: né il selettore squadra, né
 * l'accesso all'area riservata, che si limita ad associare l'account dello staff alle iscrizioni che già ci sono.
 *
 * Le funzioni lavorano su un `PushDeps` (service worker, archivio e chiamate al sito) passato da chi le usa: così si provano
 * senza browser (vedi unit/team-push.spec.ts).
 */

export interface PushWorker {
  script: string;
  scope: string;
}

export const PUSH_WORKERS: Record<TrainingTeam, PushWorker> = {
  u14u15: { script: "/sw.js", scope: "/" },
  minivolley: { script: "/sw-s3.js", scope: "/minivolley" },
};

export const PUSH_TEAMS: TrainingTeam[] = ["u14u15", "minivolley"];

/** Le squadre per cui questo browser ha attivato le notifiche (elenco JSON): serve a rifare un'iscrizione cancellata dal browser. */
export const PUSH_TEAMS_KEY = "vl-pwa-push-teams";
/** Com'era prima: una squadra sola per browser. Si legge ancora, per chi aveva già attivato le notifiche. */
export const LEGACY_PUSH_TEAM_KEY = "vl-pwa-push-team";
/** Quando l'iscrizione è stata controllata l'ultima volta (fuori dall'area riservata, al massimo una volta al giorno). */
export const PUSH_SYNCED_AT_KEY = "vl-pwa-push-synced-at";
export const PUSH_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** Fatto una volta per browser: l'iscrizione di chi seguiva Minivolley passa dal worker di «/» a quello di Minivolley. */
const PUSH_MOVED_KEY = "vl-pwa-push-v2";
/** Su iPhone/iPad ogni app della schermata Home ha il suo contenitore: qui si ricorda di quale squadra è questa. */
const APP_TEAM_KEY = "vl-pwa-app-team";
/** Fatto una volta per app Minivolley su iPhone/iPad: via l'iscrizione U14/U15 che il selettore squadra le aveva dato. */
const IOS_CLEANED_KEY = "vl-pwa-push-ios-cleaned";

export interface PushDeps {
  serviceWorker: {
    register(script: string, options: { scope: string }): Promise<ServiceWorkerRegistration>;
    getRegistration(clientURL: string): Promise<ServiceWorkerRegistration | undefined>;
  };
  storage: Pick<Storage, "getItem" | "setItem">;
  /** Chiamata a /api/push/subscribe: true se il sito ha risposto bene. */
  send(method: "POST" | "DELETE", body: Record<string, unknown>): Promise<boolean>;
  publicKey: string | undefined;
  now(): number;
  /** App aperta dalla schermata Home di iPhone o iPad. */
  iosApp: boolean;
  /** Percorso della pagina aperta (senza indirizzo del sito né parametri). */
  pathname: string;
}

function read(deps: PushDeps, key: string): string | null {
  try {
    return deps.storage.getItem(key);
  } catch {
    return null;
  }
}

function write(deps: PushDeps, key: string, value: string) {
  try {
    deps.storage.setItem(key, value);
  } catch {
    // Archivio non disponibile: nessun problema, si ricontrolla alla prossima visita.
  }
}

const isTeam = (value: unknown): value is TrainingTeam => value === "u14u15" || value === "minivolley";

export const isMinivolleyPath = (pathname: string) => pathname === "/minivolley" || pathname.startsWith("/minivolley/");

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

/** Le squadre per cui questo browser ha attivato le notifiche. */
export function rememberedTeams(deps: PushDeps): TrainingTeam[] {
  const raw = read(deps, PUSH_TEAMS_KEY);
  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return PUSH_TEAMS.filter((team) => parsed.includes(team));
    } catch {
      // Elenco rovinato: si riparte da quello vecchio, se c'è.
    }
  }
  const legacy = read(deps, LEGACY_PUSH_TEAM_KEY);
  return isTeam(legacy) ? [legacy] : [];
}

function saveTeams(deps: PushDeps, teams: TrainingTeam[]) {
  write(deps, PUSH_TEAMS_KEY, JSON.stringify(PUSH_TEAMS.filter((team) => teams.includes(team))));
}

function remember(deps: PushDeps, team: TrainingTeam) {
  const teams = rememberedTeams(deps);
  // Si scrive sempre: così l'elenco nuovo esiste e quello vecchio (una squadra sola) non conta più.
  saveTeams(deps, teams.includes(team) ? teams : [...teams, team]);
}

function forget(deps: PushDeps, team: TrainingTeam) {
  saveTeams(
    deps,
    rememberedTeams(deps).filter((other) => other !== team),
  );
}

/** Aspetta che il worker sia attivo (serve per iscriversi), ma non per sempre. */
async function activated(registration: ServiceWorkerRegistration, timeoutMs = 10_000): Promise<ServiceWorkerRegistration> {
  if (registration.active) return registration;
  const worker = registration.installing ?? registration.waiting;
  if (!worker || worker.state === "activated") return registration;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    worker.addEventListener("statechange", () => {
      if (worker.state === "activated" || worker.state === "redundant") {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  return registration;
}

const pathOf = (url: string) => {
  try {
    return new URL(url, "https://sito.invalid").pathname;
  } catch {
    return url;
  }
};

/**
 * Il worker di quella squadra. Con `create` lo registra (se non c'è) e lo aspetta; senza, restituisce solo quello che già
 * esiste: per Minivolley `getRegistration` risponderebbe con il worker di «/» (che copre anche «/minivolley»), che non è suo.
 */
async function registrationFor(deps: PushDeps, team: TrainingTeam, create: boolean): Promise<ServiceWorkerRegistration | null> {
  const { script, scope } = PUSH_WORKERS[team];
  if (create) return activated(await deps.serviceWorker.register(script, { scope }));
  const registration = await deps.serviceWorker.getRegistration(scope);
  return registration && pathOf(registration.scope) === scope ? registration : null;
}

/** L'iscrizione che questo dispositivo ha già per quella squadra, senza crearne una. */
export async function existingSubscription(deps: PushDeps, team: TrainingTeam): Promise<PushSubscription | null> {
  const registration = await registrationFor(deps, team, false);
  return registration ? registration.pushManager.getSubscription() : null;
}

export async function hasTeamSubscription(deps: PushDeps, team: TrainingTeam): Promise<boolean> {
  return (await existingSubscription(deps, team)) !== null;
}

/** Attiva le notifiche di una squadra su questo dispositivo, sul suo worker. true se il sito ha registrato l'iscrizione. */
export async function subscribeTeam(deps: PushDeps, team: TrainingTeam): Promise<boolean> {
  if (!deps.publicKey) return false;
  const registration = await registrationFor(deps, team, true);
  if (!registration) return false;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(deps.publicKey) as BufferSource,
  });
  const json = subscription.toJSON();
  const saved = await deps.send("POST", { endpoint: json.endpoint, keys: json.keys, team });
  if (saved) {
    remember(deps, team);
    write(deps, PUSH_SYNCED_AT_KEY, String(deps.now()));
  }
  return saved;
}

/** Toglie l'iscrizione di un worker, qui e sul sito. */
async function dropSubscription(deps: PushDeps, subscription: PushSubscription) {
  await subscription.unsubscribe().catch(() => false);
  await deps.send("DELETE", { endpoint: subscription.endpoint });
}

/**
 * Prima c'era un'iscrizione sola per browser, sul worker di «/», con la squadra scelta di volta in volta. Chi seguiva
 * Minivolley la teneva lì: la si passa al worker di Minivolley e si libera quello di «/», che resta di U14/U15. Una volta
 * sola per browser; se qualcosa non va non si segna come fatta e si riprova alla visita dopo.
 */
export async function moveLegacySubscription(deps: PushDeps): Promise<void> {
  if (read(deps, PUSH_MOVED_KEY) === "1") return;
  const legacy = read(deps, LEGACY_PUSH_TEAM_KEY);
  const root = await registrationFor(deps, "u14u15", false);
  // Nessun worker registrato (primissima visita): niente da spostare per ora, e non si dà per fatto.
  if (!root) return;
  const rootSubscription = await root.pushManager.getSubscription();
  if (rootSubscription && legacy === "minivolley") {
    if (!(await subscribeTeam(deps, "minivolley"))) return;
    await dropSubscription(deps, rootSubscription);
    forget(deps, "u14u15");
  } else if (rootSubscription) {
    remember(deps, "u14u15");
  }
  write(deps, PUSH_MOVED_KEY, "1");
}

/**
 * iPhone e iPad: ogni app della schermata Home ha un contenitore tutto suo, quindi si sa di che squadra è l'app (la pagina da
 * cui parte la prima volta: «/minivolley» o «/»). In un'app di Minivolley un'iscrizione U14/U15 non c'entra: ci era finita
 * perché l'area riservata dava all'iscrizione la squadra del selettore. Si toglie, una volta sola, e al suo posto c'è quella
 * di Minivolley. Fuori da iPhone/iPad (dove le app dello stesso sito condividono tutto) non si fa niente.
 */
export async function cleanIosMinivolleyApp(deps: PushDeps): Promise<void> {
  if (!deps.iosApp) return;
  let identity = read(deps, APP_TEAM_KEY);
  if (!isTeam(identity)) {
    identity = isMinivolleyPath(deps.pathname) ? "minivolley" : deps.pathname === "/" ? "u14u15" : null;
    if (identity) write(deps, APP_TEAM_KEY, identity);
  }
  if (identity !== "minivolley" || read(deps, IOS_CLEANED_KEY) === "1") return;
  const root = await registrationFor(deps, "u14u15", false);
  if (!root) return;
  const rootSubscription = await root.pushManager.getSubscription();
  if (rootSubscription) {
    if (!(await subscribeTeam(deps, "minivolley"))) return;
    await dropSubscription(deps, rootSubscription);
    forget(deps, "u14u15");
  }
  write(deps, IOS_CLEANED_KEY, "1");
}

/**
 * Le iscrizioni che il browser ha cancellato da sé (senza togliere il permesso) si rifanno senza chiedere niente, per le
 * stesse squadre di prima; con `refresh` quelle che ci sono si rinnovano anche sul sito (indirizzo e chiavi, mai squadra).
 */
export async function healTeams(deps: PushDeps, options: { refresh: boolean }): Promise<void> {
  for (const team of rememberedTeams(deps)) {
    const subscription = await existingSubscription(deps, team);
    if (!subscription) {
      await subscribeTeam(deps, team);
      continue;
    }
    if (!options.refresh) continue;
    const json = subscription.toJSON();
    await deps.send("POST", { endpoint: json.endpoint, keys: json.keys, team, refresh: true });
  }
}

/**
 * Nell'area riservata: l'account di chi è entrato si associa alle iscrizioni che il dispositivo ha già (così arrivano anche
 * gli avvisi riservati allo staff). Non ne crea e non cambia la squadra di nessuna.
 */
export async function linkStaff(deps: PushDeps): Promise<void> {
  for (const team of PUSH_TEAMS) {
    const subscription = await existingSubscription(deps, team);
    if (!subscription) continue;
    const json = subscription.toJSON();
    await deps.send("POST", { endpoint: json.endpoint, keys: json.keys, team, linkStaff: true });
  }
}

/**
 * Cosa si fa a ogni apertura del sito da chi ha già dato il permesso per le notifiche. Mai un cambio di squadra: al più si
 * sistemano le iscrizioni vecchie (una volta) e si tengono vive quelle che ci sono.
 */
export async function syncPush(deps: PushDeps, options: { admin: boolean }): Promise<void> {
  if (!deps.publicKey) return;
  await moveLegacySubscription(deps);
  await cleanIosMinivolleyApp(deps);
  if (options.admin) {
    await healTeams(deps, { refresh: false });
    await linkStaff(deps);
    return;
  }
  const lastSynced = Number(read(deps, PUSH_SYNCED_AT_KEY) ?? "0");
  if (deps.now() - lastSynced < PUSH_SYNC_INTERVAL_MS) return;
  await healTeams(deps, { refresh: true });
  write(deps, PUSH_SYNCED_AT_KEY, String(deps.now()));
}

"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { scoutReducer, type ScoutAction } from "@/lib/scout/actions";
import { addToArchive, archiveKey, isArchiveStale, parseArchive, withoutOldest, type ArchiveEntry, type ArchiveReason } from "@/lib/scout/archive";
import { newId } from "@/lib/scout/id";
import { backupKey, parseBackup, planStart, reconcile, sameScout, scoutContent, type LocalBackup } from "@/lib/scout/sync";
import type { MatchScout, ScoutData } from "@/lib/scout/types";

/**
 * Lo scout di una partita mentre la si segna: lo stato vive qui, e ogni
 * modifica parte da sola verso il server (una richiesta alla volta, dopo una
 * breve pausa) e intanto resta in una copia nel telefono. Con la rete che va e
 * viene non si perde niente:
 * - si riprova da soli, e una richiesta che non risponde si interrompe e si rifà (non resta mai appesa);
 * - se il server ha già i punti ma la risposta si è persa (o se due dispositivi hanno segnato in momenti diversi), le
 *   versioni si uniscono da sole: non si chiede e non si scarta niente;
 * - se la pagina viene chiusa a metà, alla riapertura si riparte dalla copia;
 * - solo se due persone hanno segnato cose diverse negli stessi momenti si chiede quale tenere, e l'altra resta nelle copie
 *   di recupero insieme a una copia per ogni set chiuso: qualunque versione sostituita si può sempre ripristinare.
 */

export type SyncStatus = "saved" | "saving" | "offline" | "conflict" | "denied" | "error";

export interface ScoutConflict {
  /** La versione che c'è ora sul server (null = nel frattempo è stata cancellata). */
  current: MatchScout | null;
  /** Quella di questo dispositivo. */
  mine: ScoutData;
}

/** `data` è quello che si vede e si modifica; `saved` l'ultimo che sappiamo essere sul server. */
interface SessionState {
  data: ScoutData;
  saved: ScoutData;
}

type SessionAction =
  | ScoutAction
  /** Quello inviato è arrivato al server. */
  | { type: "markSaved"; data: ScoutData }
  /** Si adotta una versione del server: niente da salvare. */
  | { type: "load"; data: ScoutData };

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  if (action.type === "markSaved") return { ...state, saved: action.data };
  if (action.type === "load") return { data: action.data, saved: action.data };
  const data = scoutReducer(state.data, action);
  return data === state.data ? state : { ...state, data };
}

/**
 * Lo stato dello scout vive in un unico posto, che la pagina legge e le funzioni asincrone (salvataggio, timer) leggono e
 * aggiornano nello stesso istante: così quello che si vede e quello che si salva sono sempre lo stesso oggetto, mai due
 * copie uguali ma diverse (che farebbero sembrare «da salvare» uno scout già salvato).
 */
interface SessionStore {
  get: () => SessionState;
  set: (next: SessionState) => void;
  subscribe: (listener: () => void) => () => void;
}

function createSessionStore(initial: SessionState): SessionStore {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (next) => {
      if (next === current) return;
      current = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const SAVE_DELAY_MS = 700;
/** Una richiesta che non risponde entro questo tempo si interrompe e si rifà. */
const SAVE_TIMEOUT_MS = 20_000;
/** Tornando sulla pagina (o tornando la rete), una richiesta in corso da più di così si considera appesa. */
const STUCK_AFTER_MS = 8_000;
const RETRY_START_MS = 2_000;
const RETRY_MAX_MS = 30_000;
/** Dopo un rifiuto che non passa da solo (sessione scaduta, dati rifiutati) si riprova piano, senza fermarsi. */
const SLOW_RETRY_MS = 15_000;
/** Quante unioni di fila si fanno da sole prima di chiedere (se un altro dispositivo salva di continuo). */
const MAX_AUTO_RECONCILES = 6;

/** L'istante di adesso: si chiama solo da tocchi, timer ed effetti, mai mentre si disegna la pagina. */
const clock = () => Date.now();

function readBackup(matchId: string): LocalBackup | null {
  try {
    return parseBackup(localStorage.getItem(backupKey(matchId)));
  } catch {
    return null;
  }
}

function writeBackup(matchId: string, backup: LocalBackup): boolean {
  try {
    localStorage.setItem(backupKey(matchId), JSON.stringify(backup));
    return true;
  } catch {
    // Memoria piena o non disponibile: resta solo il salvataggio sul server.
    return false;
  }
}

function clearBackup(matchId: string) {
  try {
    localStorage.removeItem(backupKey(matchId));
  } catch {
    // niente da fare
  }
}

function readArchive(matchId: string): ArchiveEntry[] {
  try {
    return parseArchive(localStorage.getItem(archiveKey(matchId)));
  } catch {
    return [];
  }
}

/** Scrive le copie di recupero; se lo spazio non basta si butta via la più vecchia e si riprova. */
function writeArchive(matchId: string, list: ArchiveEntry[]): ArchiveEntry[] {
  let current = list;
  for (;;) {
    try {
      localStorage.setItem(archiveKey(matchId), JSON.stringify(current));
      return current;
    } catch {
      if (current.length <= 1) return current;
      current = withoutOldest(current);
    }
  }
}

/**
 * Fa spazio nel telefono: la copia di una partita serve solo se ha modifiche non ancora salvate (una copia già salvata non
 * serve a niente: la versione buona sta sul server), e le copie di recupero di partite vecchie si buttano via. Le
 * modifiche non salvate non si toccano mai, di nessuna partita.
 */
function pruneStorage(currentMatchId: string) {
  try {
    const now = clock();
    const archivePrefix = archiveKey("");
    const backupPrefix = backupKey("");
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith(archivePrefix)) {
        if (key !== archiveKey(currentMatchId) && isArchiveStale(parseArchive(localStorage.getItem(key)), now)) localStorage.removeItem(key);
      } else if (key.startsWith(backupPrefix) && key !== backupKey(currentMatchId)) {
        let dirty = false;
        try {
          dirty = (JSON.parse(localStorage.getItem(key) ?? "null") as { dirty?: unknown } | null)?.dirty === true;
        } catch {
          dirty = false;
        }
        if (!dirty) localStorage.removeItem(key);
      }
    }
  } catch {
    // niente da fare
  }
}

function closedSets(data: ScoutData): number {
  return data.events.filter((event) => event.type === "setEnd").length;
}

type Problem = "offline" | "conflict" | "denied" | "error";

export function useScoutSession({
  matchId,
  initial,
  blank,
}: {
  matchId: string;
  /** Lo scout salvato sul server, se c'è. */
  initial: MatchScout | null;
  /** Da cui partire se non c'è: rosa precompilata, regole di default. */
  blank: ScoutData;
}) {
  const [store] = useState(() => {
    const data = initial ? scoutContent(initial) : blank;
    return createSessionStore({ data, saved: data });
  });
  const state = useSyncExternalStore(store.subscribe, store.get, store.get);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ScoutConflict | null>(null);
  const [archive, setArchive] = useState<ArchiveEntry[]>([]);

  // Riferimenti letti dalle funzioni asincrone, che non devono vedere uno stato vecchio.
  const versionRef = useRef<number | null>(initial?.version ?? null);
  const inFlightRef = useRef(false);
  const inFlightSinceRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const pausedRef = useRef(false);
  const hydratedRef = useRef(false);
  const reconcilesRef = useRef(0);
  const archiveRef = useRef<ArchiveEntry[]>([]);
  const closedSetsRef = useRef(initial ? closedSets(initial) : 0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelay = useRef(RETRY_START_MS);

  /** L'ultima versione di `save`, per richiamarla da se stessa e dai timer. */
  const saveRef = useRef<() => Promise<void>>(async () => {});

  /** Ogni modifica passa da qui e si vede subito, anche a chi legge senza passare dal disegno della pagina. */
  const dispatchSession = useCallback(
    (action: SessionAction) => {
      store.set(sessionReducer(store.get(), action));
    },
    [store],
  );

  /** Mette da parte una copia (per sostituirla o scartarla dopo, o per ritrovarla): non c'è niente da conservare se è vuota. */
  const keep = useCallback(
    (reason: ArchiveReason, data: ScoutData) => {
      if (data.events.length === 0) return;
      const entry: ArchiveEntry = { id: newId(), at: clock(), reason, data: scoutContent(data) };
      archiveRef.current = writeArchive(matchId, addToArchive(archiveRef.current, entry));
      setArchive(archiveRef.current);
    },
    [matchId],
  );

  const scheduleSave = useCallback((delay: number) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void saveRef.current(), delay);
  }, []);

  const save = useCallback(async () => {
    if (pausedRef.current || inFlightRef.current) return;
    const sending = store.get().data;
    if (sending === store.get().saved) return;
    inFlightRef.current = true;
    inFlightSinceRef.current = clock();
    const controller = new AbortController();
    abortRef.current = controller;
    // Una richiesta che non risponde non deve bloccare per sempre i salvataggi che seguono.
    const timeout = setTimeout(() => controller.abort(), SAVE_TIMEOUT_MS);
    let again = false;
    try {
      const response = await fetch(`/api/scout/${matchId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: scoutContent(sending), baseVersion: versionRef.current }),
        cache: "no-store",
        signal: controller.signal,
      });

      if (response.ok) {
        const json = (await response.json()) as { version: number };
        versionRef.current = json.version;
        retryDelay.current = RETRY_START_MS;
        reconcilesRef.current = 0;
        dispatchSession({ type: "markSaved", data: sending });
        setProblem(null);
        setMessage(null);
        again = store.get().data !== sending;
        // Tutto è sul server: la copia nel telefono non serve più (e non occupa spazio).
        if (!again) clearBackup(matchId);
      } else if (response.status === 409) {
        const json = (await response.json()) as { current: MatchScout | null };
        const latest = store.get().data;
        if (!json.current) {
          // Nel frattempo è stato cancellato dal server: si ricrea con quello che c'è su questo dispositivo.
          versionRef.current = null;
          again = true;
        } else if (sameScout(json.current, sending)) {
          // Era già arrivato: è andata persa la risposta, non la richiesta.
          versionRef.current = json.current.version;
          reconcilesRef.current = 0;
          dispatchSession({ type: "markSaved", data: sending });
          setProblem(null);
          again = store.get().data !== sending;
          if (!again) clearBackup(matchId);
        } else {
          // Il server ha una versione diversa: si guarda cosa è cambiato. Se uno dei due ha solo cose in più (di solito
          // il salvataggio era arrivato ma la risposta no) o se hanno cose di momenti diversi, si tiene tutto; si chiede
          // solo se due persone hanno segnato cose diverse negli stessi momenti.
          const verdict = reconcile(scoutContent(json.current), latest);
          if (verdict.kind === "conflict" || reconcilesRef.current >= MAX_AUTO_RECONCILES) {
            pausedRef.current = true;
            setConflict({ current: json.current, mine: latest });
            setProblem("conflict");
          } else {
            reconcilesRef.current += 1;
            versionRef.current = json.current.version;
            if (verdict.kind === "merged") {
              keep("unione", scoutContent(json.current));
              keep("unione", latest);
            }
            if (verdict.kind === "server" && sameScout(json.current, verdict.data)) {
              // Il server aveva già tutto quello che c'è qui: si adotta, niente da salvare (e la copia nel telefono non serve).
              dispatchSession({ type: "load", data: scoutContent(json.current) });
              clearBackup(matchId);
            } else if (!sameScout(latest, verdict.data)) {
              dispatchSession({ type: "replace", data: verdict.data });
            }
            setProblem(null);
            // Si salva subito sulla versione nuova (fra un attimo: il tempo di aggiornare la pagina).
            scheduleSave(150);
          }
        }
      } else if (response.status === 401 || response.status === 403) {
        setProblem("denied");
        setMessage(
          response.status === 401
            ? "La sessione è scaduta: accedi di nuovo. Le modifiche restano su questo dispositivo."
            : "Non hai più accesso allo Scout. Le modifiche restano su questo dispositivo.",
        );
        // Dopo aver rifatto l'accesso (anche da un'altra scheda) il salvataggio riparte da solo.
        if (retryTimer.current) clearTimeout(retryTimer.current);
        retryTimer.current = setTimeout(() => void saveRef.current(), SLOW_RETRY_MS);
      } else if (response.status >= 400 && response.status < 500) {
        const json = (await response.json().catch(() => null)) as { error?: string } | null;
        setProblem("error");
        setMessage(json?.error ?? "Non riesco a salvare questa partita.");
        // Anche così non ci si ferma: i punti restano nel telefono e si riprova piano.
        if (retryTimer.current) clearTimeout(retryTimer.current);
        retryTimer.current = setTimeout(() => void saveRef.current(), SLOW_RETRY_MS);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch {
      // Rete assente, richiesta interrotta o server in difficoltà: si riprova con attese sempre più lunghe.
      setProblem("offline");
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => void saveRef.current(), retryDelay.current);
      retryDelay.current = Math.min(retryDelay.current * 2, RETRY_MAX_MS);
    } finally {
      clearTimeout(timeout);
      abortRef.current = null;
      inFlightRef.current = false;
    }
    // Nel frattempo ci sono state altre modifiche: si salvano subito.
    if (again) void saveRef.current();
  }, [matchId, store, dispatchSession, keep, scheduleSave]);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  // All'apertura: se nel telefono ci sono modifiche rimaste a metà si riparte da lì.
  useEffect(() => {
    hydratedRef.current = true;
    pruneStorage(matchId);
    // Le copie nel telefono si leggono solo nel browser, dopo l'apertura.
    archiveRef.current = readArchive(matchId);
    setArchive(archiveRef.current);
    const backup = readBackup(matchId);
    if (backup && !backup.dirty) clearBackup(matchId);
    const plan = planStart(initial, backup);
    // Il server ha già tutto quello che aveva la copia del telefono: la copia non serve più.
    if (plan.kind === "server" && backup?.dirty) clearBackup(matchId);
    if (plan.kind === "local" && backup) {
      if (plan.merged && initial) {
        keep("unione", scoutContent(initial));
        keep("unione", backup.data);
      }
      // La copia diventa lo stato attuale: è diverso da `saved`, quindi il salvataggio parte da solo.
      dispatchSession({ type: "replace", data: plan.data });
    } else if (plan.kind === "conflict" && backup) {
      pausedRef.current = true;
      setConflict({ current: initial, mine: backup.data });
      setProblem("conflict");
    }
    // Solo all'apertura: `initial` non cambia per tutta la vita della pagina.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ogni modifica: copia nel telefono subito, salvataggio sul server dopo una breve pausa.
  useEffect(() => {
    if (!hydratedRef.current) return;
    // A ogni set chiuso si mette da parte una copia: se qualcosa va storto si torna a quel punto.
    const closed = closedSets(state.data);
    if (closed > closedSets(state.saved) && closed > closedSetsRef.current) keep("set", state.data);
    closedSetsRef.current = closed;
    if (state.data === state.saved) return;
    const backup: LocalBackup = { data: state.data, baseVersion: versionRef.current, dirty: true, savedAt: clock() };
    if (!writeBackup(matchId, backup)) {
      // Memoria piena: si fa spazio (si butta via il superfluo, mai le modifiche non salvate) e si riprova.
      pruneStorage(matchId);
      writeBackup(matchId, backup);
    }
    if (pausedRef.current) return;
    scheduleSave(SAVE_DELAY_MS);
  }, [state, matchId, keep, scheduleSave]);

  // Torna la rete, si riapre la scheda o la pagina: si riprova subito, e una richiesta rimasta appesa si interrompe.
  useEffect(() => {
    const retry = () => {
      if (inFlightRef.current && clock() - inFlightSinceRef.current > STUCK_AFTER_MS) abortRef.current?.abort();
      void save();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") retry();
    };
    window.addEventListener("online", retry);
    window.addEventListener("pageshow", retry);
    window.addEventListener("focus", retry);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", retry);
      window.removeEventListener("pageshow", retry);
      window.removeEventListener("focus", retry);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [save]);

  // Chiudere o ricaricare la pagina con punti non ancora salvati: avviso.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (store.get().data === store.get().saved) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [store]);

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    },
    [],
  );

  const resolveConflict = useCallback(
    (choice: "server" | "mine") => {
      if (!conflict) return;
      if (choice === "server") {
        // Quella di questo dispositivo si scarta, ma resta nelle copie di recupero.
        keep("conflitto", conflict.mine);
        if (conflict.current) {
          const next = scoutContent(conflict.current);
          versionRef.current = conflict.current.version;
          dispatchSession({ type: "load", data: next });
          clearBackup(matchId);
        } else {
          clearBackup(matchId);
        }
        reconcilesRef.current = 0;
        pausedRef.current = false;
        setConflict(null);
        setProblem(null);
        return;
      }
      // Si tiene questo dispositivo: quella del server si sostituisce, ma resta nelle copie di recupero.
      if (conflict.current) keep("conflitto", scoutContent(conflict.current));
      // Ci si basa sulla versione attuale del server, così il salvataggio passa.
      versionRef.current = conflict.current?.version ?? null;
      reconcilesRef.current = 0;
      pausedRef.current = false;
      if (store.get().data !== conflict.mine) dispatchSession({ type: "replace", data: conflict.mine });
      setConflict(null);
      setProblem(null);
      void save();
    },
    [conflict, matchId, save, keep, dispatchSession, store],
  );

  /** Cancella lo scout dal server e riparte da zero (prima si mette da parte una copia). */
  const reset = useCallback(async (): Promise<boolean> => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (retryTimer.current) clearTimeout(retryTimer.current);
    keep("azzeramento", store.get().data);
    try {
      const response = await fetch(`/api/scout/${matchId}`, { method: "DELETE", cache: "no-store" });
      if (!response.ok) return false;
    } catch {
      return false;
    }
    clearBackup(matchId);
    versionRef.current = null;
    pausedRef.current = false;
    reconcilesRef.current = 0;
    setConflict(null);
    setProblem(null);
    setMessage(null);
    dispatchSession({ type: "load", data: blank });
    return true;
  }, [blank, matchId, keep, dispatchSession, store]);

  /** Rimette al posto dello scout una copia di recupero o un file; quello di adesso resta nelle copie. */
  const restore = useCallback(
    (data: ScoutData) => {
      if (pausedRef.current) return;
      keep("ripristino", store.get().data);
      dispatchSession({ type: "replace", data: scoutContent(data) });
    },
    [keep, dispatchSession, store],
  );

  const retryNow = useCallback(() => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryDelay.current = RETRY_START_MS;
    // Una richiesta in corso si interrompe; la nuova parte appena quella è chiusa.
    const interrupting = inFlightRef.current;
    if (interrupting) abortRef.current?.abort();
    scheduleSave(interrupting ? 300 : 0);
  }, [scheduleSave]);

  const dirty = state.data !== state.saved;
  const status: SyncStatus = problem ?? (dirty ? "saving" : "saved");

  return {
    data: state.data,
    /** Quello che c'è sul server (l'ultimo salvataggio riuscito): serve a dire quanti punti non sono ancora arrivati. */
    saved: state.saved,
    dirty,
    dispatch: dispatchSession as (action: ScoutAction) => void,
    status,
    message,
    conflict,
    resolveConflict,
    reset,
    retryNow,
    archive,
    restore,
  };
}

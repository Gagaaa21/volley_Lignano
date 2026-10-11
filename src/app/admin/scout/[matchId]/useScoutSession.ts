"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { scoutReducer, type ScoutAction } from "@/lib/scout/actions";
import { backupKey, decideStart, parseBackup, sameScout, scoutContent, type LocalBackup } from "@/lib/scout/sync";
import type { MatchScout, ScoutData } from "@/lib/scout/types";

/**
 * Lo scout di una partita mentre la si segna: lo stato vive qui, e ogni
 * modifica parte da sola verso il server (una richiesta alla volta, dopo una
 * breve pausa) e intanto resta in una copia nel telefono. Con la rete che va
 * e viene non si perde niente: si riprova da soli, e se la pagina viene chiusa
 * a metà, alla riapertura si riparte dalla copia. Se un altro dispositivo ha
 * salvato nel frattempo, non si sovrascrive in silenzio: si chiede.
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

const SAVE_DELAY_MS = 700;
const RETRY_START_MS = 2_000;
const RETRY_MAX_MS = 30_000;

function readBackup(matchId: string): LocalBackup | null {
  try {
    return parseBackup(localStorage.getItem(backupKey(matchId)));
  } catch {
    return null;
  }
}

function writeBackup(matchId: string, backup: LocalBackup) {
  try {
    localStorage.setItem(backupKey(matchId), JSON.stringify(backup));
  } catch {
    // Memoria piena o non disponibile: resta solo il salvataggio sul server.
  }
}

function clearBackup(matchId: string) {
  try {
    localStorage.removeItem(backupKey(matchId));
  } catch {
    // niente da fare
  }
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
  const [state, dispatch] = useReducer(sessionReducer, initial, (first): SessionState => {
    const data = first ? scoutContent(first) : blank;
    return { data, saved: data };
  });
  const [problem, setProblem] = useState<Problem | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ScoutConflict | null>(null);

  // Riferimenti letti dalle funzioni asincrone, che non devono vedere uno stato vecchio.
  const stateRef = useRef(state);
  const versionRef = useRef<number | null>(initial?.version ?? null);
  const inFlightRef = useRef(false);
  const pausedRef = useRef(false);
  const hydratedRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelay = useRef(RETRY_START_MS);

  /** L'ultima versione di `save`, per richiamarla da se stessa e dai timer. */
  const saveRef = useRef<() => Promise<void>>(async () => {});

  const save = useCallback(async () => {
    if (pausedRef.current || inFlightRef.current) return;
    const sending = stateRef.current.data;
    if (sending === stateRef.current.saved) return;
    inFlightRef.current = true;
    let again = false;
    try {
      const response = await fetch(`/api/scout/${matchId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: scoutContent(sending), baseVersion: versionRef.current }),
        cache: "no-store",
      });

      if (response.ok) {
        const json = (await response.json()) as { version: number };
        versionRef.current = json.version;
        retryDelay.current = RETRY_START_MS;
        dispatch({ type: "markSaved", data: sending });
        setProblem(null);
        setMessage(null);
        again = stateRef.current.data !== sending;
        if (!again) writeBackup(matchId, { data: sending, baseVersion: json.version, dirty: false, savedAt: Date.now() });
      } else if (response.status === 409) {
        const json = (await response.json()) as { current: MatchScout | null };
        if (json.current && sameScout(json.current, sending)) {
          // Era già arrivato: è andata persa la risposta, non la richiesta.
          versionRef.current = json.current.version;
          dispatch({ type: "markSaved", data: sending });
          setProblem(null);
          again = stateRef.current.data !== sending;
          if (!again) {
            writeBackup(matchId, { data: sending, baseVersion: json.current.version, dirty: false, savedAt: Date.now() });
          }
        } else {
          pausedRef.current = true;
          setConflict({ current: json.current, mine: sending });
          setProblem("conflict");
        }
      } else if (response.status === 401 || response.status === 403) {
        setProblem("denied");
        setMessage(
          response.status === 401
            ? "La sessione è scaduta: accedi di nuovo. Le modifiche restano su questo dispositivo."
            : "Non hai più accesso allo Scout. Le modifiche restano su questo dispositivo.",
        );
      } else if (response.status >= 400 && response.status < 500) {
        const json = (await response.json().catch(() => null)) as { error?: string } | null;
        setProblem("error");
        setMessage(json?.error ?? "Non riesco a salvare questa partita.");
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch {
      // Rete assente o server in difficoltà: si riprova con attese sempre più lunghe.
      setProblem("offline");
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => void saveRef.current(), retryDelay.current);
      retryDelay.current = Math.min(retryDelay.current * 2, RETRY_MAX_MS);
    } finally {
      inFlightRef.current = false;
    }
    // Nel frattempo ci sono state altre modifiche: si salvano subito.
    if (again) void saveRef.current();
  }, [matchId]);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  // All'apertura: se nel telefono ci sono modifiche rimaste a metà si riparte da lì.
  useEffect(() => {
    hydratedRef.current = true;
    const backup = readBackup(matchId);
    const decision = decideStart(initial, backup);
    if (decision === "local" && backup) {
      // La copia diventa lo stato attuale: è diverso da `saved`, quindi il salvataggio parte da solo.
      dispatch({ type: "replace", data: backup.data });
    } else if (decision === "conflict" && backup) {
      pausedRef.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- la copia nel telefono si legge solo nel browser, dopo l'apertura
      setConflict({ current: initial, mine: backup.data });
      setProblem("conflict");
    }
    // Solo all'apertura: `initial` non cambia per tutta la vita della pagina.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ogni modifica: copia nel telefono subito, salvataggio sul server dopo una breve pausa.
  useEffect(() => {
    stateRef.current = state;
    if (!hydratedRef.current || state.data === state.saved) return;
    writeBackup(matchId, { data: state.data, baseVersion: versionRef.current, dirty: true, savedAt: Date.now() });
    if (pausedRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void save(), SAVE_DELAY_MS);
  }, [state, matchId, save]);

  // Torna la rete o si riapre la scheda: si riprova subito.
  useEffect(() => {
    const retry = () => void save();
    const onVisible = () => {
      if (document.visibilityState === "visible") retry();
    };
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [save]);

  // Chiudere o ricaricare la pagina con punti non ancora salvati: avviso.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (stateRef.current.data === stateRef.current.saved) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

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
        if (conflict.current) {
          const next = scoutContent(conflict.current);
          versionRef.current = conflict.current.version;
          dispatch({ type: "load", data: next });
          writeBackup(matchId, { data: next, baseVersion: conflict.current.version, dirty: false, savedAt: Date.now() });
        } else {
          clearBackup(matchId);
        }
        pausedRef.current = false;
        setConflict(null);
        setProblem(null);
        return;
      }
      // Si tiene questo dispositivo: ci si basa sulla versione attuale del server, così il salvataggio passa.
      versionRef.current = conflict.current?.version ?? null;
      pausedRef.current = false;
      if (stateRef.current.data !== conflict.mine) dispatch({ type: "replace", data: conflict.mine });
      setConflict(null);
      setProblem(null);
      void save();
    },
    [conflict, matchId, save],
  );

  /** Cancella lo scout dal server e riparte da zero. */
  const reset = useCallback(async (): Promise<boolean> => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (retryTimer.current) clearTimeout(retryTimer.current);
    try {
      const response = await fetch(`/api/scout/${matchId}`, { method: "DELETE", cache: "no-store" });
      if (!response.ok) return false;
    } catch {
      return false;
    }
    clearBackup(matchId);
    versionRef.current = null;
    pausedRef.current = false;
    setConflict(null);
    setProblem(null);
    setMessage(null);
    dispatch({ type: "load", data: blank });
    return true;
  }, [blank, matchId]);

  const retryNow = useCallback(() => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryDelay.current = RETRY_START_MS;
    void save();
  }, [save]);

  const dirty = state.data !== state.saved;
  const status: SyncStatus = problem ?? (dirty ? "saving" : "saved");

  return {
    data: state.data,
    dispatch: dispatch as (action: ScoutAction) => void,
    status,
    message,
    conflict,
    resolveConflict,
    reset,
    retryNow,
  };
}

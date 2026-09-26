"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { Maximize2, Minimize2, Pencil, RefreshCw, Repeat, Timer, Undo2, Volleyball } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Label, Select, FieldHint } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { DualLiveScoreCourt } from "./LiveScoreCourt";
import { shortName } from "@/components/matches/VolleyCourt";
import type { CourtPosition, LiveScoreSetResult, LiveScoreState, LiveScoreTeamState } from "@/lib/types";

/** I sei nomi "titolari" della rotazione, indicizzati per posizione
 * (positions[0] = posizione 1, ... positions[5] = posizione 6). */
type Positions = [string, string, string, string, string, string];
type TeamKey = "A" | "B";

/** Colore distintivo per squadra, riusato ovunque serva riconoscerle a
 * colpo d'occhio — le due tinte del brand (blu mare / ambra sabbia), non
 * colori nuovi: intestazione colorata del tabellone, storico set, ultimi
 * punti, bagliore del punteggio. */
const TEAM_ACCENT: Record<TeamKey, { dot: string; gradient: string; glow: string }> = {
  A: { dot: "bg-sea-600", gradient: "from-sea-500 to-sea-700", glow: "rgba(31,80,132,0.45)" },
  B: { dot: "bg-sand-500", gradient: "from-sand-400 to-sand-600", glow: "rgba(148,85,29,0.4)" },
};

const EMPTY_POSITIONS: Positions = ["", "", "", "", "", ""];
const LIVESCORE_API = "/api/livescore";
/** Tempo di inattività prima di salvare in automatico, per non fare una
 * richiesta a ogni singolo tasto premuto mentre si scrive un nome. */
const AUTOSAVE_DELAY_MS = 900;
/** Quanti degli ultimi punti mostrare nella striscia "Ultimi punti". */
const POINT_LOG_LIMIT = 12;
/** Time-out ufficiali a disposizione di ciascuna squadra per set. */
const MAX_TIMEOUTS_PER_SET = 2;

function teamKeyProp(key: TeamKey): "teamA" | "teamB" {
  return key === "A" ? "teamA" : "teamB";
}

function otherKey(key: TeamKey): TeamKey {
  return key === "A" ? "B" : "A";
}

/** Una rotazione: chi era in posizione 2 diventa la nuova battitrice
 * (posizione 1), chi era in posizione 1 va in fondo (posizione 6), e così
 * via — l'ordine di rotazione standard della pallavolo (1→6→5→4→3→2→1). */
function rotateOnce(positions: Positions): Positions {
  const [p1, p2, p3, p4, p5, p6] = positions;
  return [p2, p3, p4, p5, p6, p1];
}

function isHost(team: LiveScoreTeamState, name: string): boolean {
  const trimmed = name.trim();
  return trimmed !== "" && team.hostNames.some((h) => h.trim() === trimmed);
}

function emptyTeam(label: string): LiveScoreTeamState {
  return {
    label,
    positions: EMPTY_POSITIONS,
    liberoName: "",
    hostNames: ["", ""],
    liberoActiveFor: null,
    score: 0,
    setsWon: 0,
    timeoutsUsed: 0,
  };
}

function initialMatch(): LiveScoreState {
  return {
    started: false,
    servingTeam: null,
    sidesSwapped: false,
    teamA: emptyTeam("Squadra A"),
    teamB: emptyTeam("Squadra B"),
    setHistory: [],
  };
}

function isTeamEmpty(team: LiveScoreTeamState): boolean {
  return (
    team.positions.every((n) => n.trim() === "") &&
    team.liberoName.trim() === "" &&
    team.score === 0 &&
    team.setsWon === 0
  );
}

/**
 * Assegna il punto alla squadra `winner`.
 *
 * Regolamento pallavolo: si ruota solo quando una squadra CONQUISTA la
 * battuta (vinceva la palla ricevendo), non quando la mantiene vincendo
 * mentre già serviva. La libero, secondo il regolamento, non è mai la
 * prima a servire quando una centrale arriva in battuta: la centrale
 * serve lei stessa finché la sua squadra continua a vincere (nessuna
 * rotazione, stessa battitrice), e solo quando PERDE il punto da
 * battitrice (side-out) la libero entra al suo posto — da quel momento la
 * sostituisce per tutta la sua permanenza in seconda linea, finché non
 * ruota di nuovo a rete (posizione 4), dove la centrale rientra di
 * persona.
 */
function applyPoint(match: LiveScoreState, winner: TeamKey): LiveScoreState {
  const winnerKey = teamKeyProp(winner);
  const winnerTeam: LiveScoreTeamState = { ...match[winnerKey], score: match[winnerKey].score + 1 };

  if (match.servingTeam === winner) {
    // Stava già servendo e ha vinto: nessuna rotazione, nessun cambio libero.
    return { ...match, [winnerKey]: winnerTeam };
  }

  const loserKeyName = otherKey(winner);
  const loserKey = teamKeyProp(loserKeyName);
  let loserTeam: LiveScoreTeamState = { ...match[loserKey] };

  if (match.servingTeam === loserKeyName) {
    // Side-out: la squadra che stava servendo perde il punto. Se in
    // battuta (posizione 1) c'era una delle sue due centrali, da ora la
    // libero entra al suo posto.
    const server = loserTeam.positions[0].trim();
    if (isHost(loserTeam, server) && loserTeam.liberoActiveFor !== server) {
      loserTeam = { ...loserTeam, liberoActiveFor: server };
    }
  }

  // La squadra che vince conquista la battuta e ruota: chi usciva dalla
  // seconda linea (posizione 5 → 4) rientra in campo di persona se era lei
  // ad avere la libero dentro.
  const exiting = winnerTeam.positions[4].trim();
  const rotatedWinner: LiveScoreTeamState = {
    ...winnerTeam,
    positions: rotateOnce(winnerTeam.positions),
    liberoActiveFor: winnerTeam.liberoActiveFor === exiting ? null : winnerTeam.liberoActiveFor,
  };

  return {
    ...match,
    servingTeam: winner,
    [winnerKey]: rotatedWinner,
    [loserKey]: loserTeam,
  };
}

/** Chiude il set corrente: vince chi ha più punti (pareggio bloccato,
 * verificato anche a monte nel reducer). Il punteggio finale resta in
 * `setHistory` (altrimenti andrebbe perso non appena si azzera per il set
 * successivo), poi punteggio e time-out si azzerano, libero resettata per
 * entrambe (si riparte da capo), il coach dovrà scegliere di nuovo chi
 * serve per primo. */
function closeSet(match: LiveScoreState): LiveScoreState {
  if (match.teamA.score === match.teamB.score) return match;
  const winner: TeamKey = match.teamA.score > match.teamB.score ? "A" : "B";
  const winnerKey = teamKeyProp(winner);
  const loserKey = teamKeyProp(otherKey(winner));
  return {
    ...match,
    servingTeam: null,
    setHistory: [...match.setHistory, { scoreA: match.teamA.score, scoreB: match.teamB.score }],
    [winnerKey]: {
      ...match[winnerKey],
      score: 0,
      setsWon: match[winnerKey].setsWon + 1,
      liberoActiveFor: null,
      timeoutsUsed: 0,
    },
    [loserKey]: { ...match[loserKey], score: 0, liberoActiveFor: null, timeoutsUsed: 0 },
  };
}

interface ReducerState {
  match: LiveScoreState;
  history: LiveScoreState[];
  /** Chi ha segnato gli ultimi punti del set in corso (solo per la
   * striscia "Ultimi punti": non si salva su Supabase, si riparte da vuoto
   * a ogni ricarica o nuovo set — non serve sopravvivere, è solo un colpo
   * d'occhio sull'andamento). */
  pointLog: TeamKey[];
  /** Istantanea di pointLog corrispondente a ogni voce di `history`, per
   * poter tornare indietro esattamente con "Annulla ultimo punto". */
  pointLogHistory: TeamKey[][];
}

type Action =
  | { type: "hydrate"; match: LiveScoreState }
  | { type: "startMatch"; servingTeam: TeamKey }
  | { type: "point"; winner: TeamKey }
  | { type: "closeSet" }
  | { type: "undo" }
  | { type: "toggleSides" }
  | { type: "newMatch" }
  | { type: "toggleTimeout"; team: TeamKey }
  | { type: "setPosition"; team: TeamKey; position: CourtPosition; value: string }
  | { type: "setLiberoName"; team: TeamKey; value: string }
  | { type: "setHostName"; team: TeamKey; index: 0 | 1; value: string }
  | { type: "setLabel"; team: TeamKey; value: string };

function reducer(state: ReducerState, action: Action): ReducerState {
  switch (action.type) {
    case "hydrate":
      return { match: action.match, history: [], pointLog: [], pointLogHistory: [] };
    case "startMatch":
      return {
        match: { ...state.match, started: true, servingTeam: action.servingTeam },
        history: [],
        pointLog: [],
        pointLogHistory: [],
      };
    case "point":
      return {
        match: applyPoint(state.match, action.winner),
        history: [...state.history, state.match],
        pointLog: [...state.pointLog, action.winner].slice(-POINT_LOG_LIMIT),
        pointLogHistory: [...state.pointLogHistory, state.pointLog],
      };
    case "closeSet": {
      if (state.match.teamA.score === state.match.teamB.score) return state;
      return {
        match: closeSet(state.match),
        history: [...state.history, state.match],
        pointLog: [],
        pointLogHistory: [...state.pointLogHistory, state.pointLog],
      };
    }
    case "undo": {
      if (state.history.length === 0) return state;
      return {
        match: state.history[state.history.length - 1],
        history: state.history.slice(0, -1),
        pointLog: state.pointLogHistory[state.pointLogHistory.length - 1] ?? [],
        pointLogHistory: state.pointLogHistory.slice(0, -1),
      };
    }
    case "toggleSides":
      return { ...state, match: { ...state.match, sidesSwapped: !state.match.sidesSwapped } };
    case "newMatch":
      return { match: initialMatch(), history: [], pointLog: [], pointLogHistory: [] };
    case "toggleTimeout": {
      const key = teamKeyProp(action.team);
      const team = state.match[key];
      const timeoutsUsed = team.timeoutsUsed >= MAX_TIMEOUTS_PER_SET ? 0 : team.timeoutsUsed + 1;
      return { ...state, match: { ...state.match, [key]: { ...team, timeoutsUsed } } };
    }
    case "setPosition": {
      const key = teamKeyProp(action.team);
      const team = state.match[key];
      const positions = [...team.positions] as Positions;
      positions[action.position - 1] = action.value;
      return { ...state, match: { ...state.match, [key]: { ...team, positions } } };
    }
    case "setLiberoName": {
      const key = teamKeyProp(action.team);
      return { ...state, match: { ...state.match, [key]: { ...state.match[key], liberoName: action.value } } };
    }
    case "setHostName": {
      const key = teamKeyProp(action.team);
      const team = state.match[key];
      const hostNames = [...team.hostNames] as [string, string];
      hostNames[action.index] = action.value;
      return { ...state, match: { ...state.match, [key]: { ...team, hostNames } } };
    }
    case "setLabel": {
      const key = teamKeyProp(action.team);
      return { ...state, match: { ...state.match, [key]: { ...state.match[key], label: action.value } } };
    }
    default:
      return state;
  }
}

const CUSTOM_NAME_OPTION = "__altro__";

/** Nome di una posizione (o della libero): se c'è un registro atlete da cui
 * pescare mostra un menù a tendina con le atlete della squadra attiva, più
 * una voce "Altro" che apre un campo libero per un nome non in registro
 * (es. un'ospite, o un nome sbagliato da correggere al volo). Senza
 * registro (Minivolley, o nessuna atleta attiva) resta un campo libero come
 * prima. */
function PositionNameField({
  id,
  value,
  onChange,
  athleteNames,
  placeholder,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  athleteNames: string[];
  placeholder: string;
}) {
  const [forceCustom, setForceCustom] = useState(false);
  const trimmed = value.trim();
  const isKnownAthlete = trimmed !== "" && athleteNames.includes(trimmed);
  const showCustomInput = forceCustom || (trimmed !== "" && !isKnownAthlete);
  const selectValue = showCustomInput ? CUSTOM_NAME_OPTION : isKnownAthlete ? trimmed : "";

  const fieldClass =
    "w-full rounded-full bg-white/95 px-2 py-1.5 text-center text-[11px] font-bold text-sea-950 shadow-sm outline-none placeholder:text-sea-950/35 focus:ring-2 focus:ring-sea-700 sm:text-xs";

  if (athleteNames.length === 0) {
    return (
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={fieldClass}
      />
    );
  }

  return (
    <div className="w-full space-y-1">
      <select
        id={id}
        value={selectValue}
        onChange={(e) => {
          if (e.target.value === CUSTOM_NAME_OPTION) {
            setForceCustom(true);
            onChange("");
            return;
          }
          setForceCustom(false);
          onChange(e.target.value);
        }}
        className={fieldClass}
      >
        <option value="">{placeholder}</option>
        {athleteNames.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
        <option value={CUSTOM_NAME_OPTION}>Altro…</option>
      </select>
      {showCustomInput && (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Scrivi il nome"
          autoFocus
          className={fieldClass}
        />
      )}
    </div>
  );
}

function cellDisplay(position: CourtPosition, team: LiveScoreTeamState): { name: string; isLibero: boolean } {
  const nameAtPosition = team.positions[position - 1].trim();
  if (team.liberoActiveFor && nameAtPosition === team.liberoActiveFor && team.liberoName.trim()) {
    return { name: team.liberoName.trim(), isLibero: true };
  }
  return { name: nameAtPosition, isLibero: false };
}

function renderTeamCell(
  team: LiveScoreTeamState,
  teamKey: TeamKey,
  editing: boolean,
  athleteNames: string[],
  isServing: boolean,
  dispatch: (action: Action) => void,
  large: boolean,
) {
  return function TeamCell(position: CourtPosition) {
    if (editing) {
      return (
        <PositionNameField
          value={team.positions[position - 1]}
          onChange={(value) => dispatch({ type: "setPosition", team: teamKey, position, value })}
          athleteNames={athleteNames}
          placeholder={`Pos. ${position}`}
        />
      );
    }
    const { name, isLibero } = cellDisplay(position, team);
    return (
      <>
        {position === 1 && isServing && (
          <span
            className={cn(
              "absolute right-1.5 top-1.5 flex items-center justify-center rounded-full bg-sea-950/80 shadow-sm ring-1 ring-white/40",
              large ? "h-6 w-6" : "h-3.5 w-3.5",
            )}
            title="Al servizio"
            aria-label={`${team.label || "Squadra"} al servizio`}
          >
            <Volleyball className={cn("text-white", large ? "h-4 w-4" : "h-2.5 w-2.5")} />
          </span>
        )}
        <span
          className={cn(
            "block w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-full font-bold",
            large ? "px-3.5 py-2 text-lg sm:text-2xl" : "px-2 py-1 text-[11px] sm:text-xs",
            isLibero
              ? "bg-sea-950 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_3px_8px_-2px_rgba(9,26,38,0.55)]"
              : "bg-white text-sea-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_2px_5px_-1px_rgba(9,26,38,0.25)]",
          )}
          title={name}
        >
          {name ? shortName(name) : "—"}
        </span>
        {/* Etichetta "Libero" sovrapposta (assoluta, non impilata nel flusso):
         * la cella ha un'altezza fissa uguale per tutte le posizioni, un
         * elemento in più nel flex avrebbe schiacciato il nome sopra. */}
        {isLibero && (
          <span
            className={cn(
              "absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white font-bold uppercase tracking-wide text-sea-950 shadow-sm ring-1 ring-sea-950/10",
              large ? "bottom-1.5 px-2 py-0.5 text-[10px] sm:bottom-2 sm:text-[11px]" : "bottom-1 px-1.5 py-[1px] text-[7px]",
            )}
          >
            Libero
          </span>
        )}
      </>
    );
  };
}

function ScoreCard({
  team,
  teamKey,
  isServing,
  onLabelChange,
  onPoint,
  onToggleTimeout,
  large,
}: {
  team: LiveScoreTeamState;
  teamKey: TeamKey;
  isServing: boolean;
  onLabelChange: (value: string) => void;
  onPoint: () => void;
  onToggleTimeout: () => void;
  large: boolean;
}) {
  const accent = TEAM_ACCENT[teamKey];
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border shadow-lg transition-shadow",
        isServing ? "border-transparent" : "border-border-subtle",
      )}
      style={isServing ? { boxShadow: `0 0 0 3px ${accent.glow}, 0 22px 40px -22px ${accent.glow}` } : undefined}
    >
      {/* Intestazione a tinta unita per squadra: molto più riconoscibile di
       * un semplice filo colorato sul bordo, e fa risaltare subito chi sta
       * servendo. */}
      <div
        className={cn(
          "flex items-center justify-center gap-1.5 bg-gradient-to-br",
          accent.gradient,
          "px-4 py-1.5",
        )}
      >
        <input
          value={team.label}
          onChange={(e) => onLabelChange(e.target.value)}
          className={cn(
            "min-w-0 flex-1 bg-transparent text-center font-bold uppercase tracking-wide text-white/85 outline-none placeholder:text-white/50 focus:text-white",
            large ? "text-sm sm:text-base" : "text-xs",
          )}
        />
        {isServing && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full bg-white/25 font-bold uppercase tracking-wide text-white",
              large ? "px-2 py-0.5 text-[10px] sm:text-xs" : "px-1.5 py-0.5 text-[9px]",
            )}
          >
            <Volleyball className={large ? "h-3 w-3" : "h-2.5 w-2.5"} />
            Al servizio
          </span>
        )}
      </div>
      <div className={cn("bg-gradient-to-b from-surface to-muted/20 text-center", "p-3")}>
        <p
          className={cn(
            "font-[family-name:var(--font-display-minivolley)] font-extrabold leading-none tabular-nums text-foreground",
            "text-5xl sm:text-6xl",
          )}
          style={{ textShadow: `0 8px 28px ${accent.glow}` }}
        >
          {team.score}
        </p>
        <div className="mt-1 flex items-center justify-center gap-2.5">
          <p className={cn("font-medium text-muted-foreground", large ? "text-xs sm:text-sm" : "text-xs")}>
            Set vinti: {team.setsWon}
          </p>
          <button
            type="button"
            onClick={onToggleTimeout}
            title="Segna un time-out (2 a disposizione per set)"
            className={cn(
              "inline-flex items-center gap-1 rounded-full border font-bold uppercase tracking-wide transition-colors",
              large ? "px-2 py-0.5 text-[10px] sm:text-xs" : "px-1.5 py-0.5 text-[9px]",
              team.timeoutsUsed >= MAX_TIMEOUTS_PER_SET
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-border-subtle text-muted-foreground hover:border-primary/30 hover:text-foreground",
            )}
          >
            <Timer className={large ? "h-3 w-3" : "h-2.5 w-2.5"} />
            Time-out {team.timeoutsUsed}/{MAX_TIMEOUTS_PER_SET}
          </button>
        </div>
        <Button onClick={onPoint} size={large ? "sm" : "lg"} className={cn("w-full", large ? "mt-1.5" : "mt-3")}>
          Punto {team.label}
        </Button>
      </div>
    </div>
  );
}

function LiberoFields({
  team,
  teamKey,
  idPrefix,
  athleteNames,
  dispatch,
}: {
  team: LiveScoreTeamState;
  teamKey: TeamKey;
  idPrefix: string;
  athleteNames: string[];
  dispatch: (action: Action) => void;
}) {
  const filledNames = team.positions.map((n) => n.trim()).filter(Boolean);
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface p-3.5">
      <Label htmlFor={`${idPrefix}-libero`}>Libero {team.label} (opzionale)</Label>
      <PositionNameField
        id={`${idPrefix}-libero`}
        value={team.liberoName}
        onChange={(value) => dispatch({ type: "setLiberoName", team: teamKey, value })}
        athleteNames={athleteNames}
        placeholder="Nome della libero"
      />
      {team.liberoName.trim() && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor={`${idPrefix}-host1`}>1ª centrale</Label>
            <Select
              id={`${idPrefix}-host1`}
              value={team.hostNames[0]}
              onChange={(e) => dispatch({ type: "setHostName", team: teamKey, index: 0, value: e.target.value })}
            >
              <option value="">Scegli…</option>
              {filledNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-host2`}>2ª centrale</Label>
            <Select
              id={`${idPrefix}-host2`}
              value={team.hostNames[1]}
              onChange={(e) => dispatch({ type: "setHostName", team: teamKey, index: 1, value: e.target.value })}
            >
              <option value="">Scegli…</option>
              {filledNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      )}
      <FieldHint>
        La libero sostituisce qualunque delle due centrali sia in seconda linea. Se tocca a una di loro
        servire, gioca lei stessa finché non perde il punto: solo da quel momento entra la libero al suo
        posto, fino a quando quella centrale non rientra a rete.
      </FieldHint>
    </div>
  );
}

/** Striscia compatta con lo storico dei set già giocati (il punteggio
 * finale, altrimenti perso non appena si azzera per il set successivo) e
 * gli ultimi punti segnati, colorati per squadra, per leggere al volo chi
 * ha in mano il momentum — utile per un coach durante l'allenamento senza
 * dover tenere a mente lo storico a voce. Non occupa una riga in più
 * quando non c'è ancora nulla da mostrare. */
function SetHistoryAndStreak({
  setHistory,
  pointLog,
}: {
  setHistory: LiveScoreSetResult[];
  pointLog: TeamKey[];
}) {
  if (setHistory.length === 0 && pointLog.length === 0) return null;
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-center gap-2.5">
      {setHistory.length > 0 && (
        <div className="inline-flex flex-wrap items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-3 py-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Set</span>
          {setHistory.map((set, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-bold tabular-nums text-foreground"
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", TEAM_ACCENT.A.dot)} />
              {set.scoreA}–{set.scoreB}
              <span className={cn("h-1.5 w-1.5 rounded-full", TEAM_ACCENT.B.dot)} />
            </span>
          ))}
        </div>
      )}
      {pointLog.length > 0 && (
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-3 py-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Ultimi punti</span>
          <div className="flex items-center gap-1">
            {pointLog.map((winner, i) => (
              <span
                key={i}
                className={cn(
                  "h-2 w-2 rounded-full",
                  TEAM_ACCENT[winner].dot,
                  i === pointLog.length - 1 && "ring-2 ring-offset-1 ring-offset-surface",
                  i === pointLog.length - 1 && (winner === "A" ? "ring-sea-300" : "ring-sand-300"),
                )}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Tabellone live per l'allenamento: pensato per tablet o computer a bordo
 * campo (vedi il gate `sm:hidden` più sotto), mai per telefono — due mezzi
 * campo e due tabelloni leggibili non ci stanno in una manciata di
 * centimetri. Formazioni, punteggio, set e stato della libero si salvano
 * in automatico su Supabase per qualche ora (vedi LIVE_SCORE_TTL_MS), così
 * un ricaricamento accidentale non fa perdere l'allenamento in corso; lo
 * storico punti (per l'annulla) resta invece solo in memoria.
 */
export function LiveScoreClient({ athleteNames }: { athleteNames: string[] }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    match: initialMatch(),
    history: [],
    pointLog: [],
    pointLogHistory: [],
  }));
  const [editingNames, setEditingNames] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pendingServer, setPendingServer] = useState<TeamKey>("A");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const { match } = state;

  // Segue lo stato reale dello schermo intero (anche se il coach esce con
  // Esc invece che dal pulsante), per adattare grafica e pulsante insieme.
  useEffect(() => {
    function handleChange() {
      setIsFullscreen(!!document.fullscreenElement && document.fullscreenElement === stageRef.current);
    }
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  async function toggleFullscreen() {
    if (!stageRef.current) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await stageRef.current.requestFullscreen();
      }
    } catch {
      // Schermo intero non supportato o negato dal browser: il pulsante
      // resta semplicemente senza effetto, nessun dato in gioco.
    }
  }

  // Al montaggio, ripristina l'eventuale allenamento salvato di recente
  // (entro LIVE_SCORE_TTL_MS): senza questo la pagina parte sempre vuota,
  // anche subito dopo un ricaricamento accidentale.
  useEffect(() => {
    let cancelled = false;
    fetch(LIVESCORE_API)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { state: LiveScoreState | null } | null) => {
        if (cancelled || !data?.state) return;
        dispatch({ type: "hydrate", match: data.state });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Salvataggio automatico, con un breve debounce per non scrivere a ogni
  // tasto premuto. Salta finché non è finito il ripristino iniziale (evita
  // di sovrascrivere un allenamento salvato con lo stato vuoto di partenza)
  // e quando non c'è ancora nulla da salvare.
  useEffect(() => {
    if (!loaded) return;
    if (!match.started && isTeamEmpty(match.teamA) && isTeamEmpty(match.teamB)) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch(LIVESCORE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(match),
      }).catch(() => {});
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [loaded, match]);

  function handleNewMatch() {
    if (!window.confirm("Iniziare un nuovo allenamento? Punteggi e formazioni attuali andranno persi.")) return;
    setEditingNames(false);
    dispatch({ type: "newMatch" });
    fetch(LIVESCORE_API, { method: "DELETE" }).catch(() => {});
  }

  const leftKey: TeamKey = match.sidesSwapped ? "B" : "A";
  const rightKey: TeamKey = match.sidesSwapped ? "A" : "B";
  const leftTeam = match[teamKeyProp(leftKey)];
  const rightTeam = match[teamKeyProp(rightKey)];
  const matchWinner: TeamKey | null = match.teamA.setsWon >= 3 ? "A" : match.teamB.setsWon >= 3 ? "B" : null;
  const tied = match.teamA.score === match.teamB.score;

  return (
    <>
      <div className="rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-12 text-center sm:hidden">
        <Volleyball className="mx-auto h-8 w-8 text-foreground/30" />
        <p className="mt-3 font-display text-base font-bold text-foreground">Serve uno schermo più grande</p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Il live score è pensato per tablet o computer, per avere il campo doppio e i due tabelloni ben
          leggibili a bordo campo durante l&apos;allenamento.
        </p>
      </div>

      <div
        ref={stageRef}
        className={cn(
          "hidden sm:block",
          isFullscreen &&
            "h-screen w-screen overflow-y-auto bg-gradient-to-br from-sea-50 via-background to-sand-50 p-3 sm:p-4",
        )}
      >
        <div
          className={cn(
            isFullscreen && "mx-auto flex h-full max-w-[1700px] flex-col gap-2.5",
          )}
        >
          {!match.started && (
            <div className="flex shrink-0 justify-end">
              <Button variant="outline" size="sm" onClick={toggleFullscreen}>
                {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                {isFullscreen ? "Esci da schermo intero" : "Schermo intero"}
              </Button>
            </div>
          )}

          {!match.started ? (
          <div className="space-y-5">
            <div>
              <p className="eyebrow">
                <Volleyball className="h-3 w-3" />
                Live score
              </p>
              <h1 className="mt-1.5 font-[family-name:var(--font-display-minivolley)] text-2xl font-extrabold text-foreground">
                Imposta le due squadre
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Scegli i nomi nelle 6 posizioni di ciascuna squadra come sono disposte in campo, poi indica le
                libero (se le usi).
              </p>
            </div>

            <DualLiveScoreCourt
              className="shrink-0"
              renderCellA={renderTeamCell(leftTeam, leftKey, true, athleteNames, false, dispatch, isFullscreen)}
              renderCellB={renderTeamCell(rightTeam, rightKey, true, athleteNames, false, dispatch, isFullscreen)}
              large={isFullscreen}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <LiberoFields team={match.teamA} teamKey="A" idPrefix="a-setup" athleteNames={athleteNames} dispatch={dispatch} />
              <LiberoFields team={match.teamB} teamKey="B" idPrefix="b-setup" athleteNames={athleteNames} dispatch={dispatch} />
            </div>

            <div className="rounded-2xl border border-border-subtle bg-surface p-3.5">
              <Label>Chi serve per prima?</Label>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {(["A", "B"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPendingServer(key)}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
                      pendingServer === key
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border-subtle text-foreground/70 hover:bg-muted",
                    )}
                  >
                    {match[teamKeyProp(key)].label}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={() => dispatch({ type: "startMatch", servingTeam: pendingServer })} size="lg" className="w-full">
              <Volleyball className="h-4 w-4" />
              Inizia
            </Button>
          </div>
        ) : (
          <div className={cn(isFullscreen ? "flex h-full min-h-0 flex-col gap-2" : "space-y-4")}>
            {/* Intestazione a tre zone (titolo, storico/ultimi punti, azioni):
             * prima erano due righe separate, unite qui per lasciare più
             * spazio verticale al campo, che a schermo intero è quello che
             * conta davvero. */}
            <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
              <h1
                className={cn(
                  "shrink-0 font-[family-name:var(--font-display-minivolley)] font-extrabold text-foreground",
                  isFullscreen ? "text-xl" : "text-2xl",
                )}
              >
                In campo
              </h1>
              <div className="flex min-w-0 flex-1 justify-center">
                <SetHistoryAndStreak setHistory={match.setHistory} pointLog={state.pointLog} />
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => dispatch({ type: "toggleSides" })}>
                  <Repeat className="h-3.5 w-3.5" />
                  Inverti campi
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEditingNames((v) => !v)}>
                  <Pencil className="h-3.5 w-3.5" />
                  {editingNames ? "Fatto" : "Modifica formazioni"}
                </Button>
                <Button variant="ghost" size="sm" onClick={handleNewMatch}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Nuovo allenamento
                </Button>
                <Button variant="outline" size="sm" onClick={toggleFullscreen}>
                  {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  {isFullscreen ? "Esci" : "Schermo intero"}
                </Button>
              </div>
            </div>

            {matchWinner && (
              <div className="shrink-0 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-center text-sm font-bold text-primary">
                🏆 {match[teamKeyProp(matchWinner)].label} ha vinto la partita ({match[teamKeyProp(matchWinner)].setsWon} set a{" "}
                {match[teamKeyProp(otherKey(matchWinner))].setsWon})
              </div>
            )}

            <div className="grid shrink-0 gap-3.5 sm:grid-cols-2">
              <ScoreCard
                team={leftTeam}
                teamKey={leftKey}
                isServing={match.servingTeam === leftKey}
                onLabelChange={(value) => dispatch({ type: "setLabel", team: leftKey, value })}
                onPoint={() => dispatch({ type: "point", winner: leftKey })}
                onToggleTimeout={() => dispatch({ type: "toggleTimeout", team: leftKey })}
                large={isFullscreen}
              />
              <ScoreCard
                team={rightTeam}
                teamKey={rightKey}
                isServing={match.servingTeam === rightKey}
                onLabelChange={(value) => dispatch({ type: "setLabel", team: rightKey, value })}
                onPoint={() => dispatch({ type: "point", winner: rightKey })}
                onToggleTimeout={() => dispatch({ type: "toggleTimeout", team: rightKey })}
                large={isFullscreen}
              />
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-center gap-2.5">
              <Button variant="outline" size="sm" onClick={() => dispatch({ type: "closeSet" })} disabled={tied}>
                Chiudi set
              </Button>
              <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "undo" })} disabled={state.history.length === 0}>
                <Undo2 className="h-3.5 w-3.5" />
                Annulla ultimo punto
              </Button>
              {tied && (
                <span className="text-xs text-muted-foreground">Punteggio pari: continua prima di chiudere il set.</span>
              )}
            </div>

            <DualLiveScoreCourt
              className="shrink-0"
              renderCellA={renderTeamCell(leftTeam, leftKey, editingNames, athleteNames, match.servingTeam === leftKey, dispatch, isFullscreen)}
              renderCellB={renderTeamCell(rightTeam, rightKey, editingNames, athleteNames, match.servingTeam === rightKey, dispatch, isFullscreen)}
              large={isFullscreen}
            />

            {editingNames && (
              <div className="grid shrink-0 gap-4 sm:grid-cols-2">
                <LiberoFields team={leftTeam} teamKey={leftKey} idPrefix={`${leftKey}-live`} athleteNames={athleteNames} dispatch={dispatch} />
                <LiberoFields team={rightTeam} teamKey={rightKey} idPrefix={`${rightKey}-live`} athleteNames={athleteNames} dispatch={dispatch} />
              </div>
            )}
          </div>
          )}
        </div>
      </div>
    </>
  );
}

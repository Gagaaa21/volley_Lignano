"use client";

import { useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import {
  ExternalLink,
  Maximize2,
  Minimize2,
  Pencil,
  RefreshCw,
  Repeat,
  Timer,
  TimerOff,
  Trophy,
  Undo2,
  Volleyball,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Label, Select, FieldHint, Input, Toggle } from "@/components/ui/Field";
import { SegmentedButtons } from "@/components/ui/Segmented";
import { cn } from "@/lib/cn";
import { CATEGORY_LABELS } from "@/lib/category";
import {
  DEFAULT_FORMAT,
  HOME_TEAM_LABEL,
  MAX_TIMEOUTS_PER_SET,
  applyPoint,
  closeSet,
  initialMatch,
  isTeamEmpty,
  liberoInPlay,
  linkCalendarMatch,
  matchWinner as winnerOf,
  otherKey,
  readableTextColor,
  teamColor,
  teamKeyProp,
  withAlpha,
  withPlayersPerSide,
  type LiveScoreFormat,
  type TeamKey,
} from "@/lib/liveScore";
import { DualLiveScoreCourt } from "./LiveScoreCourt";
import { useStageFullscreen } from "./useStageFullscreen";
import { shortName } from "@/components/matches/VolleyCourt";
import { SectionTour } from "@/components/tour/SectionTour";
import { LIVESCORE_INGAME_TOUR_STEPS, LIVESCORE_SETUP_TOUR_STEPS } from "@/components/tour/sectionSteps";
import {
  LIVE_SCORE_PLAYER_OPTIONS,
  type Category,
  type CourtPosition,
  type LiveScoreMode,
  type LiveScorePlayers,
  type LiveScoreSetResult,
  type LiveScoreState,
  type LiveScoreTeamState,
  type TrainingTeam,
} from "@/lib/types";

/** Scorciatoie rapide nel selettore colore avversaria, per non dover aprire
 * ogni volta il color-picker nativo — il coach può comunque scegliere
 * qualunque altro colore con l'ultimo swatch. */
const OPPONENT_COLOR_PRESETS = ["#475569", "#dc2626", "#16a34a", "#7c3aed", "#111827", "#ea580c"];

/** Partita del calendario di oggi, da collegare al tabellone in Partita. */
export interface LiveScoreCalendarMatch {
  id: string;
  /** "HH:MM" */
  time: string;
  category: Category | null;
  opponent: string;
  isTournament: boolean;
}

/** Colore distintivo per squadra, riusato ovunque serva riconoscerle a
 * colpo d'occhio: tabellone, storico set, ultimi punti, pulsanti "Punto".
 * Squadra A è sempre il blu del club (fisso). Squadra B è il giallo acceso
 * in allenamento (fisso), oppure il colore scelto dal coach per l'avversaria
 * vera in Partita — per questo entrambe sono espresse come colori concreti
 * (non classi Tailwind), col testo calcolato per restare sempre leggibile. */
type TeamAccent = { background: string; text: string; textSoft: string; overlay: string; dot: string; glow: string };

function getTeamAccent(teamKey: TeamKey, mode: LiveScoreMode, opponentColor: string): TeamAccent {
  const hex = teamColor(teamKey, mode, opponentColor);
  const text = readableTextColor(hex);
  const isLightBg = text !== "#ffffff";
  return {
    background: hex,
    text,
    // Varianti più tenui dello stesso testo, per elementi secondari (label
    // "Set", pillola time-out a riposo) — calcolate sul chiaro/scuro dello
    // sfondo invece che fisse, dato che lo sfondo può essere qualunque
    // colore scelto dal coach.
    textSoft: isLightBg ? "rgba(13,25,38,0.65)" : "rgba(255,255,255,0.8)",
    overlay: isLightBg ? "rgba(13,25,38,0.12)" : "rgba(255,255,255,0.22)",
    dot: hex,
    glow: withAlpha(hex, 0.4),
  };
}

/** Sfondo neutro (non tinto squadra) per le pillole leggere come lo storico
 * set: con un colore avversaria scelto a piacere non si può derivare in modo
 * affidabile una tinta chiara leggibile, quindi qui la distinzione tra
 * squadre resta ai soli pallini colorati (TeamAccent.dot). */
const SOFT_PILL = "bg-surface-muted text-foreground";

const POINT_BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl font-bold uppercase tracking-wide shadow-sm transition-transform duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring";

/** Etichetta di una squadra da mostrare, con un fallback quando è ancora
 * vuota (es. nome avversaria non ancora scritto in modalità Partita). */
function displayLabel(team: LiveScoreTeamState, key: TeamKey): string {
  return team.label.trim() || (key === "A" ? "Squadra A" : "Squadra B");
}

const LIVESCORE_API = "/api/livescore";
/** Ultimo formato scelto su questo dispositivo (tipo, formazione, giocatrici,
 * libero): una comodità per non reimpostarlo a ogni nuova partita. */
const FORMAT_STORAGE_KEY = "vl-livescore-format";
/** Tempo di inattività prima di salvare in automatico, per non fare una
 * richiesta a ogni singolo tasto premuto mentre si scrive un nome. */
const AUTOSAVE_DELAY_MS = 900;
/** Quanti degli ultimi punti mostrare nella striscia "Ultimi punti". */
const POINT_LOG_LIMIT = 12;

function formatOf(match: LiveScoreState): LiveScoreFormat {
  return {
    mode: match.mode,
    playersPerSide: match.playersPerSide,
    withLineup: match.withLineup,
    useLibero: match.useLibero,
  };
}

function readSavedFormat(): Partial<LiveScoreFormat> {
  try {
    const raw = JSON.parse(localStorage.getItem(FORMAT_STORAGE_KEY) ?? "null") as Partial<LiveScoreFormat> | null;
    if (!raw || typeof raw !== "object") return {};
    const format: Partial<LiveScoreFormat> = {};
    if (raw.mode === "training" || raw.mode === "match") format.mode = raw.mode;
    if (LIVE_SCORE_PLAYER_OPTIONS.includes(raw.playersPerSide as LiveScorePlayers)) format.playersPerSide = raw.playersPerSide;
    if (typeof raw.withLineup === "boolean") format.withLineup = raw.withLineup;
    if (typeof raw.useLibero === "boolean") format.useLibero = raw.useLibero;
    return format;
  } catch {
    return {};
  }
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
  | { type: "setMode"; mode: LiveScoreMode }
  | { type: "setPlayers"; players: LiveScorePlayers }
  | { type: "setWithLineup"; value: boolean }
  | { type: "setUseLibero"; value: boolean }
  | { type: "setPublicLive"; value: boolean; team: TrainingTeam }
  | { type: "linkMatch"; match: LiveScoreCalendarMatch | null }
  | { type: "toggleTimeout"; team: TeamKey }
  | { type: "setPosition"; team: TeamKey; position: CourtPosition; value: string }
  | { type: "setLiberoName"; team: TeamKey; value: string }
  | { type: "setHostName"; team: TeamKey; index: 0 | 1; value: string }
  | { type: "setLabel"; team: TeamKey; value: string }
  | { type: "setOpponentColor"; value: string };

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
      // La diretta pubblica resta com'è: «Annulla» torna indietro sul
      // punteggio, non deve riaccenderla o spegnerla.
      const previous = state.history[state.history.length - 1];
      return {
        match: { ...previous, publicLive: state.match.publicLive, team: state.match.team },
        history: state.history.slice(0, -1),
        pointLog: state.pointLogHistory[state.pointLogHistory.length - 1] ?? [],
        pointLogHistory: state.pointLogHistory.slice(0, -1),
      };
    }
    case "toggleSides":
      return { ...state, match: { ...state.match, sidesSwapped: !state.match.sidesSwapped } };
    case "newMatch":
      // Il formato resta quello scelto; la diretta pubblica invece si spegne:
      // va riattivata apposta per la partita successiva.
      return { match: initialMatch(formatOf(state.match), state.match.team), history: [], pointLog: [], pointLogHistory: [] };
    case "setMode": {
      if (state.match.started) return state;
      const isMatch = action.mode === "match";
      return {
        ...state,
        match: {
          ...state.match,
          mode: action.mode,
          teamA: { ...state.match.teamA, label: isMatch ? HOME_TEAM_LABEL : "Squadra A" },
          teamB: { ...state.match.teamB, label: isMatch ? "" : "Squadra B" },
          // La diretta e il collegamento al calendario esistono solo in Partita.
          publicLive: isMatch && state.match.publicLive,
          matchId: isMatch ? state.match.matchId : null,
          category: isMatch ? state.match.category : null,
        },
      };
    }
    case "setPlayers":
      if (state.match.started) return state;
      return { ...state, match: withPlayersPerSide(state.match, action.players) };
    case "setWithLineup":
      if (state.match.started) return state;
      return { ...state, match: { ...state.match, withLineup: action.value } };
    case "setUseLibero":
      if (state.match.started) return state;
      return { ...state, match: { ...state.match, useLibero: action.value } };
    case "setPublicLive":
      if (state.match.mode !== "match") return state;
      return { ...state, match: { ...state.match, publicLive: action.value, team: action.team } };
    case "linkMatch":
      return { ...state, match: linkCalendarMatch(state.match, action.match) };
    case "toggleTimeout": {
      const key = teamKeyProp(action.team);
      const team = state.match[key];
      const timeoutsUsed = team.timeoutsUsed >= MAX_TIMEOUTS_PER_SET ? 0 : team.timeoutsUsed + 1;
      return { ...state, match: { ...state.match, [key]: { ...team, timeoutsUsed } } };
    }
    case "setPosition": {
      const key = teamKeyProp(action.team);
      const team = state.match[key];
      const positions = [...team.positions];
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
    case "setOpponentColor":
      return { ...state, match: { ...state.match, opponentColor: action.value } };
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
  compact,
  numeric,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  athleteNames: string[];
  placeholder: string;
  compact?: boolean;
  /** Modalità "Partita": numero di maglia invece del nome — niente menù a
   * tendina con le atlete (le avversarie non ci sono in registro, e anche
   * per le nostre si scrive il numero, non il nome). */
  numeric?: boolean;
}) {
  const [forceCustom, setForceCustom] = useState(false);
  const trimmed = value.trim();
  const isKnownAthlete = trimmed !== "" && athleteNames.includes(trimmed);
  const showCustomInput = forceCustom || (trimmed !== "" && !isKnownAthlete);
  const selectValue = showCustomInput ? CUSTOM_NAME_OPTION : isKnownAthlete ? trimmed : "";

  const fieldClass = compact
    ? "w-full rounded-full bg-white/95 px-2 py-1 text-center text-[11px] font-bold text-sea-950 shadow-sm outline-none placeholder:text-sea-950/35 focus:ring-2 focus:ring-sea-700"
    : "w-full rounded-full bg-white/95 px-2 py-1.5 text-center text-[11px] font-bold text-sea-950 shadow-sm outline-none placeholder:text-sea-950/35 focus:ring-2 focus:ring-sea-700 sm:text-xs";

  if (numeric || athleteNames.length === 0) {
    return (
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={numeric ? "numeric" : undefined}
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

function cellDisplay(
  position: CourtPosition,
  team: LiveScoreTeamState,
  showLibero: boolean,
): { name: string; isLibero: boolean } {
  const nameAtPosition = (team.positions[position - 1] ?? "").trim();
  if (showLibero && team.liberoActiveFor && nameAtPosition === team.liberoActiveFor) {
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
  numeric: boolean,
  showLibero: boolean,
) {
  return function TeamCell(position: CourtPosition) {
    if (editing) {
      return (
        <PositionNameField
          value={team.positions[position - 1] ?? ""}
          onChange={(value) => dispatch({ type: "setPosition", team: teamKey, position, value })}
          athleteNames={athleteNames}
          placeholder={numeric ? "N." : `Pos. ${position}`}
          numeric={numeric}
        />
      );
    }
    const { name, isLibero } = cellDisplay(position, team, showLibero);
    return (
      <>
        {position === 1 && isServing && (
          <span
            className={cn("absolute right-1.5 top-1.5", large ? "h-6 w-6" : "h-3.5 w-3.5")}
            title="Al servizio"
            aria-label={`${team.label || "Squadra"} al servizio`}
          >
            <span className="absolute inset-0 animate-ping rounded-full bg-sea-950/60" />
            <span className="relative flex h-full w-full items-center justify-center rounded-full bg-sea-950/80 shadow-sm ring-1 ring-white/40">
              <Volleyball className={cn("text-white", large ? "h-4 w-4" : "h-2.5 w-2.5")} />
            </span>
          </span>
        )}
        <span
          className={cn(
            "block w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-full font-bold",
            large ? "px-3.5 py-2 text-lg sm:text-2xl" : "px-2 py-1 text-[11px] sm:text-xs",
            !name
              ? "bg-white/40 text-sea-950/30 shadow-none ring-1 ring-inset ring-sea-950/10"
              : isLibero
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

/** Blocco squadra del tabellone "stile tv": nome, set vinti e time-out —
 * niente più intestazione a gradiente, tinta piatta del colore squadra
 * (vedi getTeamAccent). Il punteggio grande e l'indicatore di chi serve
 * stanno nel display centrale condiviso (vedi CenterDisplay), non qui. */
function TeamBlock({
  team,
  teamKey,
  mode,
  opponentColor,
  editable,
  placeholder,
  onLabelChange,
  onToggleTimeout,
  large,
}: {
  team: LiveScoreTeamState;
  teamKey: TeamKey;
  mode: LiveScoreMode;
  opponentColor: string;
  /** false in modalità "Partita" per Squadra A: il Volley Lignano è sempre
   * lo stesso, non un'etichetta da scrivere ogni volta. */
  editable: boolean;
  placeholder?: string;
  onLabelChange: (value: string) => void;
  onToggleTimeout: () => void;
  large: boolean;
}) {
  const accent = getTeamAccent(teamKey, mode, opponentColor);
  const timeoutMaxed = team.timeoutsUsed >= MAX_TIMEOUTS_PER_SET;
  return (
    <div
      className={cn(
        "relative flex shrink-0 flex-col items-center justify-center gap-1.5",
        large ? "w-36 py-2.5 sm:w-52 sm:py-3.5 md:w-64" : "w-24 py-1.5 sm:w-36 sm:py-2",
      )}
      style={{ background: accent.background, color: accent.text }}
    >
      <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: accent.overlay }} />
      {editable ? (
        <input
          value={team.label}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "w-full min-w-0 bg-transparent px-1 text-center font-bold uppercase tracking-wide outline-none placeholder:text-current placeholder:opacity-60 [text-shadow:0_1px_3px_rgba(6,16,26,0.25)]",
            large ? "text-sm sm:text-base" : "text-[11px] sm:text-xs",
          )}
        />
      ) : (
        <p
          className={cn(
            "w-full truncate px-1 text-center font-bold uppercase tracking-wide [text-shadow:0_1px_3px_rgba(6,16,26,0.25)]",
            large ? "text-sm sm:text-base" : "text-[11px] sm:text-xs",
          )}
        >
          {team.label}
        </p>
      )}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <span className="text-[9px] font-semibold uppercase tracking-wide sm:text-[10px]" style={{ color: accent.textSoft }}>
          Set <b className="font-bold" style={{ color: accent.text }}>{team.setsWon}</b>
        </span>
        <button
          type="button"
          onClick={onToggleTimeout}
          title="Segna un time-out (2 a disposizione per set)"
          className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold transition-colors"
          style={timeoutMaxed ? { background: "#ffffff", color: "var(--destructive)" } : { background: accent.overlay, color: accent.text }}
        >
          {timeoutMaxed ? <TimerOff className="h-2.5 w-2.5" /> : <Timer className="h-2.5 w-2.5" />}
          {team.timeoutsUsed}/{MAX_TIMEOUTS_PER_SET}
        </button>
      </div>
    </div>
  );
}

/** Piccolo triangolo "al servizio", stile grafica tv, accanto al punteggio
 * di chi sta servendo nel display centrale. */
function ServeIndicator() {
  return (
    <span
      aria-hidden
      className="inline-block h-0 w-0 border-x-[6px] border-x-transparent border-b-[9px] border-b-green-400"
    />
  );
}

/** Display centrale del tabellone: i due punteggi, grandi, separati da un
 * sottile divisorio verticale — il "digital display" al centro del
 * tabellone tv, tra i due blocchi colorati di squadra. `huge` per il solo
 * punteggio a schermo intero, dove il tabellone è l'unica cosa da leggere. */
function CenterDisplay({
  leftScore,
  rightScore,
  servingSide,
  large,
  huge = false,
}: {
  leftScore: number;
  rightScore: number;
  servingSide: "left" | "right" | null;
  large: boolean;
  huge?: boolean;
}) {
  const scoreClass = cn(
    "animate-[livescore-score-pop_320ms_ease-out] font-[family-name:var(--font-display-minivolley)] font-extrabold leading-none tabular-nums text-white",
    huge ? "text-6xl sm:text-8xl" : large ? "text-4xl sm:text-6xl" : "text-2xl sm:text-3xl",
  );
  return (
    <div className="flex flex-1 items-center bg-sea-950" data-livescore-scores>
      <div className={cn("flex flex-1 items-center justify-end gap-2 sm:gap-3", large ? "pr-3 sm:pr-6" : "pr-2 sm:pr-4")}>
        {servingSide === "left" && <ServeIndicator />}
        <span key={leftScore} className={scoreClass}>
          {leftScore}
        </span>
      </div>
      <div className={cn("my-3 w-px shrink-0 self-stretch bg-white/15 sm:my-4", large && "sm:my-5")} />
      <div className={cn("flex flex-1 items-center gap-2 sm:gap-3", large ? "pl-3 sm:pl-6" : "pl-2 sm:pl-4")}>
        <span key={rightScore} className={scoreClass}>
          {rightScore}
        </span>
        {servingSide === "right" && <ServeIndicator />}
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
  players,
  large,
  numeric,
}: {
  team: LiveScoreTeamState;
  teamKey: TeamKey;
  idPrefix: string;
  athleteNames: string[];
  dispatch: (action: Action) => void;
  players: LiveScorePlayers;
  large?: boolean;
  numeric?: boolean;
}) {
  const filledNames = team.positions.map((n) => n.trim()).filter(Boolean);
  const liberoLabel = numeric ? `Numero libero ${team.label}` : `Nome della libero`;
  // Nella pallavolo a 6 la libero prende il posto delle centrali; negli
  // altri formati si sceglie liberamente chi sostituisce.
  const hostLabel = (n: 1 | 2) => (players === 6 ? `${n}ª centrale` : `${n}ª sostituita`);
  return (
    <div className={large ? "" : "rounded-2xl border border-border-subtle bg-surface p-3.5"}>
      {!large && <Label htmlFor={`${idPrefix}-libero`}>Libero {team.label} (opzionale)</Label>}
      <PositionNameField
        id={`${idPrefix}-libero`}
        value={team.liberoName}
        onChange={(value) => dispatch({ type: "setLiberoName", team: teamKey, value })}
        athleteNames={athleteNames}
        placeholder={large ? `Libero ${team.label} (opzionale)` : liberoLabel}
        compact={large}
        numeric={numeric}
      />
      {team.liberoName.trim() && (
        <div className={cn("grid grid-cols-2", large ? "mt-1.5 gap-1.5" : "mt-3 gap-3")}>
          {([0, 1] as const).map((index) => (
            <div key={index}>
              {!large && <Label htmlFor={`${idPrefix}-host${index + 1}`}>{hostLabel(index === 0 ? 1 : 2)}</Label>}
              <Select
                id={`${idPrefix}-host${index + 1}`}
                value={team.hostNames[index]}
                onChange={(e) => dispatch({ type: "setHostName", team: teamKey, index, value: e.target.value })}
              >
                <option value="">{hostLabel(index === 0 ? 1 : 2)}…</option>
                {filledNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Select>
            </div>
          ))}
        </div>
      )}
      {!large && (
        <FieldHint>
          {players === 6
            ? "La libero sostituisce qualunque delle due centrali sia in seconda linea."
            : "La libero sostituisce chi scegli qui, quando è in seconda linea."}{" "}
          Se tocca a una di loro servire, gioca lei stessa finché non perde il punto: solo da quel momento entra la
          libero al suo posto, fino a quando non rientra a rete.
        </FieldHint>
      )}
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
  mode,
  opponentColor,
}: {
  setHistory: LiveScoreSetResult[];
  pointLog: TeamKey[];
  mode: LiveScoreMode;
  opponentColor: string;
}) {
  if (setHistory.length === 0 && pointLog.length === 0) return null;
  const accentA = getTeamAccent("A", mode, opponentColor);
  const accentB = getTeamAccent("B", mode, opponentColor);
  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5">
      {setHistory.length > 0 && (
        <div className="inline-flex flex-wrap items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-3 py-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Set</span>
          {setHistory.map((set, i) => (
            <span key={i} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums", SOFT_PILL)}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: accentA.dot }} />
              {set.scoreA}–{set.scoreB}
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: accentB.dot }} />
            </span>
          ))}
        </div>
      )}
      {pointLog.length > 0 && (
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-3 py-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Ultimi punti</span>
          <div className="flex items-center gap-1">
            {pointLog.map((winner, i) => {
              const accent = getTeamAccent(winner, mode, opponentColor);
              const isLast = i === pointLog.length - 1;
              return (
                <span
                  key={i}
                  className="h-2 w-2 rounded-full"
                  style={{
                    background: accent.dot,
                    boxShadow: isLast ? `0 0 0 2px var(--surface), 0 0 0 4px ${accent.dot}` : undefined,
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Una voce del riquadro «Formato» in impostazione. */
function SetupOption({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-[13px] font-semibold text-foreground/80">{label}</p>
      {children}
    </div>
  );
}

/**
 * Tabellone live per allenamenti e partite: pensato per tablet o computer a
 * bordo campo (vedi il gate `sm:hidden` più sotto), mai per telefono — due
 * mezzi campo e due tabelloni leggibili non ci stanno in una manciata di
 * centimetri. Funziona dal 2 contro 2 al 6 contro 6, con o senza libero, o
 * anche senza formazione (solo punteggio). Formazioni, punteggio, set e stato
 * della libero si salvano in automatico per qualche ora (vedi
 * LIVE_SCORE_TTL_MS), così un ricaricamento accidentale non fa perdere il
 * gioco in corso; lo storico punti (per l'annulla) resta invece solo in
 * memoria. In Partita un admin può accendere la diretta: il sito pubblico
 * mostra il punteggio (mai nomi o formazioni) mentre lo si segna.
 */
export function LiveScoreClient({
  athleteNames,
  team,
  todayMatches,
}: {
  athleteNames: string[];
  /** Squadra attiva nell'area riservata: su quale sito va la diretta. */
  team: TrainingTeam;
  todayMatches: LiveScoreCalendarMatch[];
}) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    match: initialMatch(DEFAULT_FORMAT, team),
    history: [],
    pointLog: [],
    pointLogHistory: [],
  }));
  const [editingNames, setEditingNames] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pendingServer, setPendingServer] = useState<TeamKey>("A");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, isSimulated, toggle: toggleFullscreen } = useStageFullscreen(stageRef);
  const { match } = state;

  // Al montaggio, ripristina l'eventuale gioco salvato di recente (entro
  // LIVE_SCORE_TTL_MS): senza questo la pagina parte sempre vuota, anche
  // subito dopo un ricaricamento accidentale. Se non c'è nulla, riparte dal
  // formato usato l'ultima volta su questo dispositivo.
  useEffect(() => {
    let cancelled = false;
    fetch(LIVESCORE_API)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { state: LiveScoreState | null } | null) => {
        if (cancelled) return;
        dispatch({ type: "hydrate", match: data?.state ?? initialMatch(readSavedFormat(), team) });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: "hydrate", match: initialMatch(readSavedFormat(), team) });
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
    // Solo al primo montaggio: la squadra attiva serve come valore di partenza.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Salvataggio automatico, con un breve debounce per non scrivere a ogni
  // tasto premuto. Salta finché non è finito il ripristino iniziale (evita
  // di sovrascrivere un gioco salvato con lo stato vuoto di partenza)
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

  // Ricorda il formato scelto su questo dispositivo.
  const { mode, playersPerSide, withLineup, useLibero } = match;
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(FORMAT_STORAGE_KEY, JSON.stringify({ mode, playersPerSide, withLineup, useLibero }));
    } catch {
      // localStorage non disponibile: si riparte dal formato predefinito.
    }
  }, [loaded, mode, playersPerSide, withLineup, useLibero]);

  function handleNewMatch() {
    const message = match.publicLive
      ? "Ricominciare da capo? Punteggi e formazioni attuali andranno persi e la diretta sul sito si chiude."
      : "Ricominciare da capo? Punteggi e formazioni attuali andranno persi.";
    if (!window.confirm(message)) return;
    setEditingNames(false);
    dispatch({ type: "newMatch" });
    fetch(LIVESCORE_API, { method: "DELETE" }).catch(() => {});
  }

  function togglePublicLive() {
    if (
      !match.publicLive &&
      !window.confirm(
        "Mostrare questa partita in diretta sul sito pubblico? Si vedranno solo le squadre, i punti e i set (risultato non ufficiale), mai nomi o formazioni.",
      )
    ) {
      return;
    }
    dispatch({ type: "setPublicLive", value: !match.publicLive, team });
  }

  const leftKey: TeamKey = match.sidesSwapped ? "B" : "A";
  const rightKey: TeamKey = match.sidesSwapped ? "A" : "B";
  const leftTeam = match[teamKeyProp(leftKey)];
  const rightTeam = match[teamKeyProp(rightKey)];
  const matchWinner = winnerOf(match);
  const tied = match.teamA.score === match.teamB.score;
  const numeric = match.mode === "match";
  const showLiberoFields = match.withLineup && match.useLibero;
  // Senza formazione il tabellone è l'unica cosa da guardare: più grande.
  const bigBoard = isFullscreen || !match.withLineup;
  const publicPath = (match.publicLive ? match.team : team) === "minivolley" ? "/minivolley" : "/";

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
            "overflow-y-auto bg-gradient-to-br from-primary-soft via-background to-accent p-0.5 sm:p-1",
          // Schermo intero vero: lo riempie il browser. Simulato: il riquadro ricopre la finestra.
          isFullscreen && !isSimulated && "h-screen w-screen",
          isSimulated && "fixed inset-0 z-40",
        )}
      >
        <div
          className={cn(
            isFullscreen && "mx-auto flex h-full max-w-[1700px] flex-col gap-2.5",
          )}
        >
          {!match.started ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
              <div className="min-w-0 flex-1">
                <p className="eyebrow mb-2">
                  <Volleyball className="h-3 w-3" />
                  Live score
                </p>
                <div className="flex items-center gap-2">
                  <h1 className="display-wide text-[1.75rem] leading-[1.1] text-foreground sm:text-[2.125rem]">
                    Imposta le due squadre
                  </h1>
                  <SectionTour steps={LIVESCORE_SETUP_TOUR_STEPS} />
                </div>
                <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
                  {!match.withLineup
                    ? "Solo punteggio: niente formazioni né rotazioni, si segnano punti, set e time-out. Scegli chi serve per prima e inizia."
                    : `${match.mode === "match" ? "Scrivi i numeri di maglia" : "Scegli i nomi"} nelle ${match.playersPerSide} posizioni di ciascuna squadra come sono disposte in campo${showLiberoFields ? ", poi indica le libero." : "."}`}
                </p>
              </div>
              <Button variant="outline" onClick={toggleFullscreen}>
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                {isFullscreen ? "Esci da schermo intero" : "Schermo intero"}
              </Button>
            </div>

            {/* Formato del gioco, scelto prima di iniziare: tipo (nomi o numeri
             * di maglia), con o senza formazione, quante giocatrici per
             * squadra e se si usa la libero. */}
            <div
              className="flex flex-wrap items-start gap-x-6 gap-y-4 rounded-2xl border border-border-subtle bg-surface p-3.5"
              data-tour="section-livescore-mode"
            >
              <SetupOption label="Tipo">
                <SegmentedButtons
                  ariaLabel="Tipo"
                  value={match.mode}
                  onChange={(value) => dispatch({ type: "setMode", mode: value })}
                  items={[
                    { value: "training", label: "Allenamento" },
                    { value: "match", label: "Partita" },
                  ]}
                />
              </SetupOption>
              <SetupOption label="Formazione">
                <SegmentedButtons
                  ariaLabel="Formazione"
                  value={match.withLineup ? "lineup" : "score"}
                  onChange={(value) => dispatch({ type: "setWithLineup", value: value === "lineup" })}
                  items={[
                    { value: "lineup", label: "Con formazione" },
                    { value: "score", label: "Solo punteggio" },
                  ]}
                />
              </SetupOption>
              {match.withLineup && (
                <>
                  <SetupOption label="Giocatrici per squadra">
                    <SegmentedButtons
                      ariaLabel="Giocatrici per squadra"
                      value={String(match.playersPerSide)}
                      onChange={(value) => dispatch({ type: "setPlayers", players: Number(value) as LiveScorePlayers })}
                      items={LIVE_SCORE_PLAYER_OPTIONS.map((n) => ({
                        value: String(n),
                        label: `${n} vs ${n}`,
                        title: `${n} contro ${n}`,
                      }))}
                    />
                  </SetupOption>
                  <SetupOption label="Libero">
                    <SegmentedButtons
                      ariaLabel="Libero"
                      value={match.useLibero ? "yes" : "no"}
                      onChange={(value) => dispatch({ type: "setUseLibero", value: value === "yes" })}
                      items={[
                        { value: "no", label: "Senza" },
                        { value: "yes", label: "Con libero" },
                      ]}
                    />
                  </SetupOption>
                </>
              )}
            </div>

            {match.mode === "match" && (
              <div className="space-y-3.5 rounded-2xl border border-border-subtle bg-surface p-3.5">
                {todayMatches.length > 0 && (
                  <div>
                    <Label htmlFor="calendar-match">Partita di oggi (facoltativo)</Label>
                    <Select
                      id="calendar-match"
                      value={match.matchId ?? ""}
                      onChange={(e) =>
                        dispatch({ type: "linkMatch", match: todayMatches.find((m) => m.id === e.target.value) ?? null })
                      }
                    >
                      <option value="">Nessuna</option>
                      {todayMatches.map((m) => (
                        <option key={m.id} value={m.id}>
                          {[m.time, m.category ? CATEGORY_LABELS[m.category] : null, m.opponent].filter(Boolean).join(" · ")}
                        </option>
                      ))}
                    </Select>
                    <FieldHint>Scrive da sola l&apos;avversaria e dice alla diretta pubblica di che categoria è.</FieldHint>
                  </div>
                )}
                <div>
                  <Label htmlFor="opponent-name">Nome avversaria (vs {HOME_TEAM_LABEL})</Label>
                  <Input
                    id="opponent-name"
                    value={match.teamB.label}
                    onChange={(e) => dispatch({ type: "setLabel", team: "B", value: e.target.value })}
                    placeholder="Es. Pallavolo Città"
                  />
                </div>
                <div>
                  <Label htmlFor="opponent-color">Colore squadra avversaria</Label>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {OPPONENT_COLOR_PRESETS.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => dispatch({ type: "setOpponentColor", value: hex })}
                        aria-label={`Usa il colore ${hex}`}
                        title={hex}
                        className={cn(
                          "h-8 w-8 shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-surface transition-transform",
                          match.opponentColor.toLowerCase() === hex ? "ring-primary scale-110" : "ring-transparent hover:scale-105",
                        )}
                        style={{ background: hex }}
                      />
                    ))}
                    <input
                      id="opponent-color"
                      type="color"
                      value={match.opponentColor}
                      onChange={(e) => dispatch({ type: "setOpponentColor", value: e.target.value })}
                      title="Scegli un colore personalizzato"
                      className="h-8 w-10 shrink-0 cursor-pointer rounded-lg border border-border-subtle bg-transparent p-0.5"
                    />
                  </div>
                </div>
                <div data-tour="section-livescore-public">
                  <Toggle
                    label="Diretta sul sito pubblico"
                    description="Chi apre il sito vede il punteggio mentre lo segni: solo squadre, punti e set (risultato non ufficiale), mai nomi o formazioni. Parte quando premi «Inizia» e si può spegnere in qualsiasi momento."
                    checked={match.publicLive}
                    onChange={(e) => dispatch({ type: "setPublicLive", value: e.target.checked, team })}
                  />
                </div>
              </div>
            )}

            {match.withLineup && (
              <div data-tour="section-livescore-court">
                <DualLiveScoreCourt
                  className="shrink-0"
                  players={match.playersPerSide}
                  labelA={displayLabel(leftTeam, leftKey)}
                  labelB={displayLabel(rightTeam, rightKey)}
                  renderCellA={renderTeamCell(leftTeam, leftKey, true, athleteNames, false, dispatch, isFullscreen, numeric, false)}
                  renderCellB={renderTeamCell(rightTeam, rightKey, true, athleteNames, false, dispatch, isFullscreen, numeric, false)}
                  large={isFullscreen}
                />
              </div>
            )}

            {showLiberoFields && (
              <div className="grid gap-4 sm:grid-cols-2" data-tour="section-livescore-libero">
                <LiberoFields
                  team={match.teamA}
                  teamKey="A"
                  idPrefix="a-setup"
                  athleteNames={athleteNames}
                  dispatch={dispatch}
                  players={match.playersPerSide}
                  numeric={numeric}
                />
                <LiberoFields
                  team={match.teamB}
                  teamKey="B"
                  idPrefix="b-setup"
                  athleteNames={athleteNames}
                  dispatch={dispatch}
                  players={match.playersPerSide}
                  numeric={numeric}
                />
              </div>
            )}

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
                    {match[teamKeyProp(key)].label.trim() || (key === "A" ? "Squadra A" : "Squadra B")}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={() => {
                dispatch({ type: "startMatch", servingTeam: pendingServer });
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              size="lg"
              className="w-full"
              data-tour="section-livescore-start"
            >
              <Volleyball className="h-4 w-4" />
              Inizia
            </Button>
          </div>
        ) : (
          <div className={cn(isFullscreen ? "flex h-full min-h-0 flex-col gap-2" : "space-y-4")}>
            {/* Intestazione a tre zone (titolo, storico/ultimi punti, tutte
             * le azioni raggruppate in un'unica riga di pulsanti): prima
             * erano tre righe separate, unite qui per lasciare più spazio
             * verticale al campo, che a schermo intero è quello che conta
             * davvero. */}
            <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1">
              <h1
                className={cn(
                  "display-wide shrink-0 text-foreground",
                  isFullscreen ? "text-sm" : "text-2xl",
                )}
              >
                In campo
              </h1>
              {/* Niente min-w-0: se lo spazio non basta, la riga va a capo
               * invece di far scivolare lo storico sopra il titolo. */}
              <div className="flex flex-1 justify-center">
                <SetHistoryAndStreak
                  setHistory={match.setHistory}
                  pointLog={state.pointLog}
                  mode={match.mode}
                  opponentColor={match.opponentColor}
                />
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1.5" data-tour="section-livescore-toolbar">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => dispatch({ type: "closeSet" })}
                  disabled={tied}
                  title={tied ? "Punteggio pari: continua a giocare prima di chiudere il set." : undefined}
                >
                  Chiudi set
                </Button>
                <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "undo" })} disabled={state.history.length === 0}>
                  <Undo2 className="h-3.5 w-3.5" />
                  Annulla
                </Button>
                <Button variant="outline" size="sm" onClick={() => dispatch({ type: "toggleSides" })}>
                  <Repeat className="h-3.5 w-3.5" />
                  Inverti
                </Button>
                {match.withLineup && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingNames((v) => !v)}
                    data-tour="section-livescore-formations"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {editingNames ? "Fatto" : "Formazioni"}
                  </Button>
                )}
                {match.mode === "match" && (
                  <span className="inline-flex items-center gap-0.5" data-tour="section-livescore-public">
                    <Button
                      variant={match.publicLive ? "danger" : "outline"}
                      size="sm"
                      onClick={togglePublicLive}
                      aria-pressed={match.publicLive}
                      data-livescore-public-toggle
                      title={
                        match.publicLive
                          ? "Il punteggio si vede sul sito pubblico: tocca per spegnere la diretta."
                          : "Mostra il punteggio in diretta sul sito pubblico."
                      }
                    >
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          match.publicLive ? "animate-pulse bg-white" : "bg-muted-foreground/50",
                        )}
                      />
                      {match.publicLive ? "In diretta" : "Diretta"}
                    </Button>
                    {match.publicLive && (
                      <a
                        href={publicPath}
                        target="_blank"
                        rel="noreferrer"
                        title="Apri il sito pubblico"
                        aria-label="Apri il sito pubblico"
                        className={buttonVariants({ variant: "quiet", size: "icon-sm" })}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </span>
                )}
                <Button variant="ghost" size="sm" onClick={handleNewMatch}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Nuovo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleFullscreen}
                  data-tour="section-livescore-fullscreen"
                >
                  {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  {isFullscreen ? "Esci" : "Schermo intero"}
                </Button>
                <SectionTour steps={LIVESCORE_INGAME_TOUR_STEPS} />
              </div>
            </div>

            {matchWinner && (
              <div
                className="flex shrink-0 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-center text-sm font-bold"
                style={{
                  background: getTeamAccent(matchWinner, match.mode, match.opponentColor).background,
                  color: getTeamAccent(matchWinner, match.mode, match.opponentColor).text,
                  boxShadow: `0 14px 32px -18px ${getTeamAccent(matchWinner, match.mode, match.opponentColor).glow}`,
                }}
              >
                <Trophy className="h-4 w-4 shrink-0 opacity-90" />
                {displayLabel(match[teamKeyProp(matchWinner)], matchWinner)} ha vinto la partita ({match[teamKeyProp(matchWinner)].setsWon} set a{" "}
                {match[teamKeyProp(otherKey(matchWinner))].setsWon})
              </div>
            )}

            {/* Tabellone "stile tv" chiuso in un riquadro proprio (bordo +
             * sfondo distinti dalla pagina): lo isola meglio dal resto,
             * invece del solo anello sottile di prima. Due blocchi squadra a
             * tinta piatta ai lati, display centrale con i due punteggi
             * grandi. */}
            <div
              className={cn(
                "shrink-0 rounded-3xl border-2 border-border-subtle bg-surface shadow-[0_8px_24px_-16px_rgba(15,23,42,0.4)]",
                isFullscreen ? "p-2" : "p-2.5",
              )}
            >
              <div
                className={cn(
                  "flex overflow-hidden rounded-2xl ring-1 ring-sea-950/10",
                  isFullscreen ? "shadow-[0_20px_40px_-18px_rgba(12,30,42,0.5)]" : "shadow-lg",
                )}
              >
                <TeamBlock
                  team={leftTeam}
                  teamKey={leftKey}
                  mode={match.mode}
                  opponentColor={match.opponentColor}
                  large={bigBoard}
                  editable={!(match.mode === "match" && leftKey === "A")}
                  placeholder={match.mode === "match" && leftKey === "B" ? "Nome avversaria" : undefined}
                  onLabelChange={(value) => dispatch({ type: "setLabel", team: leftKey, value })}
                  onToggleTimeout={() => dispatch({ type: "toggleTimeout", team: leftKey })}
                />
                <CenterDisplay
                  leftScore={leftTeam.score}
                  rightScore={rightTeam.score}
                  servingSide={match.servingTeam === leftKey ? "left" : match.servingTeam === rightKey ? "right" : null}
                  large={bigBoard}
                  huge={isFullscreen && !match.withLineup}
                />
                <TeamBlock
                  team={rightTeam}
                  teamKey={rightKey}
                  mode={match.mode}
                  opponentColor={match.opponentColor}
                  large={bigBoard}
                  editable={!(match.mode === "match" && rightKey === "A")}
                  placeholder={match.mode === "match" && rightKey === "B" ? "Nome avversaria" : undefined}
                  onLabelChange={(value) => dispatch({ type: "setLabel", team: rightKey, value })}
                  onToggleTimeout={() => dispatch({ type: "toggleTimeout", team: rightKey })}
                />
              </div>
            </div>

            <div
              className={cn(
                "grid shrink-0 grid-cols-2 gap-2.5 sm:gap-3.5",
                // Senza formazione i due pulsanti prendono il posto del campo.
                match.withLineup ? (isFullscreen ? "h-11 sm:h-12" : "h-11") : isFullscreen ? "min-h-24 flex-1" : "h-36",
              )}
              data-tour="section-livescore-score"
            >
              {([leftKey, rightKey] as const).map((key) => {
                const accent = getTeamAccent(key, match.mode, match.opponentColor);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => dispatch({ type: "point", winner: key })}
                    className={cn(
                      POINT_BUTTON_BASE,
                      !match.withLineup
                        ? "text-lg sm:text-2xl"
                        : isFullscreen
                          ? "text-sm sm:text-base"
                          : "text-xs sm:text-sm",
                    )}
                    style={{ background: accent.background, color: accent.text }}
                  >
                    Punto {displayLabel(match[teamKeyProp(key)], key)}
                  </button>
                );
              })}
            </div>

            {match.withLineup && (
              <DualLiveScoreCourt
                className={isFullscreen ? "min-h-0 flex-1" : "shrink-0"}
                fitHeight={isFullscreen}
                players={match.playersPerSide}
                labelA={displayLabel(leftTeam, leftKey)}
                labelB={displayLabel(rightTeam, rightKey)}
                renderCellA={renderTeamCell(leftTeam, leftKey, editingNames, athleteNames, match.servingTeam === leftKey, dispatch, isFullscreen, numeric, liberoInPlay(match, leftTeam))}
                renderCellB={renderTeamCell(rightTeam, rightKey, editingNames, athleteNames, match.servingTeam === rightKey, dispatch, isFullscreen, numeric, liberoInPlay(match, rightTeam))}
                large={isFullscreen}
              />
            )}

            {match.withLineup && editingNames && showLiberoFields && (
              <div className={cn("grid shrink-0 sm:grid-cols-2", isFullscreen ? "gap-1.5" : "gap-4")}>
                <LiberoFields
                  team={leftTeam}
                  teamKey={leftKey}
                  idPrefix={`${leftKey}-live`}
                  athleteNames={athleteNames}
                  dispatch={dispatch}
                  players={match.playersPerSide}
                  large={isFullscreen}
                  numeric={numeric}
                />
                <LiberoFields
                  team={rightTeam}
                  teamKey={rightKey}
                  idPrefix={`${rightKey}-live`}
                  athleteNames={athleteNames}
                  dispatch={dispatch}
                  players={match.playersPerSide}
                  large={isFullscreen}
                  numeric={numeric}
                />
              </div>
            )}
          </div>
          )}
        </div>
      </div>
    </>
  );
}

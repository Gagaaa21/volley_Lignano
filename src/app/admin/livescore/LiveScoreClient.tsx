"use client";

import { useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeftRight,
  ExternalLink,
  Flag,
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
import { PointsInput } from "@/components/ui/PointsInput";
import { MATCH_FORMAT_LABELS, MATCH_FORMAT_SHORT_LABELS } from "@/lib/volleyRules";
import { courtOccupant, lineupIssues, lineupIssueText, namesTakenElsewhere, type LineupIssue } from "@/lib/lineup";
import { cn } from "@/lib/cn";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { prepareAudio } from "@/lib/beep";
import { nowMs, startTimeoutRun, type TimeoutRun } from "@/lib/timeoutClock";
import { CATEGORY_LABELS } from "@/lib/category";
import {
  DEFAULT_FORMAT,
  HOME_TEAM_LABEL,
  MAX_TIMEOUTS_PER_SET,
  applyPoint,
  changeSides,
  chooseFirstServer,
  closeSet,
  currentSet,
  hasLiberoOption,
  initialMatch,
  isSetFresh,
  isTeamEmpty,
  liberoInPlay,
  linkCalendarMatch,
  matchWinner as winnerOf,
  needsFirstServer,
  otherKey,
  reconcileLibero,
  startMatch,
  substitutePlayer,
  substitutionLimit,
  suggestedSetEnd,
  teamKeyProp,
  withMode,
  withPlayersPerSide,
  type LiveScoreFormat,
  type TeamKey,
} from "@/lib/liveScore";
import { DualLiveScoreCourt } from "./LiveScoreCourt";
import { displayLabel, getTeamAccent } from "./accent";
import { SubstitutionDialog } from "./SubstitutionDialog";
import { TimeoutCard } from "./TimeoutCard";
import { LineupIssuesCard, SetEndCard, SetStartCard, SideChangeCard, StatusStrip } from "./LiveScoreStatus";
import { useStageFullscreen } from "./useStageFullscreen";
import { shortName } from "@/components/matches/VolleyCourt";
import { orderRegistryNumbers, type RegistryChoices, type RegistryNumber } from "@/lib/jersey";
import { SectionTour } from "@/components/tour/SectionTour";
import { LIVESCORE_INGAME_TOUR_STEPS, LIVESCORE_SETUP_TOUR_STEPS } from "@/components/tour/sectionSteps";
import {
  LIVE_SCORE_PLAYER_OPTIONS,
  type Category,
  type CourtPosition,
  type LiveScoreMode,
  type LiveScorePlayers,
  type LiveScoreRules,
  type LiveScoreSetResult,
  type LiveScoreState,
  type LiveScoreTeamState,
  type TrainingTeam,
  type VolleyRole,
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
  /** Le convocate della partita: i loro numeri si propongono per prime. */
  calledUpAthleteIds: string[];
  /** Le formazioni salvate in Partite, una per set (vuote se non ce n'è). */
  lineups: SavedSetLineup[];
}

/** Formazione di un set salvata nella sezione Partite: chi sta in ogni posizione, la libero e i ruoli. */
export interface SavedSetLineup {
  /** Atleta in posizione 1…6 (null = vuota). */
  athleteIds: (string | null)[];
  /** Ruolo scelto per ogni posizione (le centrali sono «MB»). */
  roles: (VolleyRole | null)[];
  liberoId: string | null;
}

/** La formazione salvata di un set, scritta con i numeri di maglia dell'anagrafica (null se non c'è o non ha nessun numero). */
function savedLineupFor(
  match: LiveScoreCalendarMatch,
  setIndex: number,
  registry: RegistryNumber[],
): { positions: string[]; libero: string; hosts: [string, string] } | null {
  const saved = match.lineups[setIndex];
  if (!saved || saved.athleteIds.every((id) => !id)) return null;
  const numberOf = (id: string | null) => (id ? (registry.find((r) => r.id === id)?.number ?? "") : "");
  const positions = saved.athleteIds.map(numberOf);
  if (positions.every((n) => n === "")) return null;
  const centrals = saved.roles.flatMap((role, i) => (role === "MB" && positions[i] ? [positions[i]] : []));
  return {
    positions,
    libero: numberOf(saved.liberoId),
    hosts: [centrals[0] ?? "", centrals[1] ?? ""],
  };
}

/** Sfondo neutro (non tinto squadra) per le pillole leggere come lo storico
 * set: con un colore avversaria scelto a piacere non si può derivare in modo
 * affidabile una tinta chiara leggibile, quindi qui la distinzione tra
 * squadre resta ai soli pallini colorati (TeamAccent.dot). */
const SOFT_PILL = "bg-surface-muted text-foreground";

/** Il pulsante dei punti è un tasto vero: spesso, con il bordo scuro in basso che si schiaccia al tocco. */
const POINT_BUTTON_BASE =
  "relative inline-flex items-center justify-center gap-2.5 rounded-2xl border-b-[6px] border-black/25 px-3 text-center font-extrabold uppercase leading-tight tracking-wide shadow-md transition-[transform,border-width] duration-100 active:translate-y-[4px] active:border-b-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:ring-ring";

/** Pulsanti della barra delle azioni: tassello con l'icona sopra su telefono, pulsante con l'icona accanto da tablet. */
const TOOL_BUTTON =
  "h-14 flex-col gap-1 whitespace-normal border-2 px-1 text-center text-[11px] leading-tight sm:h-11 sm:flex-row sm:gap-1.5 sm:whitespace-nowrap sm:px-3 sm:text-sm";
const TOOL_ICON = "h-5 w-5 sm:h-4 sm:w-4";

/** Schermo largo (tablet in orizzontale, computer): la partita si dispone su tre colonne, con il campo in mezzo. */
const WIDE_QUERY = "(min-width: 1024px)";

/** Le azioni della partita su schermo largo: tasselli con l'icona sopra l'etichetta, sotto il campo. */
const WIDE_TOOL =
  "h-14 flex-col gap-1 whitespace-normal border-2 px-1 text-center text-[13px] leading-tight";

/** Time-out e cambi di una squadra su schermo largo: sotto il suo pulsante dei punti, col bordo del colore della squadra e lo sfondo dell'azione. */
const WIDE_TEAM_ACTION =
  "inline-flex h-14 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border-2 px-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Un colore per ogni azione, lo stesso ovunque compaia (barra delle azioni, colonne delle squadre): si riconosce a
 * colpo d'occhio dove toccare, senza leggere. «Punto» ha il colore della squadra; qui ci sono tutte le altre.
 */
const ACTION = {
  undo: { tile: "border-slate-900 bg-slate-600 text-white hover:bg-slate-500", icon: "text-white" },
  substitution: { tile: "border-sky-500 bg-sky-100 text-sky-950 hover:bg-sky-200", icon: "text-sky-700" },
  closeSet: { tile: "border-emerald-600 bg-emerald-100 text-emerald-950 hover:bg-emerald-200", icon: "text-emerald-700" },
  swap: { tile: "border-violet-500 bg-violet-100 text-violet-950 hover:bg-violet-200", icon: "text-violet-700" },
  lineups: { tile: "border-teal-600 bg-teal-100 text-teal-950 hover:bg-teal-200", icon: "text-teal-700" },
  /** «Fatto», mentre si correggono le formazioni: pieno, perché è lo stato attivo. */
  lineupsDone: { tile: "border-teal-800 bg-teal-600 text-white hover:bg-teal-500", icon: "text-white" },
  live: { tile: "border-fuchsia-500 bg-fuchsia-100 text-fuchsia-950 hover:bg-fuchsia-200", icon: "text-fuchsia-700" },
  timeout: { tile: "border-amber-500 bg-amber-100 text-amber-950 hover:bg-amber-200", icon: "text-amber-700" },
  fresh: { tile: "border-red-500 bg-white text-red-700 hover:bg-red-50", icon: "text-red-600" },
} as const;

/** Time-out e cambi nel blocco della squadra: pulsanti veri (etichetta, bordo, tocco comodo), col colore della loro azione (vedi ACTION). */
const TEAM_ACTION =
  "inline-flex min-h-9 w-full items-center justify-center gap-1 whitespace-nowrap rounded-lg border-2 border-current/35 px-1 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current sm:gap-1.5 sm:px-2 sm:text-xs";

/** Il suono che avvisa a fine time-out si accende e si spegne da qui: la scelta resta su questo dispositivo. */
const TIMEOUT_SOUND_KEY = "vl-livescore-timeout-sound";

const LIVESCORE_API = "/api/livescore";
/** Ultimo formato scelto su questo dispositivo (tipo, formazione, giocatrici,
 * libero): una comodità per non reimpostarlo a ogni nuova partita. */
const FORMAT_STORAGE_KEY = "vl-livescore-format";
/** Il minimo che il tabellone accetta come limite di un set (lo stesso del salvataggio: vedi liveScoreSchema). */
const MIN_SET_POINTS = 5;
/** Tempo di inattività prima di salvare in automatico, per non fare una
 * richiesta a ogni singolo tasto premuto mentre si scrive un nome. */
const AUTOSAVE_DELAY_MS = 900;
/** Quanti degli ultimi punti mostrare nella striscia "Ultimi punti". */
const POINT_LOG_LIMIT = 12;

/** Il suono del time-out: acceso, salvo che su questo dispositivo sia stato spento (sul server e senza memoria locale resta acceso). */
function readTimeoutSound(): boolean {
  try {
    return localStorage.getItem(TIMEOUT_SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

function formatOf(match: LiveScoreState): LiveScoreFormat {
  return {
    mode: match.mode,
    playersPerSide: match.playersPerSide,
    withLineup: match.withLineup,
    useLibero: match.useLibero,
    rules: match.rules,
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
    const rules = raw.rules;
    if (
      rules &&
      ["free", "bo5", "bo3", "fixed3"].includes(rules.format) &&
      Number.isInteger(rules.setPoints) &&
      Number.isInteger(rules.lastSetPoints) &&
      rules.setPoints >= MIN_SET_POINTS &&
      rules.setPoints <= 50 &&
      rules.lastSetPoints >= MIN_SET_POINTS &&
      rules.lastSetPoints <= 50
    ) {
      format.rules = { format: rules.format, setPoints: rules.setPoints, lastSetPoints: rules.lastSetPoints };
    }
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
  | { type: "startMatch"; servingTeam: TeamKey | null }
  | { type: "point"; winner: TeamKey }
  | { type: "closeSet" }
  | { type: "undo" }
  | { type: "toggleSides" }
  | { type: "newMatch" }
  | { type: "setMode"; mode: LiveScoreMode }
  | { type: "setRules"; rules: Partial<LiveScoreRules> }
  | { type: "chooseFirstServer"; team: TeamKey }
  | { type: "applySavedLineup"; team: TeamKey; positions: string[]; libero: string; hosts: [string, string] }
  | { type: "setPlayers"; players: LiveScorePlayers }
  | { type: "setWithLineup"; value: boolean }
  | { type: "setUseLibero"; value: boolean }
  | { type: "setPublicLive"; value: boolean; team: TrainingTeam }
  | { type: "linkMatch"; match: LiveScoreCalendarMatch | null }
  | { type: "toggleTimeout"; team: TeamKey }
  | { type: "substitute"; team: TeamKey; position: CourtPosition; incoming: string }
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
        match: startMatch(state.match, action.servingTeam),
        history: [],
        pointLog: [],
        pointLogHistory: [],
      };
    case "point":
      // Set finito, sorteggio da fare o partita chiusa: i punti restano fermi finché non si decide.
      if (suggestedSetEnd(state.match) || needsFirstServer(state.match) || winnerOf(state.match)) return state;
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
      // Anche il cambio campo a metà set decisivo passa da qui: così non resta «da fare».
      return { ...state, match: changeSides(state.match) };
    case "newMatch":
      // Il formato resta quello scelto; la diretta pubblica invece si spegne:
      // va riattivata apposta per la partita successiva.
      return { match: initialMatch(formatOf(state.match), state.match.team), history: [], pointLog: [], pointLogHistory: [] };
    case "setMode":
      return { ...state, match: withMode(state.match, action.mode) };
    case "setRules": {
      if (state.match.started) return state;
      return { ...state, match: { ...state.match, rules: { ...state.match.rules, ...action.rules } } };
    }
    case "chooseFirstServer": {
      const next = chooseFirstServer(state.match, action.team);
      if (next === state.match) return state;
      // Come un punto: «Annulla» riporta alla scelta precedente (utile nel sorteggio del set decisivo).
      return {
        match: next,
        history: [...state.history, state.match],
        pointLog: state.pointLog,
        pointLogHistory: [...state.pointLogHistory, state.pointLog],
      };
    }
    case "applySavedLineup": {
      const key = teamKeyProp(action.team);
      const team = state.match[key];
      const positions = Array.from({ length: state.match.playersPerSide }, (_, i) => action.positions[i] ?? "");
      return {
        ...state,
        match: reconcileLibero({
          ...state.match,
          [key]: { ...team, positions, liberoName: action.libero, hostNames: action.hosts },
        }),
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
    case "substitute": {
      // Come un punto: entra nello storico, così «Annulla» toglie anche un cambio sbagliato.
      const next = substitutePlayer(state.match, action.team, action.position, action.incoming);
      if (next === state.match) return state;
      return {
        match: next,
        history: [...state.history, state.match],
        pointLog: state.pointLog,
        pointLogHistory: [...state.pointLogHistory, state.pointLog],
      };
    }
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
      return { ...state, match: reconcileLibero({ ...state.match, [key]: { ...team, positions } }) };
    }
    case "setLiberoName": {
      const key = teamKeyProp(action.team);
      return { ...state, match: reconcileLibero({ ...state.match, [key]: { ...state.match[key], liberoName: action.value } }) };
    }
    case "setHostName": {
      const key = teamKeyProp(action.team);
      const team = state.match[key];
      const hostNames = [...team.hostNames] as [string, string];
      hostNames[action.index] = action.value;
      return { ...state, match: reconcileLibero({ ...state.match, [key]: { ...team, hostNames } }) };
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

/** Invio in un campo di posizione: passa alla posizione dopo (dall'ultima della prima squadra alla prima
 * dell'altra), così una formazione si scrive di seguito senza toccare ogni cella. */
function focusNextOnEnter(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key !== "Enter") return;
  const fields = Array.from(document.querySelectorAll<HTMLElement>("[data-court-position] input, [data-court-position] select"));
  const index = fields.indexOf(e.currentTarget);
  if (index < 0) return;
  e.preventDefault();
  fields[index + 1]?.focus();
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
  numberChoices,
  invalid,
  taken,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  athleteNames: string[];
  placeholder: string;
  compact?: boolean;
  /** Modalità "Partita": numero di maglia invece del nome — niente menù a
   * tendina con i nomi (le avversarie non ci sono in registro, e anche per le
   * nostre si scrive il numero, non il nome). */
  numeric?: boolean;
  /** Solo per le nostre in Partita: i numeri scritti nell'anagrafica atlete,
   * da scegliere invece di ridigitarli (resta «Altro…» per un numero qualsiasi). */
  numberChoices?: RegistryChoices;
  /** Il numero o il nome è già usato altrove nella formazione (vedi lineupIssues): la casella si segna in rosso. */
  invalid?: boolean;
  /** Numeri o nomi già presi da altre caselle della squadra: nel menù non si possono scegliere due volte. */
  taken?: string[];
}) {
  const [forceCustom, setForceCustom] = useState(false);
  const trimmed = value.trim();
  /** Una voce del menù già scelta altrove: si vede, ma non si può prendere (quella della casella stessa resta). */
  const isTaken = (option: string) =>
    option.trim().toLowerCase() !== trimmed.toLowerCase() && (taken ?? []).some((name) => name.trim().toLowerCase() === option.trim().toLowerCase());
  const numberList = numeric && numberChoices ? [...numberChoices.calledUp, ...numberChoices.others] : [];
  const isKnownAthlete = trimmed !== "" && (numberList.length > 0 ? numberList.some((o) => o.number === trimmed) : athleteNames.includes(trimmed));
  const showCustomInput = forceCustom || (trimmed !== "" && !isKnownAthlete);
  const selectValue = showCustomInput ? CUSTOM_NAME_OPTION : isKnownAthlete ? trimmed : "";

  const fieldClass = cn(
    compact
      ? "w-full rounded-full bg-white/95 px-2 py-1 text-center text-[11px] font-bold text-sea-950 shadow-sm outline-none placeholder:text-sea-950/35 focus:ring-2 focus:ring-sea-700"
      : "w-full rounded-full bg-white/95 px-2 py-1.5 text-center text-[11px] font-bold text-sea-950 shadow-sm outline-none placeholder:text-sea-950/35 focus:ring-2 focus:ring-sea-700 sm:text-xs",
    // Numero o nome già usato altrove: rosso, ben visibile anche sul campo azzurro.
    invalid && "bg-red-100 text-red-900 ring-2 ring-red-600",
  );

  if (numeric && numberChoices && numberList.length > 0) {
    const option = (o: RegistryNumber) => (
      <option key={o.id} value={o.number} disabled={isTaken(o.number)}>
        {o.number} · {shortName(o.name)}
        {isTaken(o.number) ? " · già in campo" : ""}
      </option>
    );
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
          aria-invalid={invalid || undefined}
          className={fieldClass}
          data-livescore-registry-select
        >
          <option value="">{placeholder}</option>
          {numberChoices.calledUp.length > 0 ? (
            <>
              <optgroup label="Convocate">{numberChoices.calledUp.map(option)}</optgroup>
              {numberChoices.others.length > 0 && <optgroup label="Altre atlete">{numberChoices.others.map(option)}</optgroup>}
            </>
          ) : (
            numberChoices.others.map(option)
          )}
          <option value={CUSTOM_NAME_OPTION}>Altro…</option>
        </select>
        {showCustomInput && (
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Numero"
            inputMode="numeric"
            enterKeyHint="next"
            autoFocus
            onKeyDown={focusNextOnEnter}
            aria-invalid={invalid || undefined}
            className={fieldClass}
          />
        )}
      </div>
    );
  }

  if (numeric || athleteNames.length === 0) {
    return (
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={numeric ? "numeric" : undefined}
        enterKeyHint="next"
        onKeyDown={focusNextOnEnter}
        aria-invalid={invalid || undefined}
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
        aria-invalid={invalid || undefined}
        className={fieldClass}
      >
        <option value="">{placeholder}</option>
        {athleteNames.map((name) => (
          <option key={name} value={name} disabled={isTaken(name)}>
            {name}
            {isTaken(name) ? " · già in campo" : ""}
          </option>
        ))}
        <option value={CUSTOM_NAME_OPTION}>Altro…</option>
      </select>
      {showCustomInput && (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Scrivi il nome"
          enterKeyHint="next"
          autoFocus
          onKeyDown={focusNextOnEnter}
          aria-invalid={invalid || undefined}
          className={fieldClass}
        />
      )}
    </div>
  );
}

/** Come sta la formazione di una squadra mentre la si scrive: gli errori (numeri doppi), le caselle da segnare in rosso e i numeri già presi. */
interface LineupCheck {
  issues: LineupIssue[];
  /** Posizioni di campo da segnare in rosso. */
  flagged: ReadonlySet<number>;
  /** Numeri o nomi già presi nella formazione, per la casella indicata (o per la libero). */
  taken: (slot: CourtPosition | "libero") => string[];
}

function lineupCheckFor(team: LiveScoreTeamState, match: LiveScoreState): LineupCheck {
  const options = { players: match.playersPerSide, useLibero: match.useLibero };
  const issues = match.withLineup ? lineupIssues(team, options) : [];
  return {
    issues,
    flagged: new Set(issues.flatMap((issue) => issue.positions)),
    taken: (slot) => (match.withLineup ? namesTakenElsewhere(team, slot, options) : []),
  };
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
  onSubstitute?: (position: CourtPosition) => void,
  numberChoices?: RegistryChoices,
  check?: LineupCheck,
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
          numberChoices={teamKey === "A" ? numberChoices : undefined}
          invalid={check?.flagged.has(position)}
          taken={check?.taken(position)}
        />
      );
    }
    const { name, isLibero } = courtOccupant(team, position, showLibero);
    const isServer = position === 1 && isServing;
    return (
      <>
        {isServer && (
          <span
            className={cn(
              "absolute right-1 top-1 inline-flex items-center gap-1 rounded-full bg-green-500 font-bold uppercase tracking-wide text-white shadow-md ring-2 ring-white/80",
              large ? "px-2.5 py-1 text-xs" : "px-1.5 py-0.5 text-[9px]",
            )}
            title="Al servizio"
            aria-label={`${team.label || "Squadra"} al servizio`}
          >
            <Volleyball className={large ? "h-3.5 w-3.5" : "h-2.5 w-2.5"} />
            Batte
          </span>
        )}
        <span
          className={cn(
            "block w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-full font-bold",
            // Numeri di maglia grandi; i nomi (Allenamento) un po' più piccoli, perché in una cella stretta devono starci.
            large ? (numeric ? "px-3.5 py-2 text-lg sm:text-2xl" : "px-2 py-2 text-base sm:text-lg") : "px-2 py-1 text-[11px] sm:text-xs",
            !name
              ? "bg-white/40 text-sea-950/30 shadow-none ring-1 ring-inset ring-sea-950/10"
              : isLibero
                ? "bg-sea-950 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_3px_8px_-2px_rgba(9,26,38,0.55)]"
                : "bg-white text-sea-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_2px_5px_-1px_rgba(9,26,38,0.25)]",
            isServer && "ring-2 ring-green-500 ring-offset-1 ring-offset-white/0",
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
        {/* Un tocco sulla giocatrice apre la sostituzione con lei già scelta. */}
        {onSubstitute && (
          <button
            type="button"
            onClick={() => onSubstitute(position)}
            aria-label={`Sostituisci ${name || `posizione ${position}`}`}
            title="Tocca per una sostituzione"
            className="absolute inset-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
          />
        )}
      </>
    );
  };
}

/** Blocco squadra del tabellone "stile tv": nome, set vinti e (nel layout «side») time-out e cambi —
 * niente più intestazione a gradiente, tinta piatta del colore squadra
 * (vedi getTeamAccent). Il punteggio grande e l'indicatore di chi serve
 * stanno nel display centrale condiviso (vedi CenterDisplay), non qui.
 * Su schermo largo (layout «board») time-out e cambi non ci sono: stanno
 * sotto il pulsante dei punti della squadra, e il blocco mostra solo nome e set vinti, più grandi. */
function TeamBlock({
  team,
  teamKey,
  mode,
  opponentColor,
  editable,
  placeholder,
  onLabelChange,
  onToggleTimeout,
  substitutions,
  large,
  layout = "side",
  timeoutTour = false,
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
  /** Senza, il blocco non ha il pulsante dei time-out (schermo largo: sta sotto i punti). */
  onToggleTimeout?: () => void;
  /** Cambi del set (solo con la formazione): un tocco apre la sostituzione. */
  substitutions?: { used: number; limit: number | null; onClick: () => void };
  large: boolean;
  layout?: "side" | "board";
  /** Segna questo pulsante dei time-out come bersaglio della guida passo passo (uno solo per tabellone). */
  timeoutTour?: boolean;
}) {
  const accent = getTeamAccent(teamKey, mode, opponentColor);
  const timeoutMaxed = team.timeoutsUsed >= MAX_TIMEOUTS_PER_SET;
  const subsMaxed = substitutions ? substitutions.limit !== null && substitutions.used >= substitutions.limit : false;
  const board = layout === "board";
  return (
    <div
      className={cn(
        "relative flex shrink-0 flex-col items-center justify-center",
        board
          ? "w-[clamp(8.5rem,22%,16rem)] gap-2 px-2 py-3"
          : cn("gap-1.5", large ? "w-32 py-2.5 sm:w-52 sm:py-3 md:w-72" : "w-28 py-2 sm:w-40 sm:py-2.5"),
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
            board ? "text-lg xl:text-xl" : large ? "text-sm sm:text-base" : "text-[11px] sm:text-xs",
          )}
        />
      ) : (
        <p
          className={cn(
            "w-full px-1 text-center font-bold uppercase tracking-wide [text-shadow:0_1px_3px_rgba(6,16,26,0.25)]",
            board ? "line-clamp-2 text-lg leading-tight xl:text-xl" : cn("truncate", large ? "text-sm sm:text-base" : "text-[11px] sm:text-xs"),
          )}
        >
          {team.label}
        </p>
      )}
      {board ? (
        <div className="flex items-baseline justify-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: accent.textSoft }}>
            Set vinti
          </span>
          <b className="text-3xl font-extrabold leading-none tabular-nums" style={{ color: accent.text }}>
            {team.setsWon}
          </b>
        </div>
      ) : (
        <div className="flex w-full flex-col items-stretch gap-1 px-2 sm:px-3">
          <span className="text-center text-[10px] font-semibold uppercase tracking-wide sm:text-[11px]" style={{ color: accent.textSoft }}>
            Set vinti <b className="text-sm font-extrabold sm:text-base" style={{ color: accent.text }}>{team.setsWon}</b>
          </span>
          {(onToggleTimeout || substitutions) && (
            <div className={cn("flex flex-col gap-1", large && "md:flex-row")}>
              {onToggleTimeout && (
                <button
                  type="button"
                  onClick={onToggleTimeout}
                  title={`Segna un time-out (${MAX_TIMEOUTS_PER_SET} a disposizione per set): parte il conto alla rovescia`}
                  data-tour={timeoutTour ? "section-livescore-timeout" : undefined}
                  className={cn(TEAM_ACTION, !timeoutMaxed && ACTION.timeout.tile, large && "sm:min-h-10 sm:text-sm md:min-h-9 md:flex-1 md:px-1.5 md:text-xs lg:text-sm")}
                  style={timeoutMaxed ? { background: "#ffffff", color: "var(--destructive)" } : undefined}
                >
                  {timeoutMaxed ? <TimerOff className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> : <Timer className={cn("h-3 w-3 sm:h-3.5 sm:w-3.5", ACTION.timeout.icon)} />}
                  Time-out
                  <b className="tabular-nums">
                    {team.timeoutsUsed}/{MAX_TIMEOUTS_PER_SET}
                  </b>
                </button>
              )}
              {substitutions && (
                <button
                  type="button"
                  onClick={substitutions.onClick}
                  title="Cambi in questo set: tocca per una sostituzione"
                  aria-label={`Sostituzione ${team.label}: ${substitutions.used} cambi in questo set`}
                  className={cn(TEAM_ACTION, !subsMaxed && ACTION.substitution.tile, large && "sm:min-h-10 sm:text-sm md:min-h-9 md:flex-1 md:px-1.5 md:text-xs lg:text-sm")}
                  style={subsMaxed ? { background: "#ffffff", color: "var(--destructive)" } : undefined}
                >
                  <ArrowLeftRight className={cn("h-3 w-3 sm:h-3.5 sm:w-3.5", !subsMaxed && ACTION.substitution.icon)} />
                  Cambi
                  <b className="tabular-nums">
                    {substitutions.used}
                    {substitutions.limit !== null && `/${substitutions.limit}`}
                  </b>
                </button>
              )}
            </div>
          )}
        </div>
      )}
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
 * punteggio a schermo intero, dove il tabellone è l'unica cosa da leggere.
 * `giant` (schermo largo) fa crescere le cifre con l'altezza della finestra e
 * lascia sotto i punteggi un posto per le informazioni di stato (`children`). */
function CenterDisplay({
  leftScore,
  rightScore,
  servingSide,
  large,
  huge = false,
  giant,
  children,
}: {
  leftScore: number;
  rightScore: number;
  servingSide: "left" | "right" | null;
  large: boolean;
  huge?: boolean;
  /** Dimensione delle cifre in funzione dell'altezza della finestra (a schermo intero crescono di più). */
  giant?: { fullscreen: boolean };
  children?: ReactNode;
}) {
  const scoreClass = cn(
    "animate-[livescore-score-pop_320ms_ease-out] font-[family-name:var(--font-display-minivolley)] font-extrabold leading-none tabular-nums text-white",
    !giant && (huge ? "text-6xl sm:text-8xl" : large ? "text-4xl sm:text-6xl" : "text-3xl sm:text-5xl"),
  );
  // Le cifre seguono l'altezza che il display ha davvero (unità `cqh` del suo contenitore): se un riquadro
  // (fine set, inizio set) gli porta via spazio, si rimpiccioliscono invece di uscire dal tabellone.
  const scoreStyle = giant ? { fontSize: `clamp(2.5rem, 82cqh, ${giant.fullscreen ? "10rem" : "6rem"})` } : undefined;
  const digits = (
    <>
      <div className={cn("flex flex-1 items-center justify-end gap-2 sm:gap-3", large ? "pr-3 sm:pr-6" : "pr-2 sm:pr-4")}>
        {servingSide === "left" && <ServeIndicator />}
        <span key={leftScore} className={scoreClass} style={scoreStyle} data-livescore-digit>
          {leftScore}
        </span>
      </div>
      <div className={cn("my-3 w-px shrink-0 self-stretch bg-white/15 sm:my-4", large && "sm:my-5")} />
      <div className={cn("flex flex-1 items-center gap-2 sm:gap-3", large ? "pl-3 sm:pl-6" : "pl-2 sm:pl-4")}>
        <span key={rightScore} className={scoreClass} style={scoreStyle} data-livescore-digit>
          {rightScore}
        </span>
        {servingSide === "right" && <ServeIndicator />}
      </div>
    </>
  );
  if (!giant) {
    return (
      <div className="flex flex-1 items-center bg-sea-950" data-livescore-scores>
        {digits}
      </div>
    );
  }
  return (
    <div className="flex min-w-0 flex-1 flex-col bg-sea-950">
      <div className="flex min-h-0 flex-1 items-center [container-type:size]" data-livescore-scores>
        {digits}
      </div>
      {children && <div className="shrink-0 px-3 pb-3">{children}</div>}
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
  numberChoices,
  check,
}: {
  team: LiveScoreTeamState;
  teamKey: TeamKey;
  idPrefix: string;
  athleteNames: string[];
  dispatch: (action: Action) => void;
  players: LiveScorePlayers;
  large?: boolean;
  numeric?: boolean;
  numberChoices?: RegistryChoices;
  check?: LineupCheck;
}) {
  // Chi è in campo, una volta sola (con un nome scritto due volte il menù non deve ripeterlo).
  const filledNames = [...new Set(team.positions.map((n) => n.trim()).filter(Boolean))];
  const liberoClash = check?.issues.some((issue) => issue.kind === "liberoOnCourt") ?? false;
  const hostClash = check?.issues.some((issue) => issue.kind === "sameHost") ?? false;
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
        numberChoices={teamKey === "A" ? numberChoices : undefined}
        invalid={liberoClash}
        taken={check?.taken("libero")}
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
                aria-invalid={hostClash || undefined}
                className={hostClash ? "border-red-600 bg-red-50 ring-2 ring-red-600" : undefined}
              >
                <option value="">{hostLabel(index === 0 ? 1 : 2)}…</option>
                {filledNames.map((name) => (
                  // Le due sostituite sono due giocatrici diverse: quella già scelta nell'altro menù non si ripete.
                  <option key={name} value={name} disabled={name === team.hostNames[1 - index].trim() && name !== team.hostNames[index].trim()}>
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
 * bordo campo, ma si usa anche dal telefono (campo e pulsanti dei punti si
 * adattano alla larghezza). Funziona dal 2 contro 2 al 6 contro 6, con o senza
 * libero, o anche senza formazione (solo punteggio). Formazioni, punteggio, set e stato
 * della libero si salvano in automatico per qualche ora (vedi
 * LIVE_SCORE_TTL_MS), così un ricaricamento accidentale non fa perdere il
 * gioco in corso; lo storico punti (per l'annulla) resta invece solo in
 * memoria. In Partita un admin può accendere la diretta: il sito pubblico
 * mostra il punteggio (mai nomi o formazioni) mentre lo si segna.
 */
export function LiveScoreClient({
  athleteNames,
  registryNumbers,
  team,
  todayMatches,
}: {
  athleteNames: string[];
  /** I numeri di maglia dell'anagrafica atlete, da scegliere in Partita per la nostra squadra. */
  registryNumbers: RegistryNumber[];
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
  /** Sostituzione aperta: squadra e (se toccata in campo) posizione di chi esce. */
  const [substitution, setSubstitution] = useState<{ team: TeamKey; position: CourtPosition | null } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pendingServer, setPendingServer] = useState<TeamKey>("A");
  /** Il time-out in corso, con il suo conto alla rovescia (solo a schermo: non si salva con la partita). */
  const [timeoutRun, setTimeoutRun] = useState<TimeoutRun | null>(null);
  const [timeoutSound, setTimeoutSound] = useState(readTimeoutSound);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, isSimulated, toggle: toggleFullscreen } = useStageFullscreen(stageRef);
  // Schermo largo: tabellone in alto, e sotto tre colonne (punti e cambi di una squadra, campo e azioni, punti e cambi dell'altra).
  const wide = useMediaQuery(WIDE_QUERY);
  // La barra delle azioni: a schermo intero ogni pixel in altezza va al campo, quindi i pulsanti sono un po' più bassi.
  const toolButton = cn(TOOL_BUTTON, isFullscreen && "sm:h-10 sm:px-2.5 sm:text-[13px]");
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
  const { mode, playersPerSide, withLineup, useLibero, rules } = match;
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(FORMAT_STORAGE_KEY, JSON.stringify({ mode, playersPerSide, withLineup, useLibero, rules }));
    } catch {
      // localStorage non disponibile: si riparte dal formato predefinito.
    }
  }, [loaded, mode, playersPerSide, withLineup, useLibero, rules]);

  function handleNewMatch() {
    const message = match.publicLive
      ? "Ricominciare da capo? Punteggi e formazioni attuali andranno persi e la diretta sul sito si chiude."
      : "Ricominciare da capo? Punteggi e formazioni attuali andranno persi.";
    if (!window.confirm(message)) return;
    setEditingNames(false);
    setTimeoutRun(null);
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
  // Se la partita è collegata al calendario, le convocate vengono per prime.
  const linkedMatch = todayMatches.find((m) => m.id === match.matchId) ?? null;
  const numberChoices = numeric ? orderRegistryNumbers(registryNumbers, linkedMatch?.calledUpAthleteIds ?? [], match.category) : undefined;
  const showLiberoFields = match.withLineup && match.useLibero && hasLiberoOption(match.playersPerSide);
  // Numeri (o nomi) scritti due volte, libero con il numero di chi è in campo: si segnano in rosso, e finché ci sono la partita non parte.
  const checks: Record<TeamKey, LineupCheck> = { A: lineupCheckFor(match.teamA, match), B: lineupCheckFor(match.teamB, match) };
  const lineupItems = (["A", "B"] as const).flatMap((key) =>
    checks[key].issues.map((issue) => ({
      team: displayLabel(match[teamKeyProp(key)], key),
      text: lineupIssueText(issue, { numeric: match.mode === "match", players: match.playersPerSide }),
    })),
  );
  const lineupBlocked = lineupItems.length > 0;
  // Senza formazione il tabellone è l'unica cosa da guardare: più grande.
  const bigBoard = isFullscreen || !match.withLineup;
  const publicPath = (match.publicLive ? match.team : team) === "minivolley" ? "/minivolley" : "/";
  const subLimit = substitutionLimit(match.playersPerSide);
  const closeSubstitution = useCallback(() => setSubstitution(null), []);
  // Fine set (limite raggiunto), sorteggio del set decisivo da fare o partita chiusa: i punti restano fermi.
  const setEnd = suggestedSetEnd(match);
  const tossPending = needsFirstServer(match);
  const pointsLocked = Boolean(setEnd) || tossPending || matchWinner !== null;
  // Inizio di ogni set (0-0, con la formazione): chi batte per primo, formazioni, campi.
  const showSetStart = match.started && match.withLineup && !setEnd && matchWinner === null && isSetFresh(match);
  const savedSetLineup = numeric && linkedMatch ? savedLineupFor(linkedMatch, currentSet(match) - 1, registryNumbers) : null;
  const savedSetup = numeric && linkedMatch ? savedLineupFor(linkedMatch, 0, registryNumbers) : null;

  // Time-out: il conto alla rovescia finisce da solo quando il gioco riprende (un punto, un set chiuso, una nuova partita).
  const totalPoints = match.teamA.score + match.teamB.score;
  if (timeoutRun && (!match.started || timeoutRun.points !== totalPoints)) setTimeoutRun(null);

  /** «Time-out» di una squadra: lo segna e fa partire il conto alla rovescia. Il terzo tocco azzera il conteggio (una correzione): niente conto. */
  function requestTimeout(key: TeamKey) {
    const used = match[teamKeyProp(key)].timeoutsUsed;
    dispatch({ type: "toggleTimeout", team: key });
    if (used >= MAX_TIMEOUTS_PER_SET) {
      setTimeoutRun((run) => (run?.team === key ? null : run));
      return;
    }
    if (timeoutSound) prepareAudio(); // il browser lascia suonare a fine conto solo se parte da un tocco
    setTimeoutRun(startTimeoutRun(key, used + 1, totalPoints, nowMs()));
  }

  function toggleTimeoutSound() {
    const next = !timeoutSound;
    setTimeoutSound(next);
    try {
      localStorage.setItem(TIMEOUT_SOUND_KEY, next ? "on" : "off");
    } catch {
      // localStorage non disponibile: vale solo finché la pagina è aperta.
    }
    if (next) prepareAudio();
  }
  const closeTimeout = useCallback(() => setTimeoutRun(null), []);

  // Tastiera (computer a bordo campo): ← e → segnano il punto della squadra a sinistra o a destra, ⌫ annulla.
  useEffect(() => {
    if (!match.started) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || substitution) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, select, textarea, [contenteditable='true'], [role='dialog']")) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        dispatch({ type: "point", winner: leftKey });
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        dispatch({ type: "point", winner: rightKey });
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        dispatch({ type: "undo" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [match.started, leftKey, rightKey, substitution]);

  // ── Impostazione: i blocchi si dispongono in una colonna (telefono, tablet in piedi) o in due (schermo largo:
  // i dati e «Inizia» a sinistra, il campo con le formazioni, più piccolo, a destra). ──
  const setupOpponent = match.mode === "match" && (
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
                {[m.category ? CATEGORY_LABELS[m.category] : null, m.time, m.opponent].filter(Boolean).join(" · ")}
              </option>
            ))}
          </Select>
          <FieldHint>Scrive da sola l&apos;avversaria e dice alla diretta pubblica di che categoria è.</FieldHint>
          {savedSetup && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2.5"
              onClick={() => dispatch({ type: "applySavedLineup", team: "A", ...savedSetup })}
              data-livescore-use-saved
            >
              Usa la formazione salvata del 1° set
            </Button>
          )}
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
  );

  const setupCourt = match.withLineup && (
    <div data-tour="section-livescore-court">
      <DualLiveScoreCourt
        className="shrink-0"
        players={match.playersPerSide}
        labelA={displayLabel(leftTeam, leftKey)}
        labelB={displayLabel(rightTeam, rightKey)}
        renderCellA={renderTeamCell(leftTeam, leftKey, true, athleteNames, false, dispatch, isFullscreen, numeric, false, undefined, numberChoices, checks[leftKey])}
        renderCellB={renderTeamCell(rightTeam, rightKey, true, athleteNames, false, dispatch, isFullscreen, numeric, false, undefined, numberChoices, checks[rightKey])}
        large={isFullscreen}
        stackOnPhone
      />
      {lineupBlocked && (
        <div className="mt-2.5">
          <LineupIssuesCard items={lineupItems} />
        </div>
      )}
    </div>
  );

  const setupLibero = showLiberoFields && (
    <div className="grid gap-4 sm:grid-cols-2" data-tour="section-livescore-libero">
      <LiberoFields
        team={match.teamA}
        teamKey="A"
        idPrefix="a-setup"
        athleteNames={athleteNames}
        dispatch={dispatch}
        players={match.playersPerSide}
        numeric={numeric}
        numberChoices={numberChoices}
        check={checks.A}
      />
      <LiberoFields
        team={match.teamB}
        teamKey="B"
        idPrefix="b-setup"
        athleteNames={athleteNames}
        dispatch={dispatch}
        players={match.playersPerSide}
        numeric={numeric}
        numberChoices={numberChoices}
        check={checks.B}
      />
    </div>
  );

  // Solo punteggio: chi batte non si segue, quindi non si chiede.
  const setupServe = match.withLineup && (
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
  );

  const setupStartHint = lineupBlocked && (
    <p className="text-center text-sm font-semibold text-destructive" data-livescore-start-blocked>
      Prima correggi le formazioni segnate in rosso.
    </p>
  );
  const setupStart = (
    <Button
      onClick={() => {
        dispatch({ type: "startMatch", servingTeam: match.withLineup ? pendingServer : null });
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
      disabled={lineupBlocked}
      size="lg"
      className="w-full"
      data-tour="section-livescore-start"
    >
      <Volleyball className="h-4 w-4" />
      Inizia
    </Button>
  );

  // ── La partita in corso ──────────────────────────────────────────────────────────────────────
  // Gli stessi pezzi si dispongono in due modi. Su telefono e tablet in piedi una colonna sola: azioni, tabellone,
  // punti, campo. Su schermo largo il tabellone sta in alto e sotto ci sono tre colonne: i punti, i time-out e i
  // cambi di una squadra, il campo con le azioni della partita, e gli stessi comandi dell'altra squadra.
  // I pulsanti sono quelli di sempre: cambia solo dove stanno.
  const tool = (...extra: Array<string | false | null | undefined>) => cn(wide ? WIDE_TOOL : toolButton, ...extra);
  const toolIcon = wide ? "h-5 w-5" : TOOL_ICON;

  const historyStreak = (
    <SetHistoryAndStreak setHistory={match.setHistory} pointLog={state.pointLog} mode={match.mode} opponentColor={match.opponentColor} />
  );

  const undoButton = (
    <Button
      variant="secondary"
      className={tool(ACTION.undo.tile, wide && "col-span-2")}
      onClick={() => dispatch({ type: "undo" })}
      disabled={state.history.length === 0}
      title="Toglie l'ultima azione (un punto, un cambio, la chiusura di un set)"
    >
      <Undo2 className={cn(toolIcon, ACTION.undo.icon)} />
      Annulla
    </Button>
  );
  const substitutionButton = match.withLineup && (
    <Button
      variant="soft"
      className={tool(ACTION.substitution.tile)}
      onClick={() => {
        setEditingNames(false);
        setSubstitution({ team: "A", position: null });
      }}
      data-tour="section-livescore-substitution"
    >
      <ArrowLeftRight className={cn(toolIcon, ACTION.substitution.icon)} />
      Cambio
    </Button>
  );
  const closeSetButton = (
    <Button
      variant="outline"
      className={tool(ACTION.closeSet.tile)}
      onClick={() => dispatch({ type: "closeSet" })}
      disabled={tied}
      title={tied ? "Punteggio pari: continua a giocare prima di chiudere il set." : undefined}
    >
      <Flag className={cn(toolIcon, ACTION.closeSet.icon)} />
      Chiudi set
    </Button>
  );
  const invertButton = (
    <Button variant="outline" className={tool(ACTION.swap.tile)} onClick={() => dispatch({ type: "toggleSides" })} title="Scambia i due lati del campo">
      <Repeat className={cn(toolIcon, ACTION.swap.icon)} />
      Inverti
    </Button>
  );
  const formationsButton = match.withLineup && (
    <Button
      variant="outline"
      className={tool((editingNames ? ACTION.lineupsDone : ACTION.lineups).tile)}
      onClick={() => setEditingNames((v) => !v)}
      disabled={editingNames && lineupBlocked}
      title={editingNames && lineupBlocked ? "Prima correggi i numeri in rosso" : undefined}
      data-tour="section-livescore-formations"
    >
      <Pencil className={cn(toolIcon, (editingNames ? ACTION.lineupsDone : ACTION.lineups).icon)} />
      {editingNames ? "Fatto" : "Formazioni"}
    </Button>
  );
  const publicButton = match.mode === "match" && (
    <span className="flex items-stretch gap-0.5 sm:inline-flex" data-tour="section-livescore-public">
      <Button
        variant={match.publicLive ? "danger" : "outline"}
        className={tool("min-w-0 flex-1", match.publicLive ? "border-destructive-strong" : ACTION.live.tile)}
        onClick={togglePublicLive}
        aria-pressed={match.publicLive}
        data-livescore-public-toggle
        title={
          match.publicLive
            ? "Il punteggio si vede sul sito pubblico: tocca per spegnere la diretta."
            : "Mostra il punteggio in diretta sul sito pubblico."
        }
      >
        <span className={cn("h-2.5 w-2.5 rounded-full", match.publicLive ? "animate-pulse bg-white" : "bg-fuchsia-500")} />
        {match.publicLive ? "In diretta" : "Diretta"}
      </Button>
      {match.publicLive && (
        <a
          href={publicPath}
          target="_blank"
          rel="noreferrer"
          title="Apri il sito pubblico"
          aria-label="Apri il sito pubblico"
          className={buttonVariants({ variant: "quiet", size: "icon-sm", className: "self-center" })}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </span>
  );
  const newButton = (
    <Button
      variant="outline"
      className={tool(ACTION.fresh.tile)}
      onClick={handleNewMatch}
      title="Cancella questa partita e ricomincia da capo"
    >
      <RefreshCw className={cn(toolIcon, ACTION.fresh.icon)} />
      Nuovo
    </Button>
  );
  // Lo schermo intero sta sempre nella riga in alto, grande come gli altri pulsanti di quella riga.
  const fullscreenButton = (
    <Button variant="outline" className={toolButton} onClick={toggleFullscreen} data-tour="section-livescore-fullscreen">
      {isFullscreen ? <Minimize2 className={TOOL_ICON} /> : <Maximize2 className={TOOL_ICON} />}
      {isFullscreen ? "Esci" : "Schermo intero"}
    </Button>
  );

  const winnerBanner = matchWinner && (
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
      <button
        type="button"
        onClick={handleNewMatch}
        className="ml-2 rounded-full bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-wide text-sea-950 shadow-sm transition-colors hover:bg-white"
      >
        Nuova partita
      </button>
    </div>
  );

  const teamBlock = (key: TeamKey) => {
    const team = match[teamKeyProp(key)];
    return (
      <TeamBlock
        team={team}
        teamKey={key}
        mode={match.mode}
        opponentColor={match.opponentColor}
        large={bigBoard}
        layout={wide ? "board" : "side"}
        editable={!(match.mode === "match" && key === "A")}
        placeholder={match.mode === "match" && key === "B" ? "Nome avversaria" : undefined}
        onLabelChange={(value) => dispatch({ type: "setLabel", team: key, value })}
        // Su schermo largo time-out e cambi stanno sotto il pulsante dei punti (vedi teamColumn).
        onToggleTimeout={wide ? undefined : () => requestTimeout(key)}
        timeoutTour={key === leftKey}
        substitutions={
          !wide && match.withLineup
            ? { used: team.substitutionsUsed, limit: subLimit, onClick: () => setSubstitution({ team: key, position: null }) }
            : undefined
        }
      />
    );
  };
  const statusStrip = <StatusStrip match={match} numeric={numeric} />;
  // Tabellone "stile tv" chiuso in un riquadro proprio (bordo + sfondo distinti dalla pagina): lo isola meglio dal resto,
  // invece del solo anello sottile di prima. Due blocchi squadra a tinta piatta ai lati, display centrale con i due
  // punteggi grandi. Su schermo largo cresce con l'altezza e porta sotto i punteggi la striscia di stato.
  const scoreboard = (
    <div
      className={cn(
        "rounded-3xl border-2 border-border-subtle bg-surface shadow-[0_8px_24px_-16px_rgba(15,23,42,0.4)]",
        isFullscreen ? "p-2" : "p-2.5",
        wide ? cn("flex flex-col", isFullscreen ? "max-h-[24rem] min-h-[11rem] flex-1" : "h-48 shrink-0") : "shrink-0",
      )}
    >
      <div
        className={cn(
          "flex overflow-hidden rounded-2xl ring-1 ring-sea-950/10",
          isFullscreen ? "shadow-[0_20px_40px_-18px_rgba(12,30,42,0.5)]" : "shadow-lg",
          wide && "min-h-0 flex-1",
        )}
      >
        {teamBlock(leftKey)}
        <CenterDisplay
          leftScore={leftTeam.score}
          rightScore={rightTeam.score}
          servingSide={match.servingTeam === leftKey ? "left" : match.servingTeam === rightKey ? "right" : null}
          large={bigBoard}
          huge={isFullscreen && !match.withLineup}
          giant={wide ? { fullscreen: isFullscreen } : undefined}
        >
          {wide && statusStrip}
        </CenterDisplay>
        {teamBlock(rightKey)}
      </div>
    </div>
  );
  // Le schede che chiedono un'azione (fine set, cambio campo, inizio set): sopra i pulsanti dei punti, che restano fermi finché non si sceglie.
  const statusCards = (
    <>
      <LineupIssuesCard items={lineupItems} onFix={editingNames ? undefined : () => setEditingNames(true)} />
      {timeoutRun && (
        <TimeoutCard
          run={timeoutRun}
          teamLabel={displayLabel(match[teamKeyProp(timeoutRun.team)], timeoutRun.team)}
          accent={getTeamAccent(timeoutRun.team, match.mode, match.opponentColor)}
          soundOn={timeoutSound}
          onToggleSound={toggleTimeoutSound}
          onClose={closeTimeout}
        />
      )}
      <SideChangeCard match={match} onChange={() => dispatch({ type: "toggleSides" })} />
      {setEnd && <SetEndCard match={match} onClose={() => dispatch({ type: "closeSet" })} onUndo={() => dispatch({ type: "undo" })} />}
      {showSetStart && (
        <SetStartCard
          match={match}
          numeric={numeric}
          editingLineups={editingNames}
          lineupsBlocked={lineupBlocked}
          onChoose={(key) => dispatch({ type: "chooseFirstServer", team: key })}
          onToggleLineups={() => setEditingNames((v) => !v)}
          savedLineup={
            savedSetLineup
              ? {
                  label: `Usa la formazione salvata del ${currentSet(match)}° set`,
                  onUse: () => dispatch({ type: "applySavedLineup", team: "A", ...savedSetLineup }),
                }
              : null
          }
        />
      )}
    </>
  );
  const court = match.withLineup && (
    <DualLiveScoreCourt
      className={wide || isFullscreen ? "min-h-0 flex-[0_1_auto]" : "shrink-0"}
      fitHeight={isFullscreen}
      players={match.playersPerSide}
      labelA={displayLabel(leftTeam, leftKey)}
      labelB={displayLabel(rightTeam, rightKey)}
      renderCellA={renderTeamCell(leftTeam, leftKey, editingNames, athleteNames, match.servingTeam === leftKey, dispatch, isFullscreen || wide, numeric, liberoInPlay(match, leftTeam), (position) => setSubstitution({ team: leftKey, position }), numberChoices, checks[leftKey])}
      renderCellB={renderTeamCell(rightTeam, rightKey, editingNames, athleteNames, match.servingTeam === rightKey, dispatch, isFullscreen || wide, numeric, liberoInPlay(match, rightTeam), (position) => setSubstitution({ team: rightKey, position }), numberChoices, checks[rightKey])}
      large={isFullscreen || wide}
    />
  );
  const liberoEditor = match.withLineup && editingNames && showLiberoFields && (
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
        numberChoices={numberChoices}
        check={checks[leftKey]}
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
        numberChoices={numberChoices}
        check={checks[rightKey]}
      />
    </div>
  );

  // Schermo largo: la colonna di una squadra. Il pulsante dei punti, grande, e sotto time-out e cambi, col bordo del
  // colore della squadra. La colonna di sinistra è quella della squadra che sta a sinistra del campo (e della freccia ←).
  const teamColumn = (key: TeamKey) => {
    const team = match[teamKeyProp(key)];
    const accent = getTeamAccent(key, match.mode, match.opponentColor);
    const isLeft = key === leftKey;
    const timeoutMaxed = team.timeoutsUsed >= MAX_TIMEOUTS_PER_SET;
    const substitutionsMaxed = subLimit !== null && team.substitutionsUsed >= subLimit;
    const maxedStyle = { borderColor: "var(--destructive)", color: "var(--destructive)" };
    return (
      <div className="flex min-h-0 flex-col gap-2" data-livescore-team-column={isLeft ? "left" : "right"}>
        <button
          type="button"
          onClick={() => dispatch({ type: "point", winner: key })}
          disabled={pointsLocked}
          className={cn(
            POINT_BUTTON_BASE,
            "min-h-28 flex-1 flex-col gap-3 py-3 text-lg disabled:cursor-not-allowed disabled:opacity-40 disabled:active:translate-y-0 disabled:active:border-b-[6px] xl:text-xl",
          )}
          style={{ background: accent.background, color: accent.text }}
        >
          {/* Il «+1» e la freccia sono solo da vedere: il nome del pulsante resta «Punto …». */}
          <span aria-hidden className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-black/20 text-5xl font-extrabold tabular-nums">
            +1
          </span>
          <span className="min-w-0 break-words">
            <span className="block text-sm opacity-80">Punto </span>
            <span className="block">{displayLabel(team, key)}</span>
          </span>
          <kbd
            aria-hidden
            className={cn("absolute top-2 rounded-md bg-black/20 px-1.5 py-0.5 font-sans text-xs font-bold", isLeft ? "left-2.5" : "right-2.5")}
            title="Tasto della tastiera"
          >
            {isLeft ? "←" : "→"}
          </kbd>
        </button>
        <button
          type="button"
          onClick={() => requestTimeout(key)}
          title={`Segna un time-out (${MAX_TIMEOUTS_PER_SET} a disposizione per set): parte il conto alla rovescia`}
          data-tour={isLeft ? "section-livescore-timeout" : undefined}
          className={cn(WIDE_TEAM_ACTION, ACTION.timeout.tile)}
          style={timeoutMaxed ? maxedStyle : { borderColor: accent.background }}
        >
          {timeoutMaxed ? <TimerOff className="h-4 w-4" /> : <Timer className={cn("h-4 w-4", ACTION.timeout.icon)} />}
          Time-out
          <b className="tabular-nums">
            {team.timeoutsUsed}/{MAX_TIMEOUTS_PER_SET}
          </b>
        </button>
        {match.withLineup && (
          <button
            type="button"
            onClick={() => setSubstitution({ team: key, position: null })}
            title="Cambi in questo set: tocca per una sostituzione"
            aria-label={`Sostituzione ${team.label}: ${team.substitutionsUsed} cambi in questo set`}
            className={cn(WIDE_TEAM_ACTION, ACTION.substitution.tile)}
            style={substitutionsMaxed ? maxedStyle : { borderColor: accent.background }}
          >
            <ArrowLeftRight className={cn("h-4 w-4", !substitutionsMaxed && ACTION.substitution.icon)} />
            Cambi
            <b className="tabular-nums">
              {team.substitutionsUsed}
              {subLimit !== null && `/${subLimit}`}
            </b>
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      <div
        ref={stageRef}
        data-livescore-stage
        className={cn(
          // Fuori dallo schermo intero si recupera un po' del margine alto della pagina.
          !isFullscreen && "-mt-3 sm:-mt-5",
          isFullscreen &&
            "overflow-y-auto bg-gradient-to-br from-primary-soft via-background to-accent p-0.5 sm:p-1",
          // Schermo intero vero: lo riempie il browser. Simulato: il riquadro ricopre la finestra.
          isFullscreen && !isSimulated && "h-screen w-screen",
          isSimulated && "fixed inset-0 z-40",
        )}
      >
        <div
          className={cn(
            isFullscreen && "mx-auto flex h-full max-w-[1700px] flex-col gap-2",
          )}
        >
          {/* Su iPad e iPhone la barra di stato sfoca la fascia in alto: qui non c'è niente (vedi globals.css). */}
          {isFullscreen && <div aria-hidden className="fullscreen-inset-top" />}
          {!match.started ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
              {/* Sul telefono il pulsante va sotto il titolo, che così non si spezza su tre righe. */}
              <div className="min-w-[min(100%,18rem)] flex-1">
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
                <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground lg:max-w-none">
                  {!match.withLineup
                    ? "Solo punteggio: niente formazioni né rotazioni, si segnano punti, set e time-out. Premi «Inizia» quando siete pronti."
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
              <SetupOption label="Formula">
                <SegmentedButtons
                  ariaLabel="Formula"
                  // Con «Libera» sono quattro: sui telefoni più stretti vanno a capo invece di uscire dallo schermo.
                  className="flex-wrap"
                  value={match.rules.format}
                  onChange={(value) => dispatch({ type: "setRules", rules: { format: value } })}
                  items={[
                    ...(match.mode === "training" || match.rules.format === "free" ? [{ value: "free" as const, label: "Libera", title: "Nessun limite di punti: chiudi tu i set" }] : []),
                    { value: "bo5" as const, label: MATCH_FORMAT_SHORT_LABELS.bo5, title: MATCH_FORMAT_LABELS.bo5 },
                    { value: "bo3" as const, label: MATCH_FORMAT_SHORT_LABELS.bo3, title: MATCH_FORMAT_LABELS.bo3 },
                    { value: "fixed3" as const, label: MATCH_FORMAT_SHORT_LABELS.fixed3, title: MATCH_FORMAT_LABELS.fixed3 },
                  ]}
                />
              </SetupOption>
              {match.rules.format !== "free" && (
                <SetupOption label="Punti">
                  <div className="flex items-start gap-2" data-livescore-points>
                    <div className="w-24">
                      <PointsInput
                        id="livescore-set-points"
                        label="Per set"
                        value={match.rules.setPoints}
                        min={MIN_SET_POINTS}
                        onCommit={(setPoints) => dispatch({ type: "setRules", rules: { setPoints } })}
                      />
                    </div>
                    <div className="w-24">
                      <PointsInput
                        id="livescore-last-set-points"
                        label="Ultimo set"
                        value={match.rules.lastSetPoints}
                        min={MIN_SET_POINTS}
                        onCommit={(lastSetPoints) => dispatch({ type: "setRules", rules: { lastSetPoints } })}
                      />
                    </div>
                  </div>
                  {match.rules.format === "fixed3" && (
                    <p className="mt-1.5 max-w-[14rem] text-xs leading-snug text-muted-foreground">
                      Con 3 set fissi il regolamento della gara stabilisce se il 3° va a 15 o a 25.
                    </p>
                  )}
                </SetupOption>
              )}
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
                  {hasLiberoOption(match.playersPerSide) && (
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
                  )}
                </>
              )}
            </div>

            {wide && match.withLineup ? (
              <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,6fr)] items-start gap-5">
                <div className="space-y-5">
                  {setupOpponent}
                  {setupServe}
                  {setupStartHint}
                  {/* Resta in vista anche se la schermata scorre: «Inizia» si preme sempre dopo aver scritto le formazioni. */}
                  <div className="sticky bottom-2 z-10 rounded-xl shadow-lg">{setupStart}</div>
                </div>
                <div className="space-y-5">
                  {setupCourt}
                  {setupLibero}
                </div>
              </div>
            ) : (
              <>
                {setupOpponent}
                {setupCourt}
                {setupLibero}
                {setupServe}
                {setupStartHint}
                {setupStart}
              </>
            )}
          </div>
        ) : wide ? (
          <div className={cn("mx-auto w-full max-w-[1360px]", isFullscreen ? "flex h-full min-h-0 flex-col gap-2" : "flex flex-col gap-3")}>
            {/* In alto: titolo, guida, storico dei set con gli ultimi punti, schermo intero. Le azioni della partita
             * non stanno più qui: sono sotto il campo, vicino a quello su cui agiscono. */}
            <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className={cn("display-wide shrink-0 text-foreground", isFullscreen ? "sr-only" : "text-2xl")}>In campo</h1>
              <SectionTour steps={LIVESCORE_INGAME_TOUR_STEPS} />
              <div className="flex flex-1 justify-center">{historyStreak}</div>
              {fullscreenButton}
            </div>

            {winnerBanner}
            {scoreboard}
            {statusCards}

            {/* Tre colonne: i comandi della squadra a sinistra, il campo (più piccolo) con le azioni della partita
             * in mezzo, i comandi dell'altra squadra a destra. Così ogni pulsante dei punti sta accanto al lato
             * del campo che segna, a portata di pollice. */}
            <div
              className={cn(
                "grid grid-cols-[clamp(11rem,20vw,16rem)_minmax(0,1fr)_clamp(11rem,20vw,16rem)] gap-2.5",
                // A schermo intero la riga si stringe se manca spazio (il campo rimpicciolisce); mentre si correggono
                // le formazioni no: le caselle devono restare comode, e se non basta lo spazio la schermata scorre.
                isFullscreen && !editingNames ? "min-h-0 grid-rows-[minmax(0,1fr)]" : "grid-rows-[auto]",
                isFullscreen && (match.withLineup ? (editingNames ? "flex-none" : "flex-[0_1_auto]") : "flex-1"),
              )}
              data-tour="section-livescore-score"
            >
              {teamColumn(leftKey)}
              <div className={cn("mx-auto flex min-h-0 w-full min-w-0 max-w-[46rem] flex-col gap-2", !match.withLineup && "justify-end")}>
                {court}
                {liberoEditor}
                {/* Azioni della partita: ognuna col suo colore (vedi ACTION), «Annulla» doppio, «Nuovo» rosso (cancella la partita). */}
                <div className="grid shrink-0 grid-cols-4 gap-2" data-tour="section-livescore-toolbar">
                  {undoButton}
                  {substitutionButton}
                  {closeSetButton}
                  {invertButton}
                  {formationsButton}
                  {publicButton}
                  {newButton}
                </div>
              </div>
              {teamColumn(rightKey)}
            </div>
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
                className={cn("display-wide shrink-0 text-foreground", isFullscreen ? "sr-only" : "text-2xl")}
              >
                In campo
              </h1>
              <SectionTour steps={LIVESCORE_INGAME_TOUR_STEPS} />
              {/* Niente min-w-0: se lo spazio non basta, la riga va a capo
               * invece di far scivolare lo storico sopra il titolo. */}
              <div className="flex flex-1 justify-center">{historyStreak}</div>
              {/* Azioni della partita: su telefono tasselli (icona sopra, etichetta sotto) in due righe da quattro;
               * da tablet pulsanti in fila, con il bordo e il colore che ne dicono l'uso: ognuna ha il suo colore
               * (vedi ACTION), «Annulla» scuro, «Nuovo» rosso (cancella la partita). */}
              <div
                className="grid w-full grid-cols-4 gap-1.5 sm:flex sm:w-auto sm:max-w-full sm:shrink-0 sm:flex-wrap sm:items-center sm:gap-2"
                data-tour="section-livescore-toolbar"
              >
                {undoButton}
                {substitutionButton}
                {closeSetButton}
                {invertButton}
                {formationsButton}
                {publicButton}
                {newButton}
                {fullscreenButton}
              </div>
            </div>

            {winnerBanner}
            {scoreboard}
            {statusStrip}
            {statusCards}

            <div
              className={cn(
                "grid shrink-0 grid-cols-2 gap-2.5 sm:gap-3.5",
                // Senza formazione i due pulsanti prendono il posto del campo.
                match.withLineup ? (isFullscreen ? "h-[4.5rem] sm:h-[5.25rem]" : "h-[5.25rem] sm:h-24") : isFullscreen ? "min-h-28 flex-1" : "h-40",
              )}
              data-tour="section-livescore-score"
            >
              {([leftKey, rightKey] as const).map((key, index) => {
                const accent = getTeamAccent(key, match.mode, match.opponentColor);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => dispatch({ type: "point", winner: key })}
                    disabled={pointsLocked}
                    className={cn(
                      POINT_BUTTON_BASE,
                      "disabled:cursor-not-allowed disabled:opacity-40 disabled:active:translate-y-0 disabled:active:border-b-[6px]",
                      !match.withLineup ? "text-xl sm:text-3xl" : "text-base sm:text-xl",
                    )}
                    style={{ background: accent.background, color: accent.text }}
                  >
                    {/* Il «+1» e la freccia sono solo da vedere: il nome del pulsante resta «Punto …». */}
                    <span
                      aria-hidden
                      className={cn(
                        "hidden shrink-0 place-items-center rounded-full bg-black/20 font-extrabold tabular-nums sm:grid",
                        match.withLineup ? "h-12 w-12 text-2xl" : "h-16 w-16 text-4xl",
                      )}
                    >
                      +1
                    </span>
                    <span className="min-w-0">Punto {displayLabel(match[teamKeyProp(key)], key)}</span>
                    <kbd
                      aria-hidden
                      className={cn(
                        "absolute top-2 hidden rounded-md bg-black/20 px-1.5 py-0.5 font-sans text-xs font-bold lg:block",
                        index === 0 ? "left-2.5" : "right-2.5",
                      )}
                      title="Tasto della tastiera"
                    >
                      {index === 0 ? "←" : "→"}
                    </kbd>
                  </button>
                );
              })}
            </div>

            {court}
            {liberoEditor}
          </div>
          )}
        </div>
        {/* Dentro il riquadro del tabellone, così resta visibile anche a schermo intero. */}
        {substitution && match.started && match.withLineup && (
          <SubstitutionDialog
            key={`${substitution.team}-${substitution.position ?? "none"}`}
            match={match}
            initialTeam={substitution.team}
            initialPosition={substitution.position}
            athleteNames={athleteNames}
            numberChoices={numberChoices}
            teamLabel={(key) => displayLabel(match[teamKeyProp(key)], key)}
            onConfirm={(teamKey, position, incoming) => {
              dispatch({ type: "substitute", team: teamKey, position, incoming });
              setSubstitution(null);
            }}
            onClose={closeSubstitution}
          />
        )}
      </div>
    </>
  );
}

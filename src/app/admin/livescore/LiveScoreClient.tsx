"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { Maximize2, Minimize2, Pencil, RefreshCw, Repeat, Timer, TimerOff, Trophy, Undo2, Volleyball } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Label, Select, FieldHint, Input } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { DualLiveScoreCourt } from "./LiveScoreCourt";
import { shortName } from "@/components/matches/VolleyCourt";
import { SectionTour } from "@/components/tour/SectionTour";
import { LIVESCORE_INGAME_TOUR_STEPS, LIVESCORE_SETUP_TOUR_STEPS } from "@/components/tour/sectionSteps";
import type { CourtPosition, LiveScoreMode, LiveScoreSetResult, LiveScoreState, LiveScoreTeamState } from "@/lib/types";

/** I sei nomi "titolari" della rotazione, indicizzati per posizione
 * (positions[0] = posizione 1, ... positions[5] = posizione 6). */
type Positions = [string, string, string, string, string, string];
type TeamKey = "A" | "B";

/** Colore fisso del blu del club (Squadra A, mai personalizzabile). */
const HOME_COLOR = "#3a78bb";
/** Giallo acceso per Squadra B in allenamento: non è un'avversaria vera, e un
 * colore vivace e diverso dal blu del club basta a distinguerla — niente da
 * scegliere, sempre lo stesso. */
const TRAINING_AWAY_COLOR = "#facc15";
/** Colore di partenza per l'avversaria in Partita, finché il coach non ne
 * sceglie uno vero (vedi il selettore colore nella schermata di
 * impostazione). */
const DEFAULT_OPPONENT_COLOR = "#475569";
/** Scorciatoie rapide nel selettore colore avversaria, per non dover aprire
 * ogni volta il color-picker nativo — il coach può comunque scegliere
 * qualunque altro colore con l'ultimo swatch. */
const OPPONENT_COLOR_PRESETS = ["#475569", "#dc2626", "#16a34a", "#7c3aed", "#111827", "#ea580c"];

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Testo bianco o quasi-nero a seconda di quanto è chiaro il colore di
 * sfondo (luminanza relativa WCAG) — necessario perché il colore
 * dell'avversaria è scelto liberamente dal coach (anche chiaro, es. un
 * giallo) e il testo bianco sopra diventerebbe illeggibile. */
function readableTextColor(hex: string): string {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.5 ? "#0d1926" : "#ffffff";
}

/** Colore distintivo per squadra, riusato ovunque serva riconoscerle a
 * colpo d'occhio: tabellone, storico set, ultimi punti, pulsanti "Punto".
 * Squadra A è sempre il blu del club (fisso). Squadra B è il giallo acceso
 * in allenamento (fisso), oppure il colore scelto dal coach per l'avversaria
 * vera in Partita — per questo entrambe sono espresse come colori concreti
 * (non classi Tailwind), col testo calcolato per restare sempre leggibile. */
type TeamAccent = { background: string; text: string; textSoft: string; overlay: string; dot: string; glow: string };

function getTeamAccent(teamKey: TeamKey, mode: LiveScoreMode, opponentColor: string): TeamAccent {
  const hex = teamKey === "A" ? HOME_COLOR : mode === "match" ? opponentColor : TRAINING_AWAY_COLOR;
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

const EMPTY_POSITIONS: Positions = ["", "", "", "", "", ""];
/** In modalità "Partita", Squadra A è sempre il Volley Lignano: etichetta
 * fissa, non un'altra squadra generica da rinominare come in allenamento. */
const HOME_TEAM_LABEL = "Volley Lignano";
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

function initialMatch(mode: LiveScoreMode = "training"): LiveScoreState {
  return {
    started: false,
    mode,
    servingTeam: null,
    sidesSwapped: false,
    teamA: emptyTeam(mode === "match" ? HOME_TEAM_LABEL : "Squadra A"),
    teamB: emptyTeam(mode === "match" ? "" : "Squadra B"),
    setHistory: [],
    opponentColor: DEFAULT_OPPONENT_COLOR,
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
  | { type: "setMode"; mode: LiveScoreMode }
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
      return { match: initialMatch(state.match.mode), history: [], pointLog: [], pointLogHistory: [] };
    case "setMode": {
      if (state.match.started) return state;
      return {
        ...state,
        match: {
          ...state.match,
          mode: action.mode,
          teamA: { ...state.match.teamA, label: action.mode === "match" ? HOME_TEAM_LABEL : "Squadra A" },
          teamB: { ...state.match.teamB, label: action.mode === "match" ? "" : "Squadra B" },
        },
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
  numeric: boolean,
) {
  return function TeamCell(position: CourtPosition) {
    if (editing) {
      return (
        <PositionNameField
          value={team.positions[position - 1]}
          onChange={(value) => dispatch({ type: "setPosition", team: teamKey, position, value })}
          athleteNames={athleteNames}
          placeholder={numeric ? "N." : `Pos. ${position}`}
          numeric={numeric}
        />
      );
    }
    const { name, isLibero } = cellDisplay(position, team);
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
 * tabellone tv, tra i due blocchi colorati di squadra. */
function CenterDisplay({
  leftScore,
  rightScore,
  servingSide,
  large,
}: {
  leftScore: number;
  rightScore: number;
  servingSide: "left" | "right" | null;
  large: boolean;
}) {
  const scoreClass = cn(
    "animate-[livescore-score-pop_320ms_ease-out] font-[family-name:var(--font-display-minivolley)] font-extrabold leading-none tabular-nums text-white",
    large ? "text-4xl sm:text-6xl" : "text-2xl sm:text-3xl",
  );
  return (
    <div className="flex flex-1 items-center bg-sea-950">
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
  large,
  numeric,
}: {
  team: LiveScoreTeamState;
  teamKey: TeamKey;
  idPrefix: string;
  athleteNames: string[];
  dispatch: (action: Action) => void;
  large?: boolean;
  numeric?: boolean;
}) {
  const filledNames = team.positions.map((n) => n.trim()).filter(Boolean);
  const liberoLabel = numeric ? `Numero libero ${team.label}` : `Nome della libero`;
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
          <div>
            {!large && <Label htmlFor={`${idPrefix}-host1`}>1ª centrale</Label>}
            <Select
              id={`${idPrefix}-host1`}
              value={team.hostNames[0]}
              onChange={(e) => dispatch({ type: "setHostName", team: teamKey, index: 0, value: e.target.value })}
            >
              <option value="">1ª centrale…</option>
              {filledNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            {!large && <Label htmlFor={`${idPrefix}-host2`}>2ª centrale</Label>}
            <Select
              id={`${idPrefix}-host2`}
              value={team.hostNames[1]}
              onChange={(e) => dispatch({ type: "setHostName", team: teamKey, index: 1, value: e.target.value })}
            >
              <option value="">2ª centrale…</option>
              {filledNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      )}
      {!large && (
        <FieldHint>
          La libero sostituisce qualunque delle due centrali sia in seconda linea. Se tocca a una di loro
          servire, gioca lei stessa finché non perde il punto: solo da quel momento entra la libero al suo
          posto, fino a quando quella centrale non rientra a rete.
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
    <div className="flex shrink-0 flex-wrap items-center justify-center gap-2.5">
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
            "h-screen w-screen overflow-y-auto bg-gradient-to-br from-sea-50 via-background to-sand-50 p-0.5 sm:p-1",
        )}
      >
        <div
          className={cn(
            isFullscreen && "mx-auto flex h-full max-w-[1700px] flex-col gap-2.5",
          )}
        >
          {!match.started && (
            <div className="flex shrink-0 items-center justify-end gap-2">
              <SectionTour steps={LIVESCORE_SETUP_TOUR_STEPS} />
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
                {match.mode === "match"
                  ? "Scegli i numeri di maglia nelle 6 posizioni di ciascuna squadra come sono disposte in campo, poi indica le libero (se le usi)."
                  : "Scegli i nomi nelle 6 posizioni di ciascuna squadra come sono disposte in campo, poi indica le libero (se le usi)."}
              </p>
            </div>

            {/* Allenamento (nomi) o Partita (numeri di maglia, avversaria
             * col suo nome invece di "Squadra B"): scelta fatta qui, prima
             * di iniziare — cambia come si compilano le posizioni sotto. */}
            <div className="inline-flex rounded-xl border border-border-subtle bg-surface p-1" data-tour="section-livescore-mode">
              {(
                [
                  { mode: "training" as const, label: "Allenamento" },
                  { mode: "match" as const, label: "Partita" },
                ]
              ).map(({ mode, label }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => dispatch({ type: "setMode", mode })}
                  className={cn(
                    "rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors",
                    match.mode === mode ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground/60 hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {match.mode === "match" && (
              <div className="space-y-3.5 rounded-2xl border border-border-subtle bg-surface p-3.5">
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
              </div>
            )}

            <div data-tour="section-livescore-court">
              <DualLiveScoreCourt
                className="shrink-0"
                labelA={displayLabel(leftTeam, leftKey)}
                labelB={displayLabel(rightTeam, rightKey)}
                renderCellA={renderTeamCell(leftTeam, leftKey, true, athleteNames, false, dispatch, isFullscreen, match.mode === "match")}
                renderCellB={renderTeamCell(rightTeam, rightKey, true, athleteNames, false, dispatch, isFullscreen, match.mode === "match")}
                large={isFullscreen}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2" data-tour="section-livescore-libero">
              <LiberoFields
                team={match.teamA}
                teamKey="A"
                idPrefix="a-setup"
                athleteNames={athleteNames}
                dispatch={dispatch}
                numeric={match.mode === "match"}
              />
              <LiberoFields
                team={match.teamB}
                teamKey="B"
                idPrefix="b-setup"
                athleteNames={athleteNames}
                dispatch={dispatch}
                numeric={match.mode === "match"}
              />
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
                  "shrink-0 font-[family-name:var(--font-display-minivolley)] font-extrabold text-foreground",
                  isFullscreen ? "text-sm" : "text-2xl",
                )}
              >
                In campo
              </h1>
              <div className="flex min-w-0 flex-1 justify-center">
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingNames((v) => !v)}
                  data-tour="section-livescore-formations"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {editingNames ? "Fatto" : "Formazioni"}
                </Button>
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
                  large={isFullscreen}
                  editable={!(match.mode === "match" && leftKey === "A")}
                  placeholder={match.mode === "match" && leftKey === "B" ? "Nome avversaria" : undefined}
                  onLabelChange={(value) => dispatch({ type: "setLabel", team: leftKey, value })}
                  onToggleTimeout={() => dispatch({ type: "toggleTimeout", team: leftKey })}
                />
                <CenterDisplay
                  leftScore={leftTeam.score}
                  rightScore={rightTeam.score}
                  servingSide={match.servingTeam === leftKey ? "left" : match.servingTeam === rightKey ? "right" : null}
                  large={isFullscreen}
                />
                <TeamBlock
                  team={rightTeam}
                  teamKey={rightKey}
                  mode={match.mode}
                  opponentColor={match.opponentColor}
                  large={isFullscreen}
                  editable={!(match.mode === "match" && rightKey === "A")}
                  placeholder={match.mode === "match" && rightKey === "B" ? "Nome avversaria" : undefined}
                  onLabelChange={(value) => dispatch({ type: "setLabel", team: rightKey, value })}
                  onToggleTimeout={() => dispatch({ type: "toggleTimeout", team: rightKey })}
                />
              </div>
            </div>

            <div
              className={cn("grid shrink-0 grid-cols-2 gap-2.5 sm:gap-3.5", isFullscreen ? "h-11 sm:h-12" : "h-11")}
              data-tour="section-livescore-score"
            >
              <button
                type="button"
                onClick={() => dispatch({ type: "point", winner: leftKey })}
                className={cn(POINT_BUTTON_BASE, isFullscreen ? "text-sm sm:text-base" : "text-xs sm:text-sm")}
                style={{ background: getTeamAccent(leftKey, match.mode, match.opponentColor).background, color: getTeamAccent(leftKey, match.mode, match.opponentColor).text }}
              >
                Punto {displayLabel(leftTeam, leftKey)}
              </button>
              <button
                type="button"
                onClick={() => dispatch({ type: "point", winner: rightKey })}
                className={cn(POINT_BUTTON_BASE, isFullscreen ? "text-sm sm:text-base" : "text-xs sm:text-sm")}
                style={{ background: getTeamAccent(rightKey, match.mode, match.opponentColor).background, color: getTeamAccent(rightKey, match.mode, match.opponentColor).text }}
              >
                Punto {displayLabel(rightTeam, rightKey)}
              </button>
            </div>

            <DualLiveScoreCourt
              className={isFullscreen ? "min-h-0 flex-1" : "shrink-0"}
              fitHeight={isFullscreen}
              labelA={displayLabel(leftTeam, leftKey)}
              labelB={displayLabel(rightTeam, rightKey)}
              renderCellA={renderTeamCell(leftTeam, leftKey, editingNames, athleteNames, match.servingTeam === leftKey, dispatch, isFullscreen, match.mode === "match")}
              renderCellB={renderTeamCell(rightTeam, rightKey, editingNames, athleteNames, match.servingTeam === rightKey, dispatch, isFullscreen, match.mode === "match")}
              large={isFullscreen}
            />

            {editingNames && (
              <div className={cn("grid shrink-0 sm:grid-cols-2", isFullscreen ? "gap-1.5" : "gap-4")}>
                <LiberoFields
                  team={leftTeam}
                  teamKey={leftKey}
                  idPrefix={`${leftKey}-live`}
                  athleteNames={athleteNames}
                  dispatch={dispatch}
                  large={isFullscreen}
                  numeric={match.mode === "match"}
                />
                <LiberoFields
                  team={rightTeam}
                  teamKey={rightKey}
                  idPrefix={`${rightKey}-live`}
                  athleteNames={athleteNames}
                  dispatch={dispatch}
                  large={isFullscreen}
                  numeric={match.mode === "match"}
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

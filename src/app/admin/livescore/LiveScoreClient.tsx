"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Minus, Pencil, Plus, RefreshCw, RotateCw, Undo2, Volleyball } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Label, Select, FieldHint } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { DualLiveScoreCourt } from "./LiveScoreCourt";
import type { CourtPosition, LiveScoreState, LiveScoreTeamState } from "@/lib/types";

/** I sei nomi "titolari" della rotazione, indicizzati per posizione
 * (positions[0] = posizione 1, ... positions[5] = posizione 6). Il libero
 * non è mai uno di questi sei: sostituisce solo visivamente chi è in
 * seconda linea (vedi cellDisplay), esattamente come nel regolamento. */
type Positions = [string, string, string, string, string, string];

const EMPTY_POSITIONS: Positions = ["", "", "", "", "", ""];
/** Seconda linea (fondo campo): la libero può giocare solo qui. */
const BACK_ROW: readonly CourtPosition[] = [1, 5, 6];
const LIVESCORE_API = "/api/livescore";
/** Tempo di inattività prima di salvare in automatico, per non fare una
 * richiesta a ogni singolo tasto premuto mentre si scrive un nome. */
const AUTOSAVE_DELAY_MS = 900;

/** Una rotazione: chi era in posizione 2 diventa la nuova battitrice
 * (posizione 1), chi era in posizione 1 va in fondo (posizione 6), e così
 * via — l'ordine di rotazione standard della pallavolo. */
function rotateOnce(positions: Positions): Positions {
  const [p1, p2, p3, p4, p5, p6] = positions;
  return [p2, p3, p4, p5, p6, p1];
}

function hostPosition(positions: Positions, hostName: string): CourtPosition | null {
  const host = hostName.trim();
  if (!host) return null;
  const idx = positions.findIndex((name) => name.trim() === host);
  return idx === -1 ? null : ((idx + 1) as CourtPosition);
}

function isLiberoOnCourt(positions: Positions, hostName: string, liberoName: string): boolean {
  if (!liberoName.trim()) return false;
  const position = hostPosition(positions, hostName);
  return position !== null && BACK_ROW.includes(position);
}

/** Cosa mostrare in una cella del campo: il nome della titolare, oppure —
 * quando la giocatrice che la libero sostituisce è in seconda linea — il
 * nome della libero al suo posto. Appena quella giocatrice ruota in prima
 * linea, la libero esce e torna a comparire lei. */
function cellDisplay(
  position: CourtPosition,
  positions: Positions,
  hostName: string,
  liberoName: string,
): { name: string; isLibero: boolean } {
  const host = hostPosition(positions, hostName);
  if (host === position && BACK_ROW.includes(position) && liberoName.trim()) {
    return { name: liberoName.trim(), isLibero: true };
  }
  return { name: positions[position - 1].trim(), isLibero: false };
}

function emptyTeamState(defaultLabel: string): LiveScoreTeamState {
  return { label: defaultLabel, positions: EMPTY_POSITIONS, liberoName: "", hostName: "", score: 0 };
}

/** Tutto lo stato di una delle due squadre sul campo: formazione, libero,
 * punteggio e storico rotazioni (per l'annulla, mai salvato: vedi hydrate).
 * Le due squadre sono indipendenti l'una dall'altra — ognuna ha la propria
 * rotazione perché a un allenamento a due squadre si gira separatamente. */
function useTeamState(defaultLabel: string) {
  const [label, setLabel] = useState(defaultLabel);
  const [positions, setPositions] = useState<Positions>(EMPTY_POSITIONS);
  const [liberoName, setLiberoName] = useState("");
  const [hostName, setHostName] = useState("");
  const [history, setHistory] = useState<Positions[]>([]);
  const [score, setScore] = useState(0);

  const filledNames = useMemo(() => positions.map((n) => n.trim()).filter(Boolean), [positions]);

  function updatePosition(position: CourtPosition, value: string) {
    setPositions((prev) => {
      const next = [...prev] as Positions;
      next[position - 1] = value;
      return next;
    });
  }

  function rotate() {
    setHistory((prev) => [...prev, positions]);
    setPositions((prev) => rotateOnce(prev));
  }

  function undoRotate() {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      setPositions(prev[prev.length - 1]);
      return prev.slice(0, -1);
    });
  }

  function reset() {
    setLabel(defaultLabel);
    setPositions(EMPTY_POSITIONS);
    setLiberoName("");
    setHostName("");
    setHistory([]);
    setScore(0);
  }

  /** Ripristina uno stato salvato (dal tabellone live su Supabase): niente
   * storico rotazioni, che non viene mai salvato. */
  function hydrate(saved: LiveScoreTeamState) {
    setLabel(saved.label);
    setPositions(saved.positions);
    setLiberoName(saved.liberoName);
    setHostName(saved.hostName);
    setHistory([]);
    setScore(saved.score);
  }

  const snapshot: LiveScoreTeamState = { label, positions, liberoName, hostName, score };

  return {
    label,
    setLabel,
    positions,
    updatePosition,
    liberoName,
    setLiberoName,
    hostName,
    setHostName,
    history,
    rotate,
    undoRotate,
    score,
    setScore,
    filledNames,
    reset,
    hydrate,
    snapshot,
  };
}

type TeamState = ReturnType<typeof useTeamState>;

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

function renderTeamCell(team: TeamState, editing: boolean, athleteNames: string[]) {
  return function TeamCell(position: CourtPosition) {
    if (editing) {
      return (
        <PositionNameField
          value={team.positions[position - 1]}
          onChange={(value) => team.updatePosition(position, value)}
          athleteNames={athleteNames}
          placeholder={`Pos. ${position}`}
        />
      );
    }
    const { name, isLibero } = cellDisplay(position, team.positions, team.hostName, team.liberoName);
    return (
      <>
        {position === 1 && (
          <span
            className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-sea-950/70"
            title="Al servizio"
            aria-label={`${team.label || "Squadra"} al servizio`}
          >
            <Volleyball className="h-2.5 w-2.5 text-white" />
          </span>
        )}
        <span
          className={cn(
            "line-clamp-2 rounded-full px-2 py-1 text-[11px] font-bold leading-tight shadow-sm sm:text-xs",
            isLibero ? "bg-sea-950 text-white" : "bg-white/95 text-sea-950",
          )}
        >
          {name || "—"}
        </span>
        {isLibero && (
          <span className="rounded-full bg-white/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sea-950">
            Libero
          </span>
        )}
      </>
    );
  };
}

function ScoreCard({
  label,
  onLabelChange,
  score,
  onScoreChange,
}: {
  label: string;
  onLabelChange: (value: string) => void;
  score: number;
  onScoreChange: Dispatch<SetStateAction<number>>;
}) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface p-4 text-center">
      <input
        value={label}
        onChange={(e) => onLabelChange(e.target.value)}
        className="w-full bg-transparent text-center text-xs font-bold uppercase tracking-wide text-foreground/55 outline-none focus:text-foreground"
      />
      <p className="mt-1.5 font-display text-5xl font-bold tabular-nums text-foreground sm:text-6xl">{score}</p>
      <div className="mt-3 flex items-center justify-center gap-2.5">
        <button
          type="button"
          onClick={() => onScoreChange((v) => Math.max(0, v - 1))}
          aria-label={`Togli un punto a ${label || "questa squadra"}`}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-border-subtle bg-surface text-foreground transition-colors active:bg-muted sm:hover:bg-muted"
        >
          <Minus className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => onScoreChange((v) => v + 1)}
          aria-label={`Aggiungi un punto a ${label || "questa squadra"}`}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors active:opacity-80 sm:hover:opacity-90"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function TeamRotationControls({ team, idPrefix }: { team: TeamState; idPrefix: string }) {
  return (
    <div>
      <div className="flex gap-2">
        <Button onClick={team.rotate} size="lg" className="flex-1">
          <RotateCw className="h-4 w-4" />
          Ruota {team.label || idPrefix}
        </Button>
        <Button
          onClick={team.undoRotate}
          variant="outline"
          size="lg"
          disabled={team.history.length === 0}
          aria-label={`Annulla ultima rotazione ${team.label || idPrefix}`}
        >
          <Undo2 className="h-4 w-4" />
        </Button>
      </div>

      {team.liberoName.trim() && team.hostName.trim() && (
        <p className="mt-2.5 text-center text-xs text-muted-foreground">
          {isLiberoOnCourt(team.positions, team.hostName, team.liberoName)
            ? `${team.liberoName.trim()} in campo per ${team.hostName.trim()}`
            : hostPosition(team.positions, team.hostName)
              ? `${team.hostName.trim()} in campo, ${team.liberoName.trim()} a riposo`
              : `${team.hostName.trim()} non è più tra le titolari: aggiorna la formazione`}
        </p>
      )}
    </div>
  );
}

function LiberoFields({
  team,
  idPrefix,
  athleteNames,
}: {
  team: TeamState;
  idPrefix: string;
  athleteNames: string[];
}) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface p-3.5">
      <Label htmlFor={`${idPrefix}-libero`}>Libero {team.label} (opzionale)</Label>
      <PositionNameField
        id={`${idPrefix}-libero`}
        value={team.liberoName}
        onChange={team.setLiberoName}
        athleteNames={athleteNames}
        placeholder="Nome della libero"
      />
      {team.liberoName.trim() && (
        <div className="mt-3">
          <Label htmlFor={`${idPrefix}-host`}>Sostituisce in seconda linea</Label>
          <Select id={`${idPrefix}-host`} value={team.hostName} onChange={(e) => team.setHostName(e.target.value)}>
            <option value="">Scegli chi sostituisce…</option>
            {team.filledNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
          <FieldHint>
            La libero entra al suo posto ogni volta che è in seconda linea (posizioni 1, 5, 6), ed esce
            quando tocca a lei giocare a rete.
          </FieldHint>
        </div>
      )}
    </div>
  );
}

function isTeamStateEmpty(state: LiveScoreTeamState): boolean {
  return (
    state.positions.every((name) => name.trim() === "") &&
    state.liberoName.trim() === "" &&
    state.score === 0
  );
}

/**
 * Tabellone live per l'allenamento: pensato per tablet o computer a bordo
 * campo (vedi il gate `sm:hidden` più sotto), mai per telefono — due mezzi
 * campo e due tabelloni leggibili non ci stanno in una manciata di
 * centimetri. Il rotation undo è solo in memoria (si perde al ricaricare,
 * di proposito: è una comodità per la sessione in corso, non uno stato da
 * conservare), ma formazioni e punteggio si salvano in automatico su
 * Supabase per qualche ora — così un ricaricamento accidentale a bordo
 * campo non fa perdere l'allenamento in corso (vedi LIVE_SCORE_TTL_MS).
 */
export function LiveScoreClient({ athleteNames }: { athleteNames: string[] }) {
  const [started, setStarted] = useState(false);
  const [editingNames, setEditingNames] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const teamA = useTeamState("Squadra A");
  const teamB = useTeamState("Squadra B");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Al montaggio, ripristina l'eventuale allenamento salvato di recente
  // (entro LIVE_SCORE_TTL_MS): senza questo la pagina parte sempre vuota,
  // anche subito dopo un ricaricamento accidentale.
  useEffect(() => {
    let cancelled = false;
    fetch(LIVESCORE_API)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { state: LiveScoreState | null } | null) => {
        if (cancelled || !data?.state) return;
        teamA.hydrate(data.state.teamA);
        teamB.hydrate(data.state.teamB);
        setStarted(data.state.started);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Salvataggio automatico, con un breve debounce per non scrivere a ogni
  // tasto premuto. Salta finché non è finito il ripristino iniziale (evita
  // di sovrascrivere un allenamento salvato con lo stato vuoto di partenza)
  // e quando non c'è ancora nulla da salvare.
  useEffect(() => {
    if (!loaded) return;
    if (isTeamStateEmpty(teamA.snapshot) && isTeamStateEmpty(teamB.snapshot) && !started) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const state: LiveScoreState = { started, teamA: teamA.snapshot, teamB: teamB.snapshot };
      fetch(LIVESCORE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      }).catch(() => {});
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, started, teamA.snapshot, teamB.snapshot]);

  function handleStart() {
    setStarted(true);
    setEditingNames(false);
  }

  function handleNewMatch() {
    if (!window.confirm("Iniziare un nuovo allenamento? Punteggi e formazioni attuali andranno persi.")) return;
    setStarted(false);
    setEditingNames(false);
    teamA.reset();
    teamB.reset();
    fetch(LIVESCORE_API, { method: "DELETE" }).catch(() => {});
  }

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

      <div className="hidden sm:block">
        {!started ? (
          <div className="space-y-5">
            <div>
              <p className="eyebrow">
                <Volleyball className="h-3 w-3" />
                Live score
              </p>
              <h1 className="mt-1.5 font-display text-2xl font-bold text-foreground">Imposta le due squadre</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Scegli i nomi nelle 6 posizioni di ciascuna squadra come sono disposte in campo, poi indica le
                libero (se le usi).
              </p>
            </div>

            <DualLiveScoreCourt
              renderCellA={renderTeamCell(teamA, true, athleteNames)}
              renderCellB={renderTeamCell(teamB, true, athleteNames)}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <LiberoFields team={teamA} idPrefix="a-setup" athleteNames={athleteNames} />
              <LiberoFields team={teamB} idPrefix="b-setup" athleteNames={athleteNames} />
            </div>

            <Button onClick={handleStart} size="lg" className="w-full">
              <Volleyball className="h-4 w-4" />
              Inizia
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">
                  <Volleyball className="h-3 w-3" />
                  Live score
                </p>
                <h1 className="mt-1.5 font-display text-2xl font-bold text-foreground">In campo</h1>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditingNames((v) => !v)}>
                  <Pencil className="h-3.5 w-3.5" />
                  {editingNames ? "Fatto" : "Modifica formazioni"}
                </Button>
                <Button variant="ghost" size="sm" onClick={handleNewMatch}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Nuovo allenamento
                </Button>
              </div>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <ScoreCard label={teamA.label} onLabelChange={teamA.setLabel} score={teamA.score} onScoreChange={teamA.setScore} />
              <ScoreCard label={teamB.label} onLabelChange={teamB.setLabel} score={teamB.score} onScoreChange={teamB.setScore} />
            </div>

            <DualLiveScoreCourt
              renderCellA={renderTeamCell(teamA, editingNames, athleteNames)}
              renderCellB={renderTeamCell(teamB, editingNames, athleteNames)}
            />

            {editingNames && (
              <div className="grid gap-4 sm:grid-cols-2">
                <LiberoFields team={teamA} idPrefix="a-live" athleteNames={athleteNames} />
                <LiberoFields team={teamB} idPrefix="b-live" athleteNames={athleteNames} />
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <TeamRotationControls team={teamA} idPrefix="Squadra A" />
              <TeamRotationControls team={teamB} idPrefix="Squadra B" />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

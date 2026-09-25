"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Minus, Pencil, Plus, RefreshCw, RotateCw, Undo2, Volleyball } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, FieldHint } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { DualLiveScoreCourt } from "./LiveScoreCourt";
import type { CourtPosition } from "@/lib/types";

/** I sei nomi "titolari" della rotazione, indicizzati per posizione
 * (positions[0] = posizione 1, ... positions[5] = posizione 6). Il libero
 * non è mai uno di questi sei: sostituisce solo visivamente chi è in
 * seconda linea (vedi cellDisplay), esattamente come nel regolamento. */
type Positions = [string, string, string, string, string, string];

const EMPTY_POSITIONS: Positions = ["", "", "", "", "", ""];
/** Seconda linea (fondo campo): la libero può giocare solo qui. */
const BACK_ROW: readonly CourtPosition[] = [1, 5, 6];

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

/** Tutto lo stato di una delle due squadre sul campo: formazione, libero,
 * punteggio e storico rotazioni (per l'annulla). Le due squadre sono
 * indipendenti l'una dall'altra — ognuna ha la propria rotazione perché a
 * un allenamento a due squadre si gira separatamente. */
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
  };
}

type TeamState = ReturnType<typeof useTeamState>;

function renderTeamCell(team: TeamState, editing: boolean) {
  return function TeamCell(position: CourtPosition) {
    if (editing) {
      return (
        <input
          value={team.positions[position - 1]}
          onChange={(e) => team.updatePosition(position, e.target.value)}
          placeholder={`Pos. ${position}`}
          className="w-full rounded-full bg-white/95 px-2 py-1.5 text-center text-[11px] font-bold text-sea-950 shadow-sm outline-none placeholder:text-sea-950/35 focus:ring-2 focus:ring-sea-700 sm:text-xs"
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

function LiberoFields({ team, idPrefix }: { team: TeamState; idPrefix: string }) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface p-3.5">
      <Label htmlFor={`${idPrefix}-libero`}>Libero {team.label} (opzionale)</Label>
      <Input
        id={`${idPrefix}-libero`}
        value={team.liberoName}
        onChange={(e) => team.setLiberoName(e.target.value)}
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

/**
 * Tabellone live per l'allenamento: niente salvataggio, tutto nello stato
 * del componente (si perde al ricaricare la pagina, di proposito). A
 * allenamento si gioca quasi sempre con due squadre sullo stesso campo, per
 * questo il tabellone segue entrambe le rotazioni in parallelo, fianco a
 * fianco con la rete al centro. Pensato per tablet o computer a bordo
 * campo, mai per telefono (vedi il gate `sm:hidden` più sotto) — due mezzi
 * campo e due tabelloni leggibili non ci stanno in una manciata di
 * centimetri.
 */
export function LiveScoreClient() {
  const [started, setStarted] = useState(false);
  const [editingNames, setEditingNames] = useState(false);
  const teamA = useTeamState("Squadra A");
  const teamB = useTeamState("Squadra B");

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
                Scrivi i nomi nelle 6 posizioni di ciascuna squadra come sono disposte in campo, poi indica le
                libero (se le usi).
              </p>
            </div>

            <DualLiveScoreCourt
              renderCellA={renderTeamCell(teamA, true)}
              renderCellB={renderTeamCell(teamB, true)}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <LiberoFields team={teamA} idPrefix="a-setup" />
              <LiberoFields team={teamB} idPrefix="b-setup" />
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
              renderCellA={renderTeamCell(teamA, editingNames)}
              renderCellB={renderTeamCell(teamB, editingNames)}
            />

            {editingNames && (
              <div className="grid gap-4 sm:grid-cols-2">
                <LiberoFields team={teamA} idPrefix="a-live" />
                <LiberoFields team={teamB} idPrefix="b-live" />
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

"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Minus, Pencil, Plus, RefreshCw, RotateCw, Undo2, Volleyball } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, FieldHint } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { LiveScoreCourt } from "./LiveScoreCourt";
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

function ScoreCard({
  label,
  onLabelChange,
  score,
  onScoreChange,
  emphasize = false,
}: {
  label: string;
  onLabelChange: (value: string) => void;
  score: number;
  onScoreChange: Dispatch<SetStateAction<number>>;
  emphasize?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 text-center",
        emphasize ? "border-primary/25 bg-primary/5" : "border-border-subtle bg-surface",
      )}
    >
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

/**
 * Tabellone live per l'allenamento: niente salvataggio, tutto nello stato
 * del componente (si perde al ricaricare la pagina, di proposito). Pensato
 * per tablet o computer a bordo campo, mai per telefono (vedi il gate
 * `sm:hidden` più sotto) — un campo completo e un tabellone leggibile non
 * ci stanno in una manciata di centimetri.
 */
export function LiveScoreClient() {
  const [started, setStarted] = useState(false);
  const [editingNames, setEditingNames] = useState(false);
  const [positions, setPositions] = useState<Positions>(EMPTY_POSITIONS);
  const [liberoName, setLiberoName] = useState("");
  const [hostName, setHostName] = useState("");
  const [history, setHistory] = useState<Positions[]>([]);
  const [scoreUs, setScoreUs] = useState(0);
  const [scoreThem, setScoreThem] = useState(0);
  const [teamLabel, setTeamLabel] = useState("Noi");
  const [opponentLabel, setOpponentLabel] = useState("Avversarie");

  const filledNames = useMemo(() => positions.map((n) => n.trim()).filter(Boolean), [positions]);

  function updatePosition(position: CourtPosition, value: string) {
    setPositions((prev) => {
      const next = [...prev] as Positions;
      next[position - 1] = value;
      return next;
    });
  }

  function handleStart() {
    setStarted(true);
    setEditingNames(false);
  }

  function handleRotate() {
    setHistory((prev) => [...prev, positions]);
    setPositions((prev) => rotateOnce(prev));
  }

  function handleUndoRotate() {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      setPositions(prev[prev.length - 1]);
      return prev.slice(0, -1);
    });
  }

  function handleNewMatch() {
    if (!window.confirm("Iniziare una nuova partita? Punteggio e formazione attuali andranno persi.")) return;
    setStarted(false);
    setEditingNames(false);
    setPositions(EMPTY_POSITIONS);
    setLiberoName("");
    setHostName("");
    setHistory([]);
    setScoreUs(0);
    setScoreThem(0);
  }

  const liberoFields = (idPrefix: string) => (
    <div className="rounded-2xl border border-border-subtle bg-surface p-3.5">
      <Label htmlFor={`${idPrefix}-libero`}>Libero (opzionale)</Label>
      <Input
        id={`${idPrefix}-libero`}
        value={liberoName}
        onChange={(e) => setLiberoName(e.target.value)}
        placeholder="Nome della libero"
      />
      {liberoName.trim() && (
        <div className="mt-3">
          <Label htmlFor={`${idPrefix}-host`}>Sostituisce in seconda linea</Label>
          <Select id={`${idPrefix}-host`} value={hostName} onChange={(e) => setHostName(e.target.value)}>
            <option value="">Scegli chi sostituisce…</option>
            {filledNames.map((name) => (
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

  return (
    <>
      <div className="rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-12 text-center sm:hidden">
        <Volleyball className="mx-auto h-8 w-8 text-foreground/30" />
        <p className="mt-3 font-display text-base font-bold text-foreground">Serve uno schermo più grande</p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Il live score è pensato per tablet o computer, per avere il campo e il tabellone ben leggibili a
          bordo campo durante l&apos;allenamento.
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
              <h1 className="mt-1.5 font-display text-2xl font-bold text-foreground">Imposta la formazione</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Scrivi i nomi nelle 6 posizioni come sono disposte in campo, poi indica il libero (se la
                usi).
              </p>
            </div>

            <div className="mx-auto w-full max-w-xs">
              <LiveScoreCourt
                renderCell={(position) => (
                  <input
                    value={positions[position - 1]}
                    onChange={(e) => updatePosition(position, e.target.value)}
                    placeholder={`Pos. ${position}`}
                    className="w-full rounded-full bg-white/95 px-2 py-1.5 text-center text-[11px] font-bold text-sea-950 shadow-sm outline-none placeholder:text-sea-950/35 focus:ring-2 focus:ring-sea-700 sm:text-xs"
                  />
                )}
              />
            </div>

            <div className="mx-auto w-full max-w-xs">{liberoFields("setup")}</div>

            <div className="mx-auto w-full max-w-xs">
              <Button onClick={handleStart} size="lg" className="w-full">
                <Volleyball className="h-4 w-4" />
                Inizia
              </Button>
            </div>
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
                  {editingNames ? "Fatto" : "Modifica formazione"}
                </Button>
                <Button variant="ghost" size="sm" onClick={handleNewMatch}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Nuova partita
                </Button>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[22rem_1fr] lg:items-start">
              <div className="mx-auto w-full max-w-xs lg:mx-0 lg:max-w-none">
                <LiveScoreCourt
                  renderCell={(position) => {
                    if (editingNames) {
                      return (
                        <input
                          value={positions[position - 1]}
                          onChange={(e) => updatePosition(position, e.target.value)}
                          placeholder={`Pos. ${position}`}
                          className="w-full rounded-full bg-white/95 px-2 py-1.5 text-center text-[11px] font-bold text-sea-950 shadow-sm outline-none placeholder:text-sea-950/35 focus:ring-2 focus:ring-sea-700 sm:text-xs"
                        />
                      );
                    }
                    const { name, isLibero } = cellDisplay(position, positions, hostName, liberoName);
                    return (
                      <>
                        {position === 1 && (
                          <span
                            className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-sea-950/70"
                            title="Al servizio"
                            aria-label="Al servizio"
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
                  }}
                />

                {editingNames && <div className="mt-3">{liberoFields("live")}</div>}

                <div className="mt-3 flex gap-2">
                  <Button onClick={handleRotate} size="lg" className="flex-1">
                    <RotateCw className="h-4 w-4" />
                    Ruota
                  </Button>
                  <Button
                    onClick={handleUndoRotate}
                    variant="outline"
                    size="lg"
                    disabled={history.length === 0}
                    aria-label="Annulla ultima rotazione"
                  >
                    <Undo2 className="h-4 w-4" />
                  </Button>
                </div>

                {liberoName.trim() && hostName.trim() && (
                  <p className="mt-2.5 text-center text-xs text-muted-foreground">
                    {isLiberoOnCourt(positions, hostName, liberoName)
                      ? `${liberoName.trim()} in campo per ${hostName.trim()}`
                      : hostPosition(positions, hostName)
                        ? `${hostName.trim()} in campo, ${liberoName.trim()} a riposo`
                        : `${hostName.trim()} non è più tra le titolari: aggiorna la formazione`}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3.5 self-start">
                <ScoreCard
                  label={teamLabel}
                  onLabelChange={setTeamLabel}
                  score={scoreUs}
                  onScoreChange={setScoreUs}
                  emphasize
                />
                <ScoreCard
                  label={opponentLabel}
                  onLabelChange={setOpponentLabel}
                  score={scoreThem}
                  onScoreChange={setScoreThem}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

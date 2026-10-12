"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight, Pencil, Plus, Volleyball, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { cleanNumber, opponentPlayer, type ScoutAction } from "@/lib/scout/actions";
import { benchOf, SUBSTITUTIONS_PER_SET, substitutionsUsed, substitutionWarningFor } from "@/lib/scout/court";
import type { ScoutCourt, ScoutView } from "@/lib/scout/derive";
import { playerLabel, shortName, sortPlayers } from "@/lib/scout/describe";
import { newId } from "@/lib/scout/id";
import type { ScoutData, ScoutPlayer, ScoutSide } from "@/lib/scout/types";

/** Come si legge una giocatrice sul campo: il numero di maglia (per noi, in mancanza, l'iniziale). */
function chipText(player: ScoutPlayer | undefined, side: ScoutSide): string {
  if (!player) return "?";
  return player.number ?? (side === "us" ? player.name.trim().slice(0, 1).toUpperCase() : "?");
}

/** Le posizioni come si vedono dalla propria metà campo: davanti 4-3-2, dietro 5-6-1. */
const ROWS: number[][] = [
  [4, 3, 2],
  [5, 6, 1],
];

/**
 * Una metà campo in piccolo: chi gioca in ogni posizione, con la libero in scuro
 * al posto di chi sostituisce e un pallone verde su chi batte.
 */
function MiniCourt({
  side,
  court,
  roster,
  serving,
}: {
  side: ScoutSide;
  court: ScoutCourt;
  roster: ScoutPlayer[];
  serving: boolean;
}) {
  return (
    <div className="grid gap-1" role="group" aria-label={side === "us" ? "Nostra squadra in campo" : "Avversaria in campo"} data-scout-court={side}>
      {ROWS.map((row, r) => (
        <div key={r} className="grid grid-cols-3 gap-1">
          {row.map((position) => {
            const id = court.onCourt[position - 1];
            const player = id ? roster.find((p) => p.id === id) : undefined;
            const isLibero = Boolean(id) && id === court.libero;
            const isServer = serving && position === 1;
            return (
              <div
                key={position}
                data-scout-court-position={position}
                data-scout-court-player={id || undefined}
                className={cn(
                  "relative flex h-11 min-w-0 flex-col items-center justify-center rounded-lg border text-center sm:h-12",
                  id ? (isLibero ? "border-foreground bg-foreground text-background" : "border-border bg-surface text-foreground") : "border-dashed border-border-strong bg-surface-muted/50 text-muted-foreground/60",
                  isServer && "ring-2 ring-green-500 ring-offset-1 ring-offset-card",
                )}
                title={id ? `${playerLabel({ us: side === "us" ? roster : [], opp: side === "opp" ? roster : [] }, side, id)} · posizione ${position}${isLibero ? " (libero)" : ""}` : `Posizione ${position}: vuota`}
              >
                <span className="absolute left-1 top-0.5 text-[9px] font-bold leading-none text-muted-foreground/70">{position}</span>
                <span className="tabular font-display text-[17px] font-extrabold leading-none">{id ? chipText(player, side) : "–"}</span>
                {isLibero && <span className="absolute bottom-0.5 text-[8px] font-bold uppercase leading-none tracking-wide opacity-80">libero</span>}
                {isServer && (
                  <span className="absolute -right-1 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-green-500 text-white shadow-sm" aria-label="Batte">
                    <Volleyball className="h-2.5 w-2.5" />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/**
 * Il cambio: si sceglie chi esce (tra chi è in campo) e chi entra (dalla
 * panchina; per l'avversaria si può scrivere un numero nuovo). Se il cambio non
 * rispetta le regole compare un avvertimento, ma si può confermare lo stesso.
 */
function SubstitutionSheet({
  side,
  data,
  view,
  dispatch,
  onClose,
}: {
  side: ScoutSide;
  data: ScoutData;
  view: ScoutView;
  dispatch: (action: ScoutAction) => void;
  onClose: () => void;
}) {
  const court = view.court[side] as ScoutCourt;
  const roster = data.roster[side];
  const bench = benchOf(roster, court);
  const [position, setPosition] = useState<1 | 2 | 3 | 4 | 5 | 6 | null>(null);
  const [incoming, setIncoming] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const used = substitutionsUsed(view, side);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const warning = position !== null && incoming ? substitutionWarningFor(data, view, side, position, incoming) : null;

  function addNumber() {
    const number = cleanNumber(typed);
    if (!number) return;
    const added = opponentPlayer(number);
    if (court.positions.includes(added.id)) return;
    dispatch({ type: "addPlayer", side: "opp", player: added });
    setIncoming(added.id);
    setTyped("");
  }

  function confirm() {
    if (position === null || !incoming) return;
    dispatch({ type: "sub", side, position, player: incoming, at: Date.now(), id: newId() });
    onClose();
  }

  const sideName = side === "us" ? "nostra squadra" : "avversaria";
  // Un'avversaria appena scritta non è ancora in panchina finché la rosa non si aggiorna: la si mostra comunque.
  const shownBench = incoming && !bench.some((p) => p.id === incoming) && roster.some((p) => p.id === incoming) ? sortPlayers([...bench, ...roster.filter((p) => p.id === incoming)]) : bench;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-sea-950/45 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Cambio: ${sideName}`}
        data-scout-sheet="sub"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border-subtle bg-surface p-4 shadow-[0_24px_60px_-20px_rgba(9,26,38,0.55)] sm:rounded-2xl sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold leading-tight text-foreground">
              <ArrowLeftRight className="h-5 w-5 text-primary" />
              Cambio · {side === "us" ? "noi" : "loro"}
            </h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {view.current?.n}° set · cambi fatti: <b className="text-foreground">{used}</b> su {SUBSTITUTIONS_PER_SET}
            </p>
          </div>
          <Button variant="quiet" size="icon-sm" onClick={onClose} aria-label="Chiudi">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-4">
          <p className="mb-1.5 text-[13px] font-semibold text-foreground/80">Chi esce</p>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Chi esce">
            {([1, 2, 3, 4, 5, 6] as const).map((pos) => {
              const id = court.positions[pos - 1];
              const player = id ? roster.find((p) => p.id === id) : undefined;
              const replacedByLibero = Boolean(id) && court.liberoFor === id;
              return (
                <button
                  key={pos}
                  type="button"
                  disabled={!id}
                  aria-pressed={position === pos}
                  onClick={() => setPosition(pos)}
                  data-scout-sub-out={pos}
                  className={cn(
                    "flex min-h-[3.5rem] min-w-0 flex-col items-center justify-center rounded-xl border px-1 py-1.5 text-center transition-colors disabled:opacity-40",
                    position === pos ? "border-primary bg-primary-soft ring-2 ring-primary/30" : "border-border-subtle bg-surface hover:bg-muted",
                  )}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Pos. {pos}</span>
                  <span className="tabular font-display text-xl font-extrabold leading-none text-foreground">{id ? chipText(player, side) : "–"}</span>
                  {replacedByLibero && <span className="text-[10px] text-muted-foreground">ora c&apos;è la libero</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-1.5 text-[13px] font-semibold text-foreground/80">Chi entra</p>
          {shownBench.length > 0 ? (
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5" role="group" aria-label="Chi entra">
              {shownBench.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  aria-pressed={incoming === player.id}
                  onClick={() => setIncoming(player.id)}
                  data-scout-sub-in={player.id}
                  className={cn(
                    "flex min-h-[3.25rem] min-w-0 flex-col items-center justify-center rounded-xl border px-1 py-1.5 text-center transition-colors",
                    incoming === player.id ? "border-primary bg-primary-soft ring-2 ring-primary/30" : "border-border-subtle bg-surface hover:bg-muted",
                  )}
                >
                  <span className="tabular font-display text-xl font-extrabold leading-none text-foreground">{chipText(player, side)}</span>
                  {side === "us" && <span className="mt-0.5 w-full truncate text-[11px] font-semibold text-muted-foreground">{shortName(player, roster)}</span>}
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-surface-muted px-3 py-2 text-sm text-muted-foreground">
              {side === "us" ? "Non c'è nessuna giocatrice in panchina: aggiungila da «Squadre e regole»." : "Scrivi qui sotto il numero di chi entra."}
            </p>
          )}
          {side === "opp" && (
            <div className="mt-2 flex gap-2">
              <Input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addNumber();
                  }
                }}
                inputMode="numeric"
                placeholder="Altro numero di maglia"
                aria-label="Numero di maglia di chi entra"
                data-scout-sub-number
                className="min-w-0"
              />
              <Button variant="outline" onClick={addNumber} disabled={!cleanNumber(typed)}>
                <Plus className="h-4 w-4" />
                Aggiungi
              </Button>
            </div>
          )}
        </div>

        {warning && (
          <p data-scout-sub-warning className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[13px] font-medium text-amber-950 ring-1 ring-amber-500/40">
            Attenzione: {warning} Puoi confermare lo stesso (per esempio per un infortunio).
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button onClick={confirm} disabled={position === null || !incoming} data-scout-sub-confirm>
            <ArrowLeftRight className="h-4 w-4" />
            Conferma cambio
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Chi è in campo, sopra i pulsanti dei punti: le due squadre (quelle di cui si
 * segue la formazione) con le rotazioni, chi batte, la libero e i cambi del set.
 * Si ruota da soli quando una squadra conquista la battuta.
 */
export function ScoutCourtStrip({
  data,
  view,
  locked,
  dispatch,
  onEditLineup,
}: {
  data: ScoutData;
  view: ScoutView;
  locked: boolean;
  dispatch: (action: ScoutAction) => void;
  onEditLineup: () => void;
}) {
  const [subSide, setSubSide] = useState<ScoutSide | null>(null);
  const sides = (["us", "opp"] as const).filter((side) => view.court[side]);
  if (sides.length === 0) return null;
  const server = view.current ? (view.current.rallies.length > 0 ? view.current.rallies[view.current.rallies.length - 1].winner : view.current.firstServer) : null;

  return (
    <section
      aria-label="In campo"
      data-scout-court-strip
      data-tour="scout-court-strip"
      className="space-y-2.5 rounded-2xl border border-border bg-card p-3 shadow-card sm:p-4"
    >
      <header className="flex items-center justify-between gap-2">
        <h2 className="font-display text-[17px] font-extrabold leading-none tracking-[-0.01em] text-foreground">In campo</h2>
        <Button variant="outline" size="xs" onClick={onEditLineup} data-scout-edit-lineup>
          <Pencil className="h-3.5 w-3.5" />
          Formazione
        </Button>
      </header>
      <div className={cn("grid gap-3", sides.length === 2 ? "grid-cols-2" : "grid-cols-1 sm:max-w-xs")}>
        {sides.map((side) => {
          const court = view.court[side] as ScoutCourt;
          const used = substitutionsUsed(view, side);
          return (
            <div key={side} className="min-w-0 space-y-1.5">
              <div className="flex items-center justify-between gap-1">
                <p className={cn("text-[13px] font-bold", side === "us" ? "text-primary" : "text-accent-foreground")}>
                  {side === "us" ? "Noi" : "Loro"}
                  <span className="ml-1.5 font-semibold text-muted-foreground" title="Rotazione: 1ª è la formazione di partenza, poi si ruota quando si conquista la battuta">
                    {court.rotation}ª rot.
                  </span>
                </p>
                {server === side && <span className="text-[10px] font-bold uppercase tracking-wide text-green-700">batte</span>}
              </div>
              <MiniCourt side={side} court={court} roster={data.roster[side]} serving={server === side} />
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-medium text-muted-foreground" title={`Cambi fatti nel set (${SUBSTITUTIONS_PER_SET} al massimo)`}>
                  Cambi {used}/{SUBSTITUTIONS_PER_SET}
                </span>
                <Button variant="outline" size="xs" disabled={locked} onClick={() => setSubSide(side)} data-scout-sub-open={side}>
                  <ArrowLeftRight className="h-3 w-3" />
                  Cambio
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      {subSide && view.court[subSide] && (
        <SubstitutionSheet side={subSide} data={data} view={view} dispatch={dispatch} onClose={() => setSubSide(null)} />
      )}
    </section>
  );
}
